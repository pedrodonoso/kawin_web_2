"use client";

import { useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { MapPin, X, Clock } from "lucide-react";
import { type Workshop } from "@/lib/api";

const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const selectedIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [31, 51],
  iconAnchor: [15, 51],
  popupAnchor: [1, -40],
  className: "selected-marker",
});

const MODALITY: Record<string, string> = {
  "in-person": "Presencial",
  online: "Online",
  hybrid: "Híbrido",
};

const TYPE: Record<string, string> = {
  workshop: "Taller",
  course: "Curso",
  class: "Clase",
  event: "Evento",
};

function MapClickOutside({ onClose }: { onClose: () => void }) {
  useMapEvents({ click: () => onClose() });
  return null;
}

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
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom
        className="h-full w-full"
        style={{ zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickOutside onClose={() => setSelected(null)} />

        {mapped.map((w) => (
          <Marker
            key={w.id}
            position={[w.lat!, w.lng!]}
            icon={selected?.id === w.id ? selectedIcon : defaultIcon}
            eventHandlers={{
              click: (e) => {
                e.originalEvent.stopPropagation();
                setSelected(w);
              },
            }}
          />
        ))}
      </MapContainer>

      {/* Sidebar panel */}
      {selected && (
        <div className="absolute top-3 right-3 z-[1000] w-72 bg-background border rounded-xl shadow-lg p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold leading-tight text-sm">{selected.title}</h3>
            <button
              onClick={() => setSelected(null)}
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
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

          {/* Schedules / sessions summary */}
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
              {selected.price === 0 ? "Gratis" : `$${Number(selected.price).toLocaleString("es-CL")} ${selected.currency}`}
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

      {/* Counter badge */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-background/90 backdrop-blur-sm border rounded-full px-3 py-1 text-xs text-muted-foreground">
        {mapped.length} {mapped.length !== 1 ? "talleres" : "taller"} en el mapa
      </div>
    </div>
  );
}
