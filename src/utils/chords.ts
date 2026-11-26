const SHARP_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_SCALE = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0,
  'B#': 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  F: 5,
  'E#': 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
  Cb: 11,
};

function transposeSingleNote(note: string, semitones: number, preferFlats: boolean): string {
  const idx = NOTE_TO_SEMITONE[note];
  if (idx === undefined) return note;
  const shifted = ((idx + semitones) % 12 + 12) % 12;
  return preferFlats ? FLAT_SCALE[shifted] : SHARP_SCALE[shifted];
}

export function transposeChord(chord: string, semitones: number): string {
  if (!chord || semitones === 0) return chord;
  const trimmed = chord.trim();
  const match = trimmed.match(/^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/);
  if (!match) return chord;

  const [, root, suffix, bass] = match;
  const preferFlats = root.includes('b') || (bass ? bass.includes('b') : false);
  const nextRoot = transposeSingleNote(root, semitones, preferFlats);
  const nextBass = bass ? transposeSingleNote(bass, semitones, preferFlats) : '';
  return nextBass ? `${nextRoot}${suffix}/${nextBass}` : `${nextRoot}${suffix}`;
}

export interface ChordLyricToken {
  chord: string;
  text: string;
}

export interface ParsedChartLine {
  type: 'section' | 'empty' | 'lyrics';
  heading?: string;
  tokens?: ChordLyricToken[];
}

export function parseChordPro(raw: string, semitones: number): ParsedChartLine[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  return lines.map((line): ParsedChartLine => {
    const trimmed = line.trim();
    if (!trimmed) {
      return { type: 'empty' };
    }

    // Section heading e.g. {Section: Chorus} or {comment: Bridge}
    const sectionMatch = trimmed.match(/^\{(?:section|comment|c|s):\s*(.+?)\}$/i);
    if (sectionMatch) {
      return { type: 'section', heading: sectionMatch[1].trim() };
    }

    // Parse [Chord] tokens inline
    const regex = /\[([^\]]+)\]/g;
    const tokens: ChordLyricToken[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        const leadingText = line.slice(lastIndex, match.index);
        if (tokens.length === 0) {
          tokens.push({ chord: '', text: leadingText });
        } else {
          tokens[tokens.length - 1].text += leadingText;
        }
      }
      const transposed = transposeChord(match[1], semitones);
      tokens.push({ chord: transposed, text: '' });
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < line.length) {
      const trailing = line.slice(lastIndex);
      if (tokens.length === 0) {
        tokens.push({ chord: '', text: trailing });
      } else {
        tokens[tokens.length - 1].text += trailing;
      }
    }

    return { type: 'lyrics', tokens };
  });
}

export interface ChordVoicing {
  bassMidi: number;
  chordMidis: number[];
  melodyMidis: number[];
}

/** Converts any chord symbol (e.g. "D", "Bm", "Gmaj7", "C/E", "F#") into musical MIDI voicings */
export function chordToVoicing(chord: string): ChordVoicing {
  const match = chord.trim().match(/^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/);
  if (!match) {
    return {
      bassMidi: 38, // D2
      chordMidis: [50, 54, 57],
      melodyMidis: [62, 66, 69, 74],
    };
  }

  const [, rootStr, rawSuffix, bassStr] = match;
  const suffix = rawSuffix.toLowerCase();
  const rootSemitone = NOTE_TO_SEMITONE[rootStr] ?? 2;
  const bassSemitone = bassStr ? (NOTE_TO_SEMITONE[bassStr] ?? rootSemitone) : rootSemitone;

  // Bass octave around E1 (28) to D#2 (39)
  const bassMidi = 36 + bassSemitone - (bassSemitone > 7 ? 12 : 0);

  // Chord intervals
  const isMinor = suffix.startsWith('m') && !suffix.startsWith('maj');
  const isDim = suffix.includes('dim');
  const isSus2 = suffix.includes('sus2');
  const isSus4 = suffix.includes('sus4');
  const isMaj7 = suffix.includes('maj7');
  const isDom7 = suffix.includes('7') && !isMaj7;

  let third = isMinor || isDim ? 3 : 4;
  if (isSus2) third = 2;
  if (isSus4) third = 5;
  const fifth = isDim ? 6 : 7;

  const baseOctave = 48 + rootSemitone; // C3..B3
  const chordMidis = [baseOctave, baseOctave + third, baseOctave + fifth];
  if (isMaj7) chordMidis.push(baseOctave + 11);
  else if (isDom7) chordMidis.push(baseOctave + 10);

  const melodyOctave = 60 + rootSemitone; // C4..B4
  const melodyMidis = [
    melodyOctave,
    melodyOctave + third,
    melodyOctave + fifth,
    melodyOctave + (isMinor ? 10 : 9),
    melodyOctave + 12,
  ];

  return { bassMidi, chordMidis, melodyMidis };
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function parseChordProgressionInput(input: string): string[] {
  const parsed = input
    .split(/[\s,|]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 12);
  return parsed.slice(0, 32);
}

export function buildFallbackLyricsUrl(title: string, artist: string): string {
  const q = [title, artist].filter(Boolean).join(' ').trim();
  return `https://genius.com/search?q=${encodeURIComponent(q || 'lyrics')}`;
}

export function buildFallbackChordsUrl(title: string, artist: string): string {
  const q = [title, artist].filter(Boolean).join(' ').trim();
  return `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(q || 'chords')}`;
}

