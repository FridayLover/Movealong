"use client";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import BuildingAutocomplete from "@/components/BuildingAutocomplete";
import { ACCENTS, PRONOUN_OPTIONS, LANGUAGE_OPTIONS, PICKUP_BADGES, accentOf } from "@/lib/profileTheme";

function Inner(){
  const sp = useSearchParams();
  const initialTab = (sp.get("tab") || "listings") as string;
  const [tab, setTab] = useState(initialTab);
  const [me,setMe]=useState<any>(null);
  const [limits,setLimits]=useState<any>(null);
  const [myListings,setMyListings]=useState<any[]>([]);
  const [favorites,setFavorites]=useState<any[]>([]);
  const [cart,setCart]=useState<any[]>([]);
  const [cartTotal,setCartTotal]=useState(0);
  const [rooms,setRooms]=useState<any[]>([]);
  const [generations,setGenerations]=useState<any[]>([]);
  const [savedSearches,setSavedSearches]=useState<any[]>([]);
  const [orders,setOrders]=useState<any[]>([]);
  const [paymentMethod,setPaymentMethod]=useState<"pickup"|"card">("pickup");
  const [checkoutMsg,setCheckoutMsg]=useState("");
  const [checkingOut,setCheckingOut]=useState(false);
  const [editForm,setEditForm]=useState<any>({ name:"", avatar:"", coverImage:"", tagline:"", pronouns:"", languages:[], accent:"terracotta", pickupBadges:[], showcaseIds:[], prefDistanceKm:10, prefBudgetMax:"", prefCategories:[], prefStyle:"", phone:"", building:"", address:"", bio:"" });
  const [editMsg,setEditMsg]=useState("");
  const [savingProfile,setSavingProfile]=useState(false);

  async function loadAll() {
    const meRes = await fetch("/api/auth/me").then(r=>r.json());
    if(!meRes.user){ location.href="/auth"; return; }
    setMe(meRes.user);
    setLimits(meRes.limits);
    setEditForm({ name: meRes.user.name || "", avatar: meRes.user.avatar || "", coverImage: meRes.user.coverImage || "", tagline: meRes.user.tagline || "", pronouns: meRes.user.pronouns || "", languages: meRes.user.languages || [], accent: meRes.user.accent || "terracotta", pickupBadges: meRes.user.pickupBadges || [], showcaseIds: meRes.user.showcaseIds || [], prefDistanceKm: meRes.user.prefDistanceKm ?? 10, prefBudgetMax: meRes.user.prefBudgetMax != null ? String(meRes.user.prefBudgetMax) : "", prefCategories: meRes.user.prefCategories || [], prefStyle: meRes.user.prefStyle || "", phone: meRes.user.phone || "", building: meRes.user.building || "", address: meRes.user.address || "", bio: meRes.user.bio || "" });

    const [listRes, favRes, cartRes, roomRes, genRes, searchRes, orderRes] = await Promise.all([
      fetch("/api/listings").then(r=>r.json()),
      fetch("/api/favorites").then(r=>r.json()).catch(()=>({})),
      fetch("/api/cart").then(r=>r.json()).catch(()=>({})),
      fetch("/api/rooms").then(r=>r.json()).catch(()=>({})),
      fetch("/api/generations").then(r=>r.json()).catch(()=>({})),
      fetch("/api/saved-searches").then(r=>r.json()).catch(()=>({})),
      fetch("/api/checkout").then(r=>r.json()).catch(()=>({})),
    ]);
    // Own listings by seller id (display names can collide; ids cannot)
    setMyListings((listRes.listings||[]).filter((l:any)=> l.seller?.id === meRes.user.id));
    setFavorites(favRes.favorites || []);
    setCart(cartRes.cart || []);
    setCartTotal(cartRes.total || 0);
    setRooms(roomRes.rooms || []);
    setGenerations(genRes.generations || []);
    setSavedSearches(searchRes.savedSearches || []);
    setOrders(orderRes.orders || []);
  }

  useEffect(()=>{ loadAll(); },[]);
  useEffect(()=>{ if(sp.get("tab")) setTab(sp.get("tab")!); },[sp]);

  async function saveProfile(e: React.FormEvent){
    e.preventDefault(); setSavingProfile(true); setEditMsg("");
    const r = await fetch("/api/user/profile", { method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify(editForm) });
    const d = await r.json(); setSavingProfile(false);
    if(!r.ok) return setEditMsg(d.error || "Failed");
    setMe(d.user); setEditMsg("Saved. Header will refresh."); window.dispatchEvent(new Event("movealong:refresh"));
    setTimeout(()=>setEditMsg(""), 2500);
  }

  async function removeFav(id:string){ await fetch("/api/favorites",{method:"DELETE", headers:{"Content-Type":"application/json"}, body: JSON.stringify({listingId:id})}); loadAll(); window.dispatchEvent(new Event("movealong:refresh")); }
  async function removeCart(id:string){ await fetch("/api/cart",{method:"DELETE", headers:{"Content-Type":"application/json"}, body: JSON.stringify({listingId:id})}); loadAll(); window.dispatchEvent(new Event("movealong:refresh")); }
  async function deleteRoom(id:string){ await fetch("/api/rooms",{method:"DELETE", headers:{"Content-Type":"application/json"}, body: JSON.stringify({id})}); loadAll(); }
  async function deleteGen(id:string){ await fetch("/api/generations",{method:"DELETE", headers:{"Content-Type":"application/json"}, body: JSON.stringify({id})}); loadAll(); }
  async function deleteSearch(id:string){ await fetch("/api/saved-searches",{method:"DELETE", headers:{"Content-Type":"application/json"}, body: JSON.stringify({id})}); loadAll(); }
  async function clearCart(){ await fetch("/api/cart",{method:"DELETE", headers:{"Content-Type":"application/json"}, body: JSON.stringify({clearAll:true})}); loadAll(); window.dispatchEvent(new Event("movealong:refresh")); }
  async function checkout(){
    setCheckingOut(true); setCheckoutMsg("");
    const r = await fetch("/api/checkout", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ paymentMethod }) });
    const d = await r.json(); setCheckingOut(false);
    if(!r.ok){ setCheckoutMsg(d.error || "Checkout failed"); return; }
    setCheckoutMsg(paymentMethod === "pickup" ? `Reserved ${d.orders.length} item(s) — pay $${d.total.toFixed(2)} at pickup. Chat each seller to arrange the lobby time.` : `Paid $${d.total.toFixed(2)} by card (mock) — ${d.orders.length} item(s) reserved. Show this to the seller at pickup.`);
    loadAll(); window.dispatchEvent(new Event("movealong:refresh"));
  }

  if(!me) return <div className="pt-10 text-center text-muted">Loading…</div>;

  const tabs = [
    { id:"listings", label:`My listings (${myListings.length})` },
    { id:"favorites", label:`Favorites (${favorites.length})` },
    { id:"cart", label:`Cart (${cart.length})` },
    { id:"rooms", label:`My rooms (${rooms.length}/${limits?.maxSavedRooms ?? "—"})` },
    { id:"generations", label:`Generations (${generations.length})` },
    { id:"searches", label:`Saved searches (${savedSearches.length})` },
    { id:"settings", label:"Edit profile" },
  ];

  const myAccent = accentOf(me.accent);
  return (
    <div className="animate-page-in pt-6 max-w-[1100px] mx-auto space-y-7">
      {/* Header — minimal & modern by default: quiet cover band, overlapping
          avatar, plain stats. The accent comes from the user's own settings. */}
      <div>
        <div className="relative h-32 sm:h-40 rounded-[26px] overflow-hidden" style={{ background: myAccent.soft }}>
          {me.coverImage
            ? <img src={me.coverImage} alt="" className="w-full h-full object-cover" />
            : <div className="absolute inset-0 grid place-items-center text-[13px] font-medium" style={{ color: myAccent.hex }}>Your shop cover — add one in Edit profile</div>}
          <div className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: myAccent.hex }} />
        </div>
        <div className="px-2 sm:px-4">
          <div className="flex flex-wrap items-end gap-4 -mt-9">
            {me.avatar
              ? <img src={me.avatar} alt="" className="relative w-[76px] h-[76px] rounded-[22px] object-cover ring-4 ring-[#fffbf5] bg-white" />
              : <span className="relative w-[76px] h-[76px] rounded-[22px] text-white grid place-items-center text-[26px] font-black ring-4 ring-[#fffbf5]" style={{ background: myAccent.hex }}>{me.name.slice(0,1).toUpperCase()}</span>}
            <div className="flex-1 min-w-[210px] pt-10 sm:pt-9">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[22px] leading-tight font-black tracking-tight text-ink">{me.name}</h1>
                {me.pronouns && <span className="text-xs text-muted">({me.pronouns})</span>}
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: myAccent.hex }}>{me.subscriptionTier}</span>
              </div>
              {me.tagline && <div className="text-sm text-stone-600 mt-0.5">{me.tagline}</div>}
              <div className="text-[13px] text-muted mt-0.5 truncate">{me.building || "No building set"}{me.address ? ` · ${me.address}` : ""}</div>
            </div>
            <div className="flex items-center gap-2 pt-2 sm:pt-9">
              <Link href={`/seller/${me.id}`} className="press text-white px-4 py-2.5 rounded-full text-sm font-bold shadow-soft hover:opacity-95" style={{ background: myAccent.hex }}>View my shop →</Link>
              <button onClick={()=>setTab("settings")} className="press bg-white border border-line px-4 py-2.5 rounded-full text-sm font-semibold hover:bg-amber-50">Edit profile</button>
              <button onClick={async()=>{ await fetch("/api/auth/me",{method:"DELETE"}); location.href="/"; }} className="press text-sm text-muted hover:text-ink px-1.5 py-2.5">Logout</button>
            </div>
          </div>
          {(me.languages?.length > 0 || me.pickupBadges?.length > 0) && (
            <div className="flex gap-1.5 flex-wrap mt-3">
              {(me.languages || []).map((l: string) => <span key={l} className="text-[11px] font-semibold bg-white border border-line px-2 py-1 rounded-full">{l}</span>)}
              {(me.pickupBadges || []).map((b: string) => <span key={b} className="text-[11px] font-semibold px-2 py-1 rounded-full" style={{ background: myAccent.soft, color: myAccent.dark }}>{(PICKUP_BADGES.find(x=>x.id===b)?.label || b)}</span>)}
            </div>
          )}
          {me.bio && <p className="text-sm text-stone-600 leading-relaxed mt-3 max-w-[68ch]">{me.bio}</p>}
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-4 text-[13px] text-muted">
            <span><b className="text-ink">{myListings.length}</b> listings</span>
            <span><b className="text-ink">{favorites.length}</b> favorites</span>
            <span><b className="text-ink">{cart.length}</b> in cart</span>
            <span><b className="text-ink">{rooms.length}/{limits?.maxSavedRooms ?? "—"}</b> rooms</span>
            <span><b className="text-ink">{me.subscriptionTier === "pro" ? "Unlimited" : me.credits}</b> credits · up to {limits?.maxItemsPerRoom} items/room</span>
          </div>
          <div className="text-xs text-muted mt-1.5">{me.email}{me.phone ? ` · ${me.phone} (private)` : ""}</div>
        </div>
      </div>

      {/* Tabs — quiet underline style */}
      <div className="flex gap-1 overflow-auto no-scrollbar border-b border-line">
        {tabs.map(t=> (
          <button key={t.id} onClick={()=>setTab(t.id)} className={`press shrink-0 px-3.5 py-2.5 text-sm -mb-px border-b-2 ${tab===t.id ? "font-bold text-ink" : "font-medium text-muted hover:text-ink border-transparent"}`} style={tab===t.id ? { borderColor: myAccent.hex } : {}}>{t.label}</button>
        ))}
      </div>

      {tab==="listings" && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold text-lg">Your listings</h2>
            <Link href="/sell" className="bg-[#9a3412] text-white px-4 py-2 rounded-full text-sm font-bold hover:bg-[#7c2d12]">+ New listing</Link>
          </div>
          {myListings.length===0 ? <div className="border border-dashed border-line rounded-3xl p-10 text-center text-muted bg-white/50">You haven’t listed anything yet. <Link href="/sell" className="underline">List your first item</Link></div>
          : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{myListings.map((l:any)=>(
            <Link key={l.id} href={`/listing/${l.id}`} className="bg-white border border-line/70 rounded-3xl overflow-hidden transition-shadow hover:shadow-soft">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={l.images[0]} alt="" className="w-full aspect-[4/3] object-cover" />
              <div className="p-3"><div className="font-semibold text-sm line-clamp-1">{l.title}</div><div className="text-xs text-muted">{l.isFree?"FREE":`$${l.price}`} · {l.status}</div></div>
            </Link>
          ))}</div>}
        </div>
      )}

      {tab==="favorites" && (
        <div>
          <div className="flex justify-between items-center mb-3"><h2 className="font-bold text-lg">Favorites</h2><span className="text-xs text-muted">Tap Instant preview to try favorites together in AI Lab</span></div>
          {favorites.length===0 ? <div className="border border-dashed border-line rounded-3xl p-10 text-center text-muted bg-white/50">No favorites yet. Tap the heart on any listing to save it here.</div>
          : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{favorites.map((l:any)=>(
            <div key={l.id} className="bg-white border border-line/70 rounded-3xl overflow-hidden transition-shadow hover:shadow-soft">
              <Link href={`/listing/${l.id}`} className="block"><img src={l.images[0]} alt="" className="w-full aspect-[4/3] object-cover" /></Link>
              <div className="p-3">
                <div className="font-semibold text-sm line-clamp-1">{l.title}</div>
                <div className="text-xs text-muted">{l.isFree?"FREE":`$${l.price}`} · {l.building}</div>
                <div className="flex gap-2 mt-3">
                  <Link href={`/ai-lab?listing=${l.id}`} className="flex-1 text-center text-xs font-bold bg-[#9a3412] text-white py-2 rounded-full">Instant preview</Link>
                  <button onClick={()=>removeFav(l.id)} className="flex-1 border py-2 rounded-full text-xs font-semibold hover:bg-amber-50">Remove</button>
                </div>
              </div>
            </div>
          ))}</div>}
          {favorites.length>0 && <Link href={`/ai-lab?from=favorites`} className="mt-4 inline-block bg-[#1c1917] text-white px-5 py-2.5 rounded-full text-sm font-bold">Preview all favorites in room →</Link>}
        </div>
      )}

      {tab==="cart" && (
        <div>
          <div className="flex flex-wrap gap-3 items-center justify-between mb-3">
            <h2 className="font-bold text-lg">Cart</h2>
            <div className="text-sm">Total: <b>${cartTotal.toFixed(2)}</b> · <button onClick={clearCart} className="underline text-xs">Clear cart</button></div>
          </div>
          {orders.length > 0 && (
            <div className="bg-white border border-line/70 rounded-3xl p-4 mb-4">
              <div className="font-semibold text-sm">Your orders ({orders.length})</div>
              <div className="mt-2 space-y-2">
                {orders.slice(0, 6).map((o:any)=>(
                  <div key={o.id} className="flex gap-3 items-center text-sm border border-line/60 rounded-xl p-2">
                    <img src={o.listing.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover border" />
                    <span className="flex-1 min-w-0"><span className="block font-semibold truncate text-sm">{o.listing.title}</span><span className="text-xs text-muted">{o.role === "buyer" ? `Seller: ${o.seller.name}` : `Buyer: ${o.buyer.name}`} · {o.paymentMethod} · {o.status}</span></span>
                    <span className="font-bold text-sm">${o.price}</span>
                    <Link href="/chat" className="text-xs underline shrink-0">Chat</Link>
                  </div>
                ))}
              </div>
            </div>
          )}
          {cart.length===0 ? <div className="border border-dashed border-line rounded-3xl p-10 text-center text-muted bg-white/50">Cart is empty. Add items you want to pick up together.</div>
          : (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{cart.map((l:any)=>(
                <div key={l.id} className="bg-white border border-line/70 rounded-3xl overflow-hidden transition-shadow hover:shadow-soft">
                  <Link href={`/listing/${l.id}`} className="block"><img src={l.images[0]} alt="" className="w-full aspect-[4/3] object-cover" /></Link>
                  <div className="p-3">
                    <div className="font-semibold text-sm line-clamp-1">{l.title}</div>
                    <div className="text-xs text-muted">{l.isFree?"FREE":`$${l.price}`} · {l.building}</div>
                    <div className="flex gap-2 mt-3">
                      <Link href={`/ai-lab?listing=${l.id}`} className="flex-1 text-center text-xs font-bold bg-[#9a3412] text-white py-2 rounded-full">Preview</Link>
                      <button onClick={()=>removeCart(l.id)} className="flex-1 border py-2 rounded-full text-xs font-semibold hover:bg-amber-50">Remove</button>
                    </div>
                  </div>
                </div>
              ))}</div>
              <div className="mt-4 flex gap-2 flex-wrap">
                <Link href="/ai-lab?from=cart" className="bg-[#9a3412] text-white px-5 py-2.5 rounded-full text-sm font-bold hover:bg-[#7c2d12]">Preview cart in my room →</Link>
                <span className="text-xs text-muted self-center">Preview first, then checkout below.</span>
              </div>

              <div className="mt-4 bg-white border border-line/70 rounded-3xl p-5">
                <div className="font-bold">Checkout</div>
                <p className="text-xs text-muted mt-1">Second-hand items are sold <b>as-is</b>. <b>No returns or refunds after payment/pickup</b> — please check photos, condition and size (W×H×D) carefully, and inspect the item in person at pickup before you pay in cash.</p>
                <div className="grid sm:grid-cols-2 gap-3 mt-4">
                  <label className={`border rounded-2xl p-4 cursor-pointer flex gap-3 ${paymentMethod === "pickup" ? "border-[#9a3412] bg-amber-50" : "border-line"}`}>
                    <input type="radio" name="pay" checked={paymentMethod === "pickup"} onChange={() => setPaymentMethod("pickup")} className="mt-1" />
                    <span>
                      <span className="font-bold text-sm flex items-center gap-2">Pay at pickup <span className="text-[11px] font-black bg-[#9a3412] text-white px-2 py-0.5 rounded-full">Recommended</span></span>
                      <span className="block text-xs text-muted mt-1">Reserve now, pay the seller in cash/transfer when you see the item. Safest for second-hand — you only pay if it matches the photos.</span>
                    </span>
                  </label>
                  <label className={`border rounded-2xl p-4 cursor-pointer flex gap-3 ${paymentMethod === "card" ? "border-[#9a3412] bg-amber-50" : "border-line"}`}>
                    <input type="radio" name="pay" checked={paymentMethod === "card"} onChange={() => setPaymentMethod("card")} className="mt-1" />
                    <span>
                      <span className="font-bold text-sm">Pay by card</span>
                      <span className="block text-xs text-muted mt-1">Pay now by card (mock — connect Stripe for live). Still no returns after pickup, so chat the seller and check size first.</span>
                    </span>
                  </label>
                </div>
                {paymentMethod === "card" && (
                  <div className="grid sm:grid-cols-[1fr_120px_100px] gap-2 mt-3">
                    <input placeholder="Card number (mock) 4242 4242 4242 4242" className="bg-stone-50/70 border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:bg-white focus:border-stone-400 transition" />
                    <input placeholder="MM / YY" className="bg-stone-50/70 border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:bg-white focus:border-stone-400 transition" />
                    <input placeholder="CVC" className="bg-stone-50/70 border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:bg-white focus:border-stone-400 transition" />
                  </div>
                )}
                <div className="flex flex-wrap gap-3 items-center mt-4">
                  <button onClick={checkout} disabled={checkingOut} className="bg-[#1c1917] text-white px-6 py-3 rounded-full font-bold disabled:opacity-50">{checkingOut ? "Processing…" : paymentMethod === "pickup" ? `Reserve & pay $${cartTotal.toFixed(2)} at pickup` : `Pay $${cartTotal.toFixed(2)} by card`}</button>
                  <span className="text-xs text-muted">By checking out you agree: second-hand, as-is, no returns. Listings become “reserved” for you.</span>
                </div>
                {checkoutMsg && <div className="text-sm mt-3 bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl">{checkoutMsg}</div>}
              </div>
            </>
          )}
        </div>
      )}

      {tab==="rooms" && (
        <div>
          <div className="flex justify-between items-center mb-3"><h2 className="font-bold text-lg">My rooms</h2><Link href="/ai-lab" className="bg-[#9a3412] text-white px-4 py-2 rounded-full text-sm font-bold">+ Add in AI Lab</Link></div>
          {rooms.length===0 ? <div className="border border-dashed border-line rounded-3xl p-10 text-center text-muted bg-white/50">No rooms saved yet. Go to <Link href="/ai-lab" className="underline">AI Lab</Link>, upload a room and click “Save room”. Free saves 1, Plus 5, Pro 30.</div>
          : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{rooms.map((r:any)=>(
            <div key={r.id} className="bg-white border border-line/70 rounded-3xl overflow-hidden transition-shadow hover:shadow-soft">
              <img src={r.image} alt={r.name} className="w-full aspect-[4/3] object-cover" />
              <div className="p-3">
                <div className="font-semibold text-sm truncate">{r.name}</div>
                <div className="text-xs text-muted">{new Date(r.createdAt).toLocaleString()}</div>
                <div className="flex gap-2 mt-3">
                  <Link href={`/ai-lab?room=${r.id}`} className="flex-1 text-center text-xs font-bold bg-[#9a3412] text-white py-2 rounded-full">Use in AI Lab</Link>
                  <button onClick={()=>deleteRoom(r.id)} className="flex-1 border py-2 rounded-full text-xs font-semibold hover:bg-amber-50">Delete</button>
                </div>
              </div>
            </div>
          ))}</div>}
        </div>
      )}

      {tab==="generations" && (
        <div>
          <div className="flex justify-between items-center mb-3"><h2 className="font-bold text-lg">Saved generations</h2><span className="text-xs text-muted">Download to keep locally — also stored here in your profile</span></div>
          {generations.length===0 ? <div className="border border-dashed border-line rounded-3xl p-10 text-center text-muted bg-white/50">No generations yet. <Link href="/ai-lab" className="underline">Generate your first preview</Link></div>
          : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{generations.map((g:any)=>{
            const ids: string[] = JSON.parse(g.listingIds || "[]");
            return (
              <div key={g.id} className="bg-white border border-line/70 rounded-3xl overflow-hidden transition-shadow hover:shadow-soft">
                <img src={g.resultImage} alt="" className="w-full aspect-[4/3] object-cover" />
                <div className="p-3">
                  <div className="text-xs text-muted">{new Date(g.createdAt).toLocaleString()} · {g.provider} · {ids.length} item{ids.length===1?"":"s"}</div>
                  <div className="text-xs mt-1 line-clamp-1">{g.listing?.title || ids.join(", ")}</div>
                  {g.prompt && <div className="text-xs text-muted italic line-clamp-1">“{g.prompt}”</div>}
                  <div className="flex gap-2 mt-3">
                    <a href={g.resultImage} download={`movealong-${g.id}.jpg`} className="flex-1 text-center text-xs font-bold bg-[#1c1917] text-white py-2 rounded-full">Download</a>
                    <button onClick={()=>deleteGen(g.id)} className="flex-1 border py-2 rounded-full text-xs font-semibold hover:bg-amber-50">Delete</button>
                  </div>
                  <a href={`/listing/${g.listingId}`} className="block text-center text-xs underline mt-2">View main listing →</a>
                </div>
              </div>
            );
          })}</div>}
        </div>
      )}

      {tab==="searches" && (
        <div>
          <div className="flex justify-between items-center mb-3"><h2 className="font-bold text-lg">Saved searches</h2><Link href="/" className="text-sm underline">Create on feed →</Link></div>
          {savedSearches.length===0 ? <div className="border border-dashed border-line rounded-3xl p-10 text-center text-muted bg-white/50">No saved searches yet. On the feed, set filters (e.g. “sofa · Ideo · under $70”) and tap “Notify me — save this search”. New matches will show a red count here, because good second-hand goes fast (23% online resale growth in 2024).</div>
          : <div className="space-y-2">{savedSearches.map((s:any)=>(
            <div key={s.id} className="bg-white border border-line/70 rounded-3xl p-4 flex flex-wrap gap-3 items-center">
              <div className="flex-1 min-w-[200px]">
                <div className="font-semibold text-sm">{s.query || "(any text)"} · {s.category} {s.building ? `· ${s.building}` : ""} {s.freeOnly ? "· FREE" : ""} {s.maxPrice ? `· under $${s.maxPrice}` : ""}</div>
                <div className="text-xs text-muted">Saved {new Date(s.createdAt).toLocaleDateString()} · {s.totalMatches} total matches · {s.newMatches} new since saved</div>
              </div>
              {s.newMatches > 0 && <span className="bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">{s.newMatches} new</span>}
              <Link href={`/?q=${encodeURIComponent(s.query || "")}&category=${encodeURIComponent(s.category || "all")}&building=${encodeURIComponent(s.building || "")}`} className="border px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-amber-50">View</Link>
              <button onClick={()=>deleteSearch(s.id)} className="border px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-amber-50">Delete</button>
            </div>
          ))}</div>}
        </div>
      )}

      {tab==="settings" && (
        <form onSubmit={saveProfile} className="bg-white border border-line/70 rounded-3xl p-6 sm:p-7 max-w-[760px]">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div><div className="font-bold text-lg">Edit profile — shape your shop</div>
            <p className="text-sm text-muted mt-1">Your shop starts clean and minimal — make it yours here: cover, accent, tagline, badges, showcase. Share only what you are comfortable with; a beautiful, honest shop helps neighbours trust and buy more.</p></div>
            <Link href={`/seller/${me.id}`} className="press shrink-0 text-white px-4 py-2 rounded-full text-sm font-bold" style={{ background: accentOf(editForm.accent).hex }}>View my shop →</Link>
          </div>

          {/* Live chic preview strip */}
          <div className="mt-4 rounded-2xl overflow-hidden border border-line">
            <div className="h-24 bg-stone-200 relative">{editForm.coverImage ? <img src={editForm.coverImage} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full" style={{ background: accentOf(editForm.accent).soft }} />}<div className="absolute inset-x-0 bottom-0 h-1" style={{ background: accentOf(editForm.accent).hex }} /></div>
            <div className="px-4 py-3 flex gap-3 items-center bg-white">
              {editForm.avatar ? <img src={editForm.avatar} alt="" className="w-12 h-12 rounded-2xl object-cover border" /> : <span className="w-12 h-12 rounded-2xl bg-[#1c1917] text-amber-100 grid place-items-center font-black">{(editForm.name || "?").slice(0,1).toUpperCase()}</span>}
              <span className="min-w-0"><span className="block font-bold truncate">{editForm.name || "Your name"}</span><span className="block text-xs text-muted truncate">{editForm.tagline || "Your tagline — e.g. “Moving out · everything must go by Sunday”"}</span></span>
            </div>
          </div>

          <div className="grid gap-4 mt-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className="text-sm font-semibold">Name</label><input value={editForm.name} onChange={e=>setEditForm({...editForm,name:e.target.value})} className="mt-1 w-full bg-stone-50/70 border border-stone-200 rounded-xl px-4 py-3 text-sm outline-none focus:bg-white focus:border-stone-400 transition" /></div>
              <div><label className="text-sm font-semibold">Tagline (shop headline)</label><input value={editForm.tagline} onChange={e=>setEditForm({...editForm,tagline:e.target.value})} placeholder="Moving out · all must go by Sunday" maxLength={90} className="mt-1 w-full bg-stone-50/70 border border-stone-200 rounded-xl px-4 py-3 text-sm outline-none focus:bg-white focus:border-stone-400 transition" /></div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className="text-sm font-semibold">Avatar URL</label><input value={editForm.avatar} onChange={e=>setEditForm({...editForm,avatar:e.target.value})} placeholder="https://…" className="mt-1 w-full bg-stone-50/70 border border-stone-200 rounded-xl px-4 py-3 text-sm outline-none focus:bg-white focus:border-stone-400 transition" /></div>
              <div><label className="text-sm font-semibold">Cover image URL</label><input value={editForm.coverImage} onChange={e=>setEditForm({...editForm,coverImage:e.target.value})} placeholder="Your room / building photo URL" className="mt-1 w-full bg-stone-50/70 border border-stone-200 rounded-xl px-4 py-3 text-sm outline-none focus:bg-white focus:border-stone-400 transition" /></div>
            </div>

            <div>
              <label className="text-sm font-semibold">Accent colour — your shop theme</label>
              <div className="flex gap-2 flex-wrap mt-2">
                {ACCENTS.map(a=>(
                  <button type="button" key={a.id} onClick={()=>setEditForm({...editForm,accent:a.id})} className={`press flex items-center gap-2 border rounded-full pl-1.5 pr-3 py-1.5 text-xs font-bold ${editForm.accent===a.id ? "border-[#1c1917] bg-amber-50" : "border-line bg-white"}`}><span className="w-5 h-5 rounded-full border border-white shadow" style={{ background:a.hex }} />{a.label}{editForm.accent===a.id ? " ✓" : ""}</button>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold">Pronouns (optional)</label>
                <select value={editForm.pronouns} onChange={e=>setEditForm({...editForm,pronouns:e.target.value})} className="mt-1 w-full bg-stone-50/70 border border-stone-200 rounded-xl px-3 py-3 text-sm outline-none focus:bg-white focus:border-stone-400 transition">
                  <option value="">Prefer not to say</option>
                  {PRONOUN_OPTIONS.map(p=><option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold">Languages you can chat in</label>
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {LANGUAGE_OPTIONS.map(l=>{
                    const on = (editForm.languages||[]).includes(l);
                    return <button type="button" key={l} onClick={()=>setEditForm({...editForm,languages: on ? editForm.languages.filter((x:string)=>x!==l) : [...(editForm.languages||[]), l]})} className={`press px-2.5 py-1.5 rounded-full border text-xs font-bold ${on ? "bg-[#1c1917] text-white" : "bg-white"}`}>{l}</button>;
                  })}
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold">Pickup badges — help every buyer plan</label>
              <div className="flex gap-1.5 flex-wrap mt-2">
                {PICKUP_BADGES.map(b=>{
                  const on = (editForm.pickupBadges||[]).includes(b.id);
                  return <button type="button" key={b.id} onClick={()=>setEditForm({...editForm,pickupBadges: on ? editForm.pickupBadges.filter((x:string)=>x!==b.id) : [...(editForm.pickupBadges||[]), b.id]})} className={`press px-3 py-1.5 rounded-full border text-xs font-bold ${on ? "text-white" : "bg-white"}`} style={on ? { background: accentOf(editForm.accent).hex, borderColor: accentOf(editForm.accent).hex } : {}}>{b.label}</button>;
                })}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className="text-sm font-semibold">Phone (optional, never shown publicly)</label><input value={editForm.phone} onChange={e=>setEditForm({...editForm,phone:e.target.value})} placeholder="+66…" className="mt-1 w-full bg-stone-50/70 border border-stone-200 rounded-xl px-4 py-3 text-sm outline-none focus:bg-white focus:border-stone-400 transition" /></div>
              <div><label className="text-sm font-semibold">Building — type for real places</label><div className="mt-1"><BuildingAutocomplete value={editForm.building} onChange={(v)=>setEditForm({...editForm,building:v})} onSelect={(p)=>setEditForm((f:any)=>({...f, building:p.name, address:p.displayName}))} /></div></div>
            </div>
            <div><label className="text-sm font-semibold">Address / area (public, coarse)</label><input value={editForm.address} onChange={e=>setEditForm({...editForm,address:e.target.value})} placeholder="Sukhumvit 93, Bangkok" className="mt-1 w-full bg-stone-50/70 border border-stone-200 rounded-xl px-4 py-3 text-sm outline-none focus:bg-white focus:border-stone-400 transition" /></div>
            <div><label className="text-sm font-semibold">Bio — your moving story</label><textarea value={editForm.bio} onChange={e=>setEditForm({...editForm,bio:e.target.value})} rows={3} placeholder="Moving out/in, timing, what you're looking for…" className="mt-1 w-full bg-stone-50/70 border border-stone-200 rounded-xl px-4 py-3 text-sm outline-none focus:bg-white focus:border-stone-400 transition" /></div>

            <div className="border border-line rounded-2xl p-4 bg-amber-50/40">
              <div className="font-bold text-sm">Agent preferences — what Muse Spark should recommend for you</div>
              <div className="grid sm:grid-cols-2 gap-4 mt-3 text-sm">
                <label className="flex items-center gap-2"><span className="text-muted whitespace-nowrap text-xs font-semibold">Within {editForm.prefDistanceKm}km</span><input type="range" min={1} max={50} value={editForm.prefDistanceKm} onChange={e=>setEditForm({...editForm,prefDistanceKm:Number(e.target.value)})} className="flex-1 accent-[#9a3412]" /></label>
                <div className="flex items-center gap-2"><span className="text-muted text-xs font-semibold whitespace-nowrap">Budget max $</span><input value={editForm.prefBudgetMax} onChange={e=>setEditForm({...editForm,prefBudgetMax:e.target.value})} placeholder="Any" inputMode="numeric" className="w-full bg-white border border-line rounded-full px-3 py-2 text-sm" /></div>
              </div>
              <div className="flex gap-1.5 flex-wrap mt-3">
                {["furniture","appliance","decor","kitchen","electronics","other"].map(c=>{
                  const on = (editForm.prefCategories||[]).includes(c);
                  return <button type="button" key={c} onClick={()=>setEditForm({...editForm,prefCategories: on ? editForm.prefCategories.filter((x:string)=>x!==c) : [...(editForm.prefCategories||[]), c]})} className={`press px-2.5 py-1.5 rounded-full border text-xs font-bold ${on ? "bg-[#1c1917] text-white" : "bg-white"}`}>{c}</button>;
                })}
                <select value={editForm.prefStyle} onChange={e=>setEditForm({...editForm,prefStyle:e.target.value})} className="bg-white border border-line rounded-full px-2 py-1.5 text-xs font-semibold"><option value="">Any style</option><option value="cozy warm">cozy warm</option><option value="minimal">minimal</option><option value="scandi">scandi</option><option value="warm modern">warm modern</option><option value="industrial">industrial</option></select>
              </div>
            </div>

            {myListings.length > 0 && (
              <div>
                <label className="text-sm font-semibold">Showcase — pin up to 4 best listings to the top of your shop</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                  {myListings.map((l:any)=>{
                    const on = (editForm.showcaseIds||[]).includes(l.id);
                    return <button type="button" key={l.id} onClick={()=>setEditForm({...editForm,showcaseIds: on ? editForm.showcaseIds.filter((x:string)=>x!==l.id) : [...(editForm.showcaseIds||[]), l.id].slice(0,4)})} className={`press text-left border rounded-xl overflow-hidden ${on ? "border-[#1c1917] ring-2 ring-[#1c1917]/10" : "border-line"}`}><img src={l.images[0]} alt="" className="w-full aspect-[4/3] object-cover" /><span className="block p-2"><span className="block text-[11px] font-bold line-clamp-1">{l.title}</span><span className="text-[11px] text-muted">{on ? "★ Showcased" : "Tap to showcase"}</span></span></button>;
                  })}
                </div>
              </div>
            )}

            {editMsg && <div className={`text-sm p-3 rounded-xl ${editMsg.includes("Saved") ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-red-50 border border-red-200 text-red-700"}`}>{editMsg}</div>}
            <button disabled={savingProfile} className="press text-white py-3 rounded-full font-bold disabled:opacity-50" style={{ background: accentOf(editForm.accent).hex }}>{savingProfile ? "Saving…" : "Save changes"}</button>
          </div>
        </form>
      )}

      <div className="border-t border-line pt-5 text-[13px] text-muted leading-relaxed">
        <span className="font-semibold text-ink">Good to know — </span>
        preview cart/favorites together in AI Lab (up to {limits?.maxItemsPerRoom} at once) before messaging · generations are downloadable here · saved rooms skip re-upload · this app is PWA-ready for a later Capacitor wrap (see README).
      </div>
    </div>
  );
}
export default function ProfilePage(){ return <Suspense><Inner/></Suspense> }
