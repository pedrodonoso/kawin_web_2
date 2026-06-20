"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { MapContainer, TileLayer, Marker, CircleMarker, useMapEvents, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { MapPin, X, Clock, Maximize2, Minimize2, Building2 } from "lucide-react";
import { type Workshop, type Venue } from "@/lib/api";
import { ModalityLabel } from "@/lib/constants";
import { formatPrice } from "@/lib/utils";

// ─── Brand colors (mirrors globals.css) ────────────────────────────────────
const C = {
  accent: "#b54a2c",       // terracotta
  accentDark: "#8f3a21",
  primary: "#1a1916",      // dark brown
  bg: "#f4efe6",           // cream
  border: "#d4c9b8",
  workshop: "#ea580c",     // orange-600
  workshopDark: "#c2410c", // orange-700
  course: "#d97706",       // amber-600
  courseDark: "#b45309",   // amber-700
  class: "#4f46e5",        // indigo-600
  classDark: "#4338ca",    // indigo-700
  event: "#059669",        // emerald-600
  eventDark: "#047857",    // emerald-700
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

const WORKSHOP_ICON_PATH = `
  <path d="M18.37 2.63 14 7l-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9 1.59-1.59a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 1 0-3-3Z"/>
  <path d="M9 8c-2 3-4 3.5-7 4l8 10c2-1 6-5 6-7"/>
  <path d="M14.5 17.5 4.5 15"/>`;

const COURSE_ICON_PATH = `
  <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/>
  <path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>`;

const CLASS_ICON_PATH = `
  <path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/>
  <path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>`;

const EVENT_ICON_PATH = `
  <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
  <line x1="16" x2="16" y1="2" y2="6"/>
  <line x1="8" x2="8" y1="2" y2="6"/>
  <line x1="3" x2="21" y1="10" y2="10"/>
  <path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/>
  <path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>`;

const TYPE_ICON_PATHS: Record<string, string> = {
  workshop: WORKSHOP_ICON_PATH,
  course: COURSE_ICON_PATH,
  class: CLASS_ICON_PATH,
  event: EVENT_ICON_PATH,
};

const TYPE_COLORS: Record<string, { color: string; dark: string }> = {
  workshop: { color: C.workshop, dark: C.workshopDark },
  course: { color: C.course, dark: C.courseDark },
  class: { color: C.class, dark: C.classDark },
  event: { color: C.event, dark: C.eventDark },
};

function makePinSvg(iconPath: string, size: number, selected: boolean, color?: string, colorDark?: string) {
  const bg      = selected ? (colorDark ?? C.accentDark) : (color ?? C.accent);
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

const VENUE_ICON_PATH = `
  <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
  <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
  <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
  <path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>`;

function createVenueIcon(selected: boolean): L.DivIcon {
  const size = selected ? 48 : 42;
  return L.divIcon({
    html: makePinSvg(VENUE_ICON_PATH, size, selected, C.accent, C.accentDark),
    className: "",
    iconSize: [size, size + 8],
    iconAnchor: [size / 2, size + 8],
    popupAnchor: [0, -(size + 8)],
  });
}

function createCategoryIcon(categorySlug: string | undefined, selected: boolean, workshopType?: string): L.DivIcon {
  const typeIcon = workshopType ? TYPE_ICON_PATHS[workshopType] : undefined;
  const typeCol = workshopType ? TYPE_COLORS[workshopType] : undefined;
  const path = typeIcon ?? (CATEGORY_PATHS[categorySlug ?? ""] ?? DEFAULT_ICON_PATH);
  const size = selected ? 46 : 38;
  return L.divIcon({
    html: makePinSvg(path, size, selected, typeCol?.color, typeCol?.dark),
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
const TYPE_COLOR: Record<string, string> = {
  workshop: "bg-orange-100 text-orange-700 border-0",
  course: "bg-amber-100 text-amber-700 border-0",
  class: "bg-indigo-100 text-indigo-700 border-0",
  event: "bg-emerald-100 text-emerald-700 border-0",
};

function MapClickOutside({ onClose }: { onClose: () => void }) {
  useMapEvents({ click: () => onClose() });
  return null;
}

function SyncCenter({ center }: { center: [number, number] }) {
  const map = useMap();
  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      return;
    }
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}


// ─── Main component ─────────────────────────────────────────────────────────
interface Props {
  workshops: Workshop[];
  venues?: Venue[];
  center?: [number, number];
  userLocation?: [number, number];
  zoom?: number;
  visible?: boolean;
}

export function WorkshopsMap({ workshops, venues = [], center = [-33.45, -70.65], userLocation, zoom = 12, visible }: Props) {
  const [selected, setSelected] = useState<Workshop | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [listOpen, setListOpen] = useState(true);
  const [listPage, setListPage] = useState(0);
  const PAGE_SIZE = 5;
  // Workshops that belong to a venue are represented by the venue marker —
  // don't render a duplicate marker on top of it.
  const mapped = workshops.filter((w) => w.lat != null && w.lng != null && !w.venue_id);
  const mappedVenues = venues.filter((v) => v.lat != null && v.lng != null);
  const mapRef = useRef<L.Map | null>(null);

  const totalPages = Math.ceil(workshops.length / PAGE_SIZE);
  const pageWorkshops = workshops.slice(listPage * PAGE_SIZE, (listPage + 1) * PAGE_SIZE);

  function focusWorkshop(w: Workshop) {
    if (w.lat != null && w.lng != null) {
      mapRef.current?.flyTo([w.lat, w.lng], 16, { duration: 0.8 });
    }
    setSelected(w);
  }

  const exitFullscreen = useCallback(() => setFullscreen(false), []);

  useEffect(() => {
    if (!fullscreen) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") exitFullscreen(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fullscreen, exitFullscreen]);

  useEffect(() => {
    document.body.style.overflow = fullscreen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [fullscreen]);

  // Al entrar en fullscreen: mobile oculta la lista, desktop la muestra
  useEffect(() => {
    if (!fullscreen) return;
    const isMobile = window.innerWidth < 768;
    setListOpen(!isMobile);
  }, [fullscreen]);

  useEffect(() => {
    if (visible) {
      // Leaflet no conoce el tamaño real si montó con display:none
      const t = setTimeout(() => mapRef.current?.invalidateSize(), 50);
      return () => clearTimeout(t);
    }
  }, [visible]);

  const mapContent = (
    <div className={fullscreen ? "relative w-full h-full" : "relative w-full h-[520px] rounded-xl overflow-hidden border shadow-sm"}>
      <MapContainer ref={mapRef} center={center} zoom={zoom} scrollWheelZoom zoomControl={false} attributionControl={false} className="h-full w-full" style={{ zIndex: 0 }}>
        <TileLayer
          subdomains="abcd"
          maxZoom={20}
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <SyncCenter center={center} />
        <MapClickOutside onClose={() => { setSelected(null); setSelectedVenue(null); }} />

        {userLocation && (
          <>
            <CircleMarker center={userLocation} radius={18} pathOptions={{ color: "transparent", fillColor: "#3b82f6", fillOpacity: 0.15 }} />
            <CircleMarker center={userLocation} radius={7} pathOptions={{ color: "#fff", weight: 2, fillColor: "#3b82f6", fillOpacity: 1 }} />
          </>
        )}

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
              icon={createCategoryIcon(w.category_slug, selected?.id === w.id, w.type)}
              eventHandlers={{
                click(e) {
                  e.originalEvent.stopPropagation();
                  setSelectedVenue(null);
                  setSelected(w);
                },
              }}
            />
          ))}
        </MarkerClusterGroup>

        {/* Venue markers (not clustered, distinct icon) */}
        {mappedVenues.map((v) => (
          <Marker
            key={v.id}
            position={[v.lat!, v.lng!]}
            icon={createVenueIcon(selectedVenue?.id === v.id)}
            eventHandlers={{
              click(e) {
                e.originalEvent.stopPropagation();
                setSelected(null);
                setSelectedVenue(v);
              },
            }}
          />
        ))}
      </MapContainer>

      {/* ── Mini list ── */}
      {!selected && !selectedVenue && workshops.length > 0 && (
        <div className={
          fullscreen
            ? "absolute z-[1000] bg-background/95 backdrop-blur-sm border shadow-lg overflow-hidden flex flex-col " +
              "bottom-0 left-0 right-0 rounded-t-xl md:rounded-none " +
              "md:bottom-auto md:top-0 md:left-0 md:w-72 md:h-full md:border-r md:border-y-0 md:border-l-0"
            : "absolute top-3 left-3 z-[1000] w-64 bg-background/95 backdrop-blur-sm border rounded-xl shadow-lg overflow-hidden flex flex-col"
        }>
          <div className="px-3 py-2 border-b flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {workshops.length} {workshops.length !== 1 ? "talleres" : "taller"}
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -mr-1 md:hidden"
              onClick={() => setListOpen((v) => !v)}
              title={listOpen ? "Ocultar lista" : "Mostrar lista"}
            >
              {listOpen
                ? <PanelLeftClose className="h-3.5 w-3.5" />
                : <PanelLeftOpen className="h-3.5 w-3.5" />
              }
            </Button>
          </div>
          {listOpen && <ul className={fullscreen ? "md:overflow-y-auto md:flex-1" : ""}>
            {pageWorkshops.map((w) => (
              <li key={w.id}>
                <button
                  onClick={() => focusWorkshop(w)}
                  className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-secondary/60 transition-colors group text-left"
                >
                  <div
                    className="mt-0.5 w-6 h-6 rounded-full shrink-0 flex items-center justify-center"
                    style={{ background: TYPE_COLORS[w.type]?.color ?? (w.lat != null ? C.accent : C.border) }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke={C.bg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      dangerouslySetInnerHTML={{ __html: TYPE_ICON_PATHS[w.type] ?? (CATEGORY_PATHS[w.category_slug ?? ""] ?? DEFAULT_ICON_PATH) }}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium leading-tight line-clamp-1 group-hover:text-foreground">{w.title}</p>
                    <p className={`text-xs mt-0.5 ${Number(w.price) === 0 ? "text-emerald-600 font-bold" : "text-muted-foreground"}`}>
                      {Number(w.price) === 0 ? "Gratuito - Aporte consciente" : `$${formatPrice(w.price)} ${w.currency}`}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>}
          {listOpen && totalPages > 1 && (
            <div className="px-3 py-2 border-t flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setListPage((p) => Math.max(0, p - 1))}
                disabled={listPage === 0}
                className="h-7 w-7"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                {listPage + 1} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setListPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={listPage === totalPages - 1}
                className="h-7 w-7"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Detail panel ── */}
      {selected && (
        <div className="absolute top-3 right-3 z-[1000] w-72 bg-background border rounded-xl shadow-lg p-4 space-y-3">
          {/* Type icon strip */}
          {(TYPE_ICON_PATHS[selected.type] || (selected.category_slug && CATEGORY_PATHS[selected.category_slug])) && (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: TYPE_COLORS[selected.type]?.color ?? C.accent }}
            >
              <svg
                width="16" height="16" viewBox="0 0 24 24"
                fill="none" stroke={C.bg} strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"
                dangerouslySetInnerHTML={{ __html: TYPE_ICON_PATHS[selected.type] ?? CATEGORY_PATHS[selected.category_slug!] }}
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
            <Badge className={`text-xs ${TYPE_COLOR[selected.type] ?? "bg-muted text-muted-foreground"}`}>{TYPE[selected.type]}</Badge>
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

            {Number(selected.price) > 0 ? (
              <span className={`text-sm font-bold text-emerald-600`}>
                {`$${formatPrice(selected.price)} ${selected.currency}`}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-medium text-emerald-700">
                Gratuito
              </span>
            )}
            <div className="flex items-center gap-1.5">
              {selected.maps_url && (
                <a
                  href={selected.maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium px-2.5 py-1.5 rounded-md border border-border bg-background hover:bg-secondary/60 transition-colors flex items-center gap-1"
                >
                  <MapPin className="h-3 w-3" />
                  Maps
                </a>
              )}
              <Link
                href={`/talleres/${selected.slug}`}
                className="text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Ver taller →
              </Link>
            </div>
          </div>

          {selected.instructor_name && (
            <p className="text-xs text-muted-foreground/70">por {selected.instructor_name}</p>
          )}
        </div>
      )}

      {/* ── Venue detail panel ── */}
      {selectedVenue && (
        <div className="absolute top-3 right-3 z-[1000] w-72 bg-background border rounded-xl shadow-lg p-4 space-y-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: C.accent }}
          >
            <Building2 className="h-4 w-4" style={{ color: C.bg }} />
          </div>

          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold leading-tight text-sm">{selectedVenue.name}</h3>
            <button onClick={() => setSelectedVenue(null)} className="text-muted-foreground hover:text-foreground shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>

          <Badge variant="outline" className="text-xs">Sede</Badge>

          {(selectedVenue.address || selectedVenue.city) && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              {[selectedVenue.address, selectedVenue.city].filter(Boolean).join(", ")}
            </p>
          )}

          {selectedVenue.description && (
            <p className="text-xs text-muted-foreground line-clamp-3">{selectedVenue.description}</p>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted-foreground">
              {selectedVenue.workshops_count ?? 0} taller{(selectedVenue.workshops_count ?? 0) !== 1 ? "es" : ""}
            </span>
            <Link
              href={`/sedes/${selectedVenue.slug}`}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Ver sede →
            </Link>
          </div>
        </div>
      )}

      {!fullscreen && (
        <button
          type="button"
          onClick={() => setFullscreen((v) => !v)}
          title={fullscreen ? "Salir de pantalla completa (Esc)" : "Ver en pantalla completa"}
          className="absolute bottom-3 right-3 z-[1000] flex items-center gap-1 rounded-md bg-background/90 backdrop-blur-sm border border-border px-2 py-1 text-xs text-foreground shadow-sm hover:text-muted-foreground transition-colors"
        >
          {fullscreen
            ? <><Minimize2 className="h-3.5 w-3.5" /><span className="hidden sm:inline">Salir</span></>
            : <><Maximize2 className="h-3.5 w-3.5" /><span className="hidden sm:inline">Ampliar</span></>
          }
        </button>
      )}
    </div>
  );

  if (fullscreen && typeof document !== "undefined") {
    return createPortal(
      <div className="fixed inset-0 z-[9999] bg-background flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-background/95 backdrop-blur-sm shrink-0">
          <span className="text-sm font-medium text-muted-foreground">
            {mapped.length} {mapped.length !== 1 ? "talleres" : "taller"} en el mapa
          </span>
          <button
            type="button"
            onClick={exitFullscreen}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:text-primary hover:accent/10  transition-colors"
          >
            <Minimize2 className="h-4 w-4" />
            Cerrar
            <kbd className="ml-1 hidden sm:inline-flex items-center rounded border border-border px-1 text-[10px] font-mono text-muted-foreground">Esc</kbd>
          </button>
        </div>
        <div className="flex-1 relative [&_.leaflet-container]:!h-full [&_.leaflet-container]:rounded-none">
          {mapContent}
        </div>
      </div>,
      document.body
    );
  }

  return mapContent;
}
