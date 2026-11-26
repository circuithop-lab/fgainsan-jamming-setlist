import React, { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { Menu, Plus, Disc3 } from 'lucide-react';
import { AuthScreen } from './components/AuthScreen';
import { BandRosterView } from './components/BandRosterView';
import { EquipmentView } from './components/EquipmentView';
import { PracticeStudio } from './components/PracticeStudio';
import { SetlistMatrix } from './components/SetlistMatrix';
import { Sidebar } from './components/Sidebar';
import { SongDrawer } from './components/SongDrawer';
import {
  addSongToBand,
  createBandWithStarters,
  deleteSongFromBand,
  ensureUserProfile,
  joinBandByInviteCode,
  parseEquipmentItems,
  saveBandEquipment,
  SongFormInput,
  switchActiveBand,
  updateBandName,
  updateBandRoster,
  updateSongAssignments,
  updateSongChart,
  updateSongFull,
} from './services/bandService';
import { auth, db, handleFirestoreError, OperationType, signOutUser } from './services/firebase';
import {
  Band,
  EquipmentItem,
  GEAR_DOC_ID,
  GrooveStyle,
  InstrumentSlotKey,
  Song,
  WorkspaceView,
} from './types';

const DEFAULT_BAND_INVITE_CODE = '7N2-34KE';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [bands, setBands] = useState<Band[]>([]);
  const [bandsLoaded, setBandsLoaded] = useState(false);
  const [activeBandId, setActiveBandId] = useState<string>('');
  const [songsById, setSongsById] = useState<Record<string, Song>>({});
  const [songsLoading, setSongsLoading] = useState(true);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [joiningFromLink, setJoiningFromLink] = useState(false);

  const [activeView, setActiveView] = useState<WorkspaceView>('setlist');
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [memberFilter, setMemberFilter] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  const bootstrappedUidRef = useRef<string | null>(null);
  const processedInviteRef = useRef<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // Capture ?join=INVITE_CODE from URL before Google sign-in
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const joinCode = params.get('join')?.trim().toUpperCase();
      if (joinCode && joinCode.length >= 6) {
        window.sessionStorage.setItem('stagedeck_pending_invite', joinCode);
        params.delete('join');
        const nextSearch = params.toString();
        const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
        window.history.replaceState({}, '', nextUrl);
      }
    } catch {
      // Ignore storage/history errors in restricted browsers
    }
  }, []);

  if (fatalError) {
    throw fatalError;
  }

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2800);
  };

  // 1. Auth state listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser) {
        setBands([]);
        setBandsLoaded(false);
        setActiveBandId('');
        setSongsById({});
        bootstrappedUidRef.current = null;
      }
    });
    return unsub;
  }, []);

  // 2. Ensure profile + subscribe to bands where user is a member
  useEffect(() => {
    if (!authReady || !user) return;

    let cancelled = false;
    let unsubBands: (() => void) | null = null;

    void (async () => {
      try {
        const profile = await ensureUserProfile(user);
        if (cancelled) return;
        if (profile.activeBandId) {
          setActiveBandId(profile.activeBandId);
        }

        const bandsQuery = query(
          collection(db, 'bands'),
          where('memberUids', 'array-contains', user.uid)
        );
        unsubBands = onSnapshot(
          bandsQuery,
          (snapshot) => {
            const list: Band[] = snapshot.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<Band, 'id'>),
            }));
            setBands(list);
            setBandsLoaded(true);

            if (list.length > 0) {
              setActiveBandId((prev) =>
                prev && list.some((b) => b.id === prev) ? prev : list[0].id
              );
            }
          },
          (error) => {
            try {
              handleFirestoreError(error, OperationType.LIST, 'bands');
            } catch (e) {
              setFatalError(e instanceof Error ? e : new Error(String(e)));
            }
          }
        );
      } catch (err) {
        if (!cancelled) {
          setFatalError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    })();

    return () => {
      cancelled = true;
      unsubBands?.();
    };
  }, [authReady, user]);

  // 3. Auto-join via ?join= link, or auto-sync everyone into the shared default band (7N2-34KE)
  useEffect(() => {
    if (!user || !bandsLoaded) return;

    let pendingCode = '';
    try {
      pendingCode = window.sessionStorage.getItem('stagedeck_pending_invite') || '';
    } catch {
      pendingCode = '';
    }

    const alreadyInDefaultBand = bands.some(
      (b) => b.inviteCode.toUpperCase() === DEFAULT_BAND_INVITE_CODE
    );
    const targetCode =
      pendingCode || (!alreadyInDefaultBand ? DEFAULT_BAND_INVITE_CODE : '');

    if (targetCode && processedInviteRef.current !== `${user.uid}:${targetCode}`) {
      processedInviteRef.current = `${user.uid}:${targetCode}`;
      if (pendingCode) {
        try {
          window.sessionStorage.removeItem('stagedeck_pending_invite');
        } catch {
          // ignore
        }
      }
      setJoiningFromLink(true);
      void (async () => {
        try {
          const res = await joinBandByInviteCode(user, targetCode);
          setActiveBandId(res.bandId);
          setActiveView('setlist');
          setMemberFilter('');
          showToast(
            res.alreadyMember
              ? `Switched to "${res.bandName}"`
              : `Connected to "${res.bandName}" — now synced with your band!`
          );
        } catch (err) {
          if (pendingCode) {
            showToast(err instanceof Error ? err.message : 'Unable to join via invite link.');
          }
        } finally {
          setJoiningFromLink(false);
        }
      })();
      return;
    }

    if (joiningFromLink) return;
    if (bands.length > 0) return;
    if (bootstrappedUidRef.current === user.uid) return;

    bootstrappedUidRef.current = user.uid;
    setBootstrapping(true);
    void (async () => {
      try {
        const newBandId = await createBandWithStarters(user, 'Band Rehearsal Setlist', true);
        setActiveBandId(newBandId);
        showToast('Band workspace initialized with your starter setlist');
      } catch (err) {
        setFatalError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setBootstrapping(false);
      }
    })();
  }, [user, bandsLoaded, bands, joiningFromLink]);

  const activeBand = useMemo(
    () => bands.find((b) => b.id === activeBandId) || bands[0] || null,
    [bands, activeBandId]
  );

  // 4. Reconcile real-time document listeners for each songId in activeBand.songIds (Zero list queries on songs!)
  const songIdsKey = activeBand ? activeBand.songIds.join(',') : '';

  useEffect(() => {
    if (!user || !activeBand) {
      setSongsById({});
      setSongsLoading(false);
      return;
    }

    const ids = activeBand.songIds || [];
    if (ids.length === 0) {
      setSongsById({});
      setSongsLoading(false);
      return;
    }

    setSongsLoading(true);
    const unsubs: (() => void)[] = [];
    const loadedSet = new Set<string>();

    // Prune stale songs when switching bands
    setSongsById((prev) => {
      const next: Record<string, Song> = {};
      for (const id of ids) {
        if (prev[id] && prev[id].bandId === activeBand.id) {
          next[id] = prev[id];
        }
      }
      return next;
    });

    for (const songId of ids) {
      const songPath = `bands/${activeBand.id}/songs/${songId}`;
      const unsub = onSnapshot(
        doc(db, 'bands', activeBand.id, 'songs', songId),
        (snap) => {
          loadedSet.add(songId);
          if (snap.exists()) {
            const data = snap.data() as Omit<Song, 'id'>;
            setSongsById((prev) => ({
              ...prev,
              [songId]: { id: snap.id, ...data },
            }));
          } else {
            setSongsById((prev) => {
              const copy = { ...prev };
              delete copy[songId];
              return copy;
            });
          }
          if (loadedSet.size >= ids.length) {
            setSongsLoading(false);
          }
        },
        (error) => {
          try {
            handleFirestoreError(error, OperationType.GET, songPath);
          } catch (e) {
            setFatalError(e instanceof Error ? e : new Error(String(e)));
          }
        }
      );
      unsubs.push(unsub);
    }

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [user, activeBand?.id, songIdsKey]);

  const orderedSongs = useMemo(() => {
    if (!activeBand) return [];
    const list: Song[] = [];
    for (const id of activeBand.songIds) {
      if (id === GEAR_DOC_ID) continue;
      const song = songsById[id];
      if (song) list.push(song);
    }
    return list;
  }, [activeBand, songsById]);

  const equipmentItems = useMemo(
    () => parseEquipmentItems(songsById[GEAR_DOC_ID]?.lyricsWithChords),
    [songsById]
  );

  const hasEquipmentDoc = Boolean(
    songsById[GEAR_DOC_ID] || activeBand?.songIds.includes(GEAR_DOC_ID)
  );

  // Handlers
  const handleSelectBand = async (bandId: string) => {
    if (!user) return;
    setActiveBandId(bandId);
    setMemberFilter('');
    setSelectedSongId(null);
    await switchActiveBand(user.uid, bandId);
  };

  const handleOpenPractice = (songId: string) => {
    setSelectedSongId(songId);
    setActiveView('practice');
  };

  const handleAssignSlot = async (song: Song, slot: InstrumentSlotKey, memberName: string) => {
    if (!activeBand) return;
    const nextAssignments = {
      ...song.assignments,
      [slot]: memberName,
    };
    await updateSongAssignments(activeBand.id, song.id, nextAssignments);
    showToast(
      memberName
        ? `Assigned ${memberName} on ${song.title}`
        : `Cleared slot on ${song.title}`
    );
  };

  const handleQuickAddRosterMember = async (name: string) => {
    if (!activeBand) return;
    await updateBandRoster(activeBand.id, [...activeBand.roster, name]);
    showToast(`Added ${name} to band roster`);
  };

  const handleSaveSong = async (input: SongFormInput, existing?: Song) => {
    if (!activeBand || !user) return;
    if (existing) {
      await updateSongFull(activeBand.id, existing.id, input, existing.orderIndex);
      showToast(`Updated "${input.title}"`);
    } else {
      const nextIndex = orderedSongs.length + 1;
      const newId = await addSongToBand(activeBand.id, user.uid, input, nextIndex);
      setSelectedSongId(newId);
      showToast(`Added "${input.title}" to setlist`);
    }
  };

  const handleDeleteSong = async (song: Song) => {
    if (!activeBand) return;
    await deleteSongFromBand(activeBand.id, song.id);
    if (selectedSongId === song.id) {
      setSelectedSongId(null);
    }
    showToast(`Removed "${song.title}"`);
  };

  const handleUpdateSongChart = async (
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
  ) => {
    if (!activeBand) return;
    await updateSongChart(activeBand.id, songId, patch);
  };

  const handleJoinBand = async (code: string) => {
    if (!user) return;
    const res = await joinBandByInviteCode(user, code);
    setActiveBandId(res.bandId);
    setActiveView('setlist');
    setMemberFilter('');
    showToast(
      res.alreadyMember
        ? `Switched to "${res.bandName}"`
        : `Joined "${res.bandName}" setlist`
    );
  };

  const handleCreateBand = async (name: string, includeStarters: boolean) => {
    if (!user) return;
    const newId = await createBandWithStarters(user, name, includeStarters);
    setActiveBandId(newId);
    setActiveView('setlist');
    setMemberFilter('');
    showToast(`Created workspace "${name}"`);
  };

  const handleSaveEquipment = async (nextItems: EquipmentItem[]) => {
    if (!activeBand || !user) return;
    await saveBandEquipment(activeBand.id, user.uid, nextItems, hasEquipmentDoc);
  };

  // Loading & Auth gates
  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center text-slate-400">
        <div className="flex items-center gap-3 text-sm">
          <Disc3 className="w-5 h-5 text-amber-400 animate-spin" />
          <span>Loading StageDeck...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (!activeBand || bootstrapping || joiningFromLink) {
    return (
      <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center text-slate-300">
        <div className="flex items-center gap-3 text-sm">
          <Disc3 className="w-5 h-5 text-amber-400 animate-spin" />
          <span>
            {joiningFromLink
              ? 'Joining your band workspace...'
              : 'Setting up your band rehearsal workspace...'}
          </span>
        </div>
      </div>
    );
  }

  const viewTitle =
    activeView === 'setlist'
      ? 'Setlist Matrix'
      : activeView === 'practice'
        ? 'Chords & Lyrics'
        : activeView === 'equipment'
          ? 'Equipment & Gear'
          : 'Band Roster & Sharing';

  return (
    <div className="min-h-[100dvh] bg-[#0B0E14] text-[#F1F5F9] flex">
      <Sidebar
        user={user}
        bands={bands}
        activeBand={activeBand}
        songs={orderedSongs}
        activeView={activeView}
        memberFilter={memberFilter}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onSelectView={setActiveView}
        onSelectBand={(id) => void handleSelectBand(id)}
        onSelectMemberFilter={setMemberFilter}
        onSignOut={() => void signOutUser()}
        onNotify={showToast}
      />

      <div className="flex-1 flex flex-col min-w-0 min-h-[100dvh] overflow-x-hidden">
        {/* Contextual Workspace Top Bar */}
        <header className="h-14 px-3 sm:px-5 lg:px-6 border-b border-white/[0.08] bg-[#0B0E14] flex items-center justify-between gap-2 sm:gap-4 shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-1.5 text-slate-300 hover:text-white rounded-md shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 truncate max-w-[180px] hidden sm:inline">
                {activeBand.name}
              </span>
              <span className="text-slate-600 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="font-display font-semibold text-white whitespace-nowrap truncate">
                {viewTitle}
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingSong(null);
              setDrawerOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs font-semibold bg-amber-500 text-[#0B0E14] rounded-lg hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Song</span>
          </button>
        </header>

        {/* Active Workspace View */}
        {activeView === 'setlist' && (
          <SetlistMatrix
            band={activeBand}
            songs={orderedSongs}
            loading={songsLoading}
            memberFilter={memberFilter}
            onClearMemberFilter={() => setMemberFilter('')}
            onOpenSong={handleOpenPractice}
            onEditSong={(s) => {
              setEditingSong(s);
              setDrawerOpen(true);
            }}
            onAddSong={() => {
              setEditingSong(null);
              setDrawerOpen(true);
            }}
            onAssignSlot={handleAssignSlot}
            onQuickAddRosterMember={handleQuickAddRosterMember}
          />
        )}

        {activeView === 'practice' && (
          <PracticeStudio
            songs={orderedSongs}
            selectedSongId={selectedSongId}
            onBackToSetlist={() => setActiveView('setlist')}
            onSelectSong={setSelectedSongId}
            onUpdateSongChart={handleUpdateSongChart}
            onAddSong={() => {
              setEditingSong(null);
              setDrawerOpen(true);
            }}
            onNotify={showToast}
          />
        )}

        {activeView === 'equipment' && (
          <EquipmentView
            band={activeBand}
            items={equipmentItems}
            onSaveEquipment={handleSaveEquipment}
            onNotify={showToast}
          />
        )}

        {activeView === 'roster' && (
          <BandRosterView
            band={activeBand}
            currentUid={user.uid}
            songs={orderedSongs}
            onUpdateRoster={async (next) => {
              await updateBandRoster(activeBand.id, next);
              showToast('Band roster updated');
            }}
            onRenameBand={async (name) => {
              await updateBandName(activeBand.id, name);
              showToast('Workspace renamed');
            }}
            onJoinBand={handleJoinBand}
            onCreateBand={handleCreateBand}
            onInspectMemberSongs={(memberName) => {
              setMemberFilter(memberName);
              setActiveView('setlist');
            }}
            onNotify={showToast}
          />
        )}
      </div>

      <SongDrawer
        open={drawerOpen}
        editingSong={editingSong}
        roster={activeBand.roster}
        defaultRecommendedBy={user.displayName?.split(' ')[0] || ''}
        onClose={() => {
          setDrawerOpen(false);
          setEditingSong(null);
        }}
        onSave={handleSaveSong}
        onDelete={handleDeleteSong}
      />

      {toast && (
        <div
          role="status"
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:bottom-5 sm:right-5 z-50 px-4 py-2.5 rounded-lg bg-[#1A2130] border border-amber-500/35 text-xs font-medium text-white shadow-2xl text-center sm:text-left"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
