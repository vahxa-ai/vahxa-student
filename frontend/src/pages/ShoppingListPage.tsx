import React, { useEffect, useState } from "react";
import { Plus, Trash2, Check, ShoppingCart, Clock, Sparkles, Loader2, X, Store } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { format, parseISO, isWithinInterval, subDays } from "date-fns";
import { useAppStore } from "../store/appStore";
import { healthApi } from "../services/api";
import { CATEGORIES, CATEGORY_COLORS } from "../lib/foodCategories";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShoppingItem {
  id: string;
  name: string;
  category: string;
  checked: boolean;
  purchasedAt?: string; // ISO string set when checked
}

interface PurchaseRecord {
  id: string;
  name: string;
  category: string;
  purchasedAt: string; // ISO string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEMS_KEY = "family-aid-shopping-items";
const HISTORY_KEY = "family-aid-shopping-history";

function loadItems(): ShoppingItem[] {
  try { return JSON.parse(localStorage.getItem(ITEMS_KEY) ?? "[]"); } catch { return []; }
}
function loadHistory(): PurchaseRecord[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"); } catch { return []; }
}

type Tab = "list" | "history" | "advice" | "stores";

// ─── Page ─────────────────────────────────────────────────────────────────────

export const ShoppingListPage: React.FC = () => {
  const { activeFamily } = useAppStore();
  const familyName = activeFamily()?.name ?? "the family";

  const [tab, setTab] = useState<Tab>("list");

  // ── shopping list ──
  const [items, setItems] = useState<ShoppingItem[]>(loadItems);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Other");
  const [filterCategory, setFilterCategory] = useState("All");

  // ── history ──
  const [history, setHistory] = useState<PurchaseRecord[]>(loadHistory);
  const [historyFilter, setHistoryFilter] = useState<"7d" | "30d" | "all">("30d");

  // ── health advice ──
  const [advice, setAdvice] = useState<string | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);

  // ── store recommendations ──
  const [storeRecs, setStoreRecs] = useState<string | null>(null);
  const [loadingStores, setLoadingStores] = useState(false);

  // Persist whenever items or history change
  useEffect(() => { localStorage.setItem(ITEMS_KEY, JSON.stringify(items)); }, [items]);
  useEffect(() => { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); }, [history]);

  // ── list actions ──
  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setItems((prev) => [...prev, { id: crypto.randomUUID(), name: name.trim(), category, checked: false }]);
    setName("");
  };

  const toggleItem = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const now = new Date().toISOString();
    if (!item.checked) {
      // Mark as purchased — record in history
      const record: PurchaseRecord = { id: crypto.randomUUID(), name: item.name, category: item.category, purchasedAt: now };
      setHistory((prev) => [record, ...prev]);
    }
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, checked: !i.checked, purchasedAt: !i.checked ? now : undefined } : i));
  };

  const deleteItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));
  const clearChecked = () => setItems((prev) => prev.filter((i) => !i.checked));

  // ── history helpers ──
  const filteredHistory = history.filter((r) => {
    if (historyFilter === "all") return true;
    const days = historyFilter === "7d" ? 7 : 30;
    try {
      return isWithinInterval(parseISO(r.purchasedAt), { start: subDays(new Date(), days), end: new Date() });
    } catch { return false; }
  });

  // Group history by date
  const groupedHistory = filteredHistory.reduce<Record<string, PurchaseRecord[]>>((acc, r) => {
    const day = format(parseISO(r.purchasedAt), "EEEE, MMMM d yyyy");
    (acc[day] ??= []).push(r);
    return acc;
  }, {});

  const deleteHistoryRecord = (id: string) => setHistory((prev) => prev.filter((r) => r.id !== id));

  // ── store recommendations ──
  const generateStoreRecs = async () => {
    const uncheckedItems = items.filter((i) => !i.checked);
    if (!uncheckedItems.length) return;
    setLoadingStores(true);
    try {
      const result = await healthApi.storeRecommendations({
        items: uncheckedItems.map((i) => ({ name: i.name, category: i.category })),
        family_name: familyName,
      });
      setStoreRecs(result.content);
    } finally {
      setLoadingStores(false);
    }
  };

  // ── health advice ──
  const generateAdvice = async () => {
    if (history.length === 0) return;
    setLoadingAdvice(true);
    try {
      const result = await healthApi.shoppingAdvice({
        history: history.slice(0, 100).map((r) => ({
          name: r.name, category: r.category, purchased_at: r.purchasedAt,
        })),
        family_name: familyName,
      });
      setAdvice(result.content);
    } finally {
      setLoadingAdvice(false);
    }
  };

  // ── derived ──
  const usedCategories = ["All", ...Array.from(new Set(items.map((i) => i.category)))];
  const visible = filterCategory === "All" ? items : items.filter((i) => i.category === filterCategory);
  const unchecked = visible.filter((i) => !i.checked);
  const checked = visible.filter((i) => i.checked);
  const pendingCount = items.filter((i) => !i.checked).length;

  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Shopping List</h1>
          <p className="text-gray-500 text-sm mt-1">
            {pendingCount} item{pendingCount !== 1 ? "s" : ""} remaining · {history.length} purchases tracked
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 w-fit">
        {([
          { key: "list",    label: "Shopping List",  icon: <ShoppingCart size={14} /> },
          { key: "stores",  label: "Store Deals",    icon: <Store size={14} /> },
          { key: "history", label: "History",        icon: <Clock size={14} /> },
          { key: "advice",  label: "Health Advice",  icon: <Sparkles size={14} /> },
        ] as { key: Tab; label: string; icon: React.ReactNode }[]).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {icon} {label}
            {key === "history" && history.length > 0 && (
              <span className="ml-1 text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-medium">
                {history.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Shopping List tab ─────────────────────────────── */}
      {tab === "list" && (
        <>
          {/* Add form */}
          <form onSubmit={addItem} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4 flex gap-3">
            <input
              autoFocus
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Add an item…"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <select
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <button
              type="submit"
              className="flex items-center gap-1.5 bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <Plus size={15} /> Add
            </button>
          </form>

          {/* Filter + clear */}
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            {usedCategories.length > 2 && (
              <div className="flex gap-2 flex-wrap">
                {usedCategories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setFilterCategory(c)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      filterCategory === c
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
            {checked.length > 0 && (
              <button
                onClick={clearChecked}
                className="text-xs text-red-500 hover:text-red-700 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors ml-auto"
              >
                Clear checked ({checked.length})
              </button>
            )}
          </div>

          {/* Empty */}
          {items.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <ShoppingCart size={36} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">Your shopping list is empty.</p>
            </div>
          )}

          {/* Unchecked */}
          {unchecked.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-100 mb-4">
              {unchecked.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => toggleItem(item.id)}
                    className="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center flex-shrink-0 hover:border-indigo-500 transition-colors"
                  />
                  <span className="flex-1 text-sm text-gray-800">{item.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.Other}`}>
                    {item.category}
                  </span>
                  <button onClick={() => deleteItem(item.id)} className="p-1 text-gray-300 hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Checked */}
          {checked.length > 0 && (
            <div className="bg-gray-50 rounded-xl border border-gray-200 divide-y divide-gray-200">
              {checked.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => toggleItem(item.id)}
                    className="w-5 h-5 rounded-full bg-indigo-600 border-2 border-indigo-600 flex items-center justify-center flex-shrink-0"
                  >
                    <Check size={11} className="text-white" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-400 line-through">{item.name}</span>
                    {item.purchasedAt && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Purchased {format(parseISO(item.purchasedAt), "MMM d, h:mm a")}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium opacity-50 ${CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.Other}`}>
                    {item.category}
                  </span>
                  <button onClick={() => deleteItem(item.id)} className="p-1 text-gray-300 hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Store Deals tab ──────────────────────────────── */}
      {tab === "stores" && (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-indigo-100 rounded-lg flex-shrink-0">
                <Store size={18} className="text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">AI Store Recommendations</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Analyses your {items.filter((i) => !i.checked).length} pending item{items.filter((i) => !i.checked).length !== 1 ? "s" : ""} and finds the best stores for price advantage, including bulk deals and savings tips.
                </p>
              </div>
            </div>

            {items.filter((i) => !i.checked).length === 0 ? (
              <p className="text-sm text-gray-400 italic">
                No pending items on your shopping list. Add items first to get store recommendations.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 mb-4">
                  {items.filter((i) => !i.checked).map((item) => (
                    <span key={item.id} className={`text-xs px-2.5 py-1 rounded-full font-medium ${CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.Other}`}>
                      {item.name}
                    </span>
                  ))}
                </div>
                <button
                  onClick={generateStoreRecs}
                  disabled={loadingStores}
                  className="flex items-center gap-2 bg-indigo-600 text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {loadingStores
                    ? <><Loader2 size={15} className="animate-spin" /> Finding best deals…</>
                    : <><Store size={15} /> {storeRecs ? "Refresh Recommendations" : "Find Best Deals"}</>}
                </button>
              </>
            )}
          </div>

          {storeRecs && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-violet-700 text-white">
                <p className="text-xs font-semibold uppercase tracking-widest text-indigo-200">AI Recommendation</p>
                <h2 className="text-lg font-bold mt-0.5">Store & Price Guide</h2>
                <p className="text-xs text-indigo-300 mt-1">Based on {items.filter((i) => !i.checked).length} items · Powered by Llama 3.3-70b</p>
              </div>
              <div className="px-6 py-5 prose prose-sm max-w-none overflow-x-auto">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{storeRecs}</ReactMarkdown>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── History tab ───────────────────────────────────── */}
      {tab === "history" && (
        <>
          {/* Filter + clear all */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              {([["7d", "Last 7 days"], ["30d", "Last 30 days"], ["all", "All time"]] as [typeof historyFilter, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setHistoryFilter(key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    historyFilter === key
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {history.length > 0 && (
              <button
                onClick={() => { if (window.confirm("Clear all purchase history?")) setHistory([]); }}
                className="text-xs text-red-500 hover:text-red-700 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors"
              >
                Clear history
              </button>
            )}
          </div>

          {filteredHistory.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Clock size={36} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No purchases recorded yet.</p>
              <p className="text-xs mt-1">Check off items on the shopping list to start tracking.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedHistory).map(([day, records]) => (
                <div key={day} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-600">{day}</p>
                    <p className="text-xs text-gray-400">{records.length} item{records.length !== 1 ? "s" : ""} purchased</p>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {records.map((r) => (
                      <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                        <span className="flex-1 text-sm text-gray-700">{r.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[r.category] ?? CATEGORY_COLORS.Other}`}>
                          {r.category}
                        </span>
                        <span className="text-xs text-gray-400 w-16 text-right flex-shrink-0">
                          {format(parseISO(r.purchasedAt), "h:mm a")}
                        </span>
                        <button onClick={() => deleteHistoryRecord(r.id)} className="p-1 text-gray-200 hover:text-red-400 transition-colors">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Health Advice tab ─────────────────────────────── */}
      {tab === "advice" && (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-indigo-100 rounded-lg flex-shrink-0">
                <Sparkles size={18} className="text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">AI Diet Balance Analysis</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Based on {history.length} tracked purchase{history.length !== 1 ? "s" : ""}. The AI analyses your shopping patterns to give personalised nutrition advice.
                </p>
              </div>
            </div>

            {history.length === 0 ? (
              <p className="text-sm text-gray-400 italic">
                No purchase history yet. Check off items on the shopping list to start tracking your diet.
              </p>
            ) : (
              <button
                onClick={generateAdvice}
                disabled={loadingAdvice}
                className="flex items-center gap-2 bg-indigo-600 text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {loadingAdvice
                  ? <><Loader2 size={15} className="animate-spin" /> Analysing your diet…</>
                  : <><Sparkles size={15} /> {advice ? "Refresh Advice" : "Generate Health Advice"}</>}
              </button>
            )}
          </div>

          {advice && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-violet-700 text-white">
                <p className="text-xs font-semibold uppercase tracking-widest text-indigo-200">Health Advice</p>
                <h2 className="text-lg font-bold mt-0.5">Diet Balance Report</h2>
                <p className="text-xs text-indigo-300 mt-1">Based on {history.length} purchases · Powered by Llama 3.3-70b</p>
              </div>
              <div className="px-6 py-5 prose prose-sm max-w-none overflow-x-auto">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{advice}</ReactMarkdown>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
