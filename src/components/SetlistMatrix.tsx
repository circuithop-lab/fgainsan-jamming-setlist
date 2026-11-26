import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  ExternalLink,
  FileMusic,
  Pencil,
  Plus,
  X,
  Check,
  UserPlus,
  Music2,
  AlignLeft,
} from 'lucide-react';
import {
  Band,
  INSTRUMENT_SLOTS,
  InstrumentSlotKey,
  Song,
} from '../types';
import { buildFallbackChordsUrl } from '../utils/chords';

interface SetlistMatrixProps {
  band: Band;
  songs: Song[];
  loading: boolean;
  memberFilter: string;
  onClearMemberFilter: () => void;
  onOpenSong: (songId: string) => void;
  onEditSong: (song: Song) => void;
  onAddSong: () => void;
  onAssignSlot: (song: Song, slot: InstrumentSlotKey, memberName: string) => Promise<void>;
  onQuickAddRosterMember: (name: string) => Promise<void>;
}

interface ActiveCellPopover {
  songId: string;
  slot: InstrumentSlotKey;
}

export const SetlistMatrix: React.FC<SetlistMatrixProps> = ({
  band,
  songs,
  loading,
  memberFilter,
  onClearMemberFilter,
  onOpenSong,
  onEditSong,
  onAddSong,
  onAssignSlot,
  onQuickAddRosterMember,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activePopover, setActivePopover] = useState<ActiveCellPopover | null>(null);
  const [customMemberInput, setCustomMemberInput] = useState('');
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setActivePopover(null);
        setCustomMemberInput('');
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActivePopover(null);
        setCustomMemberInput('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const filteredSongs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return songs.filter((song) => {
      if (memberFilter) {
        const lower = memberFilter.toLowerCase();
        const isAssigned = INSTRUMENT_SLOTS.some(
          (slot) => song.assignments[slot.key].toLowerCase() === lower
        );
        if (!isAssigned) return false;
      }
      if (!q) return true;
      const inMeta =
        song.title.toLowerCase().includes(q) ||
        song.artist.toLowerCase().includes(q) ||
        song.recommendedBy.toLowerCase().includes(q) ||
        song.keyChord.toLowerCase().includes(q);
      const inSlots = INSTRUMENT_SLOTS.some((slot) =>
        song.assignments[slot.key].toLowerCase().includes(q)
      );
      return inMeta || inSlots;
    });
  }, [songs, searchQuery, memberFilter]);

  const handleAssignAndClose = async (song: Song, slot: InstrumentSlotKey, name: string) => {
    setActivePopover(null);
    setCustomMemberInput('');
    await onAssignSlot(song, slot, name);
  };

  const handleAddAndAssign = async (e: React.FormEvent, song: Song, slot: InstrumentSlotKey) => {
    e.preventDefault();
    const cleaned = customMemberInput.trim();
    if (!cleaned) return;
    setActivePopover(null);
    setCustomMemberInput('');
    if (!band.roster.some((r) => r.toLowerCase() === cleaned.toLowerCase())) {
      await onQuickAddRosterMember(cleaned);
    }
    await onAssignSlot(song, slot, cleaned);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Toolbar & Inline Summary */}
      <div className="px-6 py-4 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
          <div className="relative flex-1 max-w-xs min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search song, artist, key, or musician..."
              className="w-full bg-[#131822] border border-white/[0.08] rounded-lg pl-9 pr-8 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {memberFilter && (
            <button
              type="button"
              onClick={onClearMemberFilter}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 transition-colors whitespace-nowrap"
            >
              <span>Showing: {memberFilter}</span>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 tabular-nums whitespace-nowrap">
          <span>{songs.length} tracks</span>
          <span aria-hidden="true">·</span>
          <span>{band.roster.length} musicians</span>
        </div>
      </div>

      {/* Main Matrix Viewport */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-11 bg-[#131822] border border-white/[0.06] rounded-md animate-pulse"
              />
            ))}
          </div>
        ) : songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-[#131822] border border-white/[0.08] flex items-center justify-center text-amber-400">
              <Music2 className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-md">
              <h2 className="text-lg font-semibold text-white">No songs in this setlist yet</h2>
              <p className="text-sm text-slate-400">
                Add your first track to assign vocalists and instrumentalists and build your shared chords and lyrics sheet.
              </p>
            </div>
            <button
              type="button"
              onClick={onAddSong}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-amber-500 text-[#0B0E14] rounded-lg hover:bg-amber-400 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add First Song
            </button>
          </div>
        ) : filteredSongs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-3">
            <p className="text-sm text-slate-300">No songs match your current filters.</p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                onClearMemberFilter();
              }}
              className="px-3.5 py-1.5 text-xs font-medium bg-[#1A2130] text-white rounded-lg hover:bg-[#232D42] transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <table className="w-full border-collapse text-left min-w-[1440px]">
            <thead className="sticky top-0 z-20 bg-[#111621] border-b border-white/[0.08]">
              <tr className="text-[11px] font-semibold text-slate-400 tracking-wide">
                <th className="sticky left-0 z-30 bg-[#111621] py-3 pl-5 pr-2 w-10 text-right font-mono">
                  #
                </th>
                <th className="sticky left-10 z-30 bg-[#111621] py-3 px-3 min-w-[230px] border-r border-white/[0.06]">
                  Title / Artist
                </th>
                <th className="py-3 px-2.5 w-24 whitespace-nowrap">Rec. By</th>
                <th className="py-3 px-2.5 w-44 whitespace-nowrap">Lyrics &amp; Links</th>
                <th className="py-3 px-2.5 w-16 whitespace-nowrap border-r border-white/[0.06]">
                  Key
                </th>
                {INSTRUMENT_SLOTS.map((slot) => (
                  <th
                    key={slot.key}
                    className="py-3 px-2 w-24 whitespace-nowrap text-center"
                    title={slot.label}
                  >
                    {slot.label}
                  </th>
                ))}
                <th className="py-3 pl-2 pr-5 w-28 text-right whitespace-nowrap">Sheet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06] text-xs">
              {filteredSongs.map((song, idx) => (
                  <tr
                    key={song.id}
                    className="group hover:bg-white/[0.025] transition-colors"
                  >
                    {/* Index */}
                    <td className="sticky left-0 z-10 bg-[#0B0E14] group-hover:bg-[#111620] py-2.5 pl-5 pr-2 text-right font-mono tabular-nums text-slate-500">
                      {idx + 1}
                    </td>

                    {/* Title & Artist */}
                    <td className="sticky left-10 z-10 bg-[#0B0E14] group-hover:bg-[#111620] py-2.5 px-3 border-r border-white/[0.06] max-w-[260px]">
                      <button
                        type="button"
                        onClick={() => onOpenSong(song.id)}
                        className="text-left block w-full group/title"
                      >
                        <div className="text-[13px] font-semibold text-white group-hover/title:text-amber-400 transition-colors truncate">
                          {song.title}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {song.artist || 'Unknown artist'}
                        </div>
                      </button>
                    </td>

                    {/* Recommended By */}
                    <td className="py-2.5 px-2.5 text-slate-300 truncate max-w-[96px]">
                      {song.recommendedBy || <span className="text-slate-600">—</span>}
                    </td>

                    {/* Lyrics & External Links */}
                    <td className="py-2.5 px-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenSong(song.id)}
                          title={`Open chords & lyrics page for ${song.title}`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 hover:text-amber-200 font-medium transition-colors"
                        >
                          <AlignLeft className="w-3 h-3" />
                          <span>Lyrics</span>
                        </button>
                        <a
                          href={song.chordsUrl || buildFallbackChordsUrl(song.title, song.artist)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open Chords & Tabs"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#161C28] hover:bg-[#1F283A] text-slate-300 hover:text-white transition-colors"
                        >
                          <FileMusic className="w-3 h-3 text-emerald-400" />
                          <span>Chords</span>
                        </a>
                        {song.referenceUrl && (
                          <a
                            href={song.referenceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open Reference Track Link"
                            className="inline-flex items-center gap-1 px-1.5 py-1 rounded bg-[#161C28] hover:bg-[#1F283A] text-slate-300 hover:text-white transition-colors"
                          >
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </a>
                        )}
                      </div>
                    </td>

                    {/* Key & BPM */}
                    <td className="py-2.5 px-2.5 font-mono tabular-nums whitespace-nowrap border-r border-white/[0.06]">
                      <div className="text-amber-300 font-medium">{song.keyChord || '—'}</div>
                      <div className="text-[10px] text-slate-500">{song.bpm} bpm</div>
                    </td>

                    {/* 10 Instrument Assignment Columns */}
                    {INSTRUMENT_SLOTS.map((slot) => {
                      const assigned = song.assignments[slot.key];
                      const isOpen =
                        activePopover?.songId === song.id && activePopover?.slot === slot.key;
                      const matchesFilter =
                        memberFilter &&
                        assigned.toLowerCase() === memberFilter.toLowerCase();

                      return (
                        <td key={slot.key} className="py-1.5 px-1.5 relative">
                          <button
                            type="button"
                            onClick={() => {
                              setCustomMemberInput('');
                              setActivePopover(
                                isOpen ? null : { songId: song.id, slot: slot.key }
                              );
                            }}
                            className={`w-full min-h-[32px] px-2 py-1 rounded-md text-center truncate transition-colors border ${
                              matchesFilter
                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 font-semibold'
                                : assigned
                                  ? 'bg-[#171E2C] border-white/[0.08] text-slate-100 font-medium hover:border-amber-500/40'
                                  : 'bg-transparent border-transparent text-slate-600 hover:bg-white/[0.04] hover:text-slate-400'
                            }`}
                            title={
                              assigned
                                ? `${slot.label}: ${assigned} (click to reassign)`
                                : `Assign ${slot.label}`
                            }
                          >
                            {assigned || '—'}
                          </button>

                          {isOpen && (
                            <div
                              ref={popoverRef}
                              className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-40 w-48 bg-[#161C28] border border-white/[0.14] rounded-lg shadow-2xl overflow-hidden"
                            >
                              <div className="px-3 py-2 border-b border-white/[0.08] flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-slate-300">
                                  {slot.label}
                                </span>
                                {assigned && (
                                  <button
                                    type="button"
                                    onClick={() => void handleAssignAndClose(song, slot.key, '')}
                                    className="text-[11px] text-rose-400 hover:text-rose-300"
                                  >
                                    Clear
                                  </button>
                                )}
                              </div>
                              <div className="max-h-48 overflow-y-auto py-1">
                                {band.roster.map((member) => {
                                  const selected =
                                    assigned.toLowerCase() === member.toLowerCase();
                                  return (
                                    <button
                                      key={member}
                                      type="button"
                                      onClick={() =>
                                        void handleAssignAndClose(song, slot.key, member)
                                      }
                                      className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between hover:bg-white/[0.06] transition-colors ${
                                        selected ? 'text-amber-400 font-semibold' : 'text-slate-200'
                                      }`}
                                    >
                                      <span className="truncate">{member}</span>
                                      {selected && <Check className="w-3.5 h-3.5 shrink-0" />}
                                    </button>
                                  );
                                })}
                              </div>
                              <form
                                onSubmit={(e) => void handleAddAndAssign(e, song, slot.key)}
                                className="p-2 border-t border-white/[0.08] flex items-center gap-1.5 bg-[#111621]"
                              >
                                <input
                                  type="text"
                                  value={customMemberInput}
                                  onChange={(e) => setCustomMemberInput(e.target.value)}
                                  placeholder="Add name..."
                                  maxLength={60}
                                  className="flex-1 min-w-0 bg-[#161C28] border border-white/[0.08] rounded px-2 py-1 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
                                />
                                <button
                                  type="submit"
                                  title="Add musician and assign"
                                  className="p-1.5 rounded bg-amber-500 text-[#0B0E14] hover:bg-amber-400 shrink-0"
                                >
                                  <UserPlus className="w-3.5 h-3.5" />
                                </button>
                              </form>
                            </div>
                          )}
                        </td>
                      );
                    })}

                    {/* Open Sheet & Edit Actions */}
                    <td className="py-2 pl-2 pr-5 whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenSong(song.id)}
                          title="Open Chords & Lyrics page"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#1A2130] hover:bg-amber-500 text-slate-200 hover:text-[#0B0E14] font-medium transition-colors"
                        >
                          <FileMusic className="w-3 h-3" />
                          <span>Open</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditSong(song)}
                          title="Edit song details"
                          aria-label={`Edit ${song.title}`}
                          className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
