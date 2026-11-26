# StageDeck Security Specification (Phase 0 — Payload-First TDD)

## 1. Data Invariants

1. **Zero Blanket Reads**: No collection allows unauthenticated access or unrestricted `allow list: if isSignedIn();`. `users`, `bandInvites`, and `songs` disallow `list` entirely; `bands` only allows `list` when `request.auth.uid in resource.data.memberUids`.
2. **PII & Profile Isolation**: `users/{userId}` can only be read or modified by `request.auth.uid == userId`.
3. **Master Gate Membership**: Every read or write to `bands/{bandId}/songs/{songId}` requires active membership verified via `exists(/databases/$(database)/documents/bands/$(bandId)/members/$(request.auth.uid))`.
4. **Prevent Self-Assigned Owner Role**: A user creating `bands/{bandId}/members/{uid}` can only set `role: "owner"` if `bands/{bandId}.ownerId == request.auth.uid`; otherwise `role` must be `"member"` and `inviteCodeUsed` must match `bands/{bandId}.inviteCode`.
5. **Atomicity Guarantees**: Creating a band requires the creator's `members/{uid}` doc to exist in the same batch (`existsAfter`). Joining a band via invite code requires both adding `request.auth.uid` to `bands/{bandId}.memberUids` AND creating `bands/{bandId}/members/{uid}` atomically.
6. **Strict Schema & Bounds**: Every document enforces `keys().hasAll(...)` and `keys().hasOnly(...)`, explicit string `.size()` bounds, bounded lists (`memberUids <= 25`, `roster <= 30`, `songIds <= 100`, `chordProgression <= 32`), valid ID regex `^[a-zA-Z0-9_\-]+$`, and server timestamps (`request.time`).
7. **Verified Users**: All mutations require `request.auth.token.email_verified == true`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)

1. **Unauthenticated Song Read**: `GET /bands/band-1/songs/song-1` with `auth: null`.
2. **Cross-User Profile Peek (PII Isolation)**: User B attempts `GET /users/user-A`.
3. **Shadow Field Injection on Song Create**: Member submits valid song plus ghost field `{ "isAdmin": true }`.
4. **Identity Spoofing on Band Create**: User A creates `bands/band-x` with `ownerId: "user-B"`.
5. **Self-Assigned Owner Escalation**: User B joins User A's band with `members/user-B` setting `role: "owner"`.
6. **Unauthorized Invite Code Bypass**: User B attempts to join `bands/band-1` with wrong `inviteCodeUsed: "WRONG1"`.
7. **Invite Code Scraping**: User B attempts `LIST /bandInvites`.
8. **ID Poisoning / Denial of Wallet**: User A attempts to create song with 500-character document ID or `lyricsWithChords` exceeding 20,000 chars.
9. **Client Timestamp Forgery**: User A creates song with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time`.
10. **Immutable Field Tampering**: Member attempts to update `bands/band-1` changing `ownerId` or `createdAt`.
11. **Value Poisoning on Allowed Key**: Member updates `songs/song-1` setting `bpm: "fast"` or `bpm: 9999` or `status: "hacked"`.
12. **Non-Member Song Mutation**: Outsider User C attempts to `GET` or `UPDATE` `/bands/band-1/songs/song-1`.
