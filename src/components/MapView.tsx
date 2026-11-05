"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatPrice } from "@/lib/utils";

export type MapListing = {
  id: string; title: string; price: number | null; isFree: boolean; lat: number | null; lng: number | null; building?: string | null; images: string[];
};

const USER_PIN_COLOR = "#2563eb";
const LISTING_PIN_COLOR = "#9a3412";

function makeDivIcon(L: any, color: string, label: string, isUser = false) {
  const size = isUser ? 36 : 30;
  const pulse = isUser
    ? `<span style="position:absolute;inset:-6px;border-radius:9999px;border:2px solid ${color};opacity:.45;animation:mapPulse 1.8s ease-out infinite"></span>`
    : "";
  return L.divIcon({
    className: "movealong-pin",
    html: `<div style="position:relative;width:${size}px;height:${size}px">${pulse}<div style="width:${size}px;height:${size}px;background:${color};border:2px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 4px 14px rgba(0,0,0,.35);display:grid;place-items:center"><span style="transform:rotate(45deg);color:white;font-size:${isUser ? 15 : 12}px;line-height:1">${label}</span></div></div><style>@keyframes mapPulse{0%{transform:scale(.7);opacity:.6}100%{transform:scale(1.35);opacity:0}}</style>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

// Reacts to user position: recenters / flies the map to the user pin when location becomes known.
function RecenterToUser({ Leaflet, pos, hasUserLocation }: { Leaflet: any; pos: [number, number]; hasUserLocation: boolean }) {
  const map = Leaflet.useMap();
  useEffect(() => {
    if (!map || !hasUserLocation) return;
    // Fly (smooth) on first fix, then keep view on user when it changes materially
    map.flyTo(pos, Math.max(map.getZoom(), 15), { duration: 0.9 });
  }, [map, pos, hasUserLocation]);
  return null;
}

export default function MapView({ listings, center }: { listings: MapListing[]; center?: [number, number] }) {
  const [Leaflet, setLeaflet] = useState<any>(null);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [fallbackPos] = useState<[number, number]>(center || [13.7563, 100.5018]); // Bangkok default until GPS arrives

  useEffect(() => {
    let mounted = true;
    Promise.all([import("leaflet"), import("react-leaflet")]).then(([L, RL]) => {
      if (!mounted) return;
      // Keep a fallback default icon config (not used for our divIcons, but avoids missing-icon errors elsewhere)
      // @ts-ignore
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
      setLeaflet({ L, ...RL });
    });
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => setUserPos([p.coords.latitude, p.coords.longitude]),
        () => {},
        { timeout: 6000, enableHighAccuracy: true }
      );
      // Keep updating if the user moves (cheap watch)
      const watchId = navigator.geolocation.watchPosition(
        (p) => setUserPos([p.coords.latitude, p.coords.longitude]),
        () => {},
        { timeout: 10000, maximumAge: 15000 }
      );
      return () => {
        mounted = false;
        navigator.geolocation.clearWatch(watchId);
      };
    }
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (center) setUserPos(center);
  }, [center]);

  if (!Leaflet) return <div className="h-[520px] rounded-2xl bg-amber-50 animate-pulse grid place-items-center text-muted">Loading map…</div>;

  const { MapContainer, TileLayer, Marker, Popup, Circle } = Leaflet;
  const displayPos: [number, number] = userPos || fallbackPos;
  const hasUserLocation = !!userPos;
  const listingIcon = (L: any) => makeDivIcon(L, LISTING_PIN_COLOR, "◆", false);
  const userIcon = (L: any) => makeDivIcon(L, USER_PIN_COLOR, "●", true);
  const L = Leaflet.L;

  return (
    <div className="h-[520px] rounded-2xl overflow-hidden border bg-white relative">
      <div className="absolute top-3 left-3 z-[500] flex gap-2 text-[11px] font-semibold">
        <span className="inline-flex items-center gap-1.5 bg-white border rounded-full px-2.5 py-1 shadow-sm"><span className="w-2.5 h-2.5 rounded-full" style={{ background: USER_PIN_COLOR }} /> You</span>
        <span className="inline-flex items-center gap-1.5 bg-white border rounded-full px-2.5 py-1 shadow-sm"><span className="w-2.5 h-2.5 rounded-full" style={{ background: LISTING_PIN_COLOR }} /> Listings</span>
        {!hasUserLocation && <span className="bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">Locating…</span>}
      </div>
      <MapContainer center={displayPos} zoom={14} style={{ height: "100%", width: "100%" }}>
        <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <RecenterToUser Leaflet={Leaflet} pos={displayPos} hasUserLocation={hasUserLocation} />
        {listings.filter(l=> l.lat && l.lng).map(l=> (
          <Marker key={l.id} position={[l.lat as number, l.lng as number]} icon={listingIcon(L)}>
            <Popup>
              <div className="min-w-[180px]">
                <div className="font-semibold">{l.title}</div>
                <div className="text-sm text-slate-600">{l.building || ""} · {formatPrice(l.price, l.isFree)}</div>
                <Link href={`/listing/${l.id}`} className="inline-block mt-2 text-xs bg-slate-900 text-white px-3 py-1 rounded-full">View</Link>
              </div>
            </Popup>
          </Marker>
        ))}
        <Marker position={displayPos} icon={userIcon(L)} zIndexOffset={1000}>
          <Popup>
            <div className="min-w-[140px]"><div className="font-semibold">You are here</div><div className="text-xs text-slate-600">{hasUserLocation ? "Live GPS · map centered on you" : "Approximate · enable location for accuracy"}</div></div>
          </Popup>
        </Marker>
        {hasUserLocation && Circle && (
          <Circle center={displayPos} radius={120} pathOptions={{ color: USER_PIN_COLOR, weight: 1, fillColor: USER_PIN_COLOR, fillOpacity: 0.08 }} />
        )}
      </MapContainer>
    </div>
  );
}
