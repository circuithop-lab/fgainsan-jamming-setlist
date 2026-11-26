/**
 * Phase 0 Payload-First Security Test Suite for StageDeck Firestore Rules.
 * Verifies the "Dirty Dozen" adversarial payloads and expected happy-path operations
 * against firestore.rules when run with the Firebase Rules Unit Testing emulator.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { uid: string; email_verified?: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED' | 'ALLOW';
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated song read is rejected',
    operation: 'get',
    path: '/bands/band-1/songs/song-1',
    auth: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Cross-user profile peek violates PII isolation',
    operation: 'get',
    path: '/users/user-a',
    auth: { uid: 'user-b', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Shadow field injection on song create is blocked by hasOnly',
    operation: 'create',
    path: '/bands/band-1/songs/song-99',
    auth: { uid: 'user-a', email_verified: true },
    payload: {
      bandId: 'band-1',
      title: 'Test Song',
      isAdmin: true,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Identity spoofing on band create is rejected',
    operation: 'create',
    path: '/bands/band-spoof',
    auth: { uid: 'user-a', email_verified: true },
    payload: {
      name: 'Spoof Band',
      ownerId: 'user-b',
      inviteCode: 'SPOOF123',
      memberUids: ['user-a'],
      roster: [],
      songIds: [],
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Self-assigned owner escalation on member create is rejected',
    operation: 'create',
    path: '/bands/band-1/members/user-b',
    auth: { uid: 'user-b', email_verified: true },
    payload: {
      uid: 'user-b',
      displayName: 'Mallory',
      role: 'owner',
      inviteCodeUsed: 'JAM-4821',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Joining band with wrong invite code is rejected',
    operation: 'create',
    path: '/bands/band-1/members/user-b',
    auth: { uid: 'user-b', email_verified: true },
    payload: {
      uid: 'user-b',
      displayName: 'Mallory',
      role: 'member',
      inviteCodeUsed: 'WRONG-99',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Invite code list scraping is completely disabled',
    operation: 'list',
    path: '/bandInvites',
    auth: { uid: 'user-b', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'ID poisoning with oversized doc ID is rejected',
    operation: 'create',
    path: `/bands/band-1/songs/${'a'.repeat(200)}`,
    auth: { uid: 'user-a', email_verified: true },
    payload: { title: 'Oversized' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Client-forged createdAt timestamp is rejected',
    operation: 'create',
    path: '/bands/band-1/songs/song-time',
    auth: { uid: 'user-a', email_verified: true },
    payload: {
      bandId: 'band-1',
      title: 'Forged Time',
      createdAt: '2020-01-01T00:00:00Z',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Immutable ownerId tampering on band update is rejected',
    operation: 'update',
    path: '/bands/band-1',
    auth: { uid: 'user-b', email_verified: true },
    payload: { ownerId: 'user-b' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Value poisoning on allowed song key (out-of-bounds BPM / invalid status)',
    operation: 'update',
    path: '/bands/band-1/songs/song-1',
    auth: { uid: 'user-a', email_verified: true },
    payload: { bpm: 9999, status: 'hacked' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Outsider non-member reading or mutating band song is rejected',
    operation: 'get',
    path: '/bands/band-1/songs/song-1',
    auth: { uid: 'outsider-c', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
];
