"use client";
import { useI18n } from "@/lib/i18n";
export default function Footer() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-line bg-white mt-10">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-6 text-sm text-muted flex flex-wrap gap-4 justify-between">
        <span>© {new Date().getFullYear()} MoveAlong — move light, pass it on.</span>
        <span className="flex gap-4"><a href="/credits" className="hover:text-ink">{t("Credits & Subscriptions")}</a><a href="/ai-lab" className="hover:text-ink">{t("AI Room")}</a><a href="/profile" className="hover:text-ink">{t("Profile")}</a></span>
      </div>
    </footer>
  );
}
