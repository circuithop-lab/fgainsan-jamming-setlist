import React, { useState } from 'react';
import {
  Table2,
  FileMusic,
  Speaker,
  Users,
  Copy,
  Check,
  Link2,
  LogOut,
  X,
  ChevronDown,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { Band, INSTRUMENT_SLOTS, Song, WorkspaceView } from '../types';

interface SidebarProps {
  user: User;
  bands: Band[];
  activeBand: Band | null;
  songs: Song[];
  activeView: WorkspaceView;
  memberFilter: string;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onSelectView: (view: WorkspaceView) => void;
  onSelectBand: (bandId: string) => void;
  onSelectMemberFilter: (memberName: string) => void;
  onSignOut: () => void;
  onNotify: (msg: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  bands,
  activeBand,
  songs,
  activeView,
  memberFilter,
  mobileOpen,
  onCloseMobile,
  onSelectView,
  onSelectBand,
  onSelectMemberFilter,
  onSignOut,
  onNotify,
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyCode = async () => {
    if (!activeBand?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(activeBand.inviteCode);
      setCopied(true);
      onNotify(`Invite code ${activeBand.inviteCode} copied to clipboard`);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      onNotify(`Invite code: ${activeBand.inviteCode}`);
    }
  };

  const handleCopyInviteLink = async () => {
    if (!activeBand?.inviteCode) return;
    const url = `${window.location.origin}${window.location.pathname}?join=${encodeURIComponent(activeBand.inviteCode)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      onNotify('Invite link copied — send it to your bandmates to sync!');
      window.setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      onNotify(`Share link: ${url}`);
    }
  };

  const countSongsForMember = (name: string) =>
    songs.filter((song) =>
      INSTRUMENT_SLOTS.some(
        (slot) => song.assignments[slot.key].toLowerCase() === name.toLowerCase()
      )
    ).length;

  const navItems: { id: WorkspaceView; label: string; icon: React.ReactNode }[] = [
    { id: 'setlist', label: 'Setlist Matrix', icon: <Table2 className="w-4 h-4 shrink-0" /> },
    { id: 'practice', label: 'Chords & Lyrics', icon: <FileMusic className="w-4 h-4 shrink-0" /> },
    { id: 'equipment', label: 'Equipment & Gear', icon: <Speaker className="w-4 h-4 shrink-0" /> },
    { id: 'roster', label: 'Band Roster', icon: <Users className="w-4 h-4 shrink-0" /> },
  ];

  const railContent = (
    <div className="h-[100dvh] lg:h-full w-[268px] max-w-[85vw] lg:w-[248px] bg-[#0F131C] border-r border-white/[0.08] flex flex-col select-none">
      {/* Brand Logo Crest & Wordmark */}
      <div className="px-4 pt-3.5 pb-3 lg:pt-4 lg:pb-3.5 border-b border-white/[0.08] shrink-0 relative flex flex-col items-center gap-2 lg:gap-2.5">
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation"
          className="lg:hidden absolute top-2.5 right-2.5 z-10 p-2 text-slate-400 hover:text-white rounded-md bg-[#0F131C]/80"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="w-full max-w-[132px] lg:max-w-[200px] aspect-[11/10] rounded-2xl overflow-hidden border border-white/15 bg-[#060C19] shadow-lg shrink-0">
          <img
            src={`${import.meta.env.BASE_URL}assets/aistudio/image_b9eac5aa.png`}
            alt="The ex-LEAR Network Germany logo"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center"
          />
        </div>
        <span className="font-display text-base font-bold tracking-tight text-white whitespace-nowrap">
          StageDeck
        </span>
      </div>

      {/* Band Selector & Invite Code */}
      {activeBand && (
        <div className="px-4 py-4 border-b border-white/[0.08] space-y-2.5 shrink-0">
          <div className="space-y-1">
            <label htmlFor="band-switcher" className="block text-[11px] font-medium text-slate-400">
              Active Band
            </label>
            <div className="relative">
              <select
                id="band-switcher"
                value={activeBand.id}
                onChange={(e) => onSelectBand(e.target.value)}
                className="w-full appearance-none bg-[#161C28] border border-white/[0.08] rounded-lg pl-3 pr-8 py-2 text-sm font-medium text-white focus:outline-none focus:border-amber-500/60 transition-colors truncate"
              >
                {bands.map((b) => (
                  <option key={b.id} value={b.id} className="bg-[#131822] text-white">
                    {b.name} ({b.inviteCode})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopyCode}
              className="flex-1 min-w-0 flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-md bg-[#161C28] hover:bg-[#1C2434] border border-white/[0.06] text-xs transition-colors"
              title="Copy invite code to share this setlist with your band"
            >
              <span className="font-mono font-medium text-amber-400 tabular-nums tracking-wider truncate">
                {activeBand.inviteCode}
              </span>
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              )}
            </button>
            <button
              type="button"
              onClick={handleCopyInviteLink}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
              title="Copy one-click join link for bandmates"
            >
              {copiedLink ? (
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <Link2 className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{copiedLink ? 'Copied' : 'Link'}</span>
            </button>
          </div>
          <div className="text-[11px] text-slate-500 tabular-nums">
            {activeBand.memberUids.length} synced{' '}
            {activeBand.memberUids.length === 1 ? 'account' : 'accounts'}
          </div>
        </div>
      )}

      {/* Primary Navigation */}
      <nav className="px-3 py-3 space-y-1 shrink-0" aria-label="Workspace navigation">
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectView(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-[#1A2130] text-amber-400'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Quick Filter by Musician */}
      {activeBand && (
        <div className="flex-1 overflow-y-auto px-3 py-3 border-t border-white/[0.08]">
          <div className="px-3 pb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Filter by Musician</span>
            {memberFilter && (
              <button
                type="button"
                onClick={() => onSelectMemberFilter('')}
                className="text-xs text-amber-400 hover:text-amber-300"
              >
                Clear
              </button>
            )}
          </div>
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => {
                onSelectMemberFilter('');
                if (activeView !== 'setlist') onSelectView('setlist');
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs transition-colors ${
                memberFilter === '' && activeView === 'setlist'
                  ? 'bg-white/[0.06] text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
              }`}
            >
              <span className="truncate">Everyone</span>
              <span className="font-mono tabular-nums text-slate-500">{songs.length}</span>
            </button>

            {activeBand.roster.map((name) => {
              const count = countSongsForMember(name);
              const selected = memberFilter.toLowerCase() === name.toLowerCase();
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    onSelectMemberFilter(selected ? '' : name);
                    if (activeView !== 'setlist') onSelectView('setlist');
                    onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs transition-colors ${
                    selected
                      ? 'bg-amber-500/15 text-amber-300 font-medium'
                      : 'text-slate-300 hover:text-white hover:bg-white/[0.03]'
                  }`}
                >
                  <span className="truncate">{name}</span>
                  <span className="font-mono tabular-nums text-slate-500">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* User Account Footer */}
      <div className="px-4 py-3.5 border-t border-white/[0.08] flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <div className="text-xs font-medium text-white truncate">
            {user.displayName || 'Band Member'}
          </div>
          <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          title="Sign out"
          aria-label="Sign out"
          className="p-2 text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-md transition-colors shrink-0"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block shrink-0 h-screen sticky top-0">{railContent}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/65"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{railContent}</div>
        </div>
      )}
    </>
  );
};
