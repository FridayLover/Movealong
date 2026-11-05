"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";

type Msg = {
  role: "user" | "assistant";
  body: string;
  images?: string[];
  recommendedListings?: any[];
  draftListing?: any;
  draftImages?: string[];
  draftReply?: string | null;
  provider?: string;
};

type AgentMode = "recommend" | "sell" | "reply";
const MODE_FALLBACK: Record<AgentMode, string> = {
  recommend: "What should I add in my room? Recommend within my preferences.",
  sell: "I want to sell this product — fill my listing for me from the photo.",
  reply: "Write a reply to the buyer for me — friendly, propose lobby pickup.",
};

type ImageIntent = "sell" | "similar" | "ask";
const INTENT_LABEL: Record<ImageIntent, string> = { similar: "Find similar", sell: "Sell this", ask: "Ask about it" };
const INTENT_FALLBACK: Record<ImageIntent, string> = {
  similar: "Find items like this photo for me — closest matches within my preferences.",
  sell: "I want to sell this product — fill my listing for me from the photo.",
  ask: "What can you tell me about the item in this photo — what it is, condition clues, and a fair price?",
};

/** Downscale an attached photo before sending so chat stays fast (max ~1080px, JPEG). */
function readAsDataUrl(file: File, maxDim = 1080): Promise<string> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      if (scale >= 1) { const r = new FileReader(); r.onload = () => resolve(r.result as string); r.readAsDataURL(file); return; }
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); const r = new FileReader(); r.onload = () => resolve(r.result as string); r.readAsDataURL(file); };
    img.src = url;
  });
}

const CATS = ["furniture", "appliance", "decor", "kitchen", "electronics", "other"];
const STYLES = ["", "cozy warm", "minimal", "scandi", "warm modern", "industrial"];

const GREETING: Msg = { role: "assistant", body: "Hi, I'm Baan, your MoveAlong concierge (Muse Spark). Pick a saved room, set your distance/budget, then ask me what to add. You can also tap Attach in the composer to send me a photo: choose “Find similar” if you want an item like it, “Sell this” and I'll fill your listing from the photo, or “Ask about it” for an honest read. Close me anytime with ✕." };

export default function AgentChat({ compact = false, onClose }: { compact?: boolean; onClose?: () => void }) {
  const { t: tr } = useI18n();
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusIdx, setStatusIdx] = useState(0);
  const [rooms, setRooms] = useState<any[]>([]);
  const [roomId, setRoomId] = useState("");
  const [roomImage, setRoomImage] = useState<string | null>(null);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [imageIntent, setImageIntent] = useState<ImageIntent>("similar");
  const [mode, setMode] = useState<AgentMode>("recommend");
  const [sellCondition, setSellCondition] = useState("good");
  const [replyTone, setReplyTone] = useState("Friendly");
  const fileRef = useRef<HTMLInputElement>(null);
  const [prefs, setPrefs] = useState({ maxDistanceKm: 10, budgetMax: "" as string, categories: [] as string[], style: "", freeOnly: false });
  const [provider, setProvider] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true); // only auto-scroll when the reader is already near the bottom
  const [showJump, setShowJump] = useState(false);

  function onScrollMessages() {
    const el = scrollRef.current; if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
    stickRef.current = nearBottom;
    setShowJump(!nearBottom);
  }
  function jumpToLatest() {
    const el = scrollRef.current; if (!el) return;
    stickRef.current = true; setShowJump(false);
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }
  const statuses = mode === "sell"
    ? [...(attachedImages.length ? ["Looking at your photo…"] : []), "Checking similar prices near you…", "Writing your listing draft…"]
    : mode === "reply"
      ? ["Reading the conversation…", `Drafting a ${replyTone.toLowerCase()} reply…`]
      : [...(attachedImages.length ? ["Looking at your photo…"] : []), "Looking at your room…", `Checking within ${prefs.maxDistanceKm}km…`, "Ranking by distance & value…", "Writing your answer…"];

  const instanceId = useRef(`agent-${Math.random().toString(36).slice(2)}`);
  const sendingRef = useRef(false);

  // One shared history for the small widget AND the Agent page: both render
  // from the same server rows, restored item cards included.
  const applyHistory = useCallback((histRes: any) => {
    if (histRes.messages?.length) {
      setMessages(histRes.messages.map((m: any) => ({
        role: m.role, body: m.body,
        recommendedListings: m.meta?.recommendedListings?.length ? m.meta.recommendedListings : undefined,
        draftListing: m.meta?.draftListing, draftReply: m.meta?.draftReply, provider: m.meta?.provider,
      })));
    } else {
      setMessages([GREETING]);
    }
  }, []);
  const reloadHistory = useCallback(async () => {
    if (sendingRef.current) return; // never yank messages out from under an in-flight send
    const histRes = await fetch("/api/agent/chat").then((r) => r.json()).catch(() => ({}));
    applyHistory(histRes);
  }, [applyHistory]);
  function broadcastHistory() {
    window.dispatchEvent(new CustomEvent("movealong:agent-history", { detail: { source: instanceId.current } }));
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/rooms").then((r) => r.json()).catch(() => ({})),
      fetch("/api/auth/me").then((r) => r.json()).catch(() => ({})),
      fetch("/api/agent/chat").then((r) => r.json()).catch(() => ({})),
    ]).then(([roomRes, meRes, histRes]) => {
      if (roomRes.rooms) setRooms(roomRes.rooms);
      const u = meRes.user;
      if (u) setPrefs((p) => ({ ...p, maxDistanceKm: u.prefDistanceKm ?? 10, budgetMax: u.prefBudgetMax != null ? String(u.prefBudgetMax) : "", categories: u.prefCategories || [], style: u.prefStyle || "" }));
      applyHistory(histRes);
    });
    // When the other surface (widget <-> Agent page) sends or clears, refresh to match
    const onSync = (e: Event) => {
      if ((e as CustomEvent).detail?.source === instanceId.current) return;
      void reloadHistory();
    };
    window.addEventListener("movealong:agent-history", onSync);
    // Context handoff: a page (e.g. a listing's "Ask Baan") may prefill a question
    const applyPrefill = (text: string) => { if (text) { setInput(text); setMode("recommend"); } };
    try {
      const saved = sessionStorage.getItem("movealong:agentPrefill");
      if (saved) { applyPrefill(saved); sessionStorage.removeItem("movealong:agentPrefill"); }
    } catch {}
    const onPrefill = (e: Event) => {
      const text = (e as CustomEvent).detail?.text || "";
      applyPrefill(text);
      try { sessionStorage.removeItem("movealong:agentPrefill"); } catch {}
    };
    window.addEventListener("movealong:agent-prefill", onPrefill);
    return () => {
      window.removeEventListener("movealong:agent-history", onSync);
      window.removeEventListener("movealong:agent-prefill", onPrefill);
    };
  }, [applyHistory, reloadHistory]);

  useEffect(() => {
    // Follow new messages only when the reader is already near the bottom —
    // never yank someone away from older history they're reading.
    if (stickRef.current) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    else if (messages.length > 3) setShowJump(true);
  }, [messages, loading]);
  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setStatusIdx((i) => (i + 1) % statuses.length), 900);
    return () => clearInterval(t);
  }, [loading, statuses.length]);

  function onRoomFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => { setRoomImage(r.result as string); setRoomId(""); }; r.readAsDataURL(f);
  }
  async function onAttachFiles(files: FileList | null, intent?: ImageIntent) {
    if (!files) return;
    if (intent) setImageIntent(intent);
    const picked = Array.from(files).slice(0, 4 - attachedImages.length);
    const urls = await Promise.all(picked.map((f) => readAsDataUrl(f)));
    setAttachedImages((p) => [...p, ...urls].slice(0, 4));
  }
  function onProductFiles(e: React.ChangeEvent<HTMLInputElement>) {
    void onAttachFiles(e.target.files, "sell");
    e.target.value = "";
  }
  function pickRoom(id: string) {
    setRoomId(id);
    const r = rooms.find((x) => x.id === id);
    if (r) setRoomImage(r.image);
  }
  function toggleCat(c: string) {
    setPrefs((p) => ({ ...p, categories: p.categories.includes(c) ? p.categories.filter((x) => x !== c) : [...p.categories, c] }));
  }

  // Typed words beat the intent chip: "sell this" must never be read as find-similar
  function inferIntent(text: string, fallback: ImageIntent): ImageIntent {
    const t = text.toLowerCase();
    if (/\b(sell|selling|list it|list my)\b|ขาย|ลงขาย/.test(t)) return "sell";
    if (/similar|like this|like my|look like|find like|แบบนี้|คล้าย/.test(t)) return "similar";
    if (/what is|tell me about|worth|what's this|อันนี้คือ|ราคาเท่าไหร่/.test(t)) return "ask";
    return fallback;
  }

  async function send(text?: string, intentOverride?: ImageIntent) {
    const typed = (text ?? input).trim();
    // Mode drives the request: Sell mode always drafts a listing, Reply mode
    // always asks for a chat draft (with the chosen tone), Recommend uses filters.
    const intent = intentOverride ?? (mode === "sell" ? "sell" : inferIntent(typed, imageIntent));
    const hasAttach = attachedImages.length > 0;
    // Photo-first send: with an attachment the user may type nothing — the chosen intent speaks for them.
    let body = typed || (hasAttach ? INTENT_FALLBACK[intent] : MODE_FALLBACK[mode]);
    if (mode === "sell" && typed) body = `${body} (condition: ${sellCondition})`;
    if (mode === "reply" && typed && !/^write a reply/i.test(body)) body = `Write a reply to the buyer for me — tone: ${replyTone}. Buyer context: ${body}`;
    if (!body || loading) return;
    const images = hasAttach ? [...attachedImages] : undefined;
    const userMsg: Msg = { role: "user", body, images };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    sendingRef.current = true;
    setLoading(true); setStatusIdx(0);
    try {
      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.body }));
      const r = await fetch("/api/agent/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history, roomImage, roomId: roomId || undefined,
          productImages: images || [], imageIntent: images || mode === "sell" ? intent : null,
          preferences: { maxDistanceKm: prefs.maxDistanceKm, budgetMax: prefs.budgetMax === "" ? null : Number(prefs.budgetMax), categories: prefs.categories, style: prefs.style || null, freeOnly: prefs.freeOnly },
        }),
      });
      if (r.status === 401) { location.href = "/auth"; return; }
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Agent could not answer");
      setProvider(d.provider || "");
      setMessages((m) => [...m, { role: "assistant", body: d.reply, recommendedListings: d.recommendedListings, draftListing: d.draftListing, draftImages: d.draftListing ? images : undefined, draftReply: d.draftReply, provider: d.provider }]);
      setAttachedImages([]);
      broadcastHistory(); // keep the widget and the Agent page showing the same conversation
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", body: `Sorry — ${e.message || "something went wrong"}. Try again, or widen distance/budget above.` }]);
    }
    sendingRef.current = false;
    setLoading(false);
  }

  function applyDraft(draft: any, images?: string[]) {
    // Carry the photos the draft was made from — the Sell form prefills them too
    // (the user can replace any photo there; nothing publishes automatically).
    const payload = { ...draft, images: (images || []).slice(0, 8) };
    try { sessionStorage.setItem("movealong:sellDraft", JSON.stringify(payload)); }
    catch { try { sessionStorage.setItem("movealong:sellDraft", JSON.stringify(draft)); } catch {} }
    router.push("/sell?draft=1");
    onClose?.();
  }

  async function clearHistory() {
    await fetch("/api/agent/chat", { method: "DELETE" }).catch(() => {});
    setMessages([GREETING]);
    broadcastHistory();
  }

  return (
    <div className="flex flex-col min-h-0 h-full">
      {/* Mode tabs — each mode tailors the panel below it */}
      <div className="shrink-0 bg-white border-b border-line px-3 pt-2.5 pb-2">
        <div className="flex gap-1.5" role="tablist" aria-label="Agent mode">
          {([
            { id: "recommend", label: "Recommend", sub: "for my room", icon: <path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" /> },
            { id: "sell", label: "Sell", sub: "fill my listing", icon: <path d="M20.59 13.41 12 3H4v8l8.59 8.59a2 2 0 0 0 2.82 0l5.18-5.18a2 2 0 0 0 0-2.82zM6.5 8A1.5 1.5 0 1 1 8 6.5 1.5 1.5 0 0 1 6.5 8z" /> },
            { id: "reply", label: "Reply", sub: "draft a chat", icon: <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" /> },
          ] as { id: AgentMode; label: string; sub: string; icon: React.ReactNode }[]).map((t) => (
            <button
              key={t.id} role="tab" aria-selected={mode === t.id}
              onClick={() => setMode(t.id)}
              className={`press flex-1 rounded-xl border px-2 py-2 text-left flex items-center gap-2 ${mode === t.id ? "bg-[#9a3412] border-[#9a3412] text-white shadow-soft" : "bg-amber-50/60 border-line hover:bg-amber-50"}`}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill={mode === t.id ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" className="shrink-0">{t.icon}</svg>
              <span className="min-w-0 leading-tight">
                <span className="block text-[12px] font-black">{tr(t.label)}</span>
                <span className={`block text-[10px] truncate ${mode === t.id ? "text-white/75" : "text-muted"}`}>{tr(t.sub)}</span>
              </span>
            </button>
          ))}
          <button onClick={clearHistory} className="press shrink-0 self-start text-[11px] text-muted underline px-1 py-1">{tr("Clear")}</button>
        </div>
      </div>

      {/* RECOMMEND mode — filters appear (room, distance, budget, category, style) */}
      {mode === "recommend" && (
      <div className="animate-fade-up shrink-0 overflow-y-auto max-h-[38%] border-b border-line bg-amber-50/50 px-4 py-3 space-y-3">
        <div className="flex gap-2">
          <select value={roomId} onChange={(e) => pickRoom(e.target.value)} className="flex-1 min-w-0 bg-white border border-line rounded-full px-3 py-2 text-xs font-semibold">
            <option value="">Saved room: none — upload below</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <label className="shrink-0 bg-white border border-line rounded-full px-3 py-2 text-xs font-bold cursor-pointer hover:bg-amber-50">
            <input type="file" accept="image/*" className="hidden" onChange={onRoomFile} /> Upload room
          </label>
          {roomImage && <img src={roomImage} alt="room" className="w-9 h-9 rounded-lg object-cover border shrink-0" />}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <label className="flex items-center gap-2"><span className="text-muted whitespace-nowrap">Distance {prefs.maxDistanceKm}km</span><input type="range" min={1} max={50} value={prefs.maxDistanceKm} onChange={(e) => setPrefs({ ...prefs, maxDistanceKm: Number(e.target.value) })} className="flex-1 accent-[#9a3412]" /></label>
          <label className="flex items-center gap-2"><span className="text-muted whitespace-nowrap">Budget $</span><input value={prefs.budgetMax} onChange={(e) => setPrefs({ ...prefs, budgetMax: e.target.value })} placeholder="Any" inputMode="numeric" className="w-full bg-white border border-line rounded-full px-3 py-1.5" /></label>
        </div>
        <div className="flex gap-1.5 flex-wrap items-center">
          {CATS.map((c) => (
            <button key={c} onClick={() => toggleCat(c)} className={`px-2.5 py-1 rounded-full border text-[11px] font-bold ${prefs.categories.includes(c) ? "bg-[#1c1917] text-white" : "bg-white"}`}>{c}</button>
          ))}
          <select value={prefs.style} onChange={(e) => setPrefs({ ...prefs, style: e.target.value })} className="bg-white border border-line rounded-full px-2 py-1 text-[11px] font-semibold">
            {STYLES.map((s) => <option key={s} value={s}>{s || "Any style"}</option>)}
          </select>
          <label className="flex items-center gap-1 text-[11px] font-bold bg-white border border-line rounded-full px-2.5 py-1"><input type="checkbox" checked={prefs.freeOnly} onChange={(e) => setPrefs({ ...prefs, freeOnly: e.target.checked })} /> FREE</label>
          <label className="ml-auto flex items-center gap-1 text-[11px] font-bold bg-white border border-dashed border-line rounded-full px-2.5 py-1 cursor-pointer">
            <input type="file" accept="image/*" multiple className="hidden" onChange={onProductFiles} /> + Attach to sell{attachedImages.length ? ` (${attachedImages.length})` : ""}
          </label>
        </div>
        <button onClick={() => send()} disabled={loading} className="press w-full bg-[#9a3412] text-white px-3 py-2 rounded-full text-[12px] font-bold disabled:opacity-50">{tr("Recommend for my room")}</button>
      </div>
      )}

      {/* SELL mode — tailored for selling: photos + condition in, draft out */}
      {mode === "sell" && (
        <div className="animate-fade-up shrink-0 border-b border-line bg-amber-50/50 px-4 py-3 space-y-2.5">
          <div className="text-[12px] leading-relaxed"><b>Sell mode.</b> Attach clear photos of your item, pick its condition, add a line about it below — I will draft the whole listing. <span className="text-muted">Nothing publishes until you review it on Sell.</span></div>
          <div className="flex gap-1.5 flex-wrap items-center">
            <span className="text-[11px] font-black text-muted">CONDITION:</span>
            {["new", "like_new", "good", "fair", "poor"].map((c) => (
              <button key={c} onClick={() => setSellCondition(c)} aria-pressed={sellCondition === c} className={`press px-2.5 py-1 rounded-full border text-[11px] font-bold ${sellCondition === c ? "bg-[#1c1917] text-white" : "bg-white hover:bg-amber-50"}`}>{c.replace("_", " ")}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <label className="press flex-1 text-center bg-white border border-dashed border-line rounded-full px-3 py-2 text-[12px] font-bold cursor-pointer hover:bg-amber-50">
              <input type="file" accept="image/*" multiple className="hidden" onChange={onProductFiles} />
              Attach product photos{attachedImages.length ? ` (${attachedImages.length}/4)` : ""}
            </label>
            <button onClick={() => send()} disabled={loading} className="press flex-1 bg-[#9a3412] text-white px-3 py-2 rounded-full text-[12px] font-bold disabled:opacity-50">Draft my listing</button>
          </div>
          <div className="text-[11px] text-muted">Tip: 2–4 angles + a size note in your message makes the draft (and AI preview) much better.</div>
        </div>
      )}

      {/* REPLY mode — tailored for chat replies: tone + situation in, polished draft out */}
      {mode === "reply" && (
        <div className="animate-fade-up shrink-0 border-b border-line bg-amber-50/50 px-4 py-3 space-y-2.5">
          <div className="text-[12px] leading-relaxed"><b>Reply mode.</b> Tell me what the buyer said (or paste it), choose a tone — I will write a reply you can copy into Messages.</div>
          <div className="flex gap-1.5 flex-wrap items-center">
            <span className="text-[11px] font-black text-muted">TONE:</span>
            {["Friendly", "Short & direct", "Polite Thai"].map((t) => (
              <button key={t} onClick={() => setReplyTone(t)} aria-pressed={replyTone === t} className={`press px-2.5 py-1 rounded-full border text-[11px] font-bold ${replyTone === t ? "bg-[#1c1917] text-white" : "bg-white hover:bg-amber-50"}`}>{t}</button>
            ))}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[
              ["Still available?", "Buyer asks: is this still available?"],
              ["Pickup today?", "Buyer asks: can I pick up today at the lobby around 18:00?"],
              ["Price firm?", "Buyer asks: is the price negotiable?"],
              ["Size exact?", "Buyer asks: is the size exact / will it fit a door 80cm?"],
            ].map(([label, text]) => (
              <button key={label} onClick={() => setInput(text)} className="press bg-white border px-2.5 py-1 rounded-full text-[11px] font-bold hover:bg-amber-50">{label}</button>
            ))}
            <button onClick={() => send()} disabled={loading} className="press ml-auto bg-[#9a3412] text-white px-3 py-1.5 rounded-full text-[11px] font-bold disabled:opacity-50">Draft my reply</button>
          </div>
        </div>
      )}

      {/* Messages — flexes and scrolls; min-h-0 lets it shrink so the composer below always stays visible */}
      <div ref={scrollRef} onScroll={onScrollMessages} className="relative flex-1 min-h-0 overflow-auto px-4 py-4 space-y-3 bg-[#fffbf5]">
        {messages.map((m, i) => (
          <div key={i} style={{ ["--i" as any]: Math.min(i, 6) }} className={`animate-fade-up flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[88%] ${m.role === "user" ? "" : "w-full max-w-[92%]"}`}>
              <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${m.role === "user" ? "bg-[#1c1917] text-white rounded-br-md" : "bg-white border border-line rounded-bl-md shadow-soft"}`}>
                {m.images && m.images.length > 0 && (
                  <span className="flex gap-1.5 mb-2">
                    {m.images.map((s, j) => <img key={j} src={s} alt={`You attached ${j + 1}`} className="w-16 h-16 rounded-lg object-cover border border-white/30" />)}
                  </span>
                )}
                {m.body}
              </div>
              {m.role === "assistant" && m.provider && <div className="text-[10px] text-muted mt-1">via {m.provider === "muse-spark" ? "Muse Spark" : "MoveAlong agent (offline)"}</div>}

              {m.recommendedListings && m.recommendedListings.length > 0 && (
                <div className="grid sm:grid-cols-2 gap-2 mt-2">
                  {m.recommendedListings.map((l: any, j: number) => (
                    <div key={l.id} style={{ ["--i" as any]: j }} className="animate-fade-up bg-white border border-line rounded-xl overflow-hidden flex">
                      <img src={l.images[0]} alt="" className="w-20 h-20 object-cover shrink-0" />
                      <div className="p-2 min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">{l.title}</div>
                        <div className="text-[11px] text-muted">{l.isFree ? "FREE" : `$${l.price}`} · {l.distanceKm?.toFixed(1)}km · {l.building || ""}</div>
                        <div className="flex gap-1 mt-1.5">
                          <Link href={`/ai-lab?listing=${l.id}`} onClick={onClose} className="press text-[10px] font-bold bg-[#9a3412] text-white px-2 py-1 rounded-full">Preview</Link>
                          <Link href={`/listing/${l.id}`} onClick={onClose} className="press text-[10px] font-bold border px-2 py-1 rounded-full">View</Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {m.draftListing && (
                <div className="animate-fade-up mt-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
                  <div className="font-bold text-xs">Sell draft — ready to auto-fill</div>
                  <div className="font-bold mt-1">{m.draftListing.title}</div>
                  <div className="text-xs text-muted line-clamp-3">{m.draftListing.description}</div>
                  <div className="text-xs mt-1">{m.draftListing.category} · {m.draftListing.condition} · ${m.draftListing.price}{m.draftListing.originalPrice ? ` (was $${m.draftListing.originalPrice})` : ""}</div>
                  {m.draftImages && m.draftImages.length > 0 && (
                    <div className="flex gap-1.5 mt-2">
                      {m.draftImages.map((s, j) => <img key={j} src={s} alt={`Draft photo ${j + 1}`} className="w-12 h-12 rounded-lg object-cover border" />)}
                      <span className="text-[11px] text-muted self-center">These photos go with the draft.</span>
                    </div>
                  )}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <button onClick={() => applyDraft(m.draftListing, m.draftImages)} className="press bg-[#9a3412] text-white px-3 py-1.5 rounded-full text-xs font-bold">{tr("Use this draft — fill Sell for me")}</button>
                    <span className="text-[11px] text-muted self-center">Nothing is published until you click “Publish listing” yourself.</span>
                    <button onClick={() => navigator.clipboard.writeText(`${m.draftListing.title}\n${m.draftListing.description}`)} className="press border bg-white px-3 py-1.5 rounded-full text-xs font-bold">Copy</button>
                  </div>
                </div>
              )}

              {m.draftReply && (
                <div className="animate-fade-up mt-2 bg-white border border-line rounded-xl p-3 text-sm">
                  <div className="font-bold text-xs">Chat draft</div>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{m.draftReply}</p>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => navigator.clipboard.writeText(m.draftReply!)} className="press bg-[#1c1917] text-white px-3 py-1.5 rounded-full text-xs font-bold">Copy draft</button>
                    <Link href="/chat" onClick={onClose} className="press border px-3 py-1.5 rounded-full text-xs font-bold">Open Messages</Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="animate-fade-up flex justify-start" aria-live="polite">
            <div className="bg-white border border-line rounded-2xl rounded-bl-md px-4 py-3 shadow-soft">
              <div className="flex items-center gap-2 text-sm text-muted"><span className="flex gap-1"><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></span>{statuses[statusIdx]}</div>
              <div className="shimmer-line h-2 rounded-full mt-3 w-44" />
              <div className="shimmer-line h-2 rounded-full mt-1.5 w-32" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {showJump && (
        <div className="shrink-0 flex justify-center bg-[#fffbf5] pb-1">
          <button type="button" onClick={jumpToLatest} className="animate-pop press bg-[#1c1917] text-white text-xs font-bold px-3.5 py-2 rounded-full shadow-card">New messages ↓ Jump to latest</button>
        </div>
      )}

      {/* Attached-photo tray — sits directly above the composer so previews and
          intent chips are always next to the text field, never pushing it away */}
      {attachedImages.length > 0 && (
        <div className="animate-fade-up shrink-0 border-t border-line bg-white px-3 pt-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-black text-muted">PHOTO:</span>
            {mode === "sell" ? (
              <span className="text-[11px] text-muted">Selling these — they travel with your draft into the Sell form.</span>
            ) : (
              <>
                {(["similar", "sell", "ask"] as ImageIntent[]).map((it) => (
                  <button type="button" key={it} onClick={() => setImageIntent(it)} aria-pressed={imageIntent === it} className={`press px-2.5 py-1 rounded-full text-[11px] font-bold border ${imageIntent === it ? "bg-[#9a3412] text-white border-[#9a3412]" : "bg-white hover:bg-amber-50"}`}>{INTENT_LABEL[it]}</button>
                ))}
                <span className="text-[11px] text-muted">{imageIntent === "similar" ? "I'll find items like this near you." : imageIntent === "sell" ? "I'll draft your listing from this photo — you review & publish." : "I'll tell you what it is and what it's worth."}</span>
              </>
            )}
          </div>
          <div className="flex gap-2 mt-2 pb-1">
            {attachedImages.map((s, i) => (
              <span key={i} className="animate-pop relative">
                <img src={s} alt={`Attached ${i + 1}`} className="w-14 h-14 rounded-lg object-cover border" />
                <button type="button" aria-label={`Remove attached photo ${i + 1}`} onClick={() => setAttachedImages(attachedImages.filter((_, j) => j !== i))} className="press absolute -top-1.5 -right-1.5 bg-black/70 text-white text-[10px] w-4 h-4 rounded-full grid place-items-center">✕</button>
              </span>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="shrink-0 p-3 border-t border-line bg-white flex gap-2 items-center">
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void onAttachFiles(e.target.files); e.target.value = ""; }} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={loading || attachedImages.length >= 4}
          aria-label="Attach a photo — sell it, find items like it, or ask about it"
          title="Attach photo: sell it · find similar · ask about it"
          className="press shrink-0 h-[42px] px-3 rounded-full border border-line bg-amber-50/70 hover:bg-amber-50 flex items-center gap-1.5 text-xs font-bold disabled:opacity-50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
          Attach{attachedImages.length ? ` (${attachedImages.length})` : ""}
        </button>
        <input value={input} onChange={(e) => setInput(e.target.value)} aria-label="Message Baan" placeholder={mode === "sell" ? "Describe your item — “pine dresser, 120cm, light scratches”…" : mode === "reply" ? "What did the buyer say? Paste it here…" : attachedImages.length ? "Add a note, or just press Send…" : "Ask anything — or Attach a photo to sell / find similar…"} className="flex-1 min-w-0 bg-amber-50/60 border border-line rounded-full px-4 py-2.5 text-sm outline-none focus:bg-white" />
        <button disabled={loading || (!input.trim() && !attachedImages.length)} className="press shrink-0 bg-[#9a3412] text-white px-5 py-2.5 rounded-full text-sm font-bold disabled:opacity-50">Send</button>
      </form>
      {!compact && <div className="px-4 pb-3 text-[11px] text-muted bg-white">Powered by Muse Spark (Meta Model API) when a key is set, with a built-in offline agent otherwise. Recommendations only use live listings within your distance/budget above — the agent never invents a product.{provider ? ` Last answer via ${provider}.` : ""}</div>}
    </div>
  );
}
