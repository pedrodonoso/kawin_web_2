"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2, LocateFixed, Link } from "lucide-react";
import { useUserLocation } from "@/hooks/useUserLocation";

const LocationPickerMap = dynamic(
  () => import("./LocationPickerMap").then((m) => m.LocationPickerMap),
  { ssr: false, loading: () => <div className="h-52 rounded-lg bg-secondary animate-pulse" /> }
);

const DEFAULT_LAT = -33.4489;
const DEFAULT_LNG = -70.6693;

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id: number;
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    state?: string;
    country?: string;
    postcode?: string;
    type?: string;
  };
}

interface Props {
  location: string;
  lat: string;
  lng: string;
  onLocationChange: (v: string) => void;
  onCoordsChange: (lat: string, lng: string) => void;
}

export function LocationPicker({ location, lat, lng, onLocationChange, onCoordsChange }: Props) {
  const [query, setQuery] = useState(location);
  const [suggestions, setSuggestions] = useState<PhotonFeature[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [open, setOpen] = useState(false);
  const [gmapsUrl, setGmapsUrl] = useState("");
  const [gmapsLoading, setGmapsLoading] = useState(false);
  const [gmapsError, setGmapsError] = useState("");
  const [showGmaps, setShowGmaps] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { coords: userLocation } = useUserLocation();
  const mapLat = lat !== "" ? Number(lat) : userLocation[0];
  const mapLng = lng !== "" ? Number(lng) : userLocation[1];
  const hasCoords = lat !== "" && lng !== "";

  // Sync external location → local query
  useEffect(() => { setQuery(location); }, [location]);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 3) { setSuggestions([]); setOpen(false); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/v1/search-location?q=${encodeURIComponent(q)}`);
      const data: { features: PhotonFeature[] } = await res.json();
      setSuggestions(data.features ?? []);
      setOpen((data.features ?? []).length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  }, []);

  function handleQueryChange(v: string) {
    setQuery(v);
    onLocationChange(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v), 400);
  }

  function photonLabel(f: PhotonFeature): string {
    const p = f.properties;
    const parts: string[] = [];
    if (p.name) parts.push(p.name);
    if (p.street) parts.push(p.housenumber ? `${p.street} ${p.housenumber}` : p.street);
    if (p.city) parts.push(p.city);
    if (p.state) parts.push(p.state);
    return parts.join(", ");
  }

  function selectSuggestion(f: PhotonFeature) {
    const [lon, lat] = f.geometry.coordinates;
    const label = photonLabel(f);
    setQuery(label);
    onLocationChange(label);
    onCoordsChange(String(lat), String(lon));
    setSuggestions([]);
    setOpen(false);
  }

  function handleMapDrag(newLat: number, newLng: number) {
    onCoordsChange(String(newLat), String(newLng));
  }

  async function resolveGmapsUrl() {
    if (!gmapsUrl.trim()) return;
    setGmapsLoading(true);
    setGmapsError("");
    try {
      const res = await fetch(
        `/api/v1/resolve-gmaps?url=${encodeURIComponent(gmapsUrl.trim())}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error desconocido");
      onCoordsChange(String(data.lat), String(data.lng));
      const label = data.location ?? data.name ?? null;
      if (label) {
        setQuery(label);
        onLocationChange(label);
      }
      setGmapsUrl("");
      setShowGmaps(false);
    } catch (e: unknown) {
      setGmapsError(e instanceof Error ? e.message : "No se pudo resolver el link");
    } finally {
      setGmapsLoading(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onCoordsChange(String(pos.coords.latitude), String(pos.coords.longitude));
        setLocating(false);
      },
      () => { setLocating(false); },
      { timeout: 10000, maximumAge: 60000 }
    );
  }

  // Close dropdown on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5" ref={containerRef}>
        <div className="flex items-center justify-between">
          <Label htmlFor="location">Ubicación</Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto py-0 px-1 text-xs text-muted-foreground hover:text-foreground gap-1"
              onClick={() => { setShowGmaps((v) => !v); setGmapsError(""); }}
            >
              <Link className="h-3 w-3" />
              Google Maps
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto py-0 px-1 text-xs text-muted-foreground hover:text-foreground gap-1"
              onClick={useMyLocation}
              disabled={locating}
            >
              {locating ? <Loader2 className="h-3 w-3 animate-spin" /> : <LocateFixed className="h-3 w-3" />}
              Usar mi ubicación
            </Button>
          </div>
        </div>

        {showGmaps && (
          <div className="flex gap-2">
            <Input
              placeholder="Pega el link de Google Maps..."
              value={gmapsUrl}
              onChange={(e) => { setGmapsUrl(e.target.value); setGmapsError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); resolveGmapsUrl(); } }}
              className="text-sm"
            />
            <Button
              type="button"
              size="sm"
              onClick={resolveGmapsUrl}
              disabled={gmapsLoading || !gmapsUrl.trim()}
            >
              {gmapsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
            </Button>
          </div>
        )}
        {gmapsError && (
          <p className="text-xs text-destructive">{gmapsError}</p>
        )}
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            id="location"
            placeholder="Busca una dirección o lugar..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            className="pl-9 pr-8"
            autoComplete="off"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}

          {open && suggestions.length > 0 && (
            <ul className="absolute z-[2000] mt-1 w-full bg-background border rounded-lg shadow-lg overflow-hidden">
              {suggestions.map((f) => {
                const p = f.properties;
                const address = [
                  p.street && p.housenumber ? `${p.street} ${p.housenumber}` : p.street,
                  p.city,
                  p.state,
                ].filter(Boolean).join(", ");
                return (
                  <li key={f.properties.osm_id}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent/50 transition-colors flex items-start gap-2"
                      onMouseDown={() => selectSuggestion(f)}
                    >
                      <MapPin className="h-3.5 w-3.5 shrink-0 mt-1 text-muted-foreground" />
                      <span className="flex flex-col">
                        {p.name && <span className="font-medium">{p.name}</span>}
                        <span className="text-xs text-muted-foreground line-clamp-1">{address}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {hasCoords && (
          <p className="text-xs text-muted-foreground/70">
            {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)} · Arrastra el marcador o haz clic en el mapa para ajustar
          </p>
        )}
        {!hasCoords && (
          <p className="text-xs text-muted-foreground/70">
            Busca una dirección para ubicar el taller en el mapa
          </p>
        )}
      </div>

      <LocationPickerMap lat={mapLat} lng={mapLng} onDrag={handleMapDrag} />
    </div>
  );
}
