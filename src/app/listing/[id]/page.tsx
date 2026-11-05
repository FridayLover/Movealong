"use client";
import { useEffect, useState } from "react";
import { useI18n, useTranslated } from "@/lib/i18n";
import Link from "next/link";
import { formatPrice, discountPercent, urgencyLabel } from "@/lib/utils";

export default function ListingDetail({ params }: { params: { id: string } }){
  const { t } = useI18n();
  const [listing, setListing] = useState<any>(null);
  const trTitle = useTranslated(listing?.title || "");
  const trDesc = useTranslated(listing?.description || "");
  const [sellerStats, setSellerStats] = useState<any>(null);
  const [active, setActive] = useState(0);
  const [msg, setMsg] = useState("");
  const [isFav, setIsFav] = useState(false);
  const [inCart, setInCart] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(()=> {
    // Ask for location so the API can answer "how far / same building?" — denial just means no distance shown
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetch(`/api/listings/${params.id}?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`).then(r=>r.json()).then(d=> { setListing(d.listing); setSellerStats(d.sellerStats || null); }).catch(()=>{}),
        () => fetch(`/api/listings/${params.id}`).then(r=>r.json()).then(d=> { setListing(d.listing); setSellerStats(d.sellerStats || null); }).catch(()=>{}),
        { timeout: 4000 }
      );
    } else {
      fetch(`/api/listings/${params.id}`).then(r=>r.json()).then(d=> { setListing(d.listing); setSellerStats(d.sellerStats || null); });
    }
    Promise.all([
      fetch("/api/favorites").then(r=>r.json()).catch(()=>({})),
      fetch("/api/cart").then(r=>r.json()).catch(()=>({})),
    ]).then(([f,c])=>{
      if(f?.ids) setIsFav(f.ids.includes(params.id));
      if(c?.ids) setInCart(c.ids.includes(params.id));
    });
  },[params.id]);

  async function toggleFav() {
    if (busy) return; setBusy(true);
    const r = await fetch("/api/favorites", { method: isFav ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId: params.id }) });
    if (r.status === 401) { location.href="/auth"; return; }
    if (r.ok) { setIsFav(!isFav); window.dispatchEvent(new Event("movealong:refresh")); }
    setBusy(false);
  }
  async function toggleCart() {
    if (busy) return; setBusy(true);
    const r = await fetch("/api/cart", { method: inCart ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId: params.id }) });
    if (r.status === 401) { location.href="/auth"; return; }
    if (r.ok) { setInCart(!inCart); window.dispatchEvent(new Event("movealong:refresh")); }
    setBusy(false);
  }

  function askBaan() {
    // Hand this item to Baan with context — he opens already knowing what you're looking at
    const size = listing.width ? `, ${listing.width}×${listing.depth || "?"}×${listing.height || "?"} ${listing.unit || "cm"}` : "";
    const dist = typeof listing.distanceKm === "number" ? (listing.sameBuilding ? ", same building as me" : `, ${listing.distanceKm.toFixed(1)} km from me`) : "";
    const q = `About "${listing.title}" (${formatPrice(listing.price, listing.isFree)}, ${String(listing.condition).replace("_"," ")}${size}${dist}): would it fit my room and is it a fair deal? What should I check at pickup?`;
    try { sessionStorage.setItem("movealong:agentPrefill", q); } catch {}
    window.dispatchEvent(new Event("movealong:open-agent"));
    setTimeout(() => window.dispatchEvent(new CustomEvent("movealong:agent-prefill", { detail: { text: q } })), 120);
  }

  async function startChat() {
    const r = await fetch("/api/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId: params.id }) });
    if (r.status === 401) { location.href = "/auth"; return; }
    const d = await r.json();
    if (!r.ok) { setMsg(d.error || "Could not start chat"); return; }
    location.href = `/chat?c=${d.conversation.id}`;
  }

  if(!listing) return <div className="pt-10 text-center text-muted">Loading…</div>;
  const images: string[] = typeof listing.images==="string" ? JSON.parse(listing.images) : listing.images;

  return (
    <div className="animate-page-in pt-6 grid lg:grid-cols-[1.1fr_0.9fr] gap-6">
      <div className="space-y-3">
        <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-amber-50 border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[active]} alt={listing.title} className="w-full h-full object-cover" />
        </div>
        <div className="flex gap-2 overflow-auto pb-1 no-scrollbar">
          {images.map((s,i)=> (
            <button key={i} onClick={()=>setActive(i)} className={`shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 ${i===active?"border-[#9a3412]":"border-transparent"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
        {listing.width && <div className="text-xs inline-flex gap-2 bg-white border border-line rounded-full px-3 py-1.5">Size: {listing.width} × {listing.height} × {listing.depth} {listing.unit}</div>}
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex gap-2 flex-wrap">
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white border border-line">{listing.category}</span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#1c1917] text-white">{listing.condition.replace("_"," ")}</span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800">{listing.delivery === "pickup" ? "Pickup only" : listing.delivery}</span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100">{listing.status}</span>
          </div>
          <h1 className="text-2xl font-black mt-3 leading-tight text-ink">{trTitle || listing.title}</h1>
          <div className="flex flex-wrap items-baseline gap-2 mt-1">
            <span className="text-2xl font-black">{formatPrice(listing.price, listing.isFree)}</span>
            {listing.originalPrice && !listing.isFree && <span className="text-sm text-muted line-through">${listing.originalPrice}</span>}
            {(() => { const pct = discountPercent(listing.price, listing.originalPrice, listing.isFree); return pct !== null && pct >= 15 ? <span className="text-xs font-black bg-[#9a3412] text-white px-2 py-1 rounded-full">-{pct}% vs new · save ${Math.max(0, (listing.originalPrice||0) - (listing.price||0)).toLocaleString()}</span> : null; })()}
            {listing.isFree && <span className="text-sm font-bold bg-amber-400 px-2 py-1 rounded-full align-middle">{t("FREE")}</span>}
          </div>
          {listing.pickupNote && <div className="text-xs mt-1 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1 inline-block">Pickup: {listing.pickupNote}</div>}
          {(() => { const u = urgencyLabel(listing.moveOutDate); return u ? <span className={`text-xs font-bold px-2.5 py-1 rounded-full ml-1 ${u.tone === "urgent" ? "bg-red-600 text-white" : u.tone === "soon" ? "bg-amber-400 text-ink" : "bg-stone-100 border"}`}>{u.label}</span> : null; })()}
          <div className="text-sm text-muted mt-1">{listing.building || listing.address} · {listing.views} views · {listing.favoriteCount ?? 0} favorites · saved by {listing.favoriteCount ?? 0} people · Condition: {listing.condition.replace("_"," ")} (photos show actual wear — no surprises)</div>
          {typeof listing.distanceKm === "number" && (
            <div className="mt-2">
              {listing.sameBuilding
                ? <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-600 text-white">{t("Same building")}</span>
                : <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white border border-line">{listing.distanceKm < 1 ? `${Math.round(listing.distanceKm * 1000)} m away` : `${listing.distanceKm.toFixed(1)} km away`}</span>}
            </div>
          )}
        </div>

        <div className="bg-white border border-line rounded-2xl p-5 shadow-soft">
          <div className="font-semibold">{t("Description")}</div>
          <p className="text-sm text-stone-700 whitespace-pre-wrap mt-2 leading-relaxed">{trDesc || listing.description}</p>
        </div>

        <div className="bg-white border border-line rounded-2xl p-5 shadow-soft">
          <div className="font-semibold">{t("Seller")}</div>
          <div className="flex items-center gap-3 mt-3">
            <span className="w-10 h-10 rounded-full bg-[#1c1917] text-amber-100 grid place-items-center font-bold">{listing.seller?.name?.slice(0,1).toUpperCase()}</span>
            <div className="flex-1 min-w-0"><div className="font-semibold text-sm">{listing.seller?.name}</div><div className="text-xs text-muted">{listing.seller?.building || listing.building}</div></div>
            {listing.seller?.id && <Link href={`/seller/${listing.seller.id}`} className="press shrink-0 text-xs font-bold border px-3 py-2 rounded-full hover:bg-amber-50">{t("View shop")} →</Link>}
          </div>
          <div className="grid gap-2 mt-4">
            <Link href={`/ai-lab?listing=${listing.id}`} className="bg-[#9a3412] text-white text-center py-3 rounded-full font-bold hover:bg-[#7c2d12]">Try in my room — Instant preview →</Link>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={toggleFav} disabled={busy} className={`border py-2.5 rounded-full font-semibold text-center text-sm flex items-center justify-center gap-1 ${isFav ? "bg-[#9a3412] text-white border-[#9a3412]" : "hover:bg-amber-50"}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill={isFav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                {isFav ? t("Saved") : t("Favorites")}
              </button>
              <button onClick={toggleCart} disabled={busy} className={`border py-2.5 rounded-full font-semibold text-center text-sm flex items-center justify-center gap-1 ${inCart ? "bg-[#1c1917] text-white border-[#1c1917]" : "hover:bg-amber-50"}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                {inCart ? t("In cart") : t("Add to cart")}
              </button>
              <button onClick={startChat} className="border py-2.5 rounded-full font-semibold text-center text-sm hover:bg-amber-50">{t("Chat")}</button>
            </div>
            <button onClick={askBaan} className="btn-dark w-full py-2.5 text-sm">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z"/></svg>
              Ask Baan about this item
            </button>
            <div className="grid grid-cols-2 gap-2">
              <Link href={`/ai-lab?listing=${listing.id}&from=cart`} className="border py-2 rounded-full text-xs font-semibold text-center hover:bg-amber-50">Preview from cart/favorites → AI Lab</Link>
              <button onClick={()=>{ navigator.clipboard.writeText(window.location.href); setMsg("Link copied!"); setTimeout(()=>setMsg(""),1500); }} className="border py-2 rounded-full font-semibold text-xs">Share</button>
            </div>
            {msg && <div className="text-xs text-center text-emerald-700">{msg}</div>}
            <p className="text-xs text-muted text-center">Pickup/self-delivery only. Arrange a time that works for both of you. Meet in lobby/public area.</p>
          </div>
        </div>

        <div className="bg-white border border-line rounded-2xl p-5 shadow-soft">
          <div className="font-semibold text-sm">Location (approx.)</div>
          <div className="text-sm text-muted mt-1">{listing.building || "Nearby building"} — {listing.address || "Area hidden until you contact seller"}</div>
          {listing.lat && listing.lng && <div className="text-xs text-muted mt-1">{listing.lat.toFixed(4)}, {listing.lng.toFixed(4)}</div>}
          <div className="text-xs text-muted mt-2 flex flex-wrap gap-1.5">
            <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-1 rounded-full font-semibold">Seller in {listing.building || "nearby building"}</span>
            {sellerStats && <span className="bg-white border px-2 py-1 rounded-full">{sellerStats.totalListings} listings from this seller</span>}
            {sellerStats?.memberSince && <span className="bg-white border px-2 py-1 rounded-full">Member since {new Date(sellerStats.memberSince).getFullYear()}</span>}
            <span className="bg-white border px-2 py-1 rounded-full">Photos = actual item · check condition close-ups</span>
          </div>
        </div>

        {sellerStats && sellerStats.sameSeller.length > 0 && (
          <div className="bg-white border border-line rounded-2xl p-5 shadow-soft">
            <div className="flex items-baseline justify-between gap-2">
              <div className="font-semibold text-sm">Bundle &amp; save a trip — more from {listing.seller?.name}</div>
              <span className="text-xs text-muted">{sellerStats.bundleCount} items · ${sellerStats.bundleTotal.toLocaleString()} total</span>
            </div>
            <p className="text-xs text-muted mt-1">Buyers who bundle save pickup trips. Message the seller: “If I take {sellerStats.bundleCount}, can we do a bundle price?” (typical bundle ask: 10–25% off the total).</p>
            <div className="grid grid-cols-3 gap-2 mt-3">
              {sellerStats.sameSeller.map((b: any) => (
                <Link key={b.id} href={`/listing/${b.id}`} className="block border border-line rounded-xl overflow-hidden hover:shadow-soft">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.images[0]} alt="" className="w-full aspect-square object-cover" />
                  <div className="p-2"><div className="text-[11px] font-semibold line-clamp-1">{b.title}</div><div className="text-[11px] text-muted">{b.isFree ? "FREE" : `$${b.price}`}</div></div>
                </Link>
              ))}
            </div>
            <Link href={`/ai-lab?listing=${listing.id}`} className="mt-3 block text-center text-xs font-bold bg-[#9a3412] text-white py-2.5 rounded-full">Preview this + bundle items in my room →</Link>
          </div>
        )}
      </div>

      {/* Mobile sticky actions — the two things a buyer came to do, always in reach */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-[#fffbf5]/95 backdrop-blur border-t border-line pl-4 pr-[96px] py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex gap-2">
        <Link href={`/ai-lab?listing=${listing.id}`} className="btn-primary flex-1 py-3">Try in my room</Link>
        <button onClick={startChat} className="btn-secondary flex-1 py-3">{t("Chat")}</button>
      </div>
      <div className="h-16 lg:hidden" aria-hidden />
    </div>
  );
}
