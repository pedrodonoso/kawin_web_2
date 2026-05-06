"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2, LocateFixed } from "lucide-react";

const LocationPickerMap = dynamic(
  () => import("./LocationPickerMap").then((m) => m.LocationPickerMap),
  { ssr: false, loading: () => <div className="h-52 rounded-lg bg-secondary animate-pulse" /> }
);

const DEFAULT_LAT = -33.4489;
const DEFAULT_LNG = -70.6693;

interface Suggestion {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
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
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const mapLat = lat !== "" ? Number(lat) : DEFAULT_LAT;
  const mapLng = lng !== "" ? Number(lng) : DEFAULT_LNG;
  const hasCoords = lat !== "" && lng !== "";

  // Sync external location → local query
  useEffect(() => { setQuery(location); }, [location]);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 3) { setSuggestions([]); setOpen(false); return; }
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`,
        { headers: { "Accept-Language": "es" } }
      );
      const data: Suggestion[] = await res.json();
      setSuggestions(data);
      setOpen(data.length > 0);
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

  function selectSuggestion(s: Suggestion) {
    const shortName = s.display_name.split(",").slice(0, 3).join(",").trim();
    setQuery(shortName);
    onLocationChange(shortName);
    onCoordsChange(s.lat, s.lon);
    setSuggestions([]);
    setOpen(false);
  }

  function handleMapDrag(newLat: number, newLng: number) {
    onCoordsChange(String(newLat), String(newLng));
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
              {suggestions.map((s) => (
                <li key={s.place_id}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent/50 transition-colors flex items-start gap-2"
                    onMouseDown={() => selectSuggestion(s)}
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                    <span className="line-clamp-2">{s.display_name}</span>
                  </button>
                </li>
              ))}
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
