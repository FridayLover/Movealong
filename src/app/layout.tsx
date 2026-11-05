import type { Metadata, Viewport } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import Header from "@/components/Header";
import AgentWidget from "@/components/AgentWidget";
import { LanguageProvider } from "@/lib/i18n";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "MoveAlong — Near-you secondhand for movers",
  description: "Sell, buy, or give away what you can't carry when you move. Map discovery + AI room preview.",
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#9a3412",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-surface text-ink">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-[80] focus:top-2 focus:left-2 focus:bg-white focus:border focus:px-3 focus:py-2 focus:rounded-full text-sm font-bold">Skip to content</a>
        <LanguageProvider>
          <Header />
          <main id="main" className="animate-page-in mx-auto max-w-[1200px] px-4 sm:px-6 pb-16">{children}</main>
          <AgentWidget />
          <Footer />
        </LanguageProvider>
      </body>
    </html>
  );
}
