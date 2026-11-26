import { SCHEMA_LIMITS } from '../types';

export interface LyricsMatch {
  id: string;
  trackName: string;
  artistName: string;
  albumName?: string;
  lyrics: string;
  source: 'lrclib' | 'lyrics.ovh';
}

interface LrcLibRecord {
  id?: number;
  name?: string;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

const PLACEHOLDER_SIGNATURES = [
  'Opening line cue — bright lead riff',
  'Smooth R&B pocket — let electric piano',
  'Gentle power-ballad opening with',
  'Crisp arpeggiated rhythm on Guitar 1',
  'Driving snare roll cue — full stadium',
  'Add your lyrics here with',
  'Second phrase lift — steady eighth-note',
  'Full harmonic stack — Vocals 1 lead',
  'Soaring chorus melody — big crash',
  'Welcome lift — bright major contrast',
];

const lyricsCache = new Map<string, LyricsMatch[]>();

export function isPlaceholderLyrics(text: string | undefined | null): boolean {
  if (!text || !text.trim()) return true;
  return PLACEHOLDER_SIGNATURES.some((sig) => text.includes(sig));
}

export function cleanArtistForSearch(artist: string): string {
  return artist
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\b(cover|feat\.?|ft\.?|version|live)\b.*$/i, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanTitleForSearch(title: string): string {
  return title
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripLrcTimestamps(synced: string): string {
  return synced
    .split(/\r?\n/)
    .map((line) => line.replace(/\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/g, '').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeForMatch(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreMatch(record: LrcLibRecord, targetTitle: string, targetArtist: string): number {
  let score = 0;
  const trackNorm = normalizeForMatch(record.trackName || record.name || '');
  const artistNorm = normalizeForMatch(record.artistName || '');
  const titleNorm = normalizeForMatch(targetTitle);
  const targetArtistNorm = normalizeForMatch(targetArtist).replace(/^the\s+/, '');

  if (titleNorm && trackNorm === titleNorm) score += 50;
  else if (titleNorm && trackNorm.includes(titleNorm)) score += 30;

  if (targetArtistNorm) {
    const cleanRecArtist = artistNorm.replace(/^the\s+/, '');
    if (cleanRecArtist === targetArtistNorm) score += 45;
    else if (cleanRecArtist.includes(targetArtistNorm) || targetArtistNorm.includes(cleanRecArtist)) {
      score += 25;
    }
  }

  if (record.plainLyrics && record.plainLyrics.trim().length > 80) {
    score += 15;
  }

  const combined = `${record.trackName || ''} ${record.albumName || ''}`.toLowerCase();
  if (/\b(karaoke|instrumental|sped up|slowed|8d|nightcore|remix)\b/.test(combined)) {
    score -= 35;
  }
  if (/\b(live|acoustic|cover|tribute)\b/.test(combined)) {
    score -= 12;
  }

  return score;
}

async function queryLrcLib(queryText: string, signal?: AbortSignal): Promise<LrcLibRecord[]> {
  const url = `https://lrclib.net/api/search?q=${encodeURIComponent(queryText)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!res.ok) return [];
  const data: unknown = await res.json();
  return Array.isArray(data) ? (data as LrcLibRecord[]) : [];
}

async function queryLyricsOvh(
  artist: string,
  title: string,
  signal?: AbortSignal
): Promise<LyricsMatch | null> {
  if (!artist || !title) return null;
  try {
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
    const res = await fetch(url, { method: 'GET', signal });
    if (!res.ok) return null;
    const data = (await res.json()) as { lyrics?: string };
    const text = (data.lyrics || '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (text.length < 30) return null;
    return {
      id: `ovh-${artist}-${title}`,
      trackName: title,
      artistName: artist,
      lyrics: text.slice(0, SCHEMA_LIMITS.LYRICS_MAX),
      source: 'lyrics.ovh',
    };
  } catch {
    return null;
  }
}

export async function fetchLyricsMatches(
  title: string,
  artist: string,
  signal?: AbortSignal
): Promise<LyricsMatch[]> {
  const cleanTitle = cleanTitleForSearch(title);
  const cleanArtist = cleanArtistForSearch(artist);
  if (!cleanTitle) return [];

  const cacheKey = `${cleanTitle.toLowerCase()}||${cleanArtist.toLowerCase()}`;
  const cached = lyricsCache.get(cacheKey);
  if (cached && cached.length > 0) {
    return cached;
  }

  const queries: string[] = [];
  if (cleanArtist) {
    queries.push(`${cleanTitle} ${cleanArtist}`);
    const noTheArtist = cleanArtist.replace(/^the\s+/i, '').trim();
    if (noTheArtist && noTheArtist !== cleanArtist) {
      queries.push(`${cleanTitle} ${noTheArtist}`);
    }
  }
  queries.push(cleanTitle);

  const collected: LrcLibRecord[] = [];
  for (const q of queries) {
    try {
      const records = await queryLrcLib(q, signal);
      const valid = records.filter(
        (r) => !r.instrumental && ((r.plainLyrics && r.plainLyrics.trim().length >= 40) || (r.syncedLyrics && r.syncedLyrics.trim().length >= 40))
      );
      if (valid.length > 0) {
        collected.push(...valid);
        break;
      }
    } catch (err) {
      if (signal?.aborted) throw err;
    }
  }

  const seenFingerprints = new Set<string>();
  const scored = collected
    .map((rec) => {
      const raw =
        rec.plainLyrics && rec.plainLyrics.trim().length >= 40
          ? rec.plainLyrics.replace(/\r\n/g, '\n').trim()
          : stripLrcTimestamps(rec.syncedLyrics || '');
      return {
        rec,
        lyrics: raw.slice(0, SCHEMA_LIMITS.LYRICS_MAX),
        score: scoreMatch(rec, cleanTitle, cleanArtist),
      };
    })
    .filter((item) => item.lyrics.length >= 40)
    .sort((a, b) => b.score - a.score);

  const matches: LyricsMatch[] = [];
  for (const item of scored) {
    const fingerprint = normalizeForMatch(item.lyrics.slice(0, 140));
    if (seenFingerprints.has(fingerprint)) continue;
    seenFingerprints.add(fingerprint);
    matches.push({
      id: `lrc-${item.rec.id ?? matches.length}`,
      trackName: item.rec.trackName || item.rec.name || cleanTitle,
      artistName: item.rec.artistName || cleanArtist || 'Unknown artist',
      albumName: item.rec.albumName || undefined,
      lyrics: item.lyrics,
      source: 'lrclib',
    });
    if (matches.length >= 6) break;
  }

  if (matches.length === 0 && cleanArtist) {
    const ovh = await queryLyricsOvh(cleanArtist, cleanTitle, signal);
    if (ovh) {
      matches.push(ovh);
    }
  }

  if (matches.length > 0) {
    lyricsCache.set(cacheKey, matches);
  }

  return matches;
}
