"use client";

import { useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { MapPin, X, Clock } from "lucide-react";
import { type Workshop } from "@/lib/api";
import { ModalityLabel } from "@/lib/constants";

// ─── Brand colors (mirrors globals.css) ────────────────────────────────────
const C = {
  accent: "#b54a2c",       // terracotta
  accentDark: "#8f3a21",
  primary: "#1a1916",      // dark brown
  bg: "#f4efe6",           // cream
  border: "#d4c9b8",
};

// ─── Category SVG icon paths (Lucide, viewBox 0 0 24 24) ───────────────────
const CATEGORY_PATHS: Record<string, string> = {
  "arte-creatividad": `
    <circle cx="13.5" cy="6.5" r="1.5"/>
    <circle cx="17.5" cy="10.5" r="1.5"/>
    <circle cx="8.5"  cy="7.5"  r="1.5"/>
    <circle cx="6.5"  cy="12.5" r="1.5"/>
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746
      1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125
      a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503
      5.555-5.554C21.965 6.012 17.461 2 12 2z"/>`,
  "cocina-gastronomia": `
    <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54
      5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"/>
    <line x1="6" x2="18" y1="17" y2="17"/>`,
  "musica-danza": `
    <path d="M9 18V5l12-2v13"/>
    <circle cx="6"  cy="18" r="3"/>
    <circle cx="18" cy="16" r="3"/>`,
  "bienestar-salud": `
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3
      c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5
      c0 2.3 1.5 4.05 3 5.5l7 7Z"/>`,
  "tecnologia": `
    <polyline points="16 18 22 12 16 6"/>
    <polyline points="8 6 2 12 8 18"/>`,
  "idiomas": `
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" x2="22" y1="12" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10
      15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>`,
  "deportes": `
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>`,
  "negocios": `
    <rect width="20" height="14" x="2" y="7" rx="2" ry="2"/>
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>`,
  "fotografia": `
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16
      a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
    <circle cx="12" cy="13" r="3"/>`,
  "artesania": `
    <circle cx="6" cy="6" r="3"/>
    <circle cx="6" cy="18" r="3"/>
    <line x1="20" x2="8.12" y1="4" y2="15.88"/>
    <line x1="14.47" x2="20" y1="14.48" y2="20"/>
    <line x1="8.12" x2="12" y1="8.12" y2="12"/>`,
};

const DEFAULT_ICON_PATH = `
  <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0
    C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
  <circle cx="12" cy="10" r="3"/>`;

function makePinSvg(iconPath: string, size: number, selected: boolean) {
  const bg      = selected ? C.accentDark : C.accent;
  const ring    = selected ? `<circle cx="${size / 2}" cy="${size / 2 - 4}" r="${size / 2 - 2}" fill="none" stroke="${C.bg}" stroke-width="2.5" opacity="0.6"/>` : "";
  const iconSize = size * 0.42;
  const cx = size / 2 - iconSize / 2;
  const cy = size / 2 - 4 - iconSize / 2;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + 8}" viewBox="0 0 ${size} ${size}">
      <!-- drop shadow -->
      <ellipse cx="${size / 2}" cy="${size + 5}" rx="${size * 0.3}" ry="3" fill="${C.primary}" opacity="0.18"/>
      <!-- pin body -->
      <circle cx="${size / 2}" cy="${size / 2 - 4}" r="${size / 2 - 1}" fill="${bg}"/>
      ${ring}
      <!-- tail -->
      <polygon points="${size / 2 - 5},${size - 9} ${size / 2 + 5},${size - 9} ${size / 2},${size + 2}" fill="${bg}"/>
      <!-- category icon -->
      <svg x="${cx}" y="${cy}" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24"
           fill="none" stroke="${C.bg}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${iconPath}
      </svg>
    </svg>`;
}

function createCategoryIcon(categorySlug: string | undefined, selected: boolean): L.DivIcon {
  const path = CATEGORY_PATHS[categorySlug ?? ""] ?? DEFAULT_ICON_PATH;
  const size = selected ? 46 : 38;
  return L.divIcon({
    html: makePinSvg(path, size, selected),
    className: "",
    iconSize: [size, size + 8],
    iconAnchor: [size / 2, size + 8],
    popupAnchor: [0, -(size + 8)],
  });
}

// ─── Cluster icon factory ───────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createClusterIcon(cluster: any): L.DivIcon {
  const count = cluster.getChildCount();
  const size  = count < 10 ? 36 : count < 50 ? 42 : 50;
  const html = `
    <div style="
      width:${size}px; height:${size}px;
      background:${C.primary};
      border:3px solid ${C.bg};
      border-radius:50%;
      display:flex; align-items:center; justify-content:center;
      box-shadow:0 2px 6px rgba(0,0,0,0.25);
      font-family:inherit; font-size:${size < 42 ? 13 : 14}px;
      font-weight:700; color:${C.bg};
      letter-spacing:-0.5px;
    ">${count}</div>`;
  return L.divIcon({
    html,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────
const MODALITY = ModalityLabel;
const TYPE: Record<string, string>     = { workshop: "Taller", course: "Curso", class: "Clase", event: "Evento" };

function MapClickOutside({ onClose }: { onClose: () => void }) {
  useMapEvents({ click: () => onClose() });
  return null;
}

// ─── Main component ─────────────────────────────────────────────────────────
interface Props {
  workshops: Workshop[];
  center?: [number, number];
  zoom?: number;
}

export function WorkshopsMap({ workshops, center = [-33.45, -70.65], zoom = 12 }: Props) {
  const [selected, setSelected] = useState<Workshop | null>(null);
  const mapped = workshops.filter((w) => w.lat != null && w.lng != null);

  return (
    <div className="relative w-full h-[520px] rounded-xl overflow-hidden border shadow-sm">
      <MapContainer center={center} zoom={zoom} scrollWheelZoom attributionControl={false} className="h-full w-full" style={{ zIndex: 0 }}>
        <TileLayer
          subdomains="abcd"
          maxZoom={20}
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <MapClickOutside onClose={() => setSelected(null)} />

        <MarkerClusterGroup
          chunkedLoading
          iconCreateFunction={createClusterIcon}
          maxClusterRadius={60}
          spiderfyOnMaxZoom
          showCoverageOnHover={false}
          zoomToBoundsOnClick
        >
          {mapped.map((w) => (
            <Marker
              key={w.id}
              position={[w.lat!, w.lng!]}
              icon={createCategoryIcon(w.category_slug, selected?.id === w.id)}
              eventHandlers={{
                click(e) {
                  e.originalEvent.stopPropagation();
                  setSelected(w);
                },
              }}
            />
          ))}
        </MarkerClusterGroup>
      </MapContainer>

      {/* ── Detail panel ── */}
      {selected && (
        <div className="absolute top-3 right-3 z-[1000] w-72 bg-background border rounded-xl shadow-lg p-4 space-y-3">
          {/* Category icon strip */}
          {selected.category_slug && CATEGORY_PATHS[selected.category_slug] && (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: C.accent }}
            >
              <svg
                width="16" height="16" viewBox="0 0 24 24"
                fill="none" stroke={C.bg} strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"
                dangerouslySetInnerHTML={{ __html: CATEGORY_PATHS[selected.category_slug] }}
              />
            </div>
          )}

          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold leading-tight text-sm">{selected.title}</h3>
            <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="text-xs">{MODALITY[selected.modality]}</Badge>
            <Badge variant="secondary" className="text-xs">{TYPE[selected.type]}</Badge>
            {selected.category && (
              <Badge className="text-xs bg-primary/10 text-primary border-0">{selected.category.name}</Badge>
            )}
          </div>

          {selected.location && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              {selected.location}
            </p>
          )}

          {selected.description && (
            <p className="text-xs text-muted-foreground line-clamp-3">{selected.description}</p>
          )}

          {selected.schedules && selected.schedules.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Horario
              </p>
              {selected.schedules.slice(0, 2).map((s) => {
                const days = s.days_of_week.map((d) => ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"][d]).join(", ");
                return (
                  <p key={s.id} className="text-xs text-muted-foreground pl-4">
                    {days} · {s.time_start.slice(0, 5)} ({s.duration_min} min)
                  </p>
                );
              })}
            </div>
          )}

          {selected.sessions && selected.sessions.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Próximas fechas
              </p>
              {selected.sessions.slice(0, 2).map((s) => (
                <p key={s.id} className="text-xs text-muted-foreground pl-4">
                  {new Date(s.starts_at).toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}
                </p>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-sm font-bold">
              {selected.price === 0 ? "Gratis" : `$${Math.round(Number(selected.price)).toLocaleString("es-CL", { maximumFractionDigits: 0 })} ${selected.currency}`}
            </span>
            <Link
              href={`/talleres/${selected.slug}`}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Ver taller →
            </Link>
          </div>

          {selected.instructor_name && (
            <p className="text-xs text-muted-foreground/70">por {selected.instructor_name}</p>
          )}
        </div>
      )}

      <div className="absolute bottom-3 left-3 z-[1000] bg-background/90 backdrop-blur-sm border rounded-full px-3 py-1 text-xs text-muted-foreground">
        {mapped.length} {mapped.length !== 1 ? "talleres" : "taller"} en el mapa
      </div>
    </div>
  );
}
