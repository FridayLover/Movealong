"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import ListingCard from "@/components/ListingCard";
import { accentOf, PICKUP_BADGES } from "@/lib/profileTheme";

export default function SellerPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<any>(null);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [cartIds, setCartIds] = useState<Set<string>>(new Set());
  const [chatting, setChatting] = useState(false);

  useEffect(() => {
    fetch(`/api/users/${params.id}`).then((r) => r.json()).then((d) => { if (!d.error) setData(d); });
    Promise.all([
      fetch("/api/favorites").then((r) => r.json()).catch(() => ({})),
      fetch("/api/cart").then((r) => r.json()).catch(() => ({})),
    ]).then(([f, c]) => { if (f?.ids) setFavIds(new Set(f.ids)); if (c?.ids) setCartIds(new Set(c.ids)); });
  }, [params.id]);

  async function refresh() {
    const [f, c] = await Promise.all([fetch("/api/favorites").then((r) => r.json()).catch(() => ({})), fetch("/api/cart").then((r) => r.json()).catch(() => ({}))]);
    if (f?.ids) setFavIds(new Set(f.ids)); if (c?.ids) setCartIds(new Set(c.ids));
  }

  async function startChat() {
    setChatting(true);
    const r = await fetch("/api/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sellerId: params.id }) });
    if (r.status === 401) { location.href = "/auth"; return; }
    const d = await r.json(); setChatting(false);
    if (!r.ok) return;
    location.href = `/chat?c=${d.conversation.id}`;
  }

  if (!data) return <div className="pt-10 text-center text-muted">Loading shop…</div>;
  const s = data.seller;
  const accent = accentOf(s.accent);
  const badgeLabel = (id: string) => PICKUP_BADGES.find((b) => b.id === id)?.label || id;

  return (
    <div className="animate-page-in pt-0 -mx-4 sm:-mx-6">
      {/* Cover */}
      <div className="relative h-52 sm:h-72 bg-stone-200 overflow-hidden">
        {s.coverImage ? <img src={s.coverImage} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full" style={{ background: accent.soft }} />}
        <div className="absolute inset-x-0 bottom-0 h-1.5" style={{ background: accent.hex }} />
      </div>

      <div className="mx-auto max-w-[1100px] px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row gap-4 sm:items-end -mt-14 relative">
          <div className="shrink-0">
            {s.avatar ? <img src={s.avatar} alt={s.name} className="w-28 h-28 rounded-3xl object-cover border-4 border-[#fffbf5] shadow-card bg-white" /> : <span className="w-28 h-28 rounded-3xl bg-[#1c1917] text-amber-100 grid place-items-center text-4xl font-black border-4 border-[#fffbf5] shadow-card">{s.name.slice(0, 1).toUpperCase()}</span>}
          </div>
          <div className="flex-1 min-w-0 animate-fade-up">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-ink break-words min-w-0">{s.name}</h1>
              {s.pronouns && <span className="text-xs font-semibold bg-white border border-line px-2.5 py-1 rounded-full">{s.pronouns}</span>}
              <span className="text-xs font-bold text-white px-2.5 py-1 rounded-full" style={{ background: accent.hex }}>{accent.label} shop</span>
            </div>
            {s.tagline && <p className="text-lg text-stone-700 mt-1 font-medium">{s.tagline}</p>}
            <p className="text-sm text-muted mt-1">{s.building || "Nearby"} · Member since {new Date(s.memberSince).getFullYear()} · {data.stats.listings} listings · {data.stats.totalFavorites} hearts received · {data.stats.sold} sold</p>
            {s.languages?.length > 0 && <div className="flex gap-1.5 flex-wrap mt-2">{s.languages.map((l: string) => <span key={l} className="text-[11px] font-semibold bg-white border border-line px-2 py-1 rounded-full">{l}</span>)}</div>}
          </div>
          <div className="flex gap-2 shrink-0 pb-1">
            <button onClick={startChat} disabled={chatting} className="press text-white px-5 py-3 rounded-full font-bold text-sm disabled:opacity-50" style={{ background: accent.hex }}>Chat with {s.name.split(" ")[0]}</button>
            <Link href="/agent" className="press bg-white border border-line px-4 py-3 rounded-full font-bold text-sm">Ask Agent</Link>
          </div>
        </div>

        {s.bio && <p className="animate-fade-up text-[15px] leading-relaxed text-stone-700 max-w-[68ch] mt-5 whitespace-pre-wrap" style={{ ["--i" as any]: 1 }}>{s.bio}</p>}

        {s.pickupBadges?.length > 0 && (
          <div className="flex gap-2 flex-wrap mt-4">
            {s.pickupBadges.map((b: string) => <span key={b} className="text-xs font-semibold bg-white border border-line px-3 py-1.5 rounded-full">{badgeLabel(b)}</span>)}
            <span className="text-xs text-muted self-center">Pickup details confirmed in chat · second-hand as-is, no returns</span>
          </div>
        )}

        {data.showcase.length > 0 && (
          <section className="mt-10">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-xl font-black text-ink">Showcase</h2>
              <span className="text-xs text-muted">Hand-picked by {s.name.split(" ")[0]}</span>
            </div>
            <div className="flex gap-4 overflow-auto no-scrollbar snap-x mt-4 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
              {data.showcase.map((l: any, i: number) => (
                <div key={l.id} style={{ ["--i" as any]: i }} className="animate-fade-up snap-start shrink-0 w-[78vw] max-w-[340px]">
                  <ListingCard l={{ ...l, seller: { name: s.name, avatar: s.avatar } }} favIds={favIds} cartIds={cartIds} onFavChange={refresh} onCartChange={refresh} />
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-10 pb-4">
          <h2 className="text-xl font-black text-ink">All listings</h2>
          {data.listings.length === 0 && data.showcase.length === 0 ? (
            <div className="bg-white border border-line rounded-2xl p-10 text-center text-muted mt-4">Nothing available right now — check back soon or chat to ask what’s coming.</div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {data.listings.map((l: any, i: number) => (
                <div key={l.id} style={{ ["--i" as any]: Math.min(i, 6) }} className="animate-fade-up">
                  <ListingCard l={{ ...l, seller: { name: s.name, avatar: s.avatar } }} favIds={favIds} cartIds={cartIds} onFavChange={refresh} onCartChange={refresh} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
