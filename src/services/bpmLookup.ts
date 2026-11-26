import { SCHEMA_LIMITS } from '../types';
import { cleanArtistForSearch, cleanTitleForSearch } from './lyricsLookup';

export interface BpmDetectionResult {
  bpm: number;
  trackName: string;
  artistName: string;
  previewUrl: string;
  source: 'itunes-audio';
}

interface ITunesResult {
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  previewUrl?: string;
}

interface ITunesSearchResponse {
  results?: ITunesResult[];
}

const bpmCache = new Map<string, BpmDetectionResult>();

function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreITunesMatch(
  item: ITunesResult,
  targetTitle: string,
  targetArtist: string
): number {
  let score = 0;
  const trackNorm = normalizeText(item.trackName || '');
  const artistNorm = normalizeText(item.artistName || '');
  const titleNorm = normalizeText(targetTitle);
  const targetArtistNorm = normalizeText(targetArtist).replace(/^the\s+/, '');

  if (titleNorm && trackNorm === titleNorm) score += 55;
  else if (titleNorm && trackNorm.includes(titleNorm)) score += 32;

  if (targetArtistNorm) {
    const cleanRecArtist = artistNorm.replace(/^the\s+/, '');
    if (cleanRecArtist === targetArtistNorm) score += 50;
    else if (
      cleanRecArtist.includes(targetArtistNorm) ||
      targetArtistNorm.includes(cleanRecArtist)
    ) {
      score += 28;
    }
  }

  const combined = `${item.trackName || ''} ${item.collectionName || ''}`.toLowerCase();
  if (/\b(karaoke|instrumental|sped up|slowed|8d|nightcore|remix|lullaby|piano version)\b/.test(combined)) {
    score -= 40;
  }
  if (/\b(live|acoustic|tribute)\b/.test(combined)) {
    score -= 12;
  }

  return score;
}

async function findStudioPreview(
  title: string,
  artist: string,
  signal?: AbortSignal
): Promise<ITunesResult | null> {
  const cleanTitle = cleanTitleForSearch(title);
  const cleanArtist = cleanArtistForSearch(artist);
  if (!cleanTitle) return null;

  const queries: string[] = [];
  if (cleanArtist) {
    queries.push(`${cleanTitle} ${cleanArtist}`);
  }
  queries.push(cleanTitle);

  for (const term of queries) {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=6`;
    const res = await fetch(url, { method: 'GET', signal });
    if (!res.ok) continue;
    const data = (await res.json()) as ITunesSearchResponse;
    const candidates = (data.results || []).filter(
      (r) => typeof r.previewUrl === 'string' && r.previewUrl.length > 0
    );
    if (candidates.length === 0) continue;

    candidates.sort(
      (a, b) =>
        scoreITunesMatch(b, cleanTitle, cleanArtist) -
        scoreITunesMatch(a, cleanTitle, cleanArtist)
    );
    return candidates[0];
  }

  return null;
}

function estimateBpmFromAudioBuffer(buffer: AudioBuffer): number {
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const channels = buffer.numberOfChannels;

  // Mix down to mono
  const mono = new Float32Array(length);
  for (let ch = 0; ch < channels; ch += 1) {
    const chData = buffer.getChannelData(ch);
    const scale = 1 / channels;
    for (let i = 0; i < length; i += 1) {
      mono[i] += chData[i] * scale;
    }
  }

  // Dual-band onset envelope at 100 frames/sec (10ms hop)
  const fps = 100;
  const hopSize = Math.max(1, Math.round(sampleRate / fps));
  const numFrames = Math.floor(length / hopSize);
  if (numFrames < 200) return 110;

  // Simple 1-pole low-pass (~180 Hz) to separate kick/bass pulse from snare/strum transients
  const rc = 1 / (2 * Math.PI * 180);
  const dt = 1 / sampleRate;
  const alpha = dt / (rc + dt);

  const lowEnergy = new Float32Array(numFrames);
  const highEnergy = new Float32Array(numFrames);

  let lpState = 0;
  for (let f = 0; f < numFrames; f += 1) {
    const start = f * hopSize;
    const end = start + hopSize;
    let lowSum = 0;
    let highSum = 0;
    for (let i = start; i < end; i += 1) {
      const sample = mono[i];
      lpState += alpha * (sample - lpState);
      const hp = sample - lpState;
      lowSum += lpState * lpState;
      highSum += hp * hp;
    }
    lowEnergy[f] = Math.sqrt(lowSum / hopSize);
    highEnergy[f] = Math.sqrt(highSum / hopSize);
  }

  // Half-wave rectified positive onset flux for both bands
  const lowFlux = new Float32Array(numFrames);
  const highFlux = new Float32Array(numFrames);
  let lowFluxMean = 0;
  let highFluxMean = 0;

  for (let f = 1; f < numFrames; f += 1) {
    const dl = lowEnergy[f] - lowEnergy[f - 1];
    const dh = highEnergy[f] - highEnergy[f - 1];
    if (dl > 0) {
      lowFlux[f] = dl;
      lowFluxMean += dl;
    }
    if (dh > 0) {
      highFlux[f] = dh;
      highFluxMean += dh;
    }
  }

  lowFluxMean = lowFluxMean / numFrames || 1;
  highFluxMean = highFluxMean / numFrames || 1;

  const combined = new Float32Array(numFrames);
  for (let f = 0; f < numFrames; f += 1) {
    combined[f] = 0.65 * (lowFlux[f] / lowFluxMean) + 0.35 * (highFlux[f] / highFluxMean);
  }

  // Adaptive local mean subtraction (150ms window) to isolate crisp rhythmic onsets
  const onset = new Float32Array(numFrames);
  const halfWin = 7;
  for (let f = 0; f < numFrames; f += 1) {
    const s = Math.max(0, f - halfWin);
    const e = Math.min(numFrames - 1, f + halfWin);
    let sum = 0;
    for (let k = s; k <= e; k += 1) sum += combined[k];
    const avg = sum / (e - s + 1);
    const val = combined[f] - avg * 1.05;
    onset[f] = val > 0 ? val : 0;
  }

  // Interpolated autocorrelation helper
  const autocorrAtLag = (lagFloat: number): number => {
    const lag0 = Math.floor(lagFloat);
    const frac = lagFloat - lag0;
    const maxF = numFrames - lag0 - 2;
    if (lag0 < 1 || maxF <= 20) return 0;
    let sum = 0;
    for (let f = 0; f < maxF; f += 1) {
      const delayed = onset[f + lag0] * (1 - frac) + onset[f + lag0 + 1] * frac;
      sum += onset[f] * delayed;
    }
    return sum / maxF;
  };

  // Evaluate candidate BPMs from 60 to 190 in 0.5 BPM increments with harmonic reinforcement
  let bestBpm = 110;
  let bestScore = -1;

  for (let bpm = 60; bpm <= 190; bpm += 0.5) {
    const lag = (60 * fps) / bpm;
    const r1 = autocorrAtLag(lag);
    const r2 = autocorrAtLag(lag * 2);
    const rHalf = autocorrAtLag(lag * 0.5);

    // Gentle log-normal perceptual prior centered at ~114 BPM to avoid octave ambiguity
    const logDist = Math.log2(bpm / 114);
    const prior = Math.exp(-0.5 * (logDist / 0.58) * (logDist / 0.58));

    const score = (r1 + 0.5 * r2 + 0.25 * rHalf) * prior;
    if (score > bestScore) {
      bestScore = score;
      bestBpm = bpm;
    }
  }

  const rounded = Math.round(bestBpm);
  return Math.max(SCHEMA_LIMITS.BPM_MIN, Math.min(SCHEMA_LIMITS.BPM_MAX, rounded));
}

export async function detectSongBpm(
  title: string,
  artist: string,
  signal?: AbortSignal
): Promise<BpmDetectionResult> {
  const cleanTitle = cleanTitleForSearch(title);
  const cleanArtist = cleanArtistForSearch(artist);
  if (!cleanTitle) {
    throw new Error('Enter a song title first to detect BPM.');
  }

  const cacheKey = `${cleanTitle.toLowerCase()}||${cleanArtist.toLowerCase()}`;
  const cached = bpmCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const match = await findStudioPreview(cleanTitle, cleanArtist, signal);
  if (!match || !match.previewUrl) {
    throw new Error(`Could not find an audio preview for "${cleanTitle}".`);
  }

  const audioRes = await fetch(match.previewUrl, { method: 'GET', signal });
  if (!audioRes.ok) {
    throw new Error('Unable to download studio audio preview for BPM analysis.');
  }
  const arrayBuffer = await audioRes.arrayBuffer();
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) {
    throw new Error('Web Audio API is not supported in this browser.');
  }

  const ctx = new AudioCtx();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const bpm = estimateBpmFromAudioBuffer(audioBuffer);
    const result: BpmDetectionResult = {
      bpm,
      trackName: match.trackName || cleanTitle,
      artistName: match.artistName || cleanArtist || 'Unknown artist',
      previewUrl: match.previewUrl,
      source: 'itunes-audio',
    };
    bpmCache.set(cacheKey, result);
    return result;
  } finally {
    await ctx.close().catch(() => undefined);
  }
}
