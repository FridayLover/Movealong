"use client";
import { useI18n } from "@/lib/i18n";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthPage(){
  const { t } = useI18n();
  const [mode, setMode]=useState<"login"|"register">("login");
  const [form, setForm]=useState({email:"",password:"",name:"",building:""});
  const [error, setError]=useState(""); const [loading,setLoading]=useState(false);
  const router=useRouter();

  async function submit(e:React.FormEvent){
    e.preventDefault(); setError(""); setLoading(true);
    const url = mode==="login" ? "/api/auth/login" : "/api/auth/register";
    const r = await fetch(url,{method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(form)});
    const d=await r.json(); setLoading(false);
    if(!r.ok) return setError(d.error || "Failed");
    router.push("/"); router.refresh();
  }

  return (
    <div className="animate-page-in pt-10 max-w-[480px] mx-auto">
      <h1 className="text-3xl font-black text-ink">{t("Welcome to MoveAlong")}</h1>
      <p className="text-sm text-muted mt-2">One account to list, discover nearby, and try items in your room. Demo user is pre-seeded with rooms, favorites, cart and generations.</p>

      <div className="mt-6 flex gap-2 bg-white border border-line rounded-full p-1 w-fit shadow-soft">
        <button onClick={()=>setMode("login")} className={`px-6 py-2 rounded-full text-sm font-semibold ${mode==="login"?"bg-[#1c1917] text-white":""}`}>{t("Sign in")}</button>
        <button onClick={()=>setMode("register")} className={`px-6 py-2 rounded-full text-sm font-semibold ${mode==="register"?"bg-[#1c1917] text-white":""}`}>{t("Create account")}</button>
      </div>

      <form onSubmit={submit} className="mt-4 bg-white border border-line rounded-2xl p-6 space-y-4 shadow-soft">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl">{error}</div>}
        {mode==="register" && (
          <>
            <div><label className="text-sm font-semibold">{t("Name")}</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="mt-1 w-full bg-amber-50/60 border border-line rounded-xl px-4 py-3 text-sm" placeholder="Alex" required={mode==="register"} /></div>
            <div><label className="text-sm font-semibold">{t("Building (optional)")}</label><input value={form.building} onChange={e=>setForm({...form,building:e.target.value})} className="mt-1 w-full bg-amber-50/60 border border-line rounded-xl px-4 py-3 text-sm" placeholder="Ideo Sukhumvit 93" /></div>
          </>
        )}
        <div><label className="text-sm font-semibold">{t("Email")}</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="mt-1 w-full bg-amber-50/60 border border-line rounded-xl px-4 py-3 text-sm" placeholder="you@example.com" required /></div>
        <div><label className="text-sm font-semibold">{t("Password")}</label><input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} className="mt-1 w-full bg-amber-50/60 border border-line rounded-xl px-4 py-3 text-sm" placeholder="••••••••" required /></div>
        <button disabled={loading} className="w-full bg-[#9a3412] text-white py-3 rounded-full font-bold disabled:opacity-50 hover:bg-[#7c2d12]">{loading?"Please wait…": mode==="login"?"Sign in":"Create account"}</button>
        <div className="text-xs text-muted text-center">Demo: <code>demo@movealong.test / 123456</code> — has 1 saved room, 2 favorites, 1 cart item, 2 generations.</div>
      </form>
    </div>
  );
}
