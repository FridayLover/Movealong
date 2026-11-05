"use client";
import { useCallback, useEffect, useState } from "react";
import Filters from "@/components/Filters";
import { useI18n } from "@/lib/i18n";
import ListingCard, { CardListing } from "@/components/ListingCard";

export default function FeedPage() {
  const { t } = useI18n();
  const [listings, setListings] = useState<CardListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedError, setFeedError] = useState("");
  const [category, setCategory] = useState("all");
  const [freeOnly, setFreeOnly] = useState(false);
  const [maxDistance, setMaxDistance] = useState(20);
  const [widened, setWidened] = useState(false);
  const [search, setSearch] = useState("");
  const [building, setBuilding] = useState("");
  const [coords, setCoords] = useState<{ lat:number; lng:number }|null>(null);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [cartIds, setCartIds] = useState<Set<string>>(new Set());
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [saveMsg, setSaveMsg] = useState("");
  const [sort, setSort] = useState<"nearest" | "newest" | "cheapest" | "saving" | "urgent">("nearest");

  useEffect(()=> {
    // Allow deep links from profile Saved searches: /?q=sofa&category=furniture&building=Ideo
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("q")) setSearch(sp.get("q")!);
      if (sp.get("category")) setCategory(sp.get("category")!);
      if (sp.get("building")) setBuilding(sp.get("building")!);
    } catch {}
    if(navigator.geolocation) navigator.geolocation.getCurrentPosition(p=> setCoords({lat:p.coords.latitude,lng:p.coords.longitude}), ()=>{}, {timeout:3000});
    Promise.all([
      fetch("/api/favorites").then(r=>r.json()).catch(()=>({})),
      fetch("/api/cart").then(r=>r.json()).catch(()=>({})),
      fetch("/api/saved-searches").then(r=>r.json()).catch(()=>({})),
    ]).then(([f,c,s])=>{
      if(f?.ids) setFavIds(new Set(f.ids));
      if(c?.ids) setCartIds(new Set(c.ids));
      if(s?.savedSearches) setSavedSearches(s.savedSearches);
    });
  },[]);

  const fetchListings = useCallback(async () => {
    setLoading(true); setFeedError(""); setWidened(false);
    const params = new URLSearchParams({
      category, freeOnly: String(freeOnly), maxDistance: String(maxDistance), q: search, building,
      ...(coords ? { lat: String(coords.lat), lng: String(coords.lng) } : {})
    });
    try {
      const r = await fetch("/api/listings?"+params.toString());
      if (!r.ok) throw new Error(`Listings failed (${r.status})`);
      const d = await r.json();
      let items = d.listings || [];
      // Nothing within range is not the end of discovery: widen to everywhere
      // (still nearest-first) and say so, instead of showing an empty feed.
      if (items.length === 0 && coords && !search && !building && category === "all" && !freeOnly) {
        const wide = new URLSearchParams({ category, freeOnly: String(freeOnly), maxDistance: String(100000), q: search, building, lat: String(coords.lat), lng: String(coords.lng) });
        const r2 = await fetch("/api/listings?"+wide.toString());
        if (r2.ok) {
          const d2 = await r2.json();
          if ((d2.listings || []).length > 0) { items = d2.listings; setWidened(true); }
        }
      }
      setListings(items);
    } catch {
      // A failed load is not "0 items" — say so and offer a way back
      setFeedError("We could not load listings. Check your connection, then try again.");
    }
    setLoading(false);
  }, [category, freeOnly, maxDistance, search, building, coords]);
  useEffect(()=> { const t=setTimeout(fetchListings, 350); return ()=>clearTimeout(t); }, [fetchListings]);

  async function refreshFavCart() {
    const [f,c] = await Promise.all([ fetch("/api/favorites").then(r=>r.json()).catch(()=>({})), fetch("/api/cart").then(r=>r.json()).catch(()=>({}))]);
    if(f?.ids) setFavIds(new Set(f.ids));
    if(c?.ids) setCartIds(new Set(c.ids));
  }

  async function saveCurrentSearch() {
    setSaveMsg("");
    const r = await fetch("/api/saved-searches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: search || undefined, category, building: building || undefined, freeOnly }) });
    const d = await r.json();
    if (r.status === 401) { location.href = "/auth"; return; }
    if (!r.ok) { setSaveMsg(d.error || "Could not save — try adding a keyword, building or category first."); return; }
    setSaveMsg("Saved! We’ll surface new matches in your profile (Saved searches).");
    const s = await fetch("/api/saved-searches").then(x=>x.json()).catch(()=>({}));
    if (s?.savedSearches) setSavedSearches(s.savedSearches);
    setTimeout(()=>setSaveMsg(""), 3500);
  }

  async function applySaved(s: any) {
    setSearch(s.query || "");
    setCategory(s.category || "all");
    setBuilding(s.building || "");
    setFreeOnly(!!s.freeOnly);
  }

  return (
    <div className="animate-page-in pt-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-ink">{t("Near you, from people moving out")}</h1>
          <p className="text-sm text-muted mt-1 max-w-[62ch]">{t("Furniture, appliances and decor — pickup only, in your building or a few km away. See the saving vs new on every card, and try items in your room before you go.")}</p>
        </div>
        <a href="/sell" className="btn-primary shrink-0">{t("+ List an item")}</a>
      </div>

      {/* Why people buy second-hand — third-party context, not our metrics (sources in docs/research.md) */}
      <p className="text-xs leading-relaxed text-muted border-y border-line/70 py-2.5">
        Why it works: people buy second-hand to stretch their budget (IKEA UK / thredUp), resale grew 23% in 2024 so good items go fast (thredUp/GlobalData) — save a search below, and check the <b className="text-ink">−% vs new</b> on each card. Pickup & self-delivery only; FREE items welcome.
      </p>

      <div className="sticky top-[72px] z-30 -mx-1 px-1 py-1 bg-[#fffbf5]/90 backdrop-blur rounded-2xl">
        <Filters category={category} setCategory={setCategory} freeOnly={freeOnly} setFreeOnly={setFreeOnly} maxDistance={maxDistance} setMaxDistance={setMaxDistance} search={search} setSearch={setSearch} building={building} setBuilding={setBuilding} onReset={() => setSort("nearest")} />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted text-xs font-semibold">{loading ? t("Finding nearby…") : feedError ? t("Could not load listings.") : `${listings.length} ${listings.length === 1 ? t("item near you") : t("items near you")}`}</span>
        <label className="ml-auto flex items-center gap-2 text-xs font-semibold">{t("Sort")}
          <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="bg-white border border-line rounded-full px-3 py-2 text-xs font-bold">
            <option value="nearest">{t("Nearest first")}</option>
            <option value="urgent">{t("Must-go soonest")}</option>
            <option value="saving">{t("Biggest saving vs new")}</option>
            <option value="cheapest">{t("Cheapest")}</option>
            <option value="newest">{t("Newest")}</option>
          </select>
        </label>
        <span className="text-[11px] text-muted hidden sm:inline">As a mover you usually want Nearest + Must-go — sellers on a deadline are most flexible.</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={saveCurrentSearch} className="bg-[#1c1917] text-white px-4 py-2 rounded-full text-sm font-bold">{t("Notify me — save this search")}</button>
        <span className="text-xs text-muted">Saved searches live in your profile with a “new matches” count, so you don’t have to refresh all day.</span>
        {saveMsg && <span className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-full">{saveMsg}</span>}
      </div>
      {savedSearches.length > 0 && (
        <div className="flex gap-2 overflow-auto no-scrollbar pb-1">
          {savedSearches.map((s:any)=> (
            <button key={s.id} onClick={()=>applySaved(s)} className="shrink-0 bg-white border border-line rounded-full px-3 py-1.5 text-xs font-semibold hover:bg-amber-50">
              {s.query || s.building || s.category} {s.freeOnly ? "· FREE" : ""} {s.newMatches > 0 && <span className="ml-1 bg-red-600 text-white px-1.5 py-0.5 rounded-full text-[10px]">{s.newMatches} new</span>} <span className="text-muted font-normal">({s.totalMatches})</span>
            </button>
          ))}
        </div>
      )}

      {widened && !loading && (
        <div className="animate-fade-up flex flex-wrap items-center gap-2 bg-amber-50 border border-amber-200 text-amber-900 text-sm px-4 py-3 rounded-2xl" role="status">
          <span><b>Nothing within {maxDistance} km of you yet</b> — showing nearest first from everywhere so you can still browse. Sellers near you can change that:</span>
          <a href="/sell" className="btn-primary px-3 py-1.5 text-xs">+ List an item</a>
        </div>
      )}
      {loading ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true" aria-label="Loading listings">{Array.from({length:6}).map((_,i)=><div key={i} className="h-[320px] bg-white border border-line rounded-2xl overflow-hidden"><div className="shimmer-line h-full w-full" /></div>)}</div>
      : feedError ? <div role="alert" className="animate-fade-up border border-red-200 bg-red-50 rounded-2xl p-10 text-center"><div className="font-semibold text-red-800">{t("Listings did not load")}</div><p className="text-sm text-red-700 mt-1">{feedError}</p><button onClick={fetchListings} className="press mt-4 bg-[#9a3412] text-white px-5 py-2.5 rounded-full text-sm font-bold">{t("Retry")}</button></div>
      : listings.length===0 ? <div className="animate-fade-up bg-white border border-line rounded-2xl p-12 text-center"><div className="font-semibold">{t("No items match that search.")}</div><p className="text-sm text-muted mt-1">Nothing fits that exact combination right now. Clear the filters to see everything near you, or be first to <a href="/sell" className="underline">list something</a>.</p><button onClick={() => { setSearch(""); setFreeOnly(false); setCategory("all"); setBuilding(""); setMaxDistance(20); setSort("nearest"); }} className="btn-primary mt-4 px-5 py-2.5 text-sm">{t("Clear all filters")}</button></div>
      : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[...listings].sort((a: any, b: any) => {
          if (sort === "cheapest") return (a.isFree ? 0 : a.price ?? 1e12) - (b.isFree ? 0 : b.price ?? 1e12);
          if (sort === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          if (sort === "saving") { const pa = a.originalPrice ? 1 - (a.price ?? 0) / a.originalPrice : a.isFree ? 1 : 0; const pb = b.originalPrice ? 1 - (b.price ?? 0) / b.originalPrice : b.isFree ? 1 : 0; return pb - pa; }
          if (sort === "urgent") { const da = a.moveOutDate ? new Date(a.moveOutDate).getTime() : Infinity; const db = b.moveOutDate ? new Date(b.moveOutDate).getTime() : Infinity; return da - db; }
          return (a.distanceKm ?? 999) - (b.distanceKm ?? 999);
        }).map((l, i) => <div key={l.id} style={{ ["--i" as any]: Math.min(i, 8) }} className="animate-fade-up"><ListingCard l={l as any} favIds={favIds} cartIds={cartIds} onFavChange={refreshFavCart} onCartChange={refreshFavCart} /></div>)}</div>
      }

      <div className="bg-[#1c1917] text-white rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between">
        <div>
          <div className="font-bold text-lg">{t("Moving out next week?")}</div>
          <div className="text-white/70 text-sm mt-1">List in 45 seconds — real photos from multiple angles + optional size/original price helps buyers trust it and makes AI placement accurate. Add “Must go by” so neighbours know it’s urgent.</div>
        </div>
        <a href="/sell" className="bg-white text-[#1c1917] px-6 py-3 rounded-full font-bold shrink-0">{t("List an item →")}</a>
      </div>
    </div>
  );
}
