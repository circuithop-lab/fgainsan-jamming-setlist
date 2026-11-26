import React, { useMemo, useState } from 'react';
import {
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  PackageCheck,
  Speaker,
  Sparkles,
  Minus,
  X,
} from 'lucide-react';
import {
  Band,
  EQUIPMENT_CATEGORIES,
  EquipmentCategory,
  EquipmentItem,
  EquipmentStatus,
} from '../types';

interface EquipmentViewProps {
  band: Band;
  items: EquipmentItem[];
  onSaveEquipment: (nextItems: EquipmentItem[]) => Promise<void>;
  onNotify: (msg: string) => void;
}

const STARTER_EQUIPMENT: Omit<EquipmentItem, 'id'>[] = [
  { name: 'Electric Guitar', category: 'instruments', quantity: 2, broughtBy: '', status: 'needed', notes: 'With strap & picks' },
  { name: 'Acoustic Guitar', category: 'instruments', quantity: 1, broughtBy: '', status: 'needed', notes: 'With capo' },
  { name: 'Bass Guitar', category: 'instruments', quantity: 1, broughtBy: '', status: 'needed', notes: '' },
  { name: 'Keyboard + Stand + Sustain Pedal', category: 'instruments', quantity: 1, broughtBy: '', status: 'needed', notes: 'With power adapter' },
  { name: 'Drum Kit / Cajon & Percussion', category: 'instruments', quantity: 1, broughtBy: '', status: 'needed', notes: 'Sticks & shaker' },
  { name: 'Guitar Amp', category: 'amps_pa', quantity: 2, broughtBy: '', status: 'needed', notes: '' },
  { name: 'Bass Amp', category: 'amps_pa', quantity: 1, broughtBy: '', status: 'needed', notes: '' },
  { name: 'PA Speakers & Mixer', category: 'amps_pa', quantity: 1, broughtBy: '', status: 'needed', notes: 'Main vocals & keys' },
  { name: 'Vocal Microphones & Stands', category: 'mics_cables', quantity: 3, broughtBy: '', status: 'needed', notes: 'With XLR cables' },
  { name: 'Instrument Cables (1/4" TS)', category: 'mics_cables', quantity: 6, broughtBy: '', status: 'needed', notes: 'Bring spare cables' },
  { name: 'Power Strips & Extension Cords', category: 'accessories', quantity: 3, broughtBy: '', status: 'needed', notes: 'Surge protected' },
  { name: 'Music / Tablet Stands', category: 'accessories', quantity: 3, broughtBy: '', status: 'needed', notes: 'For chords & lyrics' },
];

function makeItemId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `eq-${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
  }
  return `eq-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

const STATUS_CYCLE: EquipmentStatus[] = ['needed', 'confirmed', 'packed'];

const STATUS_META: Record<
  EquipmentStatus,
  { label: string; badgeClass: string }
> = {
  needed: {
    label: 'Needed',
    badgeClass: 'bg-amber-500/15 border-amber-500/35 text-amber-300',
  },
  confirmed: {
    label: 'Confirmed',
    badgeClass: 'bg-sky-500/15 border-sky-500/35 text-sky-300',
  },
  packed: {
    label: 'Packed',
    badgeClass: 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300',
  },
};

export const EquipmentView: React.FC<EquipmentViewProps> = ({
  band,
  items,
  onSaveEquipment,
  onNotify,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<EquipmentCategory>('instruments');
  const [quantity, setQuantity] = useState(1);
  const [broughtBy, setBroughtBy] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [categoryFilter, setCategoryFilter] = useState<'all' | 'unassigned' | EquipmentCategory>('all');
  const [personFilter, setPersonFilter] = useState<string>('');

  const allBringers = useMemo(() => {
    const set = new Set<string>(band.roster);
    for (const item of items) {
      if (item.broughtBy) set.add(item.broughtBy);
    }
    return Array.from(set);
  }, [band.roster, items]);

  const stats = useMemo(() => {
    const total = items.length;
    const assigned = items.filter((i) => i.broughtBy.trim().length > 0).length;
    const unassigned = total - assigned;
    const packed = items.filter((i) => i.status === 'packed').length;
    return { total, assigned, unassigned, packed };
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (categoryFilter === 'unassigned') {
        if (item.broughtBy.trim().length > 0) return false;
      } else if (categoryFilter !== 'all' && item.category !== categoryFilter) {
        return false;
      }
      if (personFilter) {
        if (item.broughtBy.toLowerCase() !== personFilter.toLowerCase()) return false;
      }
      return true;
    });
  }, [items, categoryFilter, personFilter]);

  const persist = async (next: EquipmentItem[], message?: string) => {
    setSaving(true);
    try {
      await onSaveEquipment(next);
      if (message) onNotify(message);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Unable to save equipment list');
    } finally {
      setSaving(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedName = name.trim();
    if (!cleanedName) return;
    const cleanedBringer = broughtBy.trim();
    const newItem: EquipmentItem = {
      id: makeItemId(),
      name: cleanedName.slice(0, 80),
      category,
      quantity: Math.max(1, Math.min(99, Number(quantity) || 1)),
      broughtBy: cleanedBringer.slice(0, 60),
      status: cleanedBringer ? 'confirmed' : 'needed',
      notes: notes.trim().slice(0, 120),
    };
    await persist([...items, newItem], `Added "${newItem.name}" to gear list`);
    setName('');
    setQuantity(1);
    setBroughtBy('');
    setNotes('');
  };

  const handleLoadStarterChecklist = async () => {
    const starterItems: EquipmentItem[] = STARTER_EQUIPMENT.map((t) => ({
      ...t,
      id: makeItemId(),
    }));
    await persist([...items, ...starterItems], 'Loaded standard band equipment checklist');
  };

  const handleAssignBringer = async (itemId: string, nextBringer: string) => {
    const trimmed = nextBringer.trim();
    const next = items.map((it) => {
      if (it.id !== itemId) return it;
      const nextStatus: EquipmentStatus = trimmed
        ? it.status === 'needed'
          ? 'confirmed'
          : it.status
        : 'needed';
      return { ...it, broughtBy: trimmed, status: nextStatus };
    });
    const target = items.find((i) => i.id === itemId);
    await persist(
      next,
      trimmed
        ? `${trimmed} will bring ${target?.name || 'item'}`
        : `Unassigned ${target?.name || 'item'}`
    );
  };

  const handleCycleStatus = async (itemId: string) => {
    const next = items.map((it) => {
      if (it.id !== itemId) return it;
      const idx = STATUS_CYCLE.indexOf(it.status);
      const nextStatus = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
      return { ...it, status: nextStatus };
    });
    await persist(next);
  };

  const handleAdjustQty = async (itemId: string, delta: number) => {
    const next = items.map((it) => {
      if (it.id !== itemId) return it;
      return { ...it, quantity: Math.max(1, Math.min(99, it.quantity + delta)) };
    });
    await persist(next);
  };

  const handleDeleteItem = async (itemId: string) => {
    const target = items.find((i) => i.id === itemId);
    await persist(
      items.filter((i) => i.id !== itemId),
      target ? `Removed "${target.name}"` : undefined
    );
  };

  const getCategoryLabel = (cat: EquipmentCategory) =>
    EQUIPMENT_CATEGORIES.find((c) => c.value === cat)?.shortLabel || 'Equipment';

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto space-y-5 sm:space-y-6 pb-20">
      {/* Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#131822] border border-white/[0.08] rounded-xl p-3.5 sm:p-4">
          <div className="text-[11px] font-medium text-slate-400">Total Gear</div>
          <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-white mt-0.5">
            {stats.total}
          </div>
        </div>
        <div className="bg-[#131822] border border-white/[0.08] rounded-xl p-3.5 sm:p-4">
          <div className="text-[11px] font-medium text-slate-400">Assigned</div>
          <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-sky-400 mt-0.5">
            {stats.assigned}
          </div>
        </div>
        <div className="bg-[#131822] border border-white/[0.08] rounded-xl p-3.5 sm:p-4">
          <div className="text-[11px] font-medium text-slate-400">Still Needed</div>
          <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-amber-400 mt-0.5">
            {stats.unassigned}
          </div>
        </div>
        <div className="bg-[#131822] border border-white/[0.08] rounded-xl p-3.5 sm:p-4">
          <div className="text-[11px] font-medium text-slate-400">Packed / Ready</div>
          <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-emerald-400 mt-0.5">
            {stats.packed}
          </div>
        </div>
      </div>

      {/* Add Equipment Form */}
      <form
        onSubmit={handleAddItem}
        className="bg-[#131822] border border-white/[0.08] rounded-xl p-4 sm:p-5 space-y-3.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-white">
              Add Instrument or Equipment
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Track instruments, amps, mics, cables, and who is bringing each item.
            </p>
          </div>
          {items.length === 0 && (
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleLoadStarterChecklist()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#1A2130] hover:bg-[#253045] border border-amber-500/30 text-amber-300 rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Load Starter Band Gear List</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 sm:gap-3">
          <div className="sm:col-span-4">
            <label htmlFor="gear-name" className="block text-[11px] text-slate-400 mb-1">
              Instrument / Equipment *
            </label>
            <input
              id="gear-name"
              type="text"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Electric Guitar, Vocal Mic, Mixer..."
              className="w-full bg-[#0F131C] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div className="grid grid-cols-3 sm:col-span-4 gap-2.5">
            <div className="col-span-2">
              <label htmlFor="gear-category" className="block text-[11px] text-slate-400 mb-1">
                Category
              </label>
              <select
                id="gear-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as EquipmentCategory)}
                className="w-full bg-[#0F131C] border border-white/[0.08] rounded-lg px-2.5 py-2 text-sm text-white focus:outline-none focus:border-amber-500/60"
              >
                {EQUIPMENT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value} className="bg-[#131822]">
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="gear-qty" className="block text-[11px] text-slate-400 mb-1">
                Qty
              </label>
              <input
                id="gear-qty"
                type="number"
                min={1}
                max={99}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
                className="w-full bg-[#0F131C] border border-white/[0.08] rounded-lg px-2.5 py-2 text-sm font-mono tabular-nums text-white focus:outline-none focus:border-amber-500/60"
              />
            </div>
          </div>

          <div className="sm:col-span-4">
            <label htmlFor="gear-bringer" className="block text-[11px] text-slate-400 mb-1">
              Who Will Bring
            </label>
            <input
              id="gear-bringer"
              type="text"
              list="gear-roster-list"
              maxLength={60}
              value={broughtBy}
              onChange={(e) => setBroughtBy(e.target.value)}
              placeholder="Leave blank if still needed..."
              className="w-full bg-[#0F131C] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
            />
            <datalist id="gear-roster-list">
              {allBringers.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <input
            type="text"
            maxLength={120}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes (e.g. include 2x XLR cables, power adapter)..."
            className="flex-1 min-w-0 bg-[#0F131C] border border-white/[0.08] rounded-lg px-3 py-2 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
          />
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold bg-amber-500 text-[#0B0E14] rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Item</span>
          </button>
        </div>
      </form>

      {/* Filters Bar */}
      {items.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full pb-0.5">
            {(
              [
                { id: 'all', label: `All (${items.length})` },
                { id: 'unassigned', label: `Still Needed (${stats.unassigned})` },
                ...EQUIPMENT_CATEGORIES.map((c) => ({ id: c.value, label: c.shortLabel })),
              ] as const
            ).map((tab) => {
              const active = categoryFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCategoryFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border ${
                    active
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                      : 'bg-[#131822] border-white/[0.08] text-slate-300 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <select
              aria-label="Filter by person"
              value={personFilter}
              onChange={(e) => setPersonFilter(e.target.value)}
              className="bg-[#131822] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/60"
            >
              <option value="" className="bg-[#131822]">
                All Bandmates
              </option>
              {allBringers.map((m) => (
                <option key={m} value={m} className="bg-[#131822]">
                  Brought by: {m}
                </option>
              ))}
            </select>
            {personFilter && (
              <button
                type="button"
                onClick={() => setPersonFilter('')}
                aria-label="Clear person filter"
                className="p-1.5 rounded-lg bg-[#131822] border border-white/[0.08] text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Equipment List */}
      {items.length === 0 ? (
        <div className="bg-[#131822] border border-white/[0.08] rounded-xl py-14 px-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-[#0F131C] border border-white/[0.08] flex items-center justify-center text-amber-400 mx-auto">
            <Speaker className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-semibold text-white">No equipment listed yet</h3>
            <p className="text-xs sm:text-sm text-slate-400">
              Add instruments, amps, mics, and cables above—or load our starter checklist so your bandmates can claim what they&apos;ll bring.
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleLoadStarterChecklist()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold bg-amber-500 text-[#0B0E14] rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>Load Starter Band Gear List</span>
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-[#131822] border border-white/[0.08] rounded-xl py-10 px-6 text-center space-y-3">
          <p className="text-sm text-slate-400">No equipment matches the selected filter.</p>
          <button
            type="button"
            onClick={() => {
              setCategoryFilter('all');
              setPersonFilter('');
            }}
            className="px-3.5 py-1.5 text-xs font-medium bg-[#1A2130] text-white rounded-lg hover:bg-[#232D42]"
          >
            Show All Equipment
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredItems.map((item) => {
            const statusInfo = STATUS_META[item.status];
            return (
              <div
                key={item.id}
                className="bg-[#131822] border border-white/[0.08] rounded-xl p-3.5 sm:px-5 sm:py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-white/[0.14] transition-colors"
              >
                {/* Left: Status toggle + Item name + category + notes */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleCycleStatus(item.id)}
                    title="Cycle status: Needed → Confirmed → Packed"
                    aria-label={`Change status for ${item.name}`}
                    className="mt-0.5 text-slate-400 hover:text-emerald-400 transition-colors shrink-0"
                  >
                    {item.status === 'packed' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : item.status === 'confirmed' ? (
                      <PackageCheck className="w-5 h-5 text-sky-400" />
                    ) : (
                      <Circle className="w-5 h-5 text-amber-400/70" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-sm font-semibold ${
                          item.status === 'packed' ? 'text-slate-300 line-through' : 'text-white'
                        }`}
                      >
                        {item.name}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#0F131C] border border-white/[0.08] text-slate-400">
                        {getCategoryLabel(item.category)}
                      </span>
                    </div>
                    {item.notes && (
                      <p className="text-xs text-slate-400 mt-0.5 break-words">{item.notes}</p>
                    )}
                  </div>
                </div>

                {/* Right: Qty + Who Will Bring + Status Pill + Delete */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 pl-8 md:pl-0 shrink-0">
                  {/* Qty Stepper */}
                  <div className="inline-flex items-center gap-1 bg-[#0F131C] border border-white/[0.08] rounded-lg px-1 py-0.5">
                    <button
                      type="button"
                      disabled={saving || item.quantity <= 1}
                      onClick={() => void handleAdjustQty(item.id, -1)}
                      aria-label="Decrease quantity"
                      className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-mono tabular-nums text-slate-200 min-w-[24px] text-center">
                      ×{item.quantity}
                    </span>
                    <button
                      type="button"
                      disabled={saving || item.quantity >= 99}
                      onClick={() => void handleAdjustQty(item.id, 1)}
                      aria-label="Increase quantity"
                      className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Who Will Bring Selector */}
                  <select
                    aria-label={`Who will bring ${item.name}`}
                    disabled={saving}
                    value={item.broughtBy}
                    onChange={(e) => void handleAssignBringer(item.id, e.target.value)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-medium border focus:outline-none focus:border-amber-500/60 max-w-[170px] ${
                      item.broughtBy
                        ? 'bg-[#171E2C] border-white/[0.12] text-white'
                        : 'bg-amber-500/10 border-amber-500/35 text-amber-300'
                    }`}
                  >
                    <option value="" className="bg-[#131822] text-amber-300">
                      Unassigned (Needed)
                    </option>
                    {allBringers.map((member) => (
                      <option key={member} value={member} className="bg-[#131822] text-white">
                        {member}
                      </option>
                    ))}
                  </select>

                  {/* Status Pill */}
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleCycleStatus(item.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap ${statusInfo.badgeClass}`}
                  >
                    {statusInfo.label}
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleDeleteItem(item.id)}
                    aria-label={`Delete ${item.name}`}
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded-md transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
