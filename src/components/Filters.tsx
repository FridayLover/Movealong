"use client";
import { useState } from "react";
import { CATEGORIES } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

/**
 * Shop filters, progressively disclosed:
 * always visible = search + FREE + the Filters toggle.
 * behind the toggle = category, building, distance (advanced intent).
 * Applied filters render as removable chips with a predictable Reset.
 * Sorting lives in the feed toolbar (separate concern, not a filter).
 */
export default function Filters({
  category, setCategory, freeOnly, setFreeOnly, maxDistance, setMaxDistance, search, setSearch, building, setBuilding, onReset
}: {
  category: string; setCategory: (v:string)=>void; freeOnly: boolean; setFreeOnly:(v:boolean)=>void;
  maxDistance: number; setMaxDistance:(v:number)=>void; search: string; setSearch:(v:string)=>void; building:string; setBuilding:(v:string)=>void;
  onReset?: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const activeCount = (category !== "all" ? 1 : 0) + (building.trim() ? 1 : 0) + (maxDistance !== 20 ? 1 : 0);
  const anyActive = activeCount > 0 || freeOnly || !!search.trim();

  function resetAll() {
    setSearch(""); setFreeOnly(false); setCategory("all"); setBuilding(""); setMaxDistance(20);
    onReset?.();
  }

  const chip = "press inline-flex items-center gap-1.5 bg-[#1c1917] text-white text-xs font-semibold pl-3 pr-2 py-1.5 rounded-full";
  const chipX = "w-4 h-4 grid place-items-center rounded-full bg-white/20 leading-none";

  return (
    <div className="bg-white border border-line/70 rounded-3xl p-3 sm:p-4 flex flex-col gap-3">
      {/* Essentials — always visible */}
      <div className="flex gap-2 flex-wrap items-center">
        <label className="sr-only" htmlFor="feed-search">{t("Search listings")}</label>
        <input id="feed-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder={t("Search title, description, building…")} className="input-pill flex-1 min-w-[200px]" />
        <label className="press flex items-center gap-2 text-sm font-semibold bg-amber-50 border border-amber-200 px-3.5 min-h-[42px] rounded-full cursor-pointer">
          <input type="checkbox" checked={freeOnly} onChange={e=>setFreeOnly(e.target.checked)} className="w-4 h-4 accent-[#9a3412]" /> {t("FREE only")}
        </label>
        <button
          type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="feed-advanced-filters"
          className={`press inline-flex items-center gap-2 min-h-[42px] px-4 rounded-full border text-sm font-bold ${open || activeCount ? "bg-[#1c1917] text-white border-[#1c1917]" : "bg-white hover:bg-amber-50"}`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/></svg>
          {t("Filters")}{activeCount ? ` (${activeCount})` : ""}
          <span aria-hidden className={`text-[10px] transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
        </button>
      </div>

      {/* Applied filters — visible, removable, resettable */}
      {anyActive && (
        <div className="flex gap-1.5 flex-wrap items-center" aria-label={t("Applied filters")}>
          
          {search.trim() && <span className={chip}>“{search.trim()}” <button type="button" aria-label="Clear search" onClick={() => setSearch("")} className={chipX}>✕</button></span>}
          {freeOnly && <span className={chip}>{t("FREE only")} <button type="button" aria-label="Turn off FREE only" onClick={() => setFreeOnly(false)} className={chipX}>✕</button></span>}
          {category !== "all" && <span className={chip}>{t(CATEGORIES.find(c=>c.id===category)?.label || category)} <button type="button" aria-label="Clear category" onClick={() => setCategory("all")} className={chipX}>✕</button></span>}
          {building.trim() && <span className={chip}>{building.trim()} <button type="button" aria-label="Clear building" onClick={() => setBuilding("")} className={chipX}>✕</button></span>}
          {maxDistance !== 20 && <span className={chip}>Within {maxDistance} km <button type="button" aria-label="Reset distance" onClick={() => setMaxDistance(20)} className={chipX}>✕</button></span>}
          <button type="button" onClick={resetAll} className="press text-xs font-bold text-[#9a3412] underline underline-offset-2 px-1.5 py-1.5">{t("Reset all")}</button>
        </div>
      )}

      {/* Advanced — category, building, distance */}
      {open && (
        <div id="feed-advanced-filters" className="animate-msg-in flex flex-col gap-3 border-t border-line/70 pt-3">
          <div className="flex gap-2 overflow-auto pb-1 no-scrollbar" role="group" aria-label={t("Category")}>
            {CATEGORIES.map(c=> (
              <button type="button" key={c.id} onClick={()=>setCategory(c.id)} aria-pressed={category===c.id} className={`press shrink-0 px-4 py-2 rounded-full text-sm font-semibold border ${category===c.id ? "bg-[#1c1917] text-white border-[#1c1917]" : "bg-white hover:bg-amber-50"}`}>{t(c.label)}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <span className="flex items-center gap-2 flex-1 min-w-[220px]">
              <label htmlFor="feed-building" className="text-sm text-muted whitespace-nowrap">{t("Building")}</label>
              <input id="feed-building" value={building} onChange={e=>setBuilding(e.target.value)} placeholder="e.g. Ideo Sukhumvit" className="input-pill flex-1" />
            </span>
            <span className="flex items-center gap-3 flex-1 min-w-[220px] text-sm">
              <label htmlFor="feed-distance" className="text-muted whitespace-nowrap">{t("Within")}</label>
              <input id="feed-distance" type="range" min={1} max={50} value={maxDistance} onChange={e=>setMaxDistance(parseInt(e.target.value))} className="flex-1 accent-[#9a3412]" />
              <span className="font-semibold whitespace-nowrap" aria-live="polite">{maxDistance} km</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
