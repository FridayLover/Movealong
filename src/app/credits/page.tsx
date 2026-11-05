"use client";
import { useI18n } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { formatCredits } from "@/lib/credits";

export default function CreditsPage(){
  const { t } = useI18n();
  const [data, setData]=useState<any>(null);
  const [msg, setMsg]=useState("");

  async function load(){ const r=await fetch("/api/ai/credits"); const d=await r.json(); if(!d.error) setData(d); }
  useEffect(()=>{ load(); },[]);

  async function buyPack(id:string){
    const r=await fetch("/api/ai/credits",{method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({packageId:id})});
    const d=await r.json(); if(r.ok){ setMsg(`+${d.credits} credits!`); load(); } else setMsg(d.error);
  }
  async function buySub(tier:string){
    const r=await fetch("/api/ai/credits",{method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({subscriptionTier:tier})});
    const d=await r.json(); if(r.ok){ setMsg(`Subscribed to ${tier}!`); load(); } else setMsg(d.error);
  }

  return (
    <div className="animate-page-in pt-6 max-w-[900px] mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-black text-ink">{t("Credits & subscriptions")}</h1>
        <p className="text-muted text-sm mt-2">Every AI “try items in your room” scene uses 1 credit (not per item). Free: 3 / month · Plus 60 · Pro unlimited. Items per room: Free 3 · Plus 5 · Pro 8. Mock checkout — add Stripe for real.</p>
      </div>

      {data && (
        <div className="bg-white border border-line rounded-2xl p-5 flex flex-wrap gap-4 items-center justify-between shadow-soft">
          <div><div className="font-bold">{t("Your balance")}</div><div className="text-2xl font-black">{data.subscriptionTier === "pro" ? t("Unlimited") : `${data.credits} ${t("Credits")}`}</div><div className="text-sm text-muted">Tier: {data.subscriptionTier} · Up to {data.limits?.maxItemsPerRoom} items/room · {data.limits?.maxSavedRooms} rooms</div></div>
          <div className="text-xs bg-amber-50 border border-line rounded-xl px-3 py-2">Resets monthly. Unused free credits do not roll over.</div>
        </div>
      )}

      {msg && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-xl text-sm">{msg}</div>}

      <div>
        <h2 className="font-bold text-lg">{t("Credit packs (one-time)")}</h2>
        <div className="grid sm:grid-cols-3 gap-4 mt-3">
          {(data?.packages || [{id:"pack10",credits:10,price:4.99,label:"Starter — 10 credits"},{id:"pack50",credits:50,price:19.99,label:"Popular — 50 credits"},{id:"pack120",credits:120,price:39.99,label:"Pro — 120 credits"}]).map((p:any)=>(
            <div key={p.id} className="bg-white border border-line rounded-2xl p-5 shadow-soft">
              <div className="font-bold">{p.label}</div>
              <div className="text-2xl font-black mt-1">${p.price.toFixed(2)}</div>
              <div className="text-xs text-muted">{p.credits} scenes (1 credit per scene, any items up to your tier limit)</div>
              <button onClick={()=>buyPack(p.id)} className="mt-4 w-full bg-[#1c1917] text-white py-2.5 rounded-full font-semibold">{t("Buy (mock)")}</button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-bold text-lg">{t("Subscriptions")}</h2>
        <div className="grid sm:grid-cols-2 gap-4 mt-3">
          <div className="bg-white border border-line rounded-2xl p-5 shadow-soft">
            <div className="font-bold">Plus — 60 / month</div><div className="text-2xl font-black mt-1">$9.99<span className="text-sm font-normal text-muted">/mo</span></div>
            <ul className="text-sm text-muted mt-2 list-disc ml-5"><li>60 scenes / month</li><li>Up to 5 items per room</li><li>5 saved rooms</li></ul>
            <button onClick={()=>buySub("plus")} className="mt-4 w-full border py-2.5 rounded-full font-semibold hover:bg-amber-50">{t("Subscribe (mock)")}</button>
          </div>
          <div className="bg-[#1c1917] text-white rounded-2xl p-5">
            <div className="font-bold">Pro — {t("Unlimited")}</div><div className="text-2xl font-black mt-1">$19.99<span className="text-sm font-normal text-white/70">/mo</span></div>
            <ul className="text-sm text-white/70 mt-2 list-disc ml-5"><li>{t("Unlimited")} scenes</li><li>Up to 8 items per room</li><li>30 saved rooms</li><li>Meta Muse Image photoreal when key set</li></ul>
            <button onClick={()=>buySub("pro")} className="mt-4 w-full bg-white text-[#1c1917] py-2.5 rounded-full font-semibold">Go Pro (mock)</button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-line rounded-2xl p-5 text-sm shadow-soft">
        <div className="font-semibold">How to add real payments later</div>
        <p className="text-muted mt-1">Swap the mock <code>/api/ai/credits</code> POST with a Stripe Checkout Session (create session → redirect → webhook → increment credits). See README for exact lines to change.</p>
      </div>
    </div>
  );
}
