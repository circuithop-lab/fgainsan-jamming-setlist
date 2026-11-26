import React, { useEffect, useRef, useState } from 'react';
import { X, Trash2, Sparkles, Loader2 } from 'lucide-react';
import {
  createEmptyAssignments,
  GrooveStyle,
  SCHEMA_LIMITS,
  Song,
  SongStatus,
} from '../types';
import { SongFormInput } from '../services/bandService';
import { detectSongBpm } from '../services/bpmLookup';

interface SongDrawerProps {
  open: boolean;
  editingSong: Song | null;
  roster: string[];
  defaultRecommendedBy: string;
  onClose: () => void;
  onSave: (input: SongFormInput, existingSong?: Song) => Promise<void>;
  onDelete?: (song: Song) => Promise<void>;
}

export const SongDrawer: React.FC<SongDrawerProps> = ({
  open,
  editingSong,
  roster,
  defaultRecommendedBy,
  onClose,
  onSave,
  onDelete,
}) => {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [recommendedBy, setRecommendedBy] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [chordsUrl, setChordsUrl] = useState('');
  const [lyricsUrl, setLyricsUrl] = useState('');
  const [keyChord, setKeyChord] = useState('D');
  const [bpm, setBpm] = useState(110);
  const [status, setStatus] = useState<SongStatus>('considering');
  const [grooveStyle, setGrooveStyle] = useState<GrooveStyle>('rock');
  const [lyricsWithChords, setLyricsWithChords] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectingBpm, setDetectingBpm] = useState(false);
  const [bpmHint, setBpmHint] = useState<string | null>(null);
  const [bpmManuallyEdited, setBpmManuallyEdited] = useState(false);
  const bpmAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) {
      bpmAbortRef.current?.abort();
      return;
    }
    setError(null);
    setConfirmDelete(false);
    setDetectingBpm(false);
    setBpmHint(null);
    setBpmManuallyEdited(false);
    if (editingSong) {
      setTitle(editingSong.title);
      setArtist(editingSong.artist);
      setRecommendedBy(editingSong.recommendedBy);
      setReferenceUrl(editingSong.referenceUrl);
      setChordsUrl(editingSong.chordsUrl);
      setLyricsUrl(editingSong.lyricsUrl || '');
      setKeyChord(editingSong.keyChord);
      setBpm(editingSong.bpm);
      setStatus(editingSong.status);
      setGrooveStyle(editingSong.grooveStyle);
      setLyricsWithChords(editingSong.lyricsWithChords);
    } else {
      setTitle('');
      setArtist('');
      setRecommendedBy(defaultRecommendedBy);
      setReferenceUrl('');
      setChordsUrl('');
      setLyricsUrl('');
      setKeyChord('G');
      setBpm(110);
      setStatus('considering');
      setGrooveStyle('rock');
      setLyricsWithChords('');
    }
  }, [open, editingSong, defaultRecommendedBy]);

  const runBpmDetection = async (targetTitle: string, targetArtist: string, manual = false) => {
    if (!targetTitle.trim()) {
      if (manual) setBpmHint('Enter a song title first.');
      return;
    }
    bpmAbortRef.current?.abort();
    const controller = new AbortController();
    bpmAbortRef.current = controller;
    setDetectingBpm(true);
    if (manual) setBpmHint('Analyzing audio tempo...');
    try {
      const result = await detectSongBpm(targetTitle, targetArtist, controller.signal);
      if (controller.signal.aborted) return;
      setBpm(result.bpm);
      setBpmHint(`Auto: ${result.bpm} BPM (${result.artistName} — ${result.trackName})`);
    } catch (err) {
      if (controller.signal.aborted) return;
      if (manual) {
        setBpmHint(err instanceof Error ? err.message : 'Could not detect BPM automatically.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setDetectingBpm(false);
      }
    }
  };

  // Auto-detect BPM when adding a new song as the user enters title/artist
  useEffect(() => {
    if (!open || editingSong || bpmManuallyEdited) return;
    if (title.trim().length < 3) return;
    const timer = window.setTimeout(() => {
      void runBpmDetection(title, artist, false);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [open, editingSong, bpmManuallyEdited, title, artist]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please enter a song title.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const nextKey = keyChord.trim() || 'C';
      const input: SongFormInput = {
        title: title.trim(),
        artist: artist.trim(),
        recommendedBy: recommendedBy.trim(),
        referenceUrl: referenceUrl.trim(),
        chordsUrl: chordsUrl.trim(),
        lyricsUrl: lyricsUrl.trim(),
        keyChord: nextKey,
        bpm: Math.max(SCHEMA_LIMITS.BPM_MIN, Math.min(SCHEMA_LIMITS.BPM_MAX, Number(bpm) || 100)),
        status,
        grooveStyle,
        chordProgression:
          editingSong && editingSong.chordProgression.length > 0
            ? editingSong.chordProgression
            : [nextKey],
        lyricsWithChords,
        assignments: editingSong ? editingSong.assignments : createEmptyAssignments(),
      };
      await onSave(input, editingSong || undefined);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save song.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingSong || !onDelete) return;
    setSaving(true);
    try {
      await onDelete(editingSong);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete song.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/70" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-xl bg-[#111621] border-l border-white/[0.1] h-[100dvh] flex flex-col">
        <div className="h-14 px-4 sm:px-6 border-b border-white/[0.08] flex items-center justify-between shrink-0">
          <h2 className="text-base font-semibold text-white">
            {editingSong ? 'Edit Song' : 'Add Song to Setlist'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="p-2 text-slate-400 hover:text-white rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300" htmlFor="song-title">
                Song Title *
              </label>
              <input
                id="song-title"
                type="text"
                required
                maxLength={SCHEMA_LIMITS.TITLE_MAX}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Sweet Child O Mine"
                className="w-full bg-[#161C28] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300" htmlFor="song-artist">
                Artist / Version
              </label>
              <input
                id="song-artist"
                type="text"
                maxLength={SCHEMA_LIMITS.ARTIST_MAX}
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="e.g. Guns N Roses (First to Eleven)"
                className="w-full bg-[#161C28] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300" htmlFor="song-rec">
                Rec. By
              </label>
              <input
                id="song-rec"
                type="text"
                list="roster-datalist"
                maxLength={SCHEMA_LIMITS.RECOMMENDED_BY_MAX}
                value={recommendedBy}
                onChange={(e) => setRecommendedBy(e.target.value)}
                placeholder="Shaun"
                className="w-full bg-[#161C28] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
              />
              <datalist id="roster-datalist">
                {roster.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300" htmlFor="song-key">
                Key Chord
              </label>
              <input
                id="song-key"
                type="text"
                maxLength={SCHEMA_LIMITS.KEY_CHORD_MAX}
                value={keyChord}
                onChange={(e) => setKeyChord(e.target.value)}
                placeholder="D"
                className="w-full bg-[#161C28] border border-white/[0.08] rounded-lg px-3 py-2 text-sm font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="block text-xs font-medium text-slate-300" htmlFor="song-bpm">
                  BPM
                </label>
                <button
                  type="button"
                  disabled={detectingBpm || !title.trim()}
                  onClick={() => {
                    setBpmManuallyEdited(false);
                    void runBpmDetection(title, artist, true);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 hover:text-amber-300 disabled:opacity-40 transition-colors"
                  title="Automatically detect BPM from the song's studio recording"
                >
                  {detectingBpm ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  <span>{detectingBpm ? 'Detecting...' : 'Auto'}</span>
                </button>
              </div>
              <input
                id="song-bpm"
                type="number"
                min={SCHEMA_LIMITS.BPM_MIN}
                max={SCHEMA_LIMITS.BPM_MAX}
                value={bpm}
                onChange={(e) => {
                  setBpmManuallyEdited(true);
                  setBpm(Number(e.target.value));
                }}
                className="w-full bg-[#161C28] border border-white/[0.08] rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-white focus:outline-none focus:border-amber-500/60"
              />
              {bpmHint && (
                <p className="text-[11px] text-slate-400 leading-snug truncate" title={bpmHint}>
                  {bpmHint}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300" htmlFor="song-ref-url">
                Reference Link
              </label>
              <input
                id="song-ref-url"
                type="text"
                maxLength={SCHEMA_LIMITS.URL_MAX}
                value={referenceUrl}
                onChange={(e) => setReferenceUrl(e.target.value)}
                placeholder="https://youtube.com/..."
                className="w-full bg-[#161C28] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300" htmlFor="song-chords-url">
                Chords / Tabs Link
              </label>
              <input
                id="song-chords-url"
                type="text"
                maxLength={SCHEMA_LIMITS.URL_MAX}
                value={chordsUrl}
                onChange={(e) => setChordsUrl(e.target.value)}
                placeholder="https://tabs.ultimate-guitar.com/..."
                className="w-full bg-[#161C28] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300" htmlFor="song-lyrics-url">
                Lyrics Link
              </label>
              <input
                id="song-lyrics-url"
                type="text"
                maxLength={SCHEMA_LIMITS.URL_MAX}
                value={lyricsUrl}
                onChange={(e) => setLyricsUrl(e.target.value)}
                placeholder="https://genius.com/..."
                className="w-full bg-[#161C28] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300" htmlFor="song-lyrics">
              Chords &amp; Lyrics Chart (use [D] inline chords &amp; {'{Section: Chorus}'})
            </label>
            <textarea
              id="song-lyrics"
              rows={9}
              maxLength={SCHEMA_LIMITS.LYRICS_MAX}
              value={lyricsWithChords}
              onChange={(e) => setLyricsWithChords(e.target.value)}
              placeholder="Leave blank to auto-load lyrics when opening the song, or paste custom lyrics with [D] chords..."
              className="w-full bg-[#161C28] border border-white/[0.08] rounded-lg px-3 py-2.5 text-xs font-mono leading-relaxed text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div className="pt-4 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
            {editingSong && onDelete ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-rose-300">Remove this song?</span>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleDelete()}
                    className="px-3 py-1.5 text-xs font-semibold bg-rose-500 text-white rounded-md hover:bg-rose-400"
                  >
                    Confirm Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Song
                </button>
              )
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-[#1A2130] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 text-sm font-semibold bg-amber-500 text-[#0B0E14] rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving...' : editingSong ? 'Save Changes' : 'Add Song'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
