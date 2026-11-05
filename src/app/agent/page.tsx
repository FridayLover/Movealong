"use client";
import { useI18n } from "@/lib/i18n";
import dynamic from "next/dynamic";

const AgentChat = dynamic(() => import("@/components/AgentChat"), { ssr: false });

export default function AgentPage() {
  const { t } = useI18n();
  return (
    <div className="animate-page-in pt-6 max-w-[880px] mx-auto flex flex-col min-h-0">
      <div className="animate-fade-up shrink-0">
        <h1 className="text-2xl sm:text-3xl font-black text-ink">{t("Baan — your MoveAlong concierge")}</h1>
        <p className="text-muted text-sm mt-1.5 max-w-[65ch]">Plain words, Thai or English. Baan sees your saved room, only recommends live listings inside your distance and budget, drafts sell listings from your photos, and writes chat replies. The floating Baan (bottom-right) is the same conversation.</p>
      </div>

      {/* Conversation workspace: history flexes to the viewport, the composer
          is always visible, and short screens shrink the header, not the chat */}
      <div
        className="animate-fade-up mt-4 bg-white border border-line/70 rounded-3xl shadow-soft overflow-hidden shrink-0 h-[calc(100dvh-215px)] min-h-[430px] max-sm:h-[calc(100dvh-190px)] max-sm:min-h-[380px]"
        style={{ ["--i" as any]: 1 }}
      >
        <AgentChat />
      </div>

      <div className="flex gap-2 flex-wrap mt-3 text-xs text-muted shrink-0">
        <span className="bg-white border border-line rounded-full px-3 py-1.5"><b className="text-ink">Room picks</b> — “What fits this corner?”</span>
        <span className="bg-white border border-line rounded-full px-3 py-1.5"><b className="text-ink">Sell auto-fill</b> — photos in, editable draft out</span>
        <span className="bg-white border border-line rounded-full px-3 py-1.5"><b className="text-ink">Chat drafts</b> — replies in your tone</span>
      </div>
    </div>
  );
}
