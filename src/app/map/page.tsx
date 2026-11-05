"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
const MapView = dynamic(()=> import("@/components/MapView"), { ssr:false });
import ListingCard from "@/components/ListingCard";

export default function MapPage() {
  const [listings, setListings] = useState<any[]>([]);
  const [mode, setMode] = useState<"swipe"|"grid">("grid");
  const [idx, setIdx] = useState(0);
  const [coords, setCoords] = useState<[number,number]|null>(null);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [cartIds, setCartIds] = useState<Set<string>>(new Set());

  useEffect(()=> {
    if(navigator.geolocation) navigator.geolocation.getCurrentPosition(p=> setCoords([p.coords.latitude,p.coords.longitude]), ()=> setCoords([13.7563,100.5018]));
    fetch("/api/listings").then(r=>r.json()).then(d=> setListings(d.listings||[]));
    Promise.all([ fetch("/api/favorites").then(r=>r.json()).catch(()=>({})), fetch("/api/cart").then(r=>r.json()).catch(()=>({}))]).then(([f,c])=>{
      if(f?.ids) setFavIds(new Set(f.ids));
      if(c?.ids) setCartIds(new Set(c.ids));
    });
  },[]);

  async function refreshFavCart() {
    const [f,c] = await Promise.all([ fetch("/api/favorites").then(r=>r.json()).catch(()=>({})), fetch("/api/cart").then(r=>r.json()).catch(()=>({}))]);
    if(f?.ids) setFavIds(new Set(f.ids));
    if(c?.ids) setCartIds(new Set(c.ids));
  }

  const current = listings[idx];

  return (
    <div className="animate-page-in pt-6 space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <h1 className="text-2xl font-black text-ink">Nearby like a dating app — but for your couch.</h1>
        <div className="flex gap-2 text-sm">
          <button onClick={()=>setMode("grid")} className={`px-4 py-2 rounded-full border font-semibold ${mode==="grid"?"bg-[#1c1917] text-white":"bg-white"}`}>Grid + Map</button>
          <button onClick={()=>setMode("swipe")} className={`px-4 py-2 rounded-full border font-semibold ${mode==="swipe"?"bg-[#1c1917] text-white":"bg-white"}`}>Swipe</button>
        </div>
      </div>

      {mode==="grid" ? (
        <div className="grid lg:grid-cols-2 gap-4">
          <MapView listings={listings.map(l=>({id:l.id,title:l.title,price:l.price,isFree:l.isFree,lat:l.lat,lng:l.lng,building:l.building,images:l.images}))} center={coords||undefined} />
          <div className="grid sm:grid-cols-2 gap-4 max-h-[520px] overflow-auto pr-1">
            {listings.map(l=> <ListingCard key={l.id} l={l} favIds={favIds} cartIds={cartIds} onFavChange={refreshFavCart} onCartChange={refreshFavCart} />)}
          </div>
        </div>
      ) : (
        <div className="max-w-[420px] mx-auto">
          {current ? (
            <div className="bg-white rounded-2xl border border-line overflow-hidden shadow-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={current.images[0]} alt={current.title} className="w-full aspect-[4/5] object-cover" />
              <div className="p-4">
                <div className="font-bold">{current.title} · {current.isFree ? "FREE" : `$${current.price}`}</div>
                <div className="text-sm text-muted line-clamp-2">{current.description}</div>
                <div className="text-xs text-muted mt-1">{current.building} · {current.category}</div>
                <div className="flex gap-2 mt-4">
                  <button onClick={()=> setIdx(i=> (i+1)%listings.length)} className="flex-1 border py-3 rounded-full font-semibold hover:bg-amber-50">Skip</button>
                  <a href={`/listing/${current.id}`} className="flex-1 bg-[#9a3412] text-white py-3 rounded-full font-semibold text-center hover:bg-[#7c2d12]">View & contact</a>
                </div>
                <div className="flex gap-2 mt-2">
                  <a href={`/ai-lab?listing=${current.id}`} className="flex-1 border py-2 rounded-full text-xs font-semibold text-center hover:bg-amber-50">Instant preview</a>
                </div>
              </div>
            </div>
          ) : <div className="text-center py-16 text-muted">No listings yet.</div>}
          <div className="text-center text-xs text-muted mt-3">Swipe logic: Skip passes, View saves. Map pin shows building.</div>
        </div>
      )}
    </div>
  );
}
