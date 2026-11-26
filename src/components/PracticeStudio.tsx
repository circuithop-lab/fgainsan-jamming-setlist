import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ExternalLink,
  FileMusic,
  AlignLeft,
  Minus,
  Plus,
  Edit3,
  Save,
  X,
  ChevronDown,
  Columns2,
  Rows2,
  RefreshCw,
  Check,
  Loader2,
  Play,
  Pause,
  Square,
  ArrowUpToLine,
  Volume2,
  VolumeX,
  Timer,
} from 'lucide-react';
import {
  GrooveStyle,
  INSTRUMENT_SLOTS,
  SCHEMA_LIMITS,
  Song,
} from '../types';
import {
  buildFallbackChordsUrl,
  buildFallbackLyricsUrl,
  parseChordPro,
  transposeChord,
} from '../utils/chords';
import {
  fetchLyricsMatches,
  isPlaceholderLyrics,
  LyricsMatch,
} from '../services/lyricsLookup';
import {
  StudioMetronome,
  TIME_SIGNATURE_BEATS,
  TimeSignature,
} from '../utils/metronome';

interface PracticeStudioProps {
  songs: Song[];
  selectedSongId: string | null;
  onBackToSetlist: () => void;
  onSelectSong: (songId: string) => void;
  onUpdateSongChart: (
    songId: string,
    patch: {
      keyChord: string;
      bpm: number;
      grooveStyle: GrooveStyle;
      chordProgression: string[];
      lyricsWithChords: string;
      referenceUrl: string;
      chordsUrl: string;
      lyricsUrl?: string;
    }
  ) => Promise<void>;
  onAddSong: () => void;
  onNotify: (msg: string) => void;
}

const TIME_SIGNATURES: TimeSignature[] = ['4/4', '3/4', '6/8'];

export const PracticeStudio: React.FC<PracticeStudioProps> = ({
  songs,
  selectedSongId,
  onBackToSetlist,
  onSelectSong,
  onUpdateSongChart,
  onAddSong,
  onNotify,
}) => {
  const song = useMemo(
    () => songs.find((s) => s.id === selectedSongId) || songs[0] || null,
    [songs, selectedSongId]
  );

  // Reader & Auto-Scroll controls
  const [transpose, setTranspose] = useState(0);
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [twoColumns, setTwoColumns] = useState(false);
  const [autoScroll, setAutoScroll] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(1.0);
  const lyricsScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollFloatRef = useRef(0);

  // Studio Metronome state
  const [metroPlaying, setMetroPlaying] = useState(false);
  const [metroBpm, setMetroBpm] = useState(song?.bpm || 110);
  const [metroTimeSig, setMetroTimeSig] = useState<TimeSignature>('4/4');
  const [metroMuted, setMetroMuted] = useState(false);
  const [activeBeat, setActiveBeat] = useState<number>(-1);
  const metroRef = useRef<StudioMetronome | null>(null);
  const tapTimesRef = useRef<number[]>([]);

  // Live lyrics lookup state
  const [fetchedMatches, setFetchedMatches] = useState<LyricsMatch[]>([]);
  const [selectedMatchIdx, setSelectedMatchIdx] = useState(0);
  const [fetchingLyrics, setFetchingLyrics] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [useFetchedPreview, setUseFetchedPreview] = useState(false);
  const [savingFetched, setSavingFetched] = useState(false);

  // Inline editor state
  const [editingChart, setEditingChart] = useState(false);
  const [draftKey, setDraftKey] = useState('');
  const [draftBpm, setDraftBpm] = useState(110);
  const [draftChordsText, setDraftChordsText] = useState('');
  const [draftLyrics, setDraftLyrics] = useState('');
  const [draftRefUrl, setDraftRefUrl] = useState('');
  const [draftChordsUrl, setDraftChordsUrl] = useState('');
  const [draftLyricsUrl, setDraftLyricsUrl] = useState('');
  const [savingChart, setSavingChart] = useState(false);

  // Initialize and dispose metronome engine
  useEffect(() => {
    const engine = new StudioMetronome({
      onBeat: (beatIdx) => {
        setActiveBeat(beatIdx);
      },
    });
    metroRef.current = engine;
    return () => {
      engine.dispose();
      metroRef.current = null;
    };
  }, []);

  // Sync metronome parameters in real time
  useEffect(() => {
    metroRef.current?.setBpm(metroBpm);
  }, [metroBpm]);

  useEffect(() => {
    metroRef.current?.setTimeSignature(metroTimeSig);
  }, [metroTimeSig]);

  useEffect(() => {
    metroRef.current?.setMuted(metroMuted);
  }, [metroMuted]);

  const stopMetronome = useCallback(() => {
    metroRef.current?.stop();
    setMetroPlaying(false);
    setActiveBeat(-1);
  }, []);

  const toggleMetronome = useCallback(() => {
    if (!metroRef.current) return;
    if (metroPlaying) {
      stopMetronome();
    } else {
      metroRef.current.setMuted(metroMuted);
      metroRef.current.start(metroBpm, metroTimeSig);
      setMetroPlaying(true);
    }
  }, [metroPlaying, metroMuted, metroBpm, metroTimeSig, stopMetronome]);

  const handleAdjustBpm = (delta: number) => {
    setMetroBpm((prev) =>
      Math.max(SCHEMA_LIMITS.BPM_MIN, Math.min(SCHEMA_LIMITS.BPM_MAX, prev + delta))
    );
  };

  const handleTapTempo = () => {
    const now = performance.now();
    const taps = tapTimesRef.current;
    if (taps.length > 0 && now - taps[taps.length - 1] > 2200) {
      tapTimesRef.current = [now];
      return;
    }
    taps.push(now);
    if (taps.length > 5) taps.shift();
    if (taps.length >= 2) {
      let sum = 0;
      for (let i = 1; i < taps.length; i += 1) {
        sum += taps[i] - taps[i - 1];
      }
      const avgMs = sum / (taps.length - 1);
      if (avgMs > 0) {
        const nextBpm = Math.round(60000 / avgMs);
        setMetroBpm(
          Math.max(SCHEMA_LIMITS.BPM_MIN, Math.min(SCHEMA_LIMITS.BPM_MAX, nextBpm))
        );
      }
    }
  };

  const cycleTimeSignature = () => {
    setMetroTimeSig((prev) => {
      const idx = TIME_SIGNATURES.indexOf(prev);
      return TIME_SIGNATURES[(idx + 1) % TIME_SIGNATURES.length];
    });
  };

  const hasSavedRealLyrics = useMemo(
    () => (song ? !isPlaceholderLyrics(song.lyricsWithChords) : false),
    [song?.lyricsWithChords]
  );

  const runLyricsLookup = useCallback(
    async (
      targetSong: Song,
      options?: { intoEditor?: boolean; signal?: AbortSignal; silent?: boolean }
    ) => {
      setFetchingLyrics(true);
      setFetchError(null);
      try {
        const matches = await fetchLyricsMatches(
          targetSong.title,
          targetSong.artist || '',
          options?.signal
        );
        if (options?.signal?.aborted) return;
        setFetchedMatches(matches);
        setSelectedMatchIdx(0);

        if (matches.length > 0) {
          if (options?.intoEditor) {
            setDraftLyrics(matches[0].lyrics);
            onNotify('Loaded lyrics into editor');
          } else {
            setUseFetchedPreview(true);
            if (!options?.silent) {
              onNotify(`Loaded lyrics for "${targetSong.title}"`);
            }
          }
        } else {
          setFetchError(
            `Could not find lyrics automatically for "${targetSong.title}". You can paste them using Edit Chords & Lyrics.`
          );
        }
      } catch {
        if (options?.signal?.aborted) return;
        setFetchError('Unable to fetch lyrics right now. Check your connection or paste them manually.');
      } finally {
        if (!options?.signal?.aborted) {
          setFetchingLyrics(false);
        }
      }
    },
    [onNotify]
  );

  // Reset reader & metronome controls only when switching to a different song
  useEffect(() => {
    setTranspose(0);
    setAutoScroll(false);
    setEditingChart(false);
    setFetchedMatches([]);
    setSelectedMatchIdx(0);
    setFetchError(null);
    setUseFetchedPreview(false);
    stopMetronome();
    tapTimesRef.current = [];
    if (song?.bpm) {
      setMetroBpm(song.bpm);
    }
    if (lyricsScrollRef.current) {
      lyricsScrollRef.current.scrollTop = 0;
      scrollFloatRef.current = 0;
    }
  }, [song?.id, stopMetronome]);

  // Keep metronome BPM synced if the user saves a new song BPM
  useEffect(() => {
    if (song?.bpm && !metroPlaying) {
      setMetroBpm(song.bpm);
    }
  }, [song?.bpm]);

  // Auto-fetch real lyrics when a song has empty or placeholder lyrics
  useEffect(() => {
    if (!song || hasSavedRealLyrics) return;

    const controller = new AbortController();
    void runLyricsLookup(song, { signal: controller.signal, silent: true });
    return () => controller.abort();
  }, [song?.id, song?.title, song?.artist, hasSavedRealLyrics, runLyricsLookup]);

  const toggleAutoScroll = useCallback(() => {
    if (editingChart) return;
    setAutoScroll((prev) => {
      const next = !prev;
      const el = lyricsScrollRef.current;
      if (next && el) {
        const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
        if (atBottom) {
          el.scrollTop = 0;
          scrollFloatRef.current = 0;
        } else {
          scrollFloatRef.current = el.scrollTop;
        }
      }
      return next;
    });
  }, [editingChart]);

  const scrollToTop = () => {
    const el = lyricsScrollRef.current;
    if (el) {
      el.scrollTo({ top: 0, behavior: 'smooth' });
      scrollFloatRef.current = 0;
    }
  };

  // Sub-pixel accurate smooth hands-free auto-scroll
  useEffect(() => {
    if (!autoScroll || editingChart) return;
    const el = lyricsScrollRef.current;
    if (!el) return;

    scrollFloatRef.current = el.scrollTop;
    let rafId = 0;
    let lastTs = performance.now();

    const step = (ts: number) => {
      const dt = Math.min((ts - lastTs) / 1000, 0.1);
      lastTs = ts;
      const container = lyricsScrollRef.current;
      if (container) {
        const maxScroll = container.scrollHeight - container.clientHeight;
        if (maxScroll <= 1) {
          setAutoScroll(false);
          return;
        }
        const pxPerSec = 32 * scrollSpeed;
        scrollFloatRef.current = Math.min(maxScroll, scrollFloatRef.current + pxPerSec * dt);
        container.scrollTop = scrollFloatRef.current;
        if (scrollFloatRef.current >= maxScroll - 0.5) {
          setAutoScroll(false);
          return;
        }
      }
      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [autoScroll, scrollSpeed, editingChart]);

  // Keyboard shortcuts: Space = Auto-Scroll, M = Metronome (when not typing)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingChart) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        toggleAutoScroll();
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        toggleMetronome();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingChart, toggleAutoScroll, toggleMetronome]);

  const activeFetchedMatch = fetchedMatches[selectedMatchIdx] || null;

  const displayedLyricsText = useMemo(() => {
    if (!song) return '';
    if (useFetchedPreview && activeFetchedMatch) {
      return activeFetchedMatch.lyrics;
    }
    if (hasSavedRealLyrics) {
      return song.lyricsWithChords;
    }
    if (activeFetchedMatch) {
      return activeFetchedMatch.lyrics;
    }
    return '';
  }, [song, useFetchedPreview, activeFetchedMatch, hasSavedRealLyrics]);

  const showingLiveFetched =
    Boolean(activeFetchedMatch) && (useFetchedPreview || !hasSavedRealLyrics);

  const startEditChart = () => {
    if (!song) return;
    setDraftKey(song.keyChord);
    setDraftBpm(song.bpm);
    setDraftChordsText((song.chordProgression || []).join('  '));
    setDraftLyrics(displayedLyricsText);
    setDraftRefUrl(song.referenceUrl);
    setDraftChordsUrl(song.chordsUrl);
    setDraftLyricsUrl(song.lyricsUrl || '');
    setAutoScroll(false);
    stopMetronome();
    setEditingChart(true);
  };

  const handleSaveFetchedToSetlist = async () => {
    if (!song || !activeFetchedMatch) return;
    setSavingFetched(true);
    try {
      await onUpdateSongChart(song.id, {
        keyChord: song.keyChord || 'C',
        bpm: song.bpm || 100,
        grooveStyle: song.grooveStyle || 'rock',
        chordProgression:
          song.chordProgression && song.chordProgression.length > 0
            ? song.chordProgression
            : [song.keyChord || 'C'],
        lyricsWithChords: activeFetchedMatch.lyrics.slice(0, SCHEMA_LIMITS.LYRICS_MAX),
        referenceUrl: song.referenceUrl || '',
        chordsUrl: song.chordsUrl || '',
        lyricsUrl: song.lyricsUrl || '',
      });
      setUseFetchedPreview(false);
      onNotify(`Saved lyrics for "${song.title}" to the band setlist`);
    } finally {
      setSavingFetched(false);
    }
  };

  const handleSaveChart = async () => {
    if (!song) return;
    setSavingChart(true);
    try {
      const nextKey = draftKey.trim() || 'C';
      const parsedChords = draftChordsText
        .split(/[\s,|·]+/)
        .map((c) => c.trim())
        .filter(Boolean)
        .slice(0, SCHEMA_LIMITS.CHORD_PROGRESSION_MAX);

      await onUpdateSongChart(song.id, {
        keyChord: nextKey,
        bpm: Math.max(
          SCHEMA_LIMITS.BPM_MIN,
          Math.min(SCHEMA_LIMITS.BPM_MAX, Number(draftBpm) || 100)
        ),
        grooveStyle: song.grooveStyle || 'rock',
        chordProgression: parsedChords.length > 0 ? parsedChords : [nextKey],
        lyricsWithChords: draftLyrics.slice(0, SCHEMA_LIMITS.LYRICS_MAX),
        referenceUrl: draftRefUrl.trim(),
        chordsUrl: draftChordsUrl.trim(),
        lyricsUrl: draftLyricsUrl.trim(),
      });
      setEditingChart(false);
      setUseFetchedPreview(false);
      onNotify('Chords & lyrics saved for the band');
    } finally {
      setSavingChart(false);
    }
  };

  const parsedLines = useMemo(
    () => parseChordPro(displayedLyricsText, transpose),
    [displayedLyricsText, transpose]
  );

  const transposedKey = song ? transposeChord(song.keyChord || 'C', transpose) : '';

  const transposedProgression = useMemo(() => {
    if (!song?.chordProgression || song.chordProgression.length === 0) return [];
    return song.chordProgression.map((ch) => transposeChord(ch, transpose));
  }, [song?.chordProgression, transpose]);

  const assignedRosterList = useMemo(() => {
    if (!song) return [];
    return INSTRUMENT_SLOTS.filter((slot) => song.assignments[slot.key]).map((slot) => ({
      slot: slot.label,
      name: song.assignments[slot.key],
    }));
  }, [song]);

  if (!song) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
        <p className="text-sm text-slate-400">
          Add a song to your setlist first to view and edit its chords and lyrics.
        </p>
        <button
          type="button"
          onClick={onAddSong}
          className="px-4 py-2 text-sm font-semibold bg-amber-500 text-[#0B0E14] rounded-lg hover:bg-amber-400 transition-colors"
        >
          Add First Song
        </button>
      </div>
    );
  }

  const fontSizeClasses = {
    sm: { chord: 'text-xs', lyric: 'text-sm leading-6' },
    md: { chord: 'text-sm', lyric: 'text-base leading-7' },
    lg: { chord: 'text-base', lyric: 'text-lg leading-8' },
  }[fontSize];

  const totalBeats = TIME_SIGNATURE_BEATS[metroTimeSig];

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col min-w-0 overflow-hidden">
      {/* Top Track Navigation & External Links */}
      <div className="px-5 lg:px-6 py-3 border-b border-white/[0.08] bg-[#0F131C] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackToSetlist}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#161C28] hover:bg-[#1F283A] border border-white/[0.08] text-slate-200 rounded-lg transition-colors whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Setlist</span>
          </button>

          <div className="relative min-w-[210px] max-w-xs sm:max-w-sm">
            <select
              aria-label="Select song"
              value={song.id}
              onChange={(e) => onSelectSong(e.target.value)}
              className="w-full appearance-none bg-[#161C28] border border-white/[0.1] rounded-lg pl-3 pr-9 py-1.5 text-sm font-semibold text-white focus:outline-none focus:border-amber-500/60 truncate"
            >
              {songs.map((s, idx) => (
                <option key={s.id} value={s.id} className="bg-[#131822]">
                  {idx + 1}. {s.title} — {s.artist || 'Unknown'}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 tabular-nums whitespace-nowrap">
            <span>
              Key <strong className="font-mono text-amber-400">{transposedKey}</strong>
              {transpose !== 0 && (
                <span className="text-slate-500 ml-1">
                  ({transpose > 0 ? `+${transpose}` : transpose})
                </span>
              )}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{metroBpm} BPM</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {song.referenceUrl && (
            <a
              href={song.referenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#161C28] hover:bg-[#1F283A] border border-white/[0.08] text-slate-200 rounded-lg transition-colors whitespace-nowrap"
            >
              <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
              <span>Reference</span>
            </a>
          )}
          <a
            href={song.chordsUrl || buildFallbackChordsUrl(song.title, song.artist)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#161C28] hover:bg-[#1F283A] border border-white/[0.08] text-slate-200 rounded-lg transition-colors whitespace-nowrap"
          >
            <FileMusic className="w-3.5 h-3.5 text-emerald-400" />
            <span>Chords / Tabs</span>
          </a>
          <a
            href={song.lyricsUrl || buildFallbackLyricsUrl(song.title, song.artist)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#161C28] hover:bg-[#1F283A] border border-white/[0.08] text-slate-200 rounded-lg transition-colors whitespace-nowrap"
          >
            <AlignLeft className="w-3.5 h-3.5 text-sky-400" />
            <span>Lyrics (Web)</span>
          </a>
        </div>
      </div>

      {/* Sheet Formatting Toolbar */}
      <div className="px-5 lg:px-6 py-2.5 border-b border-white/[0.08] bg-[#0B0E14] flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          {/* Transpose Control */}
          <div className="flex items-center gap-1 bg-[#131822] border border-white/[0.08] rounded-lg p-1">
            <button
              type="button"
              onClick={() => setTranspose((t) => Math.max(-6, t - 1))}
              aria-label="Transpose down half step"
              className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-white/[0.06]"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setTranspose(0)}
              title="Reset transpose"
              className="px-2 py-1 text-xs font-mono tabular-nums text-amber-400 hover:text-amber-300 whitespace-nowrap"
            >
              Transpose: {transpose === 0 ? 'Original' : transpose > 0 ? `+${transpose}` : transpose}
            </button>
            <button
              type="button"
              onClick={() => setTranspose((t) => Math.min(6, t + 1))}
              aria-label="Transpose up half step"
              className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-white/[0.06]"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Text Size */}
          {!editingChart && (
            <div className="flex items-center gap-0.5 p-1 bg-[#131822] border border-white/[0.08] rounded-lg">
              {(['sm', 'md', 'lg'] as const).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setFontSize(sz)}
                  className={`px-2 py-1 text-xs font-medium uppercase rounded transition-colors ${
                    fontSize === sz
                      ? 'bg-[#212A3B] text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          )}

          {/* 1-Col / 2-Col Music Stand Toggle */}
          {!editingChart && (
            <button
              type="button"
              onClick={() => setTwoColumns((v) => !v)}
              className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                twoColumns
                  ? 'bg-[#212A3B] border-white/[0.14] text-white'
                  : 'bg-[#131822] border-white/[0.08] text-slate-400 hover:text-white'
              }`}
              title="Toggle single or two-column sheet layout"
            >
              {twoColumns ? <Columns2 className="w-3.5 h-3.5" /> : <Rows2 className="w-3.5 h-3.5" />}
              <span>{twoColumns ? '2 Columns' : '1 Column'}</span>
            </button>
          )}
        </div>

        {/* Fetch / Edit / Save Controls */}
        {editingChart ? (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setEditingChart(false)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-[#1A2130] text-slate-300 hover:text-white rounded-lg whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
            <button
              type="button"
              disabled={savingChart}
              onClick={() => void handleSaveChart()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-amber-500 text-[#0B0E14] hover:bg-amber-400 rounded-lg disabled:opacity-60 whitespace-nowrap"
            >
              <Save className="w-3.5 h-3.5" />
              {savingChart ? 'Saving...' : 'Save Chords & Lyrics'}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={fetchingLyrics}
              onClick={() => void runLyricsLookup(song)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#131822] hover:bg-[#1A2130] border border-white/[0.08] text-slate-300 hover:text-white rounded-lg transition-colors whitespace-nowrap disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${fetchingLyrics ? 'animate-spin' : ''}`} />
              <span>{fetchingLyrics ? 'Fetching...' : 'Fetch Lyrics'}</span>
            </button>
            <button
              type="button"
              onClick={startEditChart}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-[#161C28] hover:bg-[#1F283A] border border-white/[0.1] text-white rounded-lg transition-colors whitespace-nowrap"
            >
              <Edit3 className="w-3.5 h-3.5 text-amber-400" />
              <span>Edit Chords &amp; Lyrics</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Scrollable Chords & Lyrics Sheet */}
      {editingChart ? (
        <div className="flex-1 overflow-y-auto px-5 lg:px-10 py-6">
          <div className="max-w-4xl mx-auto space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-400" htmlFor="chart-key">
                  Key
                </label>
                <input
                  id="chart-key"
                  type="text"
                  maxLength={SCHEMA_LIMITS.KEY_CHORD_MAX}
                  value={draftKey}
                  onChange={(e) => setDraftKey(e.target.value)}
                  className="w-full bg-[#131822] border border-white/[0.1] rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-amber-500/60"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400" htmlFor="chart-bpm">
                  BPM
                </label>
                <input
                  id="chart-bpm"
                  type="number"
                  min={SCHEMA_LIMITS.BPM_MIN}
                  max={SCHEMA_LIMITS.BPM_MAX}
                  value={draftBpm}
                  onChange={(e) => setDraftBpm(Number(e.target.value))}
                  className="w-full bg-[#131822] border border-white/[0.1] rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-white focus:outline-none focus:border-amber-500/60"
                />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-xs text-slate-400" htmlFor="chart-chords-prog">
                  Chord Progression (space separated, e.g. D C G D)
                </label>
                <input
                  id="chart-chords-prog"
                  type="text"
                  value={draftChordsText}
                  onChange={(e) => setDraftChordsText(e.target.value)}
                  placeholder="D C G D"
                  className="w-full bg-[#131822] border border-white/[0.1] rounded-lg px-3 py-2 text-sm font-mono text-amber-300 focus:outline-none focus:border-amber-500/60"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-400" htmlFor="chart-ref-url">
                  Reference Link
                </label>
                <input
                  id="chart-ref-url"
                  type="text"
                  maxLength={SCHEMA_LIMITS.URL_MAX}
                  value={draftRefUrl}
                  onChange={(e) => setDraftRefUrl(e.target.value)}
                  placeholder="https://youtube.com/..."
                  className="w-full bg-[#131822] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/60"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400" htmlFor="chart-chords-url">
                  Chords / Tabs Link
                </label>
                <input
                  id="chart-chords-url"
                  type="text"
                  maxLength={SCHEMA_LIMITS.URL_MAX}
                  value={draftChordsUrl}
                  onChange={(e) => setDraftChordsUrl(e.target.value)}
                  placeholder="https://tabs.ultimate-guitar.com/..."
                  className="w-full bg-[#131822] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/60"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400" htmlFor="chart-lyrics-url">
                  Full Lyrics Link
                </label>
                <input
                  id="chart-lyrics-url"
                  type="text"
                  maxLength={SCHEMA_LIMITS.URL_MAX}
                  value={draftLyricsUrl}
                  onChange={(e) => setDraftLyricsUrl(e.target.value)}
                  placeholder="https://genius.com/..."
                  className="w-full bg-[#131822] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/60"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs text-slate-400" htmlFor="chart-lyrics">
                  Chords &amp; Lyrics (place chords in brackets like [D] and section headers like {'{Section: Chorus}'})
                </label>
                <button
                  type="button"
                  disabled={fetchingLyrics}
                  onClick={() => void runLyricsLookup(song, { intoEditor: true })}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-[#161C28] hover:bg-[#1F283A] border border-white/[0.08] text-sky-300 rounded-md transition-colors disabled:opacity-60"
                >
                  <RefreshCw className={`w-3 h-3 ${fetchingLyrics ? 'animate-spin' : ''}`} />
                  <span>{fetchingLyrics ? 'Fetching...' : 'Load Real Lyrics'}</span>
                </button>
              </div>
              <textarea
                id="chart-lyrics"
                rows={20}
                maxLength={SCHEMA_LIMITS.LYRICS_MAX}
                value={draftLyrics}
                onChange={(e) => setDraftLyrics(e.target.value)}
                className="w-full bg-[#131822] border border-white/[0.1] rounded-lg p-4 text-sm font-mono leading-relaxed text-slate-100 focus:outline-none focus:border-amber-500/60"
              />
            </div>
          </div>
        </div>
      ) : (
        <>
          <div
            ref={lyricsScrollRef}
            onWheel={() => {
              if (autoScroll) setAutoScroll(false);
            }}
            onTouchStart={() => {
              if (autoScroll) setAutoScroll(false);
            }}
            className="flex-1 overflow-y-auto px-5 lg:px-12 py-8"
          >
            <div className={`mx-auto space-y-6 pb-16 ${twoColumns ? 'max-w-6xl' : 'max-w-4xl'}`}>
              {/* Song Title, Band Lineup & Chords Header */}
              <div className="pb-5 border-b border-white/[0.08] space-y-4">
                <div className="flex flex-wrap items-baseline justify-between gap-4">
                  <div>
                    <h2 className="text-3xl font-bold text-white">{song.title}</h2>
                    <p className="text-sm text-slate-400 mt-1">
                      {song.artist || 'Unknown artist'}
                      {song.recommendedBy ? ` · Recommended by ${song.recommendedBy}` : ''}
                    </p>
                  </div>
                  <div className="text-xs font-mono tabular-nums text-slate-400">
                    Key <span className="text-amber-400 font-semibold text-sm">{transposedKey}</span>
                    <span className="mx-2 text-slate-600">·</span>
                    <span>{metroBpm} BPM</span>
                  </div>
                </div>

                {assignedRosterList.length > 0 && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-300">
                    {assignedRosterList.map((item) => (
                      <span key={item.slot} className="whitespace-nowrap">
                        <span className="text-slate-500">{item.slot}:</span>{' '}
                        <span className="font-medium text-white">{item.name}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Live-Transposed Chord Progression Strip */}
                {transposedProgression.length > 0 && (
                  <div className="pt-3 border-t border-white/[0.06] flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Chords
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5 font-mono text-sm">
                      {transposedProgression.map((chord, idx) => (
                        <React.Fragment key={`${chord}-${idx}`}>
                          {idx > 0 && (
                            <span className="text-slate-600 select-none" aria-hidden="true">
                              ·
                            </span>
                          )}
                          <span className="font-semibold text-amber-400 px-1.5 py-0.5 rounded bg-[#131822] border border-white/[0.06]">
                            {chord}
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Subtle bar when displaying freshly fetched lyrics */}
              {showingLiveFetched && activeFetchedMatch && (
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-[#131822] border border-white/[0.08] text-xs">
                  <div className="flex flex-wrap items-center gap-2 text-slate-300 min-w-0">
                    <span className="text-slate-400">Lyrics:</span>
                    <span className="font-medium text-white truncate max-w-xs">
                      {activeFetchedMatch.artistName} — {activeFetchedMatch.trackName}
                    </span>
                    {fetchedMatches.length > 1 && (
                      <select
                        aria-label="Choose lyrics version"
                        value={selectedMatchIdx}
                        onChange={(e) => setSelectedMatchIdx(Number(e.target.value))}
                        className="bg-[#0B0E14] border border-white/[0.1] rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500/60 max-w-[210px]"
                      >
                        {fetchedMatches.map((m, idx) => (
                          <option key={m.id} value={idx} className="bg-[#131822]">
                            Version {idx + 1}: {m.artistName} — {m.trackName}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={savingFetched}
                    onClick={() => void handleSaveFetchedToSetlist()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-500 text-[#0B0E14] hover:bg-amber-400 rounded-md transition-colors disabled:opacity-60 whitespace-nowrap"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{savingFetched ? 'Saving...' : 'Save to Setlist'}</span>
                  </button>
                </div>
              )}

              {/* Chords & Lyrics Body */}
              {fetchingLyrics && parsedLines.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                  <p className="text-sm">Loading lyrics for {song.title}...</p>
                </div>
              ) : parsedLines.length === 0 ? (
                <div className="py-12 text-center space-y-4">
                  <p className="text-sm text-slate-400 max-w-md mx-auto">
                    {fetchError || 'No chords or lyrics added for this song yet.'}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    <button
                      type="button"
                      disabled={fetchingLyrics}
                      onClick={() => void runLyricsLookup(song)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#161C28] hover:bg-[#1F283A] border border-white/[0.1] text-white rounded-lg transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${fetchingLyrics ? 'animate-spin' : ''}`} />
                      <span>Retry Fetch Lyrics</span>
                    </button>
                    <button
                      type="button"
                      onClick={startEditChart}
                      className="px-4 py-2 text-xs font-semibold bg-amber-500 text-[#0B0E14] rounded-lg hover:bg-amber-400 transition-colors"
                    >
                      Paste Chords &amp; Lyrics
                    </button>
                  </div>
                </div>
              ) : (
                <div className={twoColumns ? 'md:columns-2 md:gap-12 space-y-2' : 'space-y-2'}>
                  {parsedLines.map((line, lineIdx) => {
                    if (line.type === 'empty') {
                      return <div key={lineIdx} className="h-3.5" />;
                    }
                    if (line.type === 'section') {
                      return (
                        <h3
                          key={lineIdx}
                          className="pt-4 pb-1 text-sm font-semibold text-amber-400 tracking-wide border-b border-white/[0.06] break-after-avoid"
                        >
                          {line.heading}
                        </h3>
                      );
                    }
                    const hasAnyChord = line.tokens?.some((t) => t.chord);
                    return (
                      <div
                        key={lineIdx}
                        className="flex flex-wrap items-end gap-y-2 break-inside-avoid"
                      >
                        {line.tokens?.map((tok, tokIdx) => (
                          <span
                            key={tokIdx}
                            className="inline-flex flex-col items-start whitespace-pre-wrap"
                          >
                            {hasAnyChord && (
                              <span
                                className={`font-mono font-semibold text-amber-400 pr-2 select-all ${fontSizeClasses.chord} ${
                                  tok.chord ? 'min-h-[1.25em]' : 'min-h-[1.25em] opacity-0'
                                }`}
                              >
                                {tok.chord || '\u00A0'}
                              </span>
                            )}
                            <span className={`text-slate-100 ${fontSizeClasses.lyric}`}>
                              {tok.text || (tok.chord ? '\u00A0\u00A0' : '')}
                            </span>
                          </span>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Pinned Bottom Rehearsal Console: Auto-Scroll + Studio Metronome */}
          <div className="px-5 lg:px-6 py-3 border-t border-white/[0.1] bg-[#0F131C] shrink-0">
            <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
              {/* Auto-Scroll Console */}
              <div className="flex flex-wrap items-center gap-2.5 bg-[#131822] border border-white/[0.08] rounded-xl px-3 py-2">
                <button
                  type="button"
                  onClick={toggleAutoScroll}
                  title="Toggle auto-scroll (Space)"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    autoScroll
                      ? 'bg-amber-500 text-[#0B0E14] hover:bg-amber-400'
                      : 'bg-[#1D2535] text-white hover:bg-[#273146]'
                  }`}
                >
                  {autoScroll ? (
                    <Pause className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current" />
                  )}
                  <span>{autoScroll ? 'Pause Scroll' : 'Auto-Scroll'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setScrollSpeed((s) => Math.max(0.4, Number((s - 0.2).toFixed(1))))}
                    aria-label="Decrease scroll speed"
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/[0.06]"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="range"
                    aria-label="Auto-scroll speed"
                    min={0.4}
                    max={3.0}
                    step={0.1}
                    value={scrollSpeed}
                    onChange={(e) => setScrollSpeed(Number(e.target.value))}
                    className="w-24 sm:w-28 studio-slider"
                  />
                  <button
                    type="button"
                    onClick={() => setScrollSpeed((s) => Math.min(3.0, Number((s + 0.2).toFixed(1))))}
                    aria-label="Increase scroll speed"
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/[0.06]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-mono tabular-nums text-amber-400 w-9 text-right">
                    {scrollSpeed.toFixed(1)}x
                  </span>
                </div>

                <button
                  type="button"
                  onClick={scrollToTop}
                  title="Scroll back to top"
                  className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-md transition-colors whitespace-nowrap"
                >
                  <ArrowUpToLine className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Top</span>
                </button>
              </div>

              {/* Studio Metronome Console */}
              <div className="flex flex-wrap items-center gap-2.5 bg-[#131822] border border-white/[0.08] rounded-xl px-3 py-2">
                <button
                  type="button"
                  onClick={toggleMetronome}
                  title="Toggle metronome (M)"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    metroPlaying
                      ? 'bg-amber-500 text-[#0B0E14] hover:bg-amber-400'
                      : 'bg-[#1D2535] text-white hover:bg-[#273146]'
                  }`}
                >
                  {metroPlaying ? (
                    <Square className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <Timer className="w-3.5 h-3.5" />
                  )}
                  <span>{metroPlaying ? 'Stop Click' : 'Metronome'}</span>
                </button>

                {/* Beat Indicator Stepper */}
                <div
                  className="flex items-center gap-1"
                  aria-label="Metronome beat indicator"
                >
                  {Array.from({ length: totalBeats }).map((_, idx) => {
                    const isCurrent = metroPlaying && activeBeat === idx;
                    const isAccent = idx === 0;
                    return (
                      <div
                        key={idx}
                        className={`w-6 h-6 rounded flex items-center justify-center text-[11px] font-mono font-bold tabular-nums transition-colors ${
                          isCurrent
                            ? isAccent
                              ? 'bg-amber-500 text-[#0B0E14]'
                              : 'bg-slate-100 text-[#0B0E14]'
                            : 'bg-[#1B2230] text-slate-500 border border-white/[0.06]'
                        }`}
                      >
                        {idx + 1}
                      </div>
                    );
                  })}
                </div>

                {/* BPM Controls */}
                <div className="flex items-center gap-1 bg-[#0B0E14] border border-white/[0.08] rounded-lg px-1 py-0.5">
                  <button
                    type="button"
                    onClick={() => handleAdjustBpm(-2)}
                    aria-label="Decrease BPM"
                    className="p-1 rounded text-slate-300 hover:text-white hover:bg-white/[0.06]"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-1.5 text-xs font-mono font-semibold tabular-nums text-white whitespace-nowrap min-w-[66px] text-center">
                    {metroBpm} <span className="text-slate-400 font-normal">BPM</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAdjustBpm(2)}
                    aria-label="Increase BPM"
                    className="p-1 rounded text-slate-300 hover:text-white hover:bg-white/[0.06]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Tap Tempo */}
                <button
                  type="button"
                  onClick={handleTapTempo}
                  title="Tap repeatedly to set tempo"
                  className="px-2.5 py-1.5 text-xs font-semibold bg-[#1B2230] hover:bg-[#263044] border border-white/[0.08] text-slate-200 rounded-lg transition-colors whitespace-nowrap"
                >
                  Tap
                </button>

                {/* Time Signature Toggle */}
                <button
                  type="button"
                  onClick={cycleTimeSignature}
                  title="Cycle time signature (4/4, 3/4, 6/8)"
                  className="px-2 py-1.5 text-xs font-mono font-semibold bg-[#1B2230] hover:bg-[#263044] border border-white/[0.08] text-amber-400 rounded-lg transition-colors tabular-nums whitespace-nowrap"
                >
                  {metroTimeSig}
                </button>

                {/* Mute / Visual-Only Toggle */}
                <button
                  type="button"
                  onClick={() => setMetroMuted((m) => !m)}
                  aria-label={metroMuted ? 'Unmute metronome click' : 'Mute metronome click (visual only)'}
                  title={metroMuted ? 'Click muted (visual pulse only)' : 'Mute click audio'}
                  className={`p-1.5 rounded-lg border transition-colors ${
                    metroMuted
                      ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                      : 'bg-[#1B2230] border-white/[0.08] text-slate-300 hover:text-white'
                  }`}
                >
                  {metroMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
