"use client";
import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function Inner(){
  const sp = useSearchParams();
  const initialListing = sp.get("listing") || "";
  const [allListings, setAllListings] = useState<any[]>([]);
  const [favListings, setFavListings] = useState<any[]>([]);
  const [cartListings, setCartListings] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialListing ? [initialListing] : []);
  const [sourceTab, setSourceTab] = useState<"all"|"favorites"|"cart">("all");
  const [roomImage, setRoomImage] = useState<string | null>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [roomName, setRoomName] = useState("My living room");
  const [saveRoomMsg, setSaveRoomMsg] = useState("");
  const [prompt, setPrompt] = useState("");
  const [credits, setCredits] = useState<number | null>(null);
  const [tier, setTier] = useState("free");
  const [limits, setLimits] = useState<any>({ maxItemsPerRoom: 3, maxSavedRooms: 1 });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [compositeUrl, setCompositeUrl] = useState<string | null>(null);
  const [recentGens, setRecentGens] = useState<any[]>([]);

  const loadAll = useCallback(async () => {
    const [listRes, favRes, cartRes, creditRes, roomRes, genRes] = await Promise.all([
      fetch("/api/listings").then(r=>r.json()),
      fetch("/api/favorites").then(r=>r.json()).catch(()=>({})),
      fetch("/api/cart").then(r=>r.json()).catch(()=>({})),
      fetch("/api/ai/credits").then(r=>r.json()).catch(()=>({})),
      fetch("/api/rooms").then(r=>r.json()).catch(()=>({})),
      fetch("/api/generations").then(r=>r.json()).catch(()=>({})),
    ]);
    setAllListings(listRes.listings || []);
    setFavListings(favRes.favorites || []);
    setCartListings(cartRes.cart || []);
    // Prune selections that no longer exist (e.g. an old ?listing= link after a
    // reseed) so Generate never calls the API with a dead id and gets a 404.
    const validIds = new Set((listRes.listings || []).map((l: any) => l.id));
    setSelectedIds((prev) => prev.filter((id) => validIds.has(id)));
    if (creditRes.credits !== undefined) { setCredits(creditRes.credits); setTier(creditRes.subscriptionTier); if (creditRes.limits) setLimits(creditRes.limits); }
    if (roomRes.rooms) setRooms(roomRes.rooms);
    if (genRes.generations) setRecentGens(genRes.generations.slice(0, 6));
    // If coming from cart/fav link, pre-select?
    if (sp.get("from")==="cart" && cartRes.cart?.length) {
      setSelectedIds(cartRes.cart.slice(0, (creditRes.limits?.maxItemsPerRoom || 3)).map((l:any)=>l.id));
      setSourceTab("cart");
    }
  }, [sp]);
  useEffect(()=>{ loadAll(); },[loadAll]);

  const sourceList = sourceTab==="all" ? allListings : sourceTab==="favorites" ? favListings : cartListings;
  const maxItems = limits.maxItemsPerRoom;
  const atLimit = selectedIds.length >= maxItems;

  function toggle(id: string) {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x=>x!==id);
      if (prev.length >= maxItems) {
        setError(`Limit reached: ${tier} can place up to ${maxItems} items per room. Remove one or upgrade.`);
        return prev;
      }
      setError("");
      return [...prev, id];
    });
  }

  function onRoomFile(e: React.ChangeEvent<HTMLInputElement>){
    const f = e.target.files?.[0]; if(!f) return;
    const r = new FileReader(); r.onload=()=> { setRoomImage(r.result as string); setSelectedRoomId(""); }; r.readAsDataURL(f);
  }

  function onSelectRoom(id: string) {
    setSelectedRoomId(id);
    const r = rooms.find(x=>x.id===id);
    if (r) setRoomImage(r.image);
  }

  async function saveRoom() {
    if (!roomImage) return setSaveRoomMsg("Upload a room first");
    if (rooms.length >= limits.maxSavedRooms) return setSaveRoomMsg(`Saved rooms limit (${limits.maxSavedRooms}) for ${tier}. Delete one or upgrade.`);
    const res = await fetch("/api/rooms", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ name: roomName, image: roomImage }) });
    const d = await res.json();
    if (!res.ok) return setSaveRoomMsg(d.error || "Failed");
    setSaveRoomMsg("Room saved to your profile");
    loadAll();
    setTimeout(()=>setSaveRoomMsg(""), 3000);
  }

  // Multi-item canvas composite (mock fallback — photoreal when Meta key present, server returns remote image)
  // Large canvas + large items so furniture is readable on desktop (was 800×600 @ 0.42 — too small to judge).
  function makeMultiComposite(room: string, items: string[], scaleHint = 0.58): Promise<string> {
    return new Promise((resolve)=>{
      const roomImg = new Image();
      roomImg.crossOrigin = "anonymous";
      roomImg.src = room;
      roomImg.onload = async () => {
       try {
        const canvas = document.createElement("canvas"); const w=1200, h=900; canvas.width=w; canvas.height=h;
        const ctx = canvas.getContext("2d")!;
        const ratio = Math.max(w/roomImg.width, h/roomImg.height);
        const rw = roomImg.width*ratio, rh = roomImg.height*ratio;
        ctx.drawImage(roomImg, (w-rw)/2, (h-rh)/2, rw, rh);

        const n = items.length;
        const baseScale = n===1 ? 0.62 : n===2 ? 0.48 : n===3 ? 0.42 : 0.36;
        const gap = 8;
        const totalW = w * 0.86;
        const itemW = Math.min(baseScale * w, (totalW - gap*(n-1)) / Math.max(n,1));
        const startX = (w - (itemW*n + gap*(n-1)))/2;

        // draw items
        for (let i=0;i<n;i++) {
          const src = items[i];
          const im = new Image(); im.crossOrigin="anonymous"; im.src = src;
          await new Promise(res=>{ im.onload=()=>res(1); im.onerror=()=>res(1); });
          const ih = itemW * (im.height / Math.max(im.width,1) || 0.75);
          const x = startX + i*(itemW+gap);
          const y = h - ih - 20;
          ctx.fillStyle="rgba(0,0,0,0.22)"; ctx.beginPath(); ctx.ellipse(x+itemW/2, y+ih, itemW*0.38, 14, 0, 0, Math.PI*2); ctx.fill();
          ctx.save(); ctx.shadowColor="rgba(0,0,0,0.32)"; ctx.shadowBlur=14; ctx.shadowOffsetY=8;
          const r=10; ctx.beginPath();
          if (typeof (ctx as any).roundRect === "function") (ctx as any).roundRect(x,y,itemW,ih,r); else ctx.rect(x,y,itemW,ih);
          ctx.clip(); ctx.drawImage(im, x,y,itemW,ih); ctx.restore();
        }
        resolve(canvas.toDataURL("image/jpeg", 0.9));
       } catch { resolve(room); } // tainted canvas / unsupported API -> show the room, never hang or crash
      };
      roomImg.onerror = ()=> resolve(room);
    });
  }

  async function generate(){
    setError(""); setResult(null); setCompositeUrl(null);
    // Drop any id that vanished since the page loaded instead of surfacing an API 404
    const liveIds = selectedIds.filter((id) => allListings.some((l: any) => l.id === id));
    if (liveIds.length !== selectedIds.length) setSelectedIds(liveIds);
    if(liveIds.length===0) return setError("Pick at least 1 item (up to " + maxItems + " for " + tier + ").");
    if(!roomImage) return setError("Upload a room photo or pick a saved room.");
    setLoading(true);
    try{
      const res = await fetch("/api/ai/generate", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ listingIds: liveIds, roomImage, roomId: selectedRoomId || undefined, prompt }) });
      const d = await res.json();
      if(!res.ok) throw new Error(d.error || "Generation failed");
      setResult(d); setCredits(d.creditsLeft);
      if (d.limits) setLimits(d.limits);
      // If provider is meta-muse/replicate, server resultImage is remote/base64 — show it. Else canvas composite.
      if (d.provider !== "mock-canvas" && d.generation?.resultImage && d.generation.resultImage.startsWith("data:")) {
        setCompositeUrl(d.generation.resultImage);
      } else if (d.provider !== "mock-canvas" && d.generation?.resultImage?.startsWith("http")) {
        setCompositeUrl(d.generation.resultImage);
      } else {
        const comp = await makeMultiComposite(roomImage, d.itemImages, d.compositeHint?.scale || 0.58);
        setCompositeUrl(comp);
      }
      // refresh generations list
      fetch("/api/generations").then(r=>r.json()).then(g=> { if(g.generations) setRecentGens(g.generations.slice(0,6)); });
      window.dispatchEvent(new Event("movealong:refresh"));
    }catch(e:any){ setError(e.message); }
    setLoading(false);
  }

  const selectedListings = useMemo(()=> allListings.filter(l=> selectedIds.includes(l.id)), [allListings, selectedIds]);

  return (
    <div className="animate-page-in pt-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-ink">AI — Try items in your room</h1>
          <p className="text-muted text-sm mt-2 max-w-[60ch]">Upload your room once, save it, then place 1–{maxItems} items together. Cart & favorites feed straight in. With a Meta Model API key you get photoreal Muse Image output you can publish immediately; without a key we composite instantly on-device.</p>
        </div>
        <div className="bg-white border border-line rounded-2xl px-4 py-3 text-sm shadow-soft">
          <div className="font-semibold">Credits: {credits===null ? "—" : (tier === "pro" ? "Unlimited" : credits)} <span className="text-muted font-normal">· {tier}</span></div>
          <div className="text-xs text-muted mt-1">Limit: {maxItems} items / room · {limits.maxSavedRooms} saved rooms · <a href="/credits" className="underline">Get more</a></div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[440px_1fr] gap-6 mt-6">
        <div className="space-y-4">
          {/* Room picker */}
          <div className="bg-white border border-line rounded-2xl p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-sm">1. Your room</div>
              <span className="text-xs bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">{rooms.length}/{limits.maxSavedRooms} saved</span>
            </div>
            {rooms.length>0 && (
              <select value={selectedRoomId} onChange={e=>onSelectRoom(e.target.value)} className="mt-3 w-full bg-amber-50/60 border border-line rounded-xl px-3 py-2.5 text-sm">
                <option value="">— Pick a saved room —</option>
                {rooms.map(r=> <option key={r.id} value={r.id}>{r.name} · {new Date(r.createdAt).toLocaleDateString()}</option>)}
              </select>
            )}
            <label className="mt-3 block border-2 border-dashed border-line rounded-xl p-4 text-center cursor-pointer hover:bg-amber-50/50">
              <input type="file" accept="image/*" className="hidden" onChange={onRoomFile} />
              {roomImage ? <img src={roomImage} alt="room" className="max-h-[220px] mx-auto rounded-lg" /> : <span className="text-sm text-muted">Click to upload — wall, corner, or empty area</span>}
            </label>
            <div className="flex gap-2 mt-3">
              <input value={roomName} onChange={e=>setRoomName(e.target.value)} placeholder="Room name" className="flex-1 bg-amber-50/60 border border-line rounded-xl px-3 py-2 text-sm" />
              <button onClick={saveRoom} className="bg-[#1c1917] text-white px-4 py-2 rounded-xl text-sm font-semibold">Save room</button>
            </div>
            {saveRoomMsg && <div className="text-xs mt-2 text-emerald-700 bg-emerald-50 border border-emerald-100 p-2 rounded-lg">{saveRoomMsg}</div>}
            <p className="text-xs text-muted mt-2">Saved rooms live in your profile — reuse without re-uploading.</p>
          </div>

          {/* Items picker */}
          <div className="bg-white border border-line rounded-2xl p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-sm">2. Pick items ({selectedIds.length}/{maxItems})</div>
              <div className="flex gap-1 text-xs">
                {(["all","favorites","cart"] as const).map(t=> (
                  <button key={t} onClick={()=>setSourceTab(t)} className={`px-2.5 py-1 rounded-full border font-semibold ${sourceTab===t ? "bg-[#1c1917] text-white" : "bg-white"}`}>{t}</button>
                ))}
              </div>
            </div>
            {atLimit && <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 p-2 rounded-lg mt-2">{tier} limit is {maxItems} per room. Remove one or <a href="/credits" className="underline">upgrade</a>.</div>}
            <div className="mt-3 max-h-[520px] overflow-auto space-y-2 pr-1">
              {sourceList.length===0 ? <div className="text-sm text-muted text-center py-8">{sourceTab==="favorites" ? "No favorites yet. Tap the heart on any listing." : sourceTab==="cart" ? "Cart is empty. Add items from feed/detail." : "No listings yet."}</div>
              : sourceList.map((l:any)=> {
                const checked = selectedIds.includes(l.id);
                return (
                  <button key={l.id} onClick={()=>toggle(l.id)} className={`w-full flex gap-3 items-center text-left border rounded-xl p-2 ${checked ? "border-[#9a3412] bg-amber-50" : "border-line hover:bg-amber-50/40"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={l.images[0]} alt="" className="w-24 h-24 rounded-lg object-cover border shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold truncate">{l.title}</span>
                      <span className="block text-xs text-muted truncate">{l.building} · {l.isFree?"FREE":`$${l.price}`} {l.width?`· ${l.width}×${l.height} ${l.unit}`:""}</span>
                    </span>
                    <span className={`w-6 h-6 rounded-full grid place-items-center text-xs font-bold ${checked ? "bg-[#9a3412] text-white" : "bg-stone-100 border"}`}>{checked ? "✓" : "+"}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 mt-3">
              <input value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Optional: place against white wall, warm light…" className="flex-1 bg-amber-50/60 border border-line rounded-xl px-3 py-2 text-sm" />
            </div>
            <button onClick={generate} disabled={loading} className="w-full mt-3 bg-[#9a3412] text-white rounded-full py-3 font-bold disabled:opacity-50 hover:bg-[#7c2d12]">{loading?"Generating…":`Generate preview — 1 credit (${selectedIds.length} item${selectedIds.length===1?"":"s"})`}</button>
            {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 p-3 rounded-xl mt-3">{error}</div>}
            <p className="text-xs text-muted mt-2">Meta Muse Image ($0.01/img) when <code>META_API_KEY</code>/<code>MODEL_API_KEY</code> is set — output is publishable straight away. Otherwise on-device canvas mock. See README.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-line rounded-2xl p-5 shadow-soft">
            <div className="font-semibold">Preview</div>
            {loading ? (
              <div className="animate-fade-up mt-4 aspect-[4/3] rounded-xl border border-line overflow-hidden relative bg-amber-50 grid place-items-center" aria-live="polite">
                <div className="text-center px-6">
                  <div className="flex gap-1 justify-center"><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></div>
                  <div className="font-bold text-sm mt-3">Placing your items without changing your room…</div>
                  <div className="text-xs text-muted mt-1">Copying the exact products, matching scale and light. This can take a few seconds with Muse Image.</div>
                  <div className="shimmer-line h-2 rounded-full mt-4 w-52 mx-auto" />
                  <div className="shimmer-line h-2 rounded-full mt-1.5 w-36 mx-auto" />
                </div>
              </div>
            ) : !result ? <div className="mt-4 aspect-[4/3] rounded-xl bg-amber-50 grid place-items-center text-muted text-sm border border-dashed border-line">Pick a room + 1–{maxItems} items and generate</div>
            : (
              <div className="mt-4 space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-semibold text-muted mb-1">Your room {selectedRoomId ? "(saved)" : ""}</div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={roomImage!} alt="room" className="w-full rounded-xl border border-line" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-muted mb-1">Result — {result.provider} {result.provider==="mock-canvas" ? "(instant composite)" : "(photoreal — ready to publish)"}</div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={compositeUrl || result.generation?.resultImage || roomImage!} onError={(e)=>{ const t=e.currentTarget; if (roomImage && t.src!==roomImage) t.src=roomImage; }} alt="result" className="w-full rounded-xl border border-line shadow-soft" />
                    {result.providerError && <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 mt-1">Photoreal provider note: {String(result.providerError).slice(0,140)} — showing the instant composite instead.</div>}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap text-xs">
                  <a href={compositeUrl || "#"} download="movealong-preview.jpg" className="bg-[#1c1917] text-white px-4 py-2 rounded-full font-semibold">Download</a>
                  <button onClick={async()=>{ if(compositeUrl){ await navigator.clipboard.writeText(compositeUrl); alert("Image URL copied (data URL). Download to save locally."); } }} className="border px-4 py-2 rounded-full font-semibold hover:bg-amber-50">Copy link</button>
                  <span className="bg-amber-50 border border-line px-3 py-2 rounded-full">Credits left: {credits}</span>
                  <span className="bg-white border border-line px-3 py-2 rounded-full">{selectedListings.map(l=>l.title.slice(0,18)).join(" + ")}</span>
                </div>
                <div className="flex gap-2">
                  {selectedListings.map((l:any)=> <a key={l.id} href={`/listing/${l.id}`} className="text-xs underline">View {l.title.slice(0,22)} →</a>)}
                </div>
                <p className="text-xs text-muted">Saved to your profile under “Generations”. You can re-download anytime. {result.provider!=="mock-canvas" ? "Meta/Replicate output is a full-res image you can use as listing hero or share." : "Mock scales items by width with shadow. Add a Meta key for photoreal inpainting."}</p>
              </div>
            )}
          </div>

          {recentGens.length>0 && (
            <div className="bg-white border border-line rounded-2xl p-5 shadow-soft">
              <div className="flex justify-between items-center"><div className="font-semibold text-sm">Recent generations</div><a href="/profile?tab=generations" className="text-xs underline">See all in profile</a></div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-3">
                {recentGens.map((g:any)=> (
                  <a key={g.id} href={`/profile?tab=generations`} className="block aspect-square rounded-lg overflow-hidden border border-line bg-amber-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g.resultImage} alt="" className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white border border-line rounded-2xl p-5 shadow-soft text-sm">
            <div className="font-semibold">How limits work</div>
            <ul className="text-muted mt-2 list-disc ml-5 space-y-1 text-xs leading-relaxed">
              <li><b>Free: 3 items / room, 1 saved room</b> — enough for sofa + table + lamp, proves the idea without cost blow-up.</li>
              <li><b>Plus: 5 items, 5 rooms</b> — a full living room.</li>
              <li><b>Pro: 8 items, 30 rooms, unlimited credits</b> — 8 is the quality ceiling for one photo before placement gets cluttered; split larger sets into two scenes.</li>
              <li>1 credit per scene (not per item) — we want you to try combos.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
export default function AILabPage(){ return <Suspense><Inner/></Suspense> }
