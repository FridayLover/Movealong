"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { haversine, formatDistance } from "@/lib/utils";

export type PlaceResult = {
  name: string;
  displayName: string;
  lat: number;
  lng: number;
  type?: string;
  distanceKm?: number;
};

const FETCH_LIMIT = 15;
const FALLBACK_ORIGIN = { lat: 13.7563, lng: 100.5018 }; // Bangkok — same fallback as the map, until GPS arrives

function visibleLimitForViewport(h: number, w: number): number {
  if (h < 560 || w < 360) return 4;
  if (h < 700) return 5;
  if (h < 860) return 7;
  return 9;
}

/**
 * Realtime building/condo search backed by OpenStreetMap Nominatim (free, no key).
 * Debounced (300ms) + AbortController so typing feels instant and we don't hammer the API.
 * Results are re-ordered nearest-first (haversine from the user) and sliced to a
 * screen-size limit so the dropdown never covers a small phone screen.
 * Docs: https://nominatim.org/release-docs/develop/api/Search/
 */
export default function BuildingAutocomplete({
  value,
  onChange,
  onSelect,
  near,
  placeholder = "e.g. Ideo Sukhumvit 93, Lumpini, Ari…",
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect?: (p: PlaceResult) => void;
  near?: { lat: number; lng: number } | null;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [allResults, setAllResults] = useState<PlaceResult[]>([]);
  const [visibleLimit, setVisibleLimit] = useState(6);
  const [gpsOrigin, setGpsOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const origin = near ?? gpsOrigin ?? FALLBACK_ORIGIN;
  const results = useMemo(() => allResults.slice(0, visibleLimit), [allResults, visibleLimit]);

  // Screen-size limit: fewer rows on short / narrow screens so the list fits without scrolling the page away
  useEffect(() => {
    function update() {
      setVisibleLimit(visibleLimitForViewport(window.innerHeight, window.innerWidth));
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Best-effort GPS for nearest-first ordering (parent `near` wins when provided)
  useEffect(() => {
    if (near || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setGpsOrigin({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { timeout: 5000, maximumAge: 60000 }
    );
  }, [near]);

  // Re-sort already-fetched results if the origin becomes known after the fetch
  useEffect(() => {
    setAllResults((prev) => {
      if (!prev.length) return prev;
      const withDist = prev.map((r) => ({ ...r, distanceKm: haversine(origin.lat, origin.lng, r.lat, r.lng) }));
      return [...withDist].sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin.lat, origin.lng]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 3) {
      setAllResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=${FETCH_LIMIT}&addressdetails=1&countrycodes=th&accept-language=en&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error("search failed");
        const json: any[] = await res.json();
        const mapped: PlaceResult[] = json.map((r) => {
          const a = r.address || {};
          const name = r.name || a.building || a.residential || a.suburb || a.road || r.display_name.split(",")[0];
          const lat = parseFloat(r.lat);
          const lng = parseFloat(r.lon);
          return {
            name: String(name).slice(0, 80),
            displayName: r.display_name,
            lat,
            lng,
            type: r.type,
            distanceKm: haversine(origin.lat, origin.lng, lat, lng),
          };
        });
        // Nearest first — Nominatim's importance order would bury the condo next door
        const sorted = [...mapped].sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
        setAllResults(sorted);
        setOpen(true);
      } catch (e: any) {
        if (e?.name !== "AbortError") setAllResults([]);
      } finally {
        setLoading(false);
      }
    }, 300); // debounce realtime typing
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div ref={wrapRef} className="relative">
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => { if (results.length) setOpen(true); }}
        placeholder={placeholder}
        className="w-full bg-amber-50/60 border border-line rounded-xl px-4 py-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-[#9a3412]/20"
        autoComplete="off"
      />
      {loading && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">Searching…</span>}
      {open && results.length > 0 && (
        <div
          className="absolute z-30 mt-1 w-full bg-white border border-line rounded-xl shadow-card overflow-hidden overflow-auto"
          style={{ maxHeight: "min(52vh, 420px)" }}
        >
          {results.map((r, i) => (
            <button
              key={r.lat + "-" + r.lng + "-" + i}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(r.name);
                onSelect?.(r);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2.5 hover:bg-amber-50 border-b border-line/60 last:border-0"
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="block text-sm font-semibold truncate">{r.name}</span>
                {r.distanceKm != null && <span className="shrink-0 text-[11px] font-semibold text-[#9a3412]">{formatDistance(r.distanceKm)}</span>}
              </span>
              <span className="block text-xs text-muted truncate">{r.displayName}</span>
            </button>
          ))}
          <div className="px-3 py-1.5 text-[10px] text-muted bg-amber-50/60">
            Nearest first · showing {results.length} of {allResults.length} · Places by OpenStreetMap
          </div>
        </div>
      )}
    </div>
  );
}
