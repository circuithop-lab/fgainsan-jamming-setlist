import type { User } from 'firebase/auth';
import {
  arrayRemove,
  arrayUnion,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { STARTER_ROSTER, STARTER_SONGS } from '../data/starterData';
import {
  createEmptyAssignments,
  GrooveStyle,
  INSTRUMENT_SLOTS,
  SCHEMA_LIMITS,
  SongAssignments,
  SongStatus,
  UserProfile,
} from '../types';
import { db, handleFirestoreError, OperationType } from './firebase';

function generateId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 14)
      : Math.random().toString(36).slice(2, 14) + Date.now().toString(36);
  return `${prefix}-${random}`;
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let partA = '';
  let partB = '';
  for (let i = 0; i < 3; i++) {
    partA += chars[Math.floor(Math.random() * chars.length)];
  }
  for (let i = 0; i < 4; i++) {
    partB += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${partA}-${partB}`;
}

function clampString(val: string, maxLen: number): string {
  return val.trim().slice(0, maxLen);
}

export function sanitizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }
  if (candidate.length > SCHEMA_LIMITS.URL_MAX) {
    candidate = candidate.slice(0, SCHEMA_LIMITS.URL_MAX);
  }
  return SCHEMA_LIMITS.HTTP_URL_REGEX.test(candidate) ? candidate : '';
}

function sanitizeAssignments(input?: Partial<SongAssignments>): SongAssignments {
  const base = createEmptyAssignments();
  if (!input) return base;
  for (const slot of INSTRUMENT_SLOTS) {
    const raw = input[slot.key];
    base[slot.key] = typeof raw === 'string' ? clampString(raw, SCHEMA_LIMITS.SLOT_VALUE_MAX) : '';
  }
  return base;
}

function sanitizeBpm(bpm: number): number {
  const n = Math.round(Number(bpm) || 100);
  return Math.max(SCHEMA_LIMITS.BPM_MIN, Math.min(SCHEMA_LIMITS.BPM_MAX, n));
}

function sanitizeProgression(chords: string[], fallbackKey: string): string[] {
  const cleaned = chords
    .map((c) => clampString(c, 12))
    .filter((c) => c.length > 0)
    .slice(0, SCHEMA_LIMITS.CHORD_PROGRESSION_MAX);
  if (cleaned.length > 0) return cleaned;
  const key = clampString(fallbackKey, 12) || 'C';
  return [key, key, key, key];
}

export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    const displayName = clampString(user.displayName || user.email?.split('@')[0] || 'Band Member', SCHEMA_LIMITS.DISPLAY_NAME_MAX) || 'Band Member';
    const profile = {
      uid: user.uid,
      displayName,
      activeBandId: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(userRef, profile);
    return {
      uid: user.uid,
      displayName,
      activeBandId: '',
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function switchActiveBand(uid: string, bandId: string): Promise<void> {
  const userPath = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      activeBandId: bandId,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

export async function createBandWithStarters(
  user: User,
  rawBandName: string,
  includeStarterSongs: boolean
): Promise<string> {
  const bandId = generateId('band');
  const inviteCode = generateInviteCode();
  const bandName = clampString(rawBandName || 'Band Rehearsal Setlist', SCHEMA_LIMITS.BAND_NAME_MAX) || 'Band Rehearsal Setlist';
  const displayName = clampString(user.displayName || user.email?.split('@')[0] || 'Band Member', SCHEMA_LIMITS.DISPLAY_NAME_MAX) || 'Band Member';

  const songPairs = includeStarterSongs
    ? STARTER_SONGS.map((template, idx) => ({
        id: generateId(`song${idx + 1}`),
        template,
      }))
    : [];

  const songIds = songPairs.map((s) => s.id);
  const roster = includeStarterSongs ? [...STARTER_ROSTER] : [displayName];

  const batch = writeBatch(db);
  const bandRef = doc(db, 'bands', bandId);
  const memberRef = doc(db, 'bands', bandId, 'members', user.uid);
  const inviteRef = doc(db, 'bandInvites', inviteCode);
  const userRef = doc(db, 'users', user.uid);

  batch.set(bandRef, {
    name: bandName,
    ownerId: user.uid,
    inviteCode,
    memberUids: [user.uid],
    roster: roster.slice(0, SCHEMA_LIMITS.ROSTER_MAX),
    songIds,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(memberRef, {
    uid: user.uid,
    displayName,
    role: 'owner',
    inviteCodeUsed: inviteCode,
    joinedAt: serverTimestamp(),
  });

  batch.set(inviteRef, {
    inviteCode,
    bandId,
    bandName,
    ownerId: user.uid,
    createdAt: serverTimestamp(),
  });

  for (const { id, template } of songPairs) {
    const songRef = doc(db, 'bands', bandId, 'songs', id);
    batch.set(songRef, {
      bandId,
      orderIndex: template.orderIndex,
      title: clampString(template.title, SCHEMA_LIMITS.TITLE_MAX),
      artist: clampString(template.artist, SCHEMA_LIMITS.ARTIST_MAX),
      recommendedBy: clampString(template.recommendedBy, SCHEMA_LIMITS.RECOMMENDED_BY_MAX),
      referenceUrl: sanitizeUrl(template.referenceUrl),
      chordsUrl: sanitizeUrl(template.chordsUrl),
      lyricsUrl: sanitizeUrl(template.lyricsUrl),
      keyChord: clampString(template.keyChord, SCHEMA_LIMITS.KEY_CHORD_MAX),
      bpm: sanitizeBpm(template.bpm),
      status: template.status,
      grooveStyle: template.grooveStyle,
      chordProgression: sanitizeProgression(template.chordProgression, template.keyChord),
      lyricsWithChords: template.lyricsWithChords.slice(0, SCHEMA_LIMITS.LYRICS_MAX),
      assignments: sanitizeAssignments(template.assignments),
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  batch.update(userRef, {
    activeBandId: bandId,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return bandId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `bands/${bandId}`);
  }
}

export async function joinBandByInviteCode(
  user: User,
  rawCode: string
): Promise<{ bandId: string; bandName: string; alreadyMember: boolean }> {
  const code = rawCode.trim().toUpperCase();
  if (code.length < 6 || code.length > 16 || !SCHEMA_LIMITS.INVITE_CODE_REGEX.test(code)) {
    throw new Error('Enter a valid invite code (for example, JAM-4821).');
  }

  const invitePath = `bandInvites/${code}`;
  let inviteData: { bandId: string; bandName: string } | null = null;
  try {
    const inviteSnap = await getDoc(doc(db, 'bandInvites', code));
    if (!inviteSnap.exists()) {
      throw new Error('NOT_FOUND');
    }
    inviteData = inviteSnap.data() as { bandId: string; bandName: string };
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      throw new Error('Invite code not found. Double-check the code with your bandmate.');
    }
    handleFirestoreError(error, OperationType.GET, invitePath);
  }

  const { bandId, bandName } = inviteData;
  const memberPath = `bands/${bandId}/members/${user.uid}`;
  let alreadyMember = false;
  try {
    const memberSnap = await getDoc(doc(db, 'bands', bandId, 'members', user.uid));
    alreadyMember = memberSnap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, memberPath);
  }

  if (alreadyMember) {
    await switchActiveBand(user.uid, bandId);
    return { bandId, bandName, alreadyMember: true };
  }

  const displayName = clampString(user.displayName || user.email?.split('@')[0] || 'Band Member', SCHEMA_LIMITS.DISPLAY_NAME_MAX) || 'Band Member';
  const batch = writeBatch(db);
  batch.update(doc(db, 'bands', bandId), {
    memberUids: arrayUnion(user.uid),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'bands', bandId, 'members', user.uid), {
    uid: user.uid,
    displayName,
    role: 'member',
    inviteCodeUsed: code,
    joinedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'users', user.uid), {
    activeBandId: bandId,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return { bandId, bandName, alreadyMember: false };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `bands/${bandId}`);
  }
}

export async function updateBandName(bandId: string, rawName: string): Promise<void> {
  const name = clampString(rawName, SCHEMA_LIMITS.BAND_NAME_MAX);
  if (!name) return;
  const path = `bands/${bandId}`;
  try {
    await updateDoc(doc(db, 'bands', bandId), {
      name,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateBandRoster(bandId: string, roster: string[]): Promise<void> {
  const deduped = Array.from(
    new Set(
      roster
        .map((n) => clampString(n, SCHEMA_LIMITS.SLOT_VALUE_MAX))
        .filter((n) => n.length > 0)
    )
  ).slice(0, SCHEMA_LIMITS.ROSTER_MAX);

  const path = `bands/${bandId}`;
  try {
    await updateDoc(doc(db, 'bands', bandId), {
      roster: deduped,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export interface SongFormInput {
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
  assignments?: Partial<SongAssignments>;
}

export async function addSongToBand(
  bandId: string,
  uid: string,
  input: SongFormInput,
  nextOrderIndex: number
): Promise<string> {
  const title = clampString(input.title, SCHEMA_LIMITS.TITLE_MAX);
  if (!title) {
    throw new Error('Song title is required.');
  }

  const songId = generateId('song');
  const songPath = `bands/${bandId}/songs/${songId}`;
  const batch = writeBatch(db);

  batch.set(doc(db, 'bands', bandId, 'songs', songId), {
    bandId,
    orderIndex: Math.max(0, Math.min(10000, Math.round(nextOrderIndex))),
    title,
    artist: clampString(input.artist, SCHEMA_LIMITS.ARTIST_MAX),
    recommendedBy: clampString(input.recommendedBy, SCHEMA_LIMITS.RECOMMENDED_BY_MAX),
    referenceUrl: sanitizeUrl(input.referenceUrl),
    chordsUrl: sanitizeUrl(input.chordsUrl),
    lyricsUrl: sanitizeUrl(input.lyricsUrl || ''),
    keyChord: clampString(input.keyChord, SCHEMA_LIMITS.KEY_CHORD_MAX),
    bpm: sanitizeBpm(input.bpm),
    status: input.status,
    grooveStyle: input.grooveStyle,
    chordProgression: sanitizeProgression(input.chordProgression, input.keyChord),
    lyricsWithChords: input.lyricsWithChords.slice(0, SCHEMA_LIMITS.LYRICS_MAX),
    assignments: sanitizeAssignments(input.assignments),
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.update(doc(db, 'bands', bandId), {
    songIds: arrayUnion(songId),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return songId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, songPath);
  }
}

export async function updateSongAssignments(
  bandId: string,
  songId: string,
  assignments: SongAssignments
): Promise<void> {
  const path = `bands/${bandId}/songs/${songId}`;
  try {
    await updateDoc(doc(db, 'bands', bandId, 'songs', songId), {
      assignments: sanitizeAssignments(assignments),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateSongStatus(
  bandId: string,
  songId: string,
  status: SongStatus
): Promise<void> {
  const path = `bands/${bandId}/songs/${songId}`;
  try {
    await updateDoc(doc(db, 'bands', bandId, 'songs', songId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateSongChart(
  bandId: string,
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
): Promise<void> {
  const path = `bands/${bandId}/songs/${songId}`;
  try {
    await updateDoc(doc(db, 'bands', bandId, 'songs', songId), {
      keyChord: clampString(patch.keyChord, SCHEMA_LIMITS.KEY_CHORD_MAX),
      bpm: sanitizeBpm(patch.bpm),
      grooveStyle: patch.grooveStyle,
      chordProgression: sanitizeProgression(patch.chordProgression, patch.keyChord),
      lyricsWithChords: patch.lyricsWithChords.slice(0, SCHEMA_LIMITS.LYRICS_MAX),
      referenceUrl: sanitizeUrl(patch.referenceUrl),
      chordsUrl: sanitizeUrl(patch.chordsUrl),
      lyricsUrl: sanitizeUrl(patch.lyricsUrl || ''),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateSongFull(
  bandId: string,
  songId: string,
  input: SongFormInput,
  orderIndex: number
): Promise<void> {
  const title = clampString(input.title, SCHEMA_LIMITS.TITLE_MAX);
  if (!title) {
    throw new Error('Song title is required.');
  }
  const path = `bands/${bandId}/songs/${songId}`;
  try {
    await updateDoc(doc(db, 'bands', bandId, 'songs', songId), {
      orderIndex: Math.max(0, Math.min(10000, Math.round(orderIndex))),
      title,
      artist: clampString(input.artist, SCHEMA_LIMITS.ARTIST_MAX),
      recommendedBy: clampString(input.recommendedBy, SCHEMA_LIMITS.RECOMMENDED_BY_MAX),
      referenceUrl: sanitizeUrl(input.referenceUrl),
      chordsUrl: sanitizeUrl(input.chordsUrl),
      lyricsUrl: sanitizeUrl(input.lyricsUrl || ''),
      keyChord: clampString(input.keyChord, SCHEMA_LIMITS.KEY_CHORD_MAX),
      bpm: sanitizeBpm(input.bpm),
      status: input.status,
      grooveStyle: input.grooveStyle,
      chordProgression: sanitizeProgression(input.chordProgression, input.keyChord),
      lyricsWithChords: input.lyricsWithChords.slice(0, SCHEMA_LIMITS.LYRICS_MAX),
      assignments: sanitizeAssignments(input.assignments),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteSongFromBand(bandId: string, songId: string): Promise<void> {
  const songPath = `bands/${bandId}/songs/${songId}`;
  const batch = writeBatch(db);
  batch.delete(doc(db, 'bands', bandId, 'songs', songId));
  batch.update(doc(db, 'bands', bandId), {
    songIds: arrayRemove(songId),
    updatedAt: serverTimestamp(),
  });
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, songPath);
  }
}
