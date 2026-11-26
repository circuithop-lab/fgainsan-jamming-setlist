import React, { useMemo, useState } from 'react';
import {
  UserPlus,
  Trash2,
  Copy,
  Check,
  KeyRound,
  Plus,
  ArrowRight,
  Save,
} from 'lucide-react';
import { Band, INSTRUMENT_SLOTS, SCHEMA_LIMITS, Song } from '../types';

interface BandRosterViewProps {
  band: Band;
  currentUid: string;
  songs: Song[];
  onUpdateRoster: (nextRoster: string[]) => Promise<void>;
  onRenameBand: (name: string) => Promise<void>;
  onJoinBand: (inviteCode: string) => Promise<void>;
  onCreateBand: (name: string, includeStarters: boolean) => Promise<void>;
  onInspectMemberSongs: (memberName: string) => void;
  onNotify: (msg: string) => void;
}

export const BandRosterView: React.FC<BandRosterViewProps> = ({
  band,
  currentUid,
  songs,
  onUpdateRoster,
  onRenameBand,
  onJoinBand,
  onCreateBand,
  onInspectMemberSongs,
  onNotify,
}) => {
  const [newMember, setNewMember] = useState('');
  const [bandNameInput, setBandNameInput] = useState(band.name);
  const [joinCode, setJoinCode] = useState('');
  const [newBandName, setNewBandName] = useState('');
  const [includeStarters, setIncludeStarters] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const isOwner = band.ownerId === currentUid;

  const memberStats = useMemo(() => {
    return band.roster.map((name) => {
      const assignedSongs: { songTitle: string; slots: string[] }[] = [];
      const instrumentCounts: Record<string, number> = {};

      for (const song of songs) {
        const matchedSlots: string[] = [];
        for (const slot of INSTRUMENT_SLOTS) {
          if (song.assignments[slot.key].toLowerCase() === name.toLowerCase()) {
            matchedSlots.push(slot.label);
            instrumentCounts[slot.label] = (instrumentCounts[slot.label] || 0) + 1;
          }
        }
        if (matchedSlots.length > 0) {
          assignedSongs.push({ songTitle: song.title, slots: matchedSlots });
        }
      }

      return {
        name,
        songCount: assignedSongs.length,
        roles: Object.keys(instrumentCounts),
      };
    });
  }, [band.roster, songs]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newMember.trim();
    if (!trimmed) return;
    if (band.roster.some((r) => r.toLowerCase() === trimmed.toLowerCase())) {
      onNotify(`${trimmed} is already in the band roster.`);
      return;
    }
    if (band.roster.length >= SCHEMA_LIMITS.ROSTER_MAX) {
      onNotify(`Roster limit (${SCHEMA_LIMITS.ROSTER_MAX} members) reached.`);
      return;
    }
    setBusy(true);
    try {
      await onUpdateRoster([...band.roster, trimmed]);
      setNewMember('');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveMember = async (name: string) => {
    setBusy(true);
    try {
      await onUpdateRoster(band.roster.filter((m) => m !== name));
    } finally {
      setBusy(false);
    }
  };

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(band.inviteCode);
      setCopied(true);
      onNotify(`Invite code ${band.inviteCode} copied`);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      onNotify(`Invite code: ${band.inviteCode}`);
    }
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setBusy(true);
    setJoinError(null);
    try {
      await onJoinBand(joinCode.trim());
      setJoinCode('');
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Unable to join band.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBandName.trim()) return;
    setBusy(true);
    try {
      await onCreateBand(newBandName.trim(), includeStarters);
      setNewBandName('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8 max-w-6xl w-full mx-auto space-y-8">
      {/* Top Split: Roster Management + Invite Sharing */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Band Roster & Workload Table */}
        <div className="lg:col-span-7 bg-[#131822] border border-white/[0.08] rounded-xl flex flex-col">
          <div className="px-6 py-4 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">Band Roster &amp; Workload</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Everyone listed here appears in the Setlist Matrix assignment dropdowns.
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-400">
              {band.roster.length} / {SCHEMA_LIMITS.ROSTER_MAX}
            </span>
          </div>

          <form
            onSubmit={handleAddMember}
            className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-2.5"
          >
            <input
              type="text"
              value={newMember}
              onChange={(e) => setNewMember(e.target.value)}
              maxLength={SCHEMA_LIMITS.SLOT_VALUE_MAX}
              placeholder="Add bandmate name (e.g. Marco)..."
              className="flex-1 bg-[#0F131C] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
            />
            <button
              type="submit"
              disabled={busy || !newMember.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-amber-500 text-[#0B0E14] rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <UserPlus className="w-4 h-4" />
              Add Member
            </button>
          </form>

          <div className="divide-y divide-white/[0.06]">
            {memberStats.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-slate-400">
                No musicians added yet. Add names above to populate role dropdowns.
              </div>
            ) : (
              memberStats.map((m) => (
                <div
                  key={m.name}
                  className="px-6 py-3 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onInspectMemberSongs(m.name)}
                      className="text-sm font-medium text-white hover:text-amber-400 transition-colors flex items-center gap-1.5"
                    >
                      <span>{m.name}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                    <div className="text-xs text-slate-400 truncate mt-0.5">
                      {m.roles.length > 0 ? m.roles.join(' · ') : 'No parts assigned yet'}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-xs font-mono tabular-nums text-slate-300">
                      {m.songCount} {m.songCount === 1 ? 'song' : 'songs'}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleRemoveMember(m.name)}
                      title={`Remove ${m.name} from roster`}
                      aria-label={`Remove ${m.name}`}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-md transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Workspace Settings & Invite Code Sharing */}
        <div className="lg:col-span-5 space-y-6">
          {/* Invite Bandmates */}
          <div className="bg-[#131822] border border-white/[0.08] rounded-xl p-6 space-y-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-white">Share This Setlist</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Send this invite code to your bandmates. Once they sign in and enter it, everyone edits the same live setlist together.
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-[#0B0E14] border border-white/[0.08]">
              <span className="font-mono text-xl font-semibold tracking-widest text-amber-400 tabular-nums">
                {band.inviteCode}
              </span>
              <button
                type="button"
                onClick={handleCopyInvite}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#1A2130] hover:bg-[#253045] text-white rounded-md transition-colors whitespace-nowrap"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Code'}</span>
              </button>
            </div>

            <div className="text-xs text-slate-400 tabular-nums">
              {band.memberUids.length} signed-in {band.memberUids.length === 1 ? 'account' : 'accounts'} synced to <span className="text-slate-200 font-medium">{band.name}</span>
            </div>

            {isOwner && (
              <div className="pt-3 border-t border-white/[0.08] space-y-2">
                <label htmlFor="rename-band" className="block text-xs font-medium text-slate-300">
                  Workspace Name
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="rename-band"
                    type="text"
                    maxLength={SCHEMA_LIMITS.BAND_NAME_MAX}
                    value={bandNameInput}
                    onChange={(e) => setBandNameInput(e.target.value)}
                    className="flex-1 bg-[#0F131C] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500/60"
                  />
                  <button
                    type="button"
                    disabled={busy || !bandNameInput.trim() || bandNameInput.trim() === band.name}
                    onClick={() => void onRenameBand(bandNameInput.trim())}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#1A2130] hover:bg-[#263044] text-white rounded-lg disabled:opacity-40 transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Join Another Band */}
          <div className="bg-[#131822] border border-white/[0.08] rounded-xl p-6 space-y-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-white">Join Another Band</h2>
              <p className="text-xs text-slate-400">
                Have an invite code from a bandmate? Paste it below to sync their setlist.
              </p>
            </div>

            {joinError && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                {joinError}
              </div>
            )}

            <form onSubmit={handleJoinSubmit} className="flex items-center gap-2">
              <div className="relative flex-1">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="JAM-4821"
                  maxLength={16}
                  className="w-full bg-[#0F131C] border border-white/[0.08] rounded-lg pl-9 pr-3 py-2 text-sm font-mono uppercase tracking-wider text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/60"
                />
              </div>
              <button
                type="submit"
                disabled={busy || joinCode.trim().length < 6}
                className="px-4 py-2 text-sm font-semibold bg-[#1E2738] hover:bg-amber-500 text-white hover:text-[#0B0E14] rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                Join
              </button>
            </form>
          </div>

          {/* Create New Band Workspace */}
          <div className="bg-[#131822] border border-white/[0.08] rounded-xl p-6 space-y-3">
            <h2 className="text-base font-semibold text-white">Create New Setlist Workspace</h2>
            <form onSubmit={handleCreateSubmit} className="space-y-3">
              <input
                type="text"
                value={newBandName}
                onChange={(e) => setNewBandName(e.target.value)}
                maxLength={SCHEMA_LIMITS.BAND_NAME_MAX}
                placeholder="e.g. Friday Gig Acoustic Set"
                className="w-full bg-[#0F131C] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
              />
              <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeStarters}
                  onChange={(e) => setIncludeStarters(e.target.checked)}
                  className="rounded border-white/20 bg-[#0F131C] accent-amber-500"
                />
                <span>Pre-populate with the 5 starter tracks &amp; roster</span>
              </label>
              <button
                type="submit"
                disabled={busy || !newBandName.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#1A2130] hover:bg-[#253045] text-white rounded-lg disabled:opacity-50 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Workspace
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
