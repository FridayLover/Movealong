"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { formatCredits } from "@/lib/credits";
import { LanguageSelect, useI18n } from "@/lib/i18n";

const NAV = [
  { href: "/", label: "Feed" },
  { href: "/map", label: "Map" },
  { href: "/ai-lab", label: "AI Room" },
  { href: "/agent", label: "Agent" },
  { href: "/chat", label: "Messages" },
  { href: "/credits", label: "Credits" },
];

type Me = { id: string; name: string; email: string; credits: number; subscriptionTier: string; favCount?: number; cartCount?: number; unreadCount?: number } | null;

export default function Header() {
  const { t } = useI18n();
  const [me, setMe] = useState<Me>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : !!pathname?.startsWith(href));

  async function refresh() {
    try {
      const r = await fetch("/api/auth/me");
      const d = await r.json();
      setMe(d.user || null);
    } catch {}
  }
  useEffect(() => {
    refresh();
    const h = () => refresh();
    window.addEventListener("movealong:refresh", h);
    return () => window.removeEventListener("movealong:refresh", h);
  }, []);

  return (
    <header className="sticky top-0 z-40 backdrop-blur bg-[#fffbf5]/85 border-b border-line">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 h-[64px] flex flex-nowrap items-center justify-between gap-3">
        <Link href="/" className="flex shrink-0 whitespace-nowrap items-center gap-2 font-black tracking-tight text-xl text-ink">
          <span className="w-9 h-9 rounded-lg bg-[#9a3412] text-white grid place-items-center shadow-soft">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>
          </span>
          MoveAlong
        </Link>

        <nav className="hidden xl:flex shrink-0 items-center gap-0.5 text-sm text-stone-700" aria-label="Primary">
          {NAV.map((n) => (
            <Link
              key={n.href} href={n.href}
              aria-current={isActive(n.href) ? "page" : undefined}
              className={`press relative whitespace-nowrap px-3 py-2.5 rounded-full text-[15px] ${isActive(n.href) ? "bg-amber-100/80 font-bold text-ink" : "font-medium hover:bg-amber-50"}`}
            >
              {t(n.label)}
              {n.href === "/chat" && !!me?.unreadCount && <span key={me.unreadCount} className="animate-pop absolute -top-0.5 -right-1 bg-[#9a3412] text-white text-[10px] font-black min-w-5 h-5 px-1 grid place-items-center rounded-full" aria-label={`${me.unreadCount} ${t("unread")}`}>{me.unreadCount}</span>}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 flex-nowrap items-center gap-2">
          {me && (
            <div className="hidden sm:flex items-center gap-1">
              <Link href="/profile?tab=favorites" className="relative w-9 h-9 rounded-full bg-white border grid place-items-center" title={t("Favorites")}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill={me.favCount ? "#9a3412" : "none"} stroke="#1c1917" strokeWidth="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                {!!me.favCount && <span key={me.favCount} className="animate-pop absolute -top-1 -right-1 bg-[#9a3412] text-white text-[10px] font-bold w-5 h-5 grid place-items-center rounded-full">{me.favCount}</span>}
              </Link>
              <Link href="/profile?tab=cart" className="relative w-9 h-9 rounded-full bg-white border grid place-items-center" title={t("Cart")}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1c1917" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                {!!me.cartCount && <span key={me.cartCount} className="animate-pop absolute -top-1 -right-1 bg-[#9a3412] text-white text-[10px] font-bold w-5 h-5 grid place-items-center rounded-full">{me.cartCount}</span>}
              </Link>
            </div>
          )}
          <LanguageSelect />
          <Link href="/sell" className="btn-primary hidden whitespace-nowrap sm:inline-flex px-4 py-2">{t("+ List item")}</Link>
          {me ? (
            <div className="flex items-center gap-2">
              <Link href="/profile" className="flex shrink-0 whitespace-nowrap items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full bg-[#1c1917] text-white text-sm shadow-soft">
                <span className="w-7 h-7 rounded-full bg-amber-100 text-[#7c2d12] grid place-items-center font-black">{me.name.slice(0,1).toUpperCase()}</span>
                <span className="max-w-[80px] truncate">{me.name}</span>
                <span className="hidden lg:inline whitespace-nowrap bg-white/15 px-2 py-0.5 rounded-full text-xs">{me.subscriptionTier === "pro" ? t("Unlimited") : `${me.credits} ${t("cr")}`} · {me.subscriptionTier}</span>
              </Link>
              <button onClick={async()=>{ await fetch("/api/auth/me",{method:"DELETE"}); location.href="/";}} className="text-sm text-muted hover:text-ink hidden whitespace-nowrap sm:block">{t("Logout")}</button>
            </div>
          ) : (
            <Link href="/auth" className="btn-dark whitespace-nowrap px-4 py-2">{t("Sign in")}</Link>
          )}
          <button onClick={()=>setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label={t("Menu")} className="press xl:hidden shrink-0 w-10 h-10 rounded-full border bg-white grid place-items-center text-lg leading-none">≡</button>
        </div>
      </div>
      {menuOpen && (
        <nav className="animate-msg-in xl:hidden border-t bg-[#fffbf5] px-4 py-3 flex flex-col gap-1 text-sm" aria-label="Mobile">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={()=>setMenuOpen(false)} aria-current={isActive(n.href) ? "page" : undefined} className={`press px-2 py-2.5 rounded-lg ${isActive(n.href) ? "bg-amber-100/80 font-bold text-ink" : ""}`}>
              {t(n.label)}{n.href === "/chat" && me?.unreadCount ? ` (${me.unreadCount} ${t("unread")})` : ""}
            </Link>
          ))}
          <Link href="/profile?tab=favorites" onClick={()=>setMenuOpen(false)} className="px-2 py-2.5">{t("Favorites")} {me?.favCount ? `(${me.favCount})` : ""}</Link>
          <Link href="/profile?tab=cart" onClick={()=>setMenuOpen(false)} className="px-2 py-2.5">{t("Cart")} {me?.cartCount ? `(${me.cartCount})` : ""}</Link>
          <Link href="/sell" onClick={()=>setMenuOpen(false)} className="px-2 py-2.5 font-bold text-[#9a3412]">{t("+ List item")}</Link>
          <div className="px-2 py-2"><LanguageSelect /></div>
        </nav>
      )}
    </header>
  );
}
