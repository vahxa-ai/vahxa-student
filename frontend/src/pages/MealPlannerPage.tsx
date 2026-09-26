import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus, X, Pencil, Trash2, Clock, Loader2, Link2, Package, CalendarDays,
  Coffee, Apple, Sandwich, Cookie, Croissant, UtensilsCrossed, CupSoda,
} from "lucide-react";
import { useAppStore } from "../store/appStore";
import { pantryApi, mealPlanApi, memberApi } from "../services/api";
import type { FamilyMember, MealPlan, MealPlanItem, MealSlot, MealType, PantryItem } from "../types";
import { CATEGORIES, categoryColor } from "../lib/foodCategories";

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type MealMeta = {
  type: MealType;
  label: string;
  Icon: React.ElementType;
  accent: string;
  headerBg: string;
  border: string;
};

const MEAL_META: MealMeta[] = [
  { type: "breakfast",       label: "Breakfast",        Icon: Coffee,          accent: "text-amber-600",  headerBg: "bg-amber-50",  border: "border-amber-200" },
  { type: "morning_snack",   label: "Morning Snack",    Icon: Apple,           accent: "text-lime-600",   headerBg: "bg-lime-50",   border: "border-lime-200" },
  { type: "lunch",           label: "Lunch",            Icon: Sandwich,        accent: "text-orange-600", headerBg: "bg-orange-50", border: "border-orange-200" },
  { type: "afternoon_snack", label: "Afternoon Snack",  Icon: Cookie,          accent: "text-yellow-600", headerBg: "bg-yellow-50", border: "border-yellow-200" },
  { type: "evening_snack",   label: "Evening Snack",    Icon: Croissant,       accent: "text-rose-600",   headerBg: "bg-rose-50",   border: "border-rose-200" },
  { type: "dinner",          label: "Dinner",           Icon: UtensilsCrossed, accent: "text-indigo-600", headerBg: "bg-indigo-50", border: "border-indigo-200" },
  { type: "bedtime_drink",   label: "Before-Bed Drink", Icon: CupSoda,         accent: "text-violet-600", headerBg: "bg-violet-50", border: "border-violet-200" },
];

const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : "");
const fmt12 = (t?: string | null) => {
  const s = hhmm(t);
  if (!s) return "";
  const [h, m] = s.split(":").map(Number);
  const ampm = h < 12 ? "AM" : "PM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
};
// JS getDay(): Sun=0 … Sat=6  →  Mon=0 … Sun=6
const todayIdx = () => (new Date().getDay() + 6) % 7;

const fieldCls =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

// ─── Meal item add / edit modal ───────────────────────────────────────────────

interface ItemForm {
  id: number | null;
  meal_type: MealType;
  name: string;
  pantry_item_id: number | null;
  member_id: number | null; // null = whole family
  quantity: string;
  time: string; // "HH:MM" or ""
  notes: string;
}

const MealItemModal: React.FC<{
  form: ItemForm;
  dayLabel: string;
  pantry: PantryItem[];
  members: FamilyMember[];
  onClose: () => void;
  onSave: (form: ItemForm) => Promise<void>;
}> = ({ form, dayLabel, pantry, members, onClose, onSave }) => {
  const [f, setF] = useState<ItemForm>(form);
  const [saving, setSaving] = useState(false);
  const meta = MEAL_META.find((m) => m.type === f.meal_type)!;

  const set = <K extends keyof ItemForm>(k: K, v: ItemForm[K]) => setF((p) => ({ ...p, [k]: v }));

  const pickPantry = (id: number | null) => {
    const p = id != null ? pantry.find((x) => x.id === id) : undefined;
    setF((prev) => ({
      ...prev,
      pantry_item_id: id,
      name: p && !prev.name.trim() ? p.name : prev.name,
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return;
    // Auto-link to a pantry item when the typed name matches one exactly.
    let linked = f.pantry_item_id;
    if (linked == null) {
      const match = pantry.find((p) => p.name.trim().toLowerCase() === f.name.trim().toLowerCase());
      if (match) linked = match.id;
    }
    setSaving(true);
    try {
      await onSave({ ...f, pantry_item_id: linked });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 my-8 p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-gray-800">
            {f.id ? "Edit Item" : "Add Item"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4 flex items-center gap-1.5">
          <meta.Icon size={13} className={meta.accent} /> {meta.label} · {dayLabel}
        </p>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Food / drink *</label>
            <input
              autoFocus required
              className={fieldCls}
              list="pantry-name-list"
              placeholder="e.g. Oatmeal"
              value={f.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assign from inventory <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <select
              className={fieldCls}
              value={f.pantry_item_id ?? ""}
              onChange={(e) => pickPantry(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">— Manual entry (not from inventory) —</option>
              {pantry.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.unit || p.quantity ? ` (${p.quantity}${p.unit ? ` ${p.unit}` : ""} in stock)` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              For <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <select
              className={fieldCls}
              value={f.member_id ?? ""}
              onChange={(e) => set("member_id", e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Whole family</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Portion</label>
              <input
                className={fieldCls}
                placeholder="e.g. 1 bowl"
                value={f.quantity}
                onChange={(e) => set("quantity", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="time"
                className={fieldCls}
                value={f.time}
                onChange={(e) => set("time", e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <input
              className={fieldCls}
              placeholder="Optional"
              value={f.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : f.id ? "Save Changes" : "Add Item"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Pantry tab ───────────────────────────────────────────────────────────────

interface PantryForm {
  id: number | null;
  name: string;
  category: string;
  quantity: string;
  unit: string;
  notes: string;
}

const BLANK_PANTRY: PantryForm = { id: null, name: "", category: "Other", quantity: "1", unit: "", notes: "" };

const PantryTab: React.FC<{
  familyId: number;
  pantry: PantryItem[];
  setPantry: React.Dispatch<React.SetStateAction<PantryItem[]>>;
  onDeleted: (id: number) => void;
}> = ({ familyId, pantry, setPantry, onDeleted }) => {
  const [form, setForm] = useState<PantryForm>(BLANK_PANTRY);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof PantryForm>(k: K, v: PantryForm[K]) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      category: form.category,
      quantity: parseFloat(form.quantity) || 0,
      unit: form.unit.trim(),
      notes: form.notes.trim() || null,
    };
    setBusy(true);
    try {
      if (form.id) {
        const upd = await pantryApi.update(familyId, form.id, payload);
        setPantry((prev) => prev.map((p) => (p.id === upd.id ? upd : p)).sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        const created = await pantryApi.create(familyId, payload);
        setPantry((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setForm(BLANK_PANTRY);
    } finally {
      setBusy(false);
    }
  };

  const edit = (p: PantryItem) =>
    setForm({
      id: p.id,
      name: p.name,
      category: p.category ?? "Other",
      quantity: String(p.quantity),
      unit: p.unit,
      notes: p.notes ?? "",
    });

  const remove = async (p: PantryItem) => {
    if (!window.confirm(`Remove "${p.name}" from inventory?`)) return;
    await pantryApi.delete(familyId, p.id);
    setPantry((prev) => prev.filter((x) => x.id !== p.id));
    onDeleted(p.id);
    if (form.id === p.id) setForm(BLANK_PANTRY);
  };

  return (
    <>
      <form onSubmit={submit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">
          {form.id ? "Edit inventory item" : "Add to inventory"}
        </p>
        <div className="grid sm:grid-cols-[1fr_130px_90px_90px] gap-3">
          <input className={fieldCls} placeholder="Item name…" value={form.name} onChange={(e) => set("name", e.target.value)} />
          <select className={fieldCls} value={form.category} onChange={(e) => set("category", e.target.value)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input type="number" min={0} step="any" className={fieldCls} placeholder="Qty" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
          <input className={fieldCls} placeholder="unit" value={form.unit} onChange={(e) => set("unit", e.target.value)} />
        </div>
        <input className={`${fieldCls} mt-3`} placeholder="Notes (optional)" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        <div className="flex gap-2 mt-3">
          <button
            type="submit"
            disabled={busy}
            className="flex items-center gap-1.5 bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {form.id ? "Save" : "Add"}
          </button>
          {form.id && (
            <button
              type="button"
              onClick={() => setForm(BLANK_PANTRY)}
              className="border border-gray-300 text-gray-600 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {pantry.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Your inventory is empty.</p>
          <p className="text-xs mt-1">Add what's on hand so you can assign it to meals.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-100">
          {pantry.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex-1 text-sm text-gray-800">{p.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColor(p.category)}`}>
                {p.category ?? "Other"}
              </span>
              <span className="text-xs text-gray-500 w-24 text-right tabular-nums">
                {p.quantity}{p.unit ? ` ${p.unit}` : ""}
              </span>
              <button onClick={() => edit(p)} className="p-1 text-gray-300 hover:text-indigo-500 transition-colors"><Pencil size={14} /></button>
              <button onClick={() => remove(p)} className="p-1 text-gray-300 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export const MealPlannerPage: React.FC = () => {
  const { activeFamilyId, members, setMembers } = useAppStore();
  const [tab, setTab] = useState<"plan" | "pantry">("plan");
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [day, setDay] = useState(todayIdx());
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<ItemForm | null>(null);
  const [quickAdd, setQuickAdd] = useState<{ type: MealType; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!activeFamilyId) { setPlan(null); setPantry([]); return; }
    setLoading(true);
    try {
      const [p, inv, mem] = await Promise.all([
        mealPlanApi.get(activeFamilyId),
        pantryApi.list(activeFamilyId),
        memberApi.list(activeFamilyId),
      ]);
      setPlan(p);
      setPantry(inv);
      setMembers(mem);
    } finally {
      setLoading(false);
    }
  }, [activeFamilyId]);

  useEffect(() => { load(); }, [load]);

  const memberById = useMemo(() => {
    const m = new Map<number, FamilyMember>();
    members.forEach((mm) => m.set(mm.id, mm));
    return m;
  }, [members]);

  const slotByType = useMemo(() => {
    const m = {} as Record<MealType, MealSlot | undefined>;
    plan?.slots.forEach((s) => { m[s.meal_type] = s; });
    return m;
  }, [plan]);

  const itemsFor = (type: MealType) =>
    (plan?.items ?? [])
      .filter((i) => i.day_of_week === day && i.meal_type === type)
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);

  if (!activeFamilyId) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-800">Meal Planner</h1>
        <p className="text-gray-500 text-sm mt-2">Select or create a family to start planning meals.</p>
      </div>
    );
  }

  const updateSlotTime = async (type: MealType, value: string) => {
    if (!value) return;
    const updated = await mealPlanApi.updateSlot(activeFamilyId, type, { time: `${value}:00` });
    setPlan(updated);
  };

  const saveItem = async (f: ItemForm) => {
    const payload = {
      meal_type: f.meal_type,
      day_of_week: day,
      name: f.name.trim(),
      pantry_item_id: f.pantry_item_id,
      member_id: f.member_id,
      quantity: f.quantity.trim() || null,
      time: f.time ? `${f.time}:00` : null,
      notes: f.notes.trim() || null,
    };
    if (f.id) {
      const upd = await mealPlanApi.updateItem(activeFamilyId, f.id, payload);
      setPlan((p) => p && { ...p, items: p.items.map((i) => (i.id === upd.id ? upd : i)) });
    } else {
      const created = await mealPlanApi.createItem(activeFamilyId, payload);
      setPlan((p) => p && { ...p, items: [...p.items, created] });
    }
    setModal(null);
  };

  const startQuickAdd = (type: MealType) => setQuickAdd({ type, text: "" });
  const cancelQuickAdd = () => setQuickAdd(null);

  const submitQuickAdd = async () => {
    if (!quickAdd) return;
    const name = quickAdd.text.trim();
    if (!name) { setQuickAdd(null); return; }
    const match = pantry.find((p) => p.name.trim().toLowerCase() === name.toLowerCase());
    const created = await mealPlanApi.createItem(activeFamilyId, {
      meal_type: quickAdd.type,
      day_of_week: day,
      name,
      pantry_item_id: match ? match.id : null,
      member_id: null,
      quantity: null,
      time: null,
      notes: null,
    });
    setPlan((p) => p && { ...p, items: [...p.items, created] });
    // Keep the field open (and focused) so several items can be added in a row.
    setQuickAdd({ type: quickAdd.type, text: "" });
  };

  const deleteItem = async (item: MealPlanItem) => {
    await mealPlanApi.deleteItem(activeFamilyId, item.id);
    setPlan((p) => p && { ...p, items: p.items.filter((i) => i.id !== item.id) });
  };

  const openAdd = (type: MealType, name = "") => {
    setQuickAdd(null);
    setModal({ id: null, meal_type: type, name, pantry_item_id: null, member_id: null, quantity: "", time: "", notes: "" });
  };

  const openEdit = (item: MealPlanItem) =>
    setModal({
      id: item.id,
      meal_type: item.meal_type,
      name: item.name,
      pantry_item_id: item.pantry_item_id,
      member_id: item.member_id,
      quantity: item.quantity ?? "",
      time: hhmm(item.time),
      notes: item.notes ?? "",
    });

  const totalForDay = (plan?.items ?? []).filter((i) => i.day_of_week === day).length;

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Meal Planner</h1>
        <p className="text-gray-500 text-sm mt-1">
          A reusable weekly meal schedule — seven slots a day, planned once for the whole family.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 w-fit">
        {([
          { key: "plan", label: "Weekly Plan", icon: <CalendarDays size={14} /> },
          { key: "pantry", label: "Inventory", icon: <Package size={14} /> },
        ] as { key: "plan" | "pantry"; label: string; icon: React.ReactNode }[]).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {icon} {label}
            {key === "pantry" && pantry.length > 0 && (
              <span className="ml-1 text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-medium">
                {pantry.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-10 justify-center">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      )}

      {!loading && tab === "pantry" && (
        <PantryTab
          familyId={activeFamilyId}
          pantry={pantry}
          setPantry={setPantry}
          onDeleted={(id) =>
            setPlan((p) =>
              p && { ...p, items: p.items.map((i) => (i.pantry_item_id === id ? { ...i, pantry_item_id: null } : i)) }
            )
          }
        />
      )}

      {!loading && tab === "plan" && plan && (
        <>
          {/* Day selector */}
          <div className="flex gap-1.5 mb-5 flex-wrap">
            {DAY_SHORT.map((d, i) => (
              <button
                key={d}
                onClick={() => setDay(i)}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  day === i
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          <p className="text-xs text-gray-400 mb-3">
            {DAYS[day]} · {totalForDay} item{totalForDay !== 1 ? "s" : ""} planned
          </p>

          <div className="space-y-3">
            {MEAL_META.map((meta) => {
              const slot = slotByType[meta.type];
              const items = itemsFor(meta.type);
              return (
                <div key={meta.type} className={`rounded-xl border ${meta.border} overflow-hidden`}>
                  {/* Slot header */}
                  <div className={`${meta.headerBg} px-4 py-2.5 flex items-center gap-2`}>
                    <meta.Icon size={15} className={meta.accent} />
                    <span className={`text-sm font-semibold ${meta.accent} flex-1`}>{meta.label}</span>
                    <Clock size={12} className="text-gray-400" />
                    <input
                      type="time"
                      value={hhmm(slot?.time)}
                      onChange={(e) => updateSlotTime(meta.type, e.target.value)}
                      className="text-xs bg-white/70 rounded px-1.5 py-1 text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    />
                  </div>

                  {/* Items */}
                  <div className="bg-white px-4 py-2.5 space-y-1.5">
                    {items.length === 0 && (
                      <p className="text-xs text-gray-300 py-1">No items yet.</p>
                    )}
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 group text-sm">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${meta.accent.replace("text-", "bg-")}`} />
                        <span className="text-gray-800">{item.name}</span>
                        {item.quantity && <span className="text-xs text-gray-400">· {item.quantity}</span>}
                        {item.time && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 flex items-center gap-0.5">
                            <Clock size={9} /> {fmt12(item.time)}
                          </span>
                        )}
                        {item.pantry_item_id != null && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-500 flex items-center gap-0.5">
                            <Link2 size={9} /> inventory
                          </span>
                        )}
                        {item.member_id != null && memberById.get(item.member_id) && (
                          <span
                            className="text-[11px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{
                              backgroundColor: `${memberById.get(item.member_id)!.color}1A`,
                              color: memberById.get(item.member_id)!.color,
                            }}
                          >
                            {memberById.get(item.member_id)!.name}
                          </span>
                        )}
                        <span className="flex-1" />
                        <button
                          onClick={() => openEdit(item)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-indigo-500 transition-all"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => deleteItem(item)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-400 transition-all"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                    {quickAdd?.type === meta.type ? (
                      <div className="flex items-center gap-1.5 mt-1">
                        <Plus size={12} className={`${meta.accent} flex-shrink-0`} />
                        <input
                          autoFocus
                          list="pantry-name-list"
                          placeholder="Type a food or drink, press Enter…"
                          className="flex-1 text-sm border-b border-gray-200 focus:outline-none focus:border-indigo-400 py-0.5"
                          value={quickAdd.text}
                          onChange={(e) => setQuickAdd({ type: meta.type, text: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); submitQuickAdd(); }
                            if (e.key === "Escape") { e.preventDefault(); cancelQuickAdd(); }
                          }}
                          onBlur={() => { if (!quickAdd.text.trim()) cancelQuickAdd(); }}
                        />
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => openAdd(meta.type, quickAdd.text.trim())}
                          className="text-[11px] text-gray-400 hover:text-indigo-500 flex-shrink-0"
                        >
                          details
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={cancelQuickAdd}
                          className="p-0.5 text-gray-300 hover:text-gray-500 flex-shrink-0"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startQuickAdd(meta.type)}
                        className={`flex items-center gap-1 text-xs ${meta.accent} opacity-70 hover:opacity-100 transition-opacity mt-1`}
                      >
                        <Plus size={12} /> Add item
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <datalist id="pantry-name-list">
            {pantry.map((p) => <option key={p.id} value={p.name} />)}
          </datalist>
        </>
      )}

      {modal && (
        <MealItemModal
          form={modal}
          dayLabel={DAYS[day]}
          pantry={pantry}
          members={members}
          onClose={() => setModal(null)}
          onSave={saveItem}
        />
      )}
    </div>
  );
};
