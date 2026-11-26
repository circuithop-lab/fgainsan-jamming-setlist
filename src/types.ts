import type { Timestamp } from 'firebase/firestore';

export type InstrumentSlotKey =
  | 'vocals1'
  | 'vocals2'
  | 'vocals3'
  | 'keyboard1'
  | 'guitar1'
  | 'guitar2'
  | 'guitar3'
  | 'bass'
  | 'percussion1'
  | 'percussion2';

export type StemChannelId = 'vocals' | 'guitar' | 'keys' | 'bass' | 'drums';

export type SongStatus = 'confirmed' | 'rehearsing' | 'considering' | 'shelved';

export type GrooveStyle = 'rock' | 'ballad' | 'pop' | 'indie' | 'anthem';

export interface InstrumentSlotDef {
  key: InstrumentSlotKey;
  label: string;
  shortLabel: string;
  stemGroup: StemChannelId;
}

export const INSTRUMENT_SLOTS: InstrumentSlotDef[] = [
  { key: 'vocals1', label: 'Vocals 1', shortLabel: 'Voc 1', stemGroup: 'vocals' },
  { key: 'vocals2', label: 'Vocals 2', shortLabel: 'Voc 2', stemGroup: 'vocals' },
  { key: 'vocals3', label: 'Vocals 3', shortLabel: 'Voc 3', stemGroup: 'vocals' },
  { key: 'keyboard1', label: 'Keyboard 1', shortLabel: 'Keys 1', stemGroup: 'keys' },
  { key: 'guitar1', label: 'Guitar 1', shortLabel: 'Gtr 1', stemGroup: 'guitar' },
  { key: 'guitar2', label: 'Guitar 2', shortLabel: 'Gtr 2', stemGroup: 'guitar' },
  { key: 'guitar3', label: 'Guitar 3', shortLabel: 'Gtr 3', stemGroup: 'guitar' },
  { key: 'bass', label: 'Bass', shortLabel: 'Bass', stemGroup: 'bass' },
  { key: 'percussion1', label: 'Percussion 1', shortLabel: 'Perc 1', stemGroup: 'drums' },
  { key: 'percussion2', label: 'Percussion 2', shortLabel: 'Perc 2', stemGroup: 'drums' },
];

export const STEM_CHANNELS: { id: StemChannelId; label: string; shortLabel: string; description: string }[] = [
  { id: 'vocals', label: 'Vocals', shortLabel: 'VOX', description: 'Lead & harmony guide' },
  { id: 'guitar', label: 'Guitar', shortLabel: 'GTR', description: 'Rhythm & lead guitar' },
  { id: 'keys', label: 'Keys', shortLabel: 'KEY', description: 'Piano & synth pads' },
  { id: 'bass', label: 'Bass', shortLabel: 'BAS', description: 'Low-end bassline' },
  { id: 'drums', label: 'Drums', shortLabel: 'DRM', description: 'Kit & percussion' },
];

export const STATUS_OPTIONS: { value: SongStatus; label: string; shortLabel: string; textClass: string }[] = [
  { value: 'confirmed', label: 'Confirmed (Dayon)', shortLabel: 'Dayon', textClass: 'text-emerald-400' },
  { value: 'rehearsing', label: 'Rehearsing', shortLabel: 'Rehearsing', textClass: 'text-amber-400' },
  { value: 'considering', label: 'Considering', shortLabel: 'Pending', textClass: 'text-slate-400' },
  { value: 'shelved', label: 'Shelved', shortLabel: 'Shelved', textClass: 'text-rose-400' },
];

export const GROOVE_OPTIONS: { value: GrooveStyle; label: string }[] = [
  { value: 'rock', label: 'Rock Drive' },
  { value: 'ballad', label: 'Slow Ballad' },
  { value: 'pop', label: 'Smooth Pop / R&B' },
  { value: 'indie', label: 'Indie Chime' },
  { value: 'anthem', label: 'Arena Anthem' },
];

/** Synchronized verbatim with firebase-blueprint.json & firestore.rules */
export const SCHEMA_LIMITS = {
  DISPLAY_NAME_MAX: 80,
  BAND_NAME_MAX: 80,
  TITLE_MAX: 120,
  ARTIST_MAX: 120,
  RECOMMENDED_BY_MAX: 60,
  SLOT_VALUE_MAX: 60,
  URL_MAX: 500,
  KEY_CHORD_MAX: 16,
  LYRICS_MAX: 20000,
  BPM_MIN: 40,
  BPM_MAX: 240,
  ROSTER_MAX: 30,
  SONGS_MAX: 100,
  CHORD_PROGRESSION_MAX: 32,
  INVITE_CODE_REGEX: /^[A-Z0-9-]+$/,
  HTTP_URL_REGEX: /^https?:\/\/.+/,
} as const;

export type SongAssignments = Record<InstrumentSlotKey, string>;

export interface UserProfile {
  uid: string;
  displayName: string;
  activeBandId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Band {
  id: string;
  name: string;
  ownerId: string;
  inviteCode: string;
  memberUids: string[];
  roster: string[];
  songIds: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Song {
  id: string;
  bandId: string;
  orderIndex: number;
  title: string;
  artist: string;
  recommendedBy: string;
  referenceUrl: string;
  chordsUrl: string;
  lyricsUrl?: string;
  keyChord: string;
  bpm: number;
  status: SongStatus;
  grooveStyle: GrooveStyle;
  chordProgression: string[];
  lyricsWithChords: string;
  assignments: SongAssignments;
  createdBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface StemMixChannelState {
  volume: number; // 0 to 1
  muted: boolean;
  solo: boolean;
}

export type StemMixState = Record<StemChannelId, StemMixChannelState>;

export interface StoredStemFile {
  key: string;
  bandId: string;
  songId: string;
  channelId: StemChannelId;
  fileName: string;
  mimeType: string;
  blob: Blob;
  durationSec: number;
  updatedAt: number;
}

export type WorkspaceView = 'setlist' | 'practice' | 'equipment' | 'roster';

export const GEAR_DOC_ID = 'stagedeck-equipment-checklist';

export type EquipmentCategory = 'instruments' | 'amps_pa' | 'mics_cables' | 'accessories';

export type EquipmentStatus = 'needed' | 'confirmed' | 'packed';

export interface EquipmentItem {
  id: string;
  name: string;
  category: EquipmentCategory;
  quantity: number;
  broughtBy: string;
  status: EquipmentStatus;
  notes: string;
}

export const EQUIPMENT_CATEGORIES: { value: EquipmentCategory; label: string; shortLabel: string }[] = [
  { value: 'instruments', label: 'Instruments', shortLabel: 'Instruments' },
  { value: 'amps_pa', label: 'Amps & PA', shortLabel: 'Amps & PA' },
  { value: 'mics_cables', label: 'Mics & Cables', shortLabel: 'Mics & Cables' },
  { value: 'accessories', label: 'Stands & Accessories', shortLabel: 'Accessories' },
];

export function createEmptyAssignments(): SongAssignments {
  return {
    vocals1: '',
    vocals2: '',
    vocals3: '',
    keyboard1: '',
    guitar1: '',
    guitar2: '',
    guitar3: '',
    bass: '',
    percussion1: '',
    percussion2: '',
  };
}
