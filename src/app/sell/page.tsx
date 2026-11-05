"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BuildingAutocomplete from "@/components/BuildingAutocomplete";
import { useI18n } from "@/lib/i18n";

export default function SellPage(){
  const { t } = useI18n();
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [form, setForm] = useState<any>({
    title:"", description:"", category:"furniture", condition:"good", price:"", originalPrice:"", moveOutDate:"", pickupNote:"", isFree:false,
    width:"", height:"", depth:"", unit:"cm", building:"", address:"", delivery:"pickup"
  });
  const [images, setImages] = useState<string[]>([]);
  const [coords, setCoords] = useState<{lat:number,lng:number}|null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [draftApplied, setDraftApplied] = useState(false);
  const [draftPhotoCount, setDraftPhotoCount] = useState(0);

  useEffect(()=> {
    fetch("/api/auth/me").then(r=>r.json()).then(d=> {
      if(!d.user) router.push("/auth");
      else setMe(d.user);
    });
    if(navigator.geolocation) navigator.geolocation.getCurrentPosition(p=> setCoords({lat:p.coords.latitude,lng:p.coords.longitude}));
    // Agent auto-fill: Muse Spark sell draft → pre-filled form (user still reviews + adds photos/size)
    try {
      const raw = sessionStorage.getItem("movealong:sellDraft");
      if (raw) {
        const draft = JSON.parse(raw);
        setForm((f: any) => ({
          ...f,
          title: draft.title || f.title,
          description: draft.description || f.description,
          category: draft.category || f.category,
          condition: draft.condition || f.condition,
          price: draft.price != null ? String(draft.price) : f.price,
          originalPrice: draft.originalPrice != null ? String(draft.originalPrice) : f.originalPrice,
          width: draft.width != null ? String(draft.width) : f.width,
          height: draft.height != null ? String(draft.height) : f.height,
          depth: draft.depth != null ? String(draft.depth) : f.depth,
          unit: draft.unit || f.unit,
        }));
        // Photos the draft was made from travel with it — prefill the picker
        // (still the user's call: keep, remove, or add better angles before publishing).
        if (Array.isArray(draft.images) && draft.images.length) {
          setImages(draft.images.slice(0, 8));
          setDraftPhotoCount(Math.min(draft.images.length, 8));
        }
        sessionStorage.removeItem("movealong:sellDraft");
        setDraftApplied(true);
      }
    } catch {}
  },[router]);

  function onFiles(e: React.ChangeEvent<HTMLInputElement>){
    const files = e.target.files;
    if(!files) return;
    const remaining = 8 - images.length;
    const slice = Array.from(files).slice(0, remaining);
    slice.forEach(file=>{
      const r = new FileReader();
      r.onload = ()=> setImages(prev=> [...prev, r.result as string]);
      r.readAsDataURL(file);
    });
  }

  async function submit(e: React.FormEvent){
    e.preventDefault();
    setError("");
    if(images.length===0) return setError("Add at least 1 photo (multiple angles recommended for AI preview)");
    if(!form.title || !form.description) return setError("Title and description required");
    setSubmitting(true);
    const res = await fetch("/api/listings", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({
      ...form, price: form.isFree?0:Number(form.price)||null, images,
      lat: coords?.lat, lng: coords?.lng,
      width: form.width||null, height: form.height||null, depth: form.depth||null,
    })});
    const d = await res.json();
    setSubmitting(false);
    if(!res.ok) return setError(d.error || "Failed");
    router.push(`/listing/${d.listing.id}`);
  }

  if(!me) return <div className="pt-10 text-center text-muted">Checking auth…</div>;

  return (
    <div className="animate-page-in pt-6 max-w-[760px] mx-auto">
      <h1 className="text-3xl font-black">{t("List an item")}</h1>
      <p className="text-muted mt-2 text-sm">Clear photos from 2–4 angles + size helps buyers and makes AI placement accurate. Pickup only — buyers come to you or you drop it off.</p>

      <form onSubmit={submit} className="mt-6 bg-white border rounded-2xl p-5 sm:p-6 space-y-5">
        {draftApplied && <div className="animate-fade-up bg-amber-50 border border-amber-200 text-amber-900 text-sm p-3 rounded-xl flex justify-between gap-2"><span>Agent draft applied{draftPhotoCount ? ` with ${draftPhotoCount} photo${draftPhotoCount === 1 ? "" : "s"} from your chat` : ""} — review everything, replace photos or add angles and exact size, then publish when you are happy.</span><button type="button" onClick={() => setDraftApplied(false)} className="font-bold shrink-0">✕</button></div>}
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl">{error}</div>}

        <div>
          <label className="text-sm font-semibold">{t("Photos — different angles (1–8) *")}</label>
          <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-3">
            {images.map((src,i)=>(
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden border bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={()=>setImages(images.filter((_,j)=>j!==i))} className="absolute top-1 right-1 bg-black/70 text-white text-xs px-2 py-1 rounded-full">✕</button>
              </div>
            ))}
            {images.length<8 && (
              <label className="aspect-square rounded-xl border-2 border-dashed grid place-items-center text-sm text-muted cursor-pointer hover:bg-amber-50/60">
                <input type="file" accept="image/*" multiple className="hidden" onChange={onFiles} />
                <span>+ Add</span>
              </label>
            )}
          </div>
          <p className="text-xs text-muted mt-2">Tip: front, side, back + detail. Natural light. AI uses these to understand shape and scale.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="text-sm font-semibold">{t("Title")} *</label>
            <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="e.g. IKEA MALM dresser — light oak" className="mt-1 w-full bg-amber-50/60 border rounded-xl px-4 py-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-semibold">{t("Description")} *</label>
            <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Condition, reason for moving, flaws, pickup window…" rows={4} className="mt-1 w-full bg-amber-50/60 border rounded-xl px-4 py-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-primary/20" />
          </div>

          <div>
            <label className="text-sm font-semibold">{t("Category")}</label>
            <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className="mt-1 w-full bg-amber-50/60 border rounded-xl px-3 py-3 text-sm">
              <option value="furniture">{t("Furniture")}</option><option value="appliance">{t("Appliances")}</option><option value="decor">{t("Decor")}</option><option value="kitchen">{t("Kitchen")}</option><option value="electronics">{t("Electronics")}</option><option value="other">{t("Other")}</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold">{t("Condition")}</label>
            <select value={form.condition} onChange={e=>setForm({...form,condition:e.target.value})} className="mt-1 w-full bg-amber-50/60 border rounded-xl px-3 py-3 text-sm">
              <option value="new">{t("New")}</option><option value="like_new">{t("Like New")}</option><option value="good">{t("Good")}</option><option value="fair">{t("Fair")}</option><option value="poor">{t("poor")}</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-semibold">{t("Price (USD)")}</label>
            <input type="number" min={0} step={1} value={form.price} onChange={e=>setForm({...form,price:e.target.value})} disabled={form.isFree} placeholder="0 for free" className="mt-1 w-full bg-amber-50/60 border rounded-xl px-4 py-3 text-sm disabled:opacity-50" />
            <label className="mt-2 flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.isFree} onChange={e=>setForm({...form,isFree:e.target.checked})} /> Give for FREE</label>
            {form.originalPrice && form.price && !form.isFree && Number(form.originalPrice) > Number(form.price) && (
              <span className="text-xs mt-1 text-[#9a3412] font-semibold">-{Math.round((1 - Number(form.price)/Number(form.originalPrice))*100)}% vs new — buyers love seeing this (60% buy second-hand for value)</span>
            )}
          </div>
          <div>
            <label className="text-sm font-semibold">{t("Handover")}</label>
            <select value={form.delivery} onChange={e=>setForm({...form,delivery:e.target.value})} className="mt-1 w-full bg-amber-50/60 border rounded-xl px-3 py-3 text-sm">
              <option value="pickup">{t("Buyer picks up")}</option><option value="self_delivery">{t("I can deliver nearby")}</option><option value="both">{t("Either")}</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold">Original price when new (optional)</label>
            <input type="number" min={0} step={1} value={form.originalPrice} onChange={e=>setForm({...form,originalPrice:e.target.value})} placeholder="e.g. 5900" className="mt-1 w-full bg-amber-50/60 border rounded-xl px-4 py-3 text-sm" />
            <p className="text-[11px] text-muted mt-1">Powers “-% vs new”. Resale typically sells 40–60% below new (IKEA research).</p>
          </div>
          <div>
            <label className="text-sm font-semibold">Must go by (optional)</label>
            <input type="date" value={form.moveOutDate} onChange={e=>setForm({...form,moveOutDate:e.target.value})} className="mt-1 w-full bg-amber-50/60 border rounded-xl px-4 py-3 text-sm" />
            <p className="text-[11px] text-muted mt-1">Movers with a deadline sell faster — we show “Must go in Xd”.</p>
          </div>
        </div>
        <div>
          <label className="text-sm font-semibold">Pickup note (optional)</label>
          <input value={form.pickupNote} onChange={e=>setForm({...form,pickupNote:e.target.value})} placeholder="e.g. Lobby · evenings after 18:00 · bring trolley" className="mt-1 w-full bg-amber-50/60 border rounded-xl px-4 py-3 text-sm" />
        </div>

        <div className="border rounded-xl p-4 bg-amber-50/60">
          <div className="font-semibold text-sm">{t("Size (optional — improves AI preview)")}</div>
          <div className="grid grid-cols-4 gap-3 mt-2">
            <input placeholder="W" value={form.width} onChange={e=>setForm({...form,width:e.target.value})} className="bg-white border rounded-xl px-3 py-2.5 text-sm" />
            <input placeholder="H" value={form.height} onChange={e=>setForm({...form,height:e.target.value})} className="bg-white border rounded-xl px-3 py-2.5 text-sm" />
            <input placeholder="D" value={form.depth} onChange={e=>setForm({...form,depth:e.target.value})} className="bg-white border rounded-xl px-3 py-2.5 text-sm" />
            <select value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})} className="bg-white border rounded-xl px-3 py-2.5 text-sm"><option value="cm">cm</option><option value="inch">inch</option></select>
          </div>
          <p className="text-xs text-muted mt-2">Width × Height × Depth. Leave blank if you don’t know — AI will guess scale.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="text-sm font-semibold">{t("Building / condo")}</label>
            <div className="mt-1">
              <BuildingAutocomplete
                value={form.building}
                near={coords}
                onChange={(v) => setForm({ ...form, building: v })}
                onSelect={(p) => { setForm((f: any) => ({ ...f, building: p.name, address: p.displayName })); setCoords({ lat: p.lat, lng: p.lng }); }}
              />
            </div>
            <p className="text-[11px] text-muted mt-1">Powered by OpenStreetMap — pick a result to pin it exactly on the map. Or just type your condo name.</p>
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-semibold">{t("Address / area")}</label>
            <input value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="Sukhumvit 24, Bangkok" className="mt-1 w-full bg-amber-50/60 border rounded-xl px-4 py-3 text-sm" />
          </div>
          <div className="sm:col-span-2 text-xs text-muted">Pin: {coords? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)} (from ${form.building ? "place search" : "browser"})` : "not yet set — pick a building above or allow location"} · No exact unit number is shown publicly.</div>
        </div>

        <button disabled={submitting} className="w-full bg-[#1c1917] text-white rounded-full py-3 font-bold hover:bg-black disabled:opacity-50">{submitting?"Publishing…":"Publish listing"}</button>
        <p className="text-xs text-center text-muted">By publishing you agree items are pickup/self-delivery only. No shipping.</p>
      </form>
    </div>
  );
}
