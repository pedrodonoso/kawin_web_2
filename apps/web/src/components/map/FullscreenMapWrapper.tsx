"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2, ExternalLink } from "lucide-react";

interface Props {
  children: (fullscreen: boolean) => React.ReactNode;
  className?: string;
  lat?: number;
  lng?: number;
  mapsUrl?: string;
  showGoogleMaps?: boolean;
}

export function FullscreenMapWrapper({ children, className = "", lat, lng, mapsUrl, showGoogleMaps = true }: Props) {
  const googleMapsUrl = !showGoogleMaps
    ? null
    : mapsUrl
      ? mapsUrl
      : lat != null && lng != null
        ? `https://www.google.com/maps?q=${lat},${lng}`
        : null;
  const [fullscreen, setFullscreen] = useState(false);

  const exit = useCallback(() => setFullscreen(false), []);

  // Escape key closes fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") exit();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fullscreen, exit]);

  // Prevent body scroll while fullscreen
  useEffect(() => {
    document.body.style.overflow = fullscreen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [fullscreen]);

  const toggle = () => setFullscreen((v) => !v);

  return (
    <>
      {/* Normal (inline) view */}
      <div className={`relative ${className}`}>
        {children(false)}
        <div className="absolute bottom-2 right-2 z-[400] flex items-center gap-1">
          {googleMapsUrl && (
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir en Google Maps"
              className="flex items-center gap-1 rounded-md bg-background/90 backdrop-blur-sm border border-border px-2 py-1 text-xs text-muted-foreground shadow-sm hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Google Maps</span>
            </a>
          )}
          <button
            type="button"
            onClick={toggle}
            title="Ver en pantalla completa"
            className="flex items-center gap-1 rounded-md bg-background/90 backdrop-blur-sm border border-border px-2 py-1 text-xs text-muted-foreground shadow-sm hover:text-foreground transition-colors"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Ampliar</span>
          </button>
        </div>
      </div>

      {/* Fullscreen overlay — rendered via portal to escape any stacking context */}
      {fullscreen && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-background flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b bg-background/95 backdrop-blur-sm shrink-0">
              <span className="text-sm font-medium text-muted-foreground">Mapa</span>
              <div className="flex items-center gap-2">
              {googleMapsUrl && (
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  Google Maps
                </a>
              )}
              <button
                type="button"
                onClick={exit}
                title="Cerrar (Esc)"
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Minimize2 className="h-4 w-4" />
                Cerrar
                <kbd className="ml-1 hidden sm:inline-flex items-center rounded border border-border px-1 text-[10px] font-mono text-muted-foreground">Esc</kbd>
              </button>
              </div>
            </div>

            {/* Map fills remaining space */}
            <div className="flex-1 relative [&_.leaflet-container]:!h-full [&_.leaflet-container]:rounded-none">
              {children(true)}
            </div>
          </div>,
          document.body
        )
      }
    </>
  );
}
