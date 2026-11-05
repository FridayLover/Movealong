"use client";
import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function Inner() {
  const sp = useSearchParams();
  const [convs, setConvs] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string>(sp.get("c") || "");
  const [thread, setThread] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadInbox = useCallback(async () => {
    const r = await fetch("/api/conversations");
    if (r.status === 401) { location.href = "/auth"; return; }
    const d = await r.json();
    setConvs(d.conversations || []);
    if (!activeId && d.conversations?.[0]) setActiveId(d.conversations[0].id);
  }, [activeId]);

  async function loadThread(id: string) {
    if (!id) { setThread(null); setMessages([]); return; }
    const r = await fetch(`/api/conversations/${id}`);
    if (!r.ok) { setError("Could not open this conversation."); return; }
    const d = await r.json();
    setThread(d.conversation);
    setMessages(d.messages || []);
    // Opening marks messages read server-side — refresh badges + header count
    setConvs((cs) => cs.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)));
    window.dispatchEvent(new Event("movealong:refresh"));
  }

  useEffect(() => { loadInbox(); }, [loadInbox]);
  useEffect(() => { if (sp.get("c")) setActiveId(sp.get("c")!); }, [sp]);
  useEffect(() => { loadThread(activeId); }, [activeId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !activeId) return;
    setSending(true); setError("");
    const r = await fetch(`/api/conversations/${activeId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: draft }) });
    const d = await r.json();
    setSending(false);
    if (!r.ok) { setError(d.error || "Could not send."); return; }
    setDraft("");
    loadThread(activeId);
    loadInbox();
  }

  const activeConv = convs.find((c) => c.id === activeId);

  return (
    <div className="animate-page-in pt-6">
      <h1 className="text-2xl font-black text-ink">Messages</h1>
      <p className="text-sm text-muted mt-1">Chat with sellers/buyers to arrange pickup. Meet in the lobby or a public area — second-hand sales are as-is, so check the item in person.</p>

      <div className="grid md:grid-cols-[320px_1fr] gap-4 mt-5">
        <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-soft">
          <div className="px-4 py-3 border-b border-line font-semibold text-sm">Inbox ({convs.length})</div>
          {convs.length === 0 ? (
            <div className="p-6 text-sm text-muted text-center">No conversations yet.<br />Open any listing and tap <b>Chat with seller</b>.</div>
          ) : (
            <div className="divide-y divide-line/60 max-h-[560px] overflow-auto">
              {convs.map((c) => (
                <button key={c.id} onClick={() => setActiveId(c.id)} className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-amber-50 ${activeId === c.id ? "bg-amber-50" : ""}`}>
                  {c.listing?.images?.[0] ? <img src={c.listing.images[0]} alt="" className="w-11 h-11 rounded-lg object-cover border shrink-0" /> : <span className="w-11 h-11 rounded-lg bg-[#1c1917] text-amber-100 grid place-items-center font-bold shrink-0">{c.other.name.slice(0, 1).toUpperCase()}</span>}
                  <span className="min-w-0 flex-1">
                    <span className="flex justify-between gap-2"><span className="font-semibold text-sm truncate">{c.other.name}</span><span className="text-[10px] text-muted shrink-0">{new Date(c.lastMessageAt).toLocaleDateString()}</span></span>
                    <span className="block text-xs text-muted truncate">{c.listing?.title || "Direct message"}</span>
                    <span className={`block text-xs truncate ${c.unreadCount ? "font-bold text-ink" : ""}`}>{c.lastMessage || "Say hello…"}</span>
                  </span>
                  {!!c.unreadCount && <span className="animate-pop shrink-0 self-center bg-[#9a3412] text-white text-[10px] font-black min-w-5 h-5 px-1 grid place-items-center rounded-full" aria-label={`${c.unreadCount} unread`}>{c.unreadCount}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-line rounded-2xl shadow-soft flex flex-col min-h-[560px]">
          {!activeId || !thread ? (
            <div className="flex-1 grid place-items-center p-8 text-center text-sm text-muted">Pick a conversation on the left, or start one from a listing.</div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-line flex items-center gap-3">
                {thread.listing?.images?.[0] && <img src={thread.listing.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover border" />}
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{thread.buyer.id === thread.seller.id ? "" : ""}{activeConv?.other?.name} {thread.listing && <span className="text-muted font-normal">· {thread.listing.title}</span>}</div>
                  <div className="text-xs text-muted">{thread.listing ? `${thread.listing.isFree ? "FREE" : "$" + thread.listing.price} · ` : ""}Arrange pickup here</div>
                </div>
                {thread.listing && <Link href={`/listing/${thread.listing.id}`} className="ml-auto text-xs font-semibold border px-3 py-1.5 rounded-full shrink-0 hover:bg-amber-50">View listing</Link>}
              </div>

              <div className="flex-1 overflow-auto p-4 space-y-2 bg-[#fffbf5]">
                {messages.length === 0 && <div className="text-center text-xs text-muted py-6">No messages yet — say hello and propose a pickup time.</div>}
                {messages.map((m) => (
                  <div key={m.id} className={`animate-msg-in flex ${m.mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${m.mine ? "bg-[#9a3412] text-white rounded-br-md" : "bg-white border border-line rounded-bl-md"}`}>
                      <div>{m.body}</div>
                      <div className={`text-[10px] mt-1 ${m.mine ? "text-white/70" : "text-muted"}`}>{m.senderName} · {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              <form onSubmit={send} className="p-3 border-t border-line flex gap-2">
                <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Hi! Is this still available? I can pick up…" className="flex-1 bg-amber-50/60 border border-line rounded-full px-4 py-2.5 text-sm outline-none focus:bg-white" />
                <button disabled={sending || !draft.trim()} className="bg-[#9a3412] text-white px-5 py-2.5 rounded-full text-sm font-bold disabled:opacity-50">Send</button>
              </form>
              {error && <div className="px-3 pb-3 text-xs text-red-700">{error}</div>}
              <div className="px-3 pb-3 text-[11px] text-muted">Quick templates: “Is this still available?” · “Can I pick up today at 18:00 at the lobby?” · “Is the size exact?”</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() { return <Suspense><Inner /></Suspense>; }
