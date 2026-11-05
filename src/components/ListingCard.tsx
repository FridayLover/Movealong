"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatPrice, formatDistance, discountPercent, urgencyLabel, FALLBACK_PRODUCT_IMAGE } from "@/lib/utils";
import { useI18n, useTranslated } from "@/lib/i18n";

export type CardListing = {
  id: string; title: string; description: string; price: number | null; originalPrice?: number | null; moveOutDate?: string | null; isFree: boolean; category: string; condition: string;
  images: string[]; building?: string | null; lat?: number | null; lng?: number | null; seller: { id?: string; name: string; avatar?: string | null };
  favoriteCount?: number;
  distanceKm?: number | null; createdAt: string;
};

export default function ListingCard({ l, favIds, cartIds, onFavChange, onCartChange }: { l: CardListing; favIds?: Set<string>; cartIds?: Set<string>; onFavChange?: () => void; onCartChange?: () => void }) {
  const { t } = useI18n();
  const title = useTranslated(l.title);
  const img = l.images?.[0] || FALLBACK_PRODUCT_IMAGE;
  const pct = discountPercent(l.price, l.originalPrice, l.isFree);
  const urgency = urgencyLabel(l.moveOutDate);
  const [isFav, setIsFav] = useState(!!favIds?.has(l.id));
  const [inCart, setInCart] = useState(!!cartIds?.has(l.id));
  const [busy, setBusy] = useState(false);

  useEffect(() => { setIsFav(!!favIds?.has(l.id)); }, [favIds, l.id]);
  useEffect(() => { setInCart(!!cartIds?.has(l.id)); }, [cartIds, l.id]);

  async function toggleFav(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const method = isFav ? "DELETE" : "POST";
    const r = await fetch("/api/favorites", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId: l.id }) });
    if (r.status === 401) { location.href = "/auth"; return; }
    if (r.ok) { setIsFav(!isFav); onFavChange?.(); window.dispatchEvent(new Event("movealong:refresh")); }
    setBusy(false);
  }
  async function toggleCart(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const method = inCart ? "DELETE" : "POST";
    const r = await fetch("/api/cart", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId: l.id }) });
    if (r.status === 401) { location.href = "/auth"; return; }
    if (r.ok) { setInCart(!inCart); onCartChange?.(); window.dispatchEvent(new Event("movealong:refresh")); }
    setBusy(false);
  }

  return (
    <div className="group bg-white rounded-2xl overflow-hidden border border-line shadow-soft hover:shadow-card transition relative">
      <Link href={`/listing/${l.id}`} className="block">
        <div className="aspect-[4/3] overflow-hidden bg-amber-50 relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt={title} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-[1.02] transition duration-300" />
          {/* At most two overlay pills (price + saving) — category lives in the meta row,
              so text can never collide with the fav/cart actions on narrow cards */}
          <div className="absolute top-3 left-3 flex gap-2 max-w-[calc(100%-104px)]">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${l.isFree ? "bg-emerald-600 text-white" : "bg-white/95 text-ink border"}`}>{l.isFree ? t("FREE") : formatPrice(l.price, l.isFree)}</span>
            {pct !== null && pct >= 20 && <span className="text-xs font-black px-2.5 py-1 rounded-full bg-[#9a3412] text-white whitespace-nowrap">-{pct}%</span>}
          </div>
          {/* One shared bottom row: urgency (left) and distance (right) can shrink/truncate, never overlap */}
          <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 pointer-events-none">
            <span className="min-w-0 truncate">
              {urgency && urgency.tone !== "normal" && <span className={`text-[11px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${urgency.tone === "urgent" ? "bg-red-600 text-white" : "bg-amber-400 text-ink"}`}>{urgency.label}</span>}
            </span>
            {typeof l.distanceKm === "number" && (
              l.distanceKm <= 0.08
                ? <span className="shrink-0 text-xs font-bold px-2 py-1 rounded-full bg-emerald-600 text-white whitespace-nowrap" title="In your building or the same block">{t("Same building")}</span>
                : <span className="shrink-0 text-xs font-medium px-2 py-1 rounded-full bg-white/95 border whitespace-nowrap">{formatDistance(l.distanceKm)}</span>
            )}
          </div>
        </div>
      </Link>

      {/* Actions overlay — top right fav/cart */}
      <div className="absolute top-3 right-3 flex gap-1.5 z-10">
        <button onClick={toggleFav} title={isFav ? t("Remove from favorites") : t("Add to favorites")} className={`press w-10 h-10 rounded-full grid place-items-center border shadow-sm backdrop-blur ${isFav ? "bg-[#9a3412] text-white border-[#9a3412]" : "bg-white/95 hover:bg-white"}`}>
          <svg key={String(isFav)} className={isFav ? "animate-pop" : ""} width="14" height="14" viewBox="0 0 24 24" fill={isFav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
        </button>
        <button onClick={toggleCart} title={inCart ? t("Remove from cart") : t("Add to cart")} className={`press w-10 h-10 rounded-full grid place-items-center border shadow-sm backdrop-blur ${inCart ? "bg-[#1c1917] text-white border-[#1c1917]" : "bg-white/95 hover:bg-white"}`}>
          <svg key={String(inCart)} className={inCart ? "animate-pop" : ""} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        </button>
      </div>

      <div className="p-4">
        <Link href={`/listing/${l.id}`} className="font-semibold leading-tight line-clamp-1 hover:underline">{title}</Link>
        <div className="text-sm text-muted line-clamp-1">{l.description}</div>
        <div className="mt-3 flex items-center justify-between gap-2 text-xs min-w-0">
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="w-6 h-6 shrink-0 rounded-full bg-[#1c1917] text-amber-100 grid place-items-center text-[11px] font-bold">{l.seller.name.slice(0,1).toUpperCase()}</span>
            <span className="truncate">{l.seller.name}</span>
          </span>
          <span className="text-muted truncate text-right">{t(l.category)} · {l.building || t("Nearby")} · {t(l.condition.replace("_"," "))}</span>
        </div>
        <div className="mt-1.5 text-[11px] text-muted flex items-center gap-1">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="#9a3412" stroke="#9a3412" strokeWidth="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
          {l.favoriteCount ?? 0} {t("favorites")} · {t("saved by")} {l.favoriteCount ?? 0} {(l.favoriteCount ?? 0) === 1 ? t("person") : t("people")}
        </div>
        <div className="mt-3 flex gap-2">
          <Link href={`/ai-lab?listing=${l.id}`} className="press flex-1 text-center text-xs font-bold bg-[#9a3412] text-white py-2 rounded-full hover:bg-[#7c2d12]">{t("Instant preview")}</Link>
          <Link href={`/listing/${l.id}`} className="press flex-1 text-center text-xs font-semibold border py-2 rounded-full hover:bg-amber-50">{t("Details")}</Link>
        </div>
      </div>
    </div>
  );
}
