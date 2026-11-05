"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import HomeBuddy from "./HomeBuddy";
import { useI18n } from "@/lib/i18n";

const AgentChat = dynamic(() => import("./AgentChat"), { ssr: false });

const NUDGES = [
  "Hi, I'm Baan — want help styling your room?",
  "Tell me your budget and distance — I'll pick pieces near you.",
  "Selling something? I can draft your listing in seconds.",
  "Not sure what fits? Show me your room and I'll suggest a combo.",
];

/**
 * Floating Muse Spark concierge as Baan, a home-like character.
 * The character icon floats (agent-float) at the bottom right and periodically
 * pops a small help bubble; it waves on hover/nudge. Closable three ways:
 * the ✕ button, the character again, or Escape. Help never traps the user.
 */
export default function AgentWidget() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [bubble, setBubble] = useState(false);
  const [nudgeIdx, setNudgeIdx] = useState(0);
  const interacted = useRef(false);
  const fabRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  function close() {
    setClosing(true);
    setTimeout(() => {
      setOpen(false); setClosing(false);
      fabRef.current?.focus(); // return focus to Baan so keyboard users are not lost
    }, 190);
  }

  // Move focus into the dialog when it opens (close button first)
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open ]);
  function toggle() {
    interacted.current = true;
    setBubble(false);
    if (open) close();
    else { setMounted(true); setOpen(true); }
  }
  function dismissBubble(e: React.MouseEvent) {
    e.stopPropagation();
    interacted.current = true;
    setBubble(false);
  }

  // Idle help bubble: floats up after a few seconds, rotates tips, and stops
  // for good once the user opens or dismisses the agent.
  useEffect(() => {
    if (open) { setBubble(false); return; }
    let hide: ReturnType<typeof setTimeout>;
    const show = () => {
      if (interacted.current) return;
      setNudgeIdx((i) => (i + 1) % NUDGES.length);
      setBubble(true);
      hide = setTimeout(() => setBubble(false), 6500);
    };
    const first = setTimeout(show, 2800);
    const loop = setInterval(show, 28000);
    return () => { clearTimeout(first); clearTimeout(hide); clearInterval(loop); };
  }, [open ]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && open) close(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open ]);

  // Pages can summon Baan with context (e.g. "Ask Baan about this item")
  useEffect(() => {
    const onSummon = () => {
      interacted.current = true;
      setBubble(false);
      setMounted(true);
      setOpen(true);
    };
    window.addEventListener("movealong:open-agent", onSummon);
    return () => window.removeEventListener("movealong:open-agent", onSummon);
  }, []);

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="MoveAlong AI concierge"
          className={`${closing ? "agent-panel-out" : "agent-panel-in"} fixed z-[60] bg-white border border-line shadow-card overflow-hidden flex flex-col sm:transition-[width,height] sm:duration-300
            max-sm:inset-0 max-sm:rounded-none max-sm:border-0 max-sm:pt-[env(safe-area-inset-top)] max-sm:pb-[env(safe-area-inset-bottom)]
            sm:bottom-[104px] sm:right-5 sm:rounded-2xl sm:max-w-[calc(100vw-2rem)]
            ${expanded ? "sm:w-[720px] sm:h-[calc(100dvh-120px)]" : "sm:w-[430px] sm:h-[min(640px,calc(100dvh-132px))]"}`}
        >
          <div className="flex items-center gap-2.5 px-4 py-3 bg-[#1c1917] text-white shrink-0">
            <span className="w-9 h-9 rounded-xl bg-white grid place-items-center shrink-0 overflow-hidden">
              <HomeBuddy size={30} waving />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-sm leading-tight">Baan · MoveAlong Agent</span>
              <span className="block text-[11px] text-white/70">Muse Spark · room picks, sell drafts, chat replies</span>
            </span>
            <a href="/agent" className="press hidden sm:block text-[11px] font-bold bg-white/15 px-2.5 py-1.5 rounded-full shrink-0">Full page</a>
            <button
              onClick={() => setExpanded((v) => !v)}
              aria-pressed={expanded}
              aria-label={expanded ? t("Shrink assistant") : t("Expand assistant")}
              title={expanded ? "Shrink panel" : "Expand panel — more room to read"}
              className="press hidden sm:grid w-8 h-8 rounded-full bg-white/15 place-items-center shrink-0"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                {expanded
                  ? <path d="M8 3v5H3M16 3v5h5M8 21v-5H3M16 21v-5h5" />
                  : <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />}
              </svg>
            </button>
            <button ref={closeRef} onClick={close} aria-label={t("Close assistant")} className="press w-10 h-10 sm:w-8 sm:h-8 rounded-full bg-white/15 grid place-items-center text-lg leading-none shrink-0">✕</button>
          </div>
          <div className="flex-1 min-h-0">
            {mounted && <AgentChat compact onClose={close} />}
          </div>
        </div>
      )}

      <div className={`fixed z-[61] bottom-5 right-4 sm:right-5 flex-col items-end gap-1 flex ${open ? "max-sm:hidden" : ""}`}>
        {bubble && !open && (
          <button
            onClick={toggle}
            className="animate-bubble-in press relative max-w-[248px] text-left bg-white border border-line shadow-card rounded-2xl rounded-br-md px-3.5 py-2.5 mr-1 mb-1"
          >
            <span className="block text-[12.5px] font-semibold leading-snug text-ink">{NUDGES[nudgeIdx]}</span>
            <span className="block text-[11px] text-[#9a3412] font-bold mt-1">Tap Baan to chat →</span>
            <span
              role="button"
              aria-label="Dismiss help tip"
              onClick={dismissBubble}
              className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-[#1c1917] text-white text-[11px] grid place-items-center leading-none"
            >✕</span>
          </button>
        )}

        <div className="flex flex-col items-center">
          <button
            ref={fabRef}
            onClick={toggle}
            aria-expanded={open}
            aria-label={open ? "Close AI agent Baan" : "Open AI agent Baan — get help styling, selling or replying"}
            title={open ? "Close Baan" : "Ask Baan, your home buddy"}
            className="group press relative w-[68px] h-[68px] rounded-full bg-white border border-line shadow-card grid place-items-center"
          >
            {open ? (
              <span className="w-10 h-10 rounded-full bg-[#9a3412] text-white grid place-items-center text-xl leading-none">✕</span>
            ) : (
              <span className="agent-float block">
                <HomeBuddy size={52} waving={bubble} />
              </span>
            )}
            {!open && <span className="animate-pop absolute -top-0.5 -right-0.5 bg-[#9a3412] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full border-2 border-white">AI</span>}
          </button>
          {!open && <span aria-hidden className="buddy-shadow block w-10 h-[6px] rounded-full bg-[#1c1917] mt-0.5" />}
          <span className="text-[10px] font-bold text-muted bg-[#fffbf5]/85 px-1.5 rounded-full mt-0.5">{open ? t("Close") : t("Ask Baan")}</span>
        </div>
      </div>
    </>
  );
}
