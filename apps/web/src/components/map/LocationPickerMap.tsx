"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { FullscreenMapWrapper } from "./FullscreenMapWrapper";

const pinHtml = `
<div style="display:flex;flex-direction:column;align-items:center;width:40px;">
  <img src="/brand/kwin-favicon-light-64.png" style="width:36px;height:36px;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,0.4);" />
  <div style="
    width:0;height:0;
    border-left:9px solid transparent;
    border-right:9px solid transparent;
    border-top:13px solid #b54a2c;
    margin-top:-1px;
    filter:drop-shadow(0 2px 2px rgba(0,0,0,0.3));
  "></div>
</div>`;

const icon = L.divIcon({
  html: pinHtml,
  className: "",
  iconSize: [44, 58],
  iconAnchor: [22, 58],
});

function MapController({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const prev = useRef<[number, number] | null>(null);
  useEffect(() => {
    if (prev.current?.[0] !== lat || prev.current?.[1] !== lng) {
      map.setView([lat, lng], map.getZoom() < 13 ? 15 : map.getZoom());
      prev.current = [lat, lng];
    }
  }, [lat, lng, map]);
  return null;
}

function DraggableMarker({
  lat,
  lng,
  onDrag,
}: {
  lat: number;
  lng: number;
  onDrag: (lat: number, lng: number) => void;
}) {
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    markerRef.current?.setLatLng([lat, lng]);
  }, [lat, lng]);

  useMapEvents({
    click(e) {
      onDrag(e.latlng.lat, e.latlng.lng);
    },
  });

  return (
    <Marker
      position={[lat, lng]}
      icon={icon}
      draggable
      ref={markerRef}
      eventHandlers={{
        dragend() {
          const pos = markerRef.current?.getLatLng();
          if (pos) onDrag(pos.lat, pos.lng);
        },
      }}
    />
  );
}

interface Props {
  lat: number;
  lng: number;
  onDrag: (lat: number, lng: number) => void;
}

export function LocationPickerMap({ lat, lng, onDrag }: Props) {
  return (
    <FullscreenMapWrapper className="h-52 w-full rounded-lg overflow-hidden" lat={lat} lng={lng} showGoogleMaps={false}>
      {(fullscreen) => (
        <MapContainer
          center={[lat, lng]}
          zoom={15}
          scrollWheelZoom={fullscreen}
          attributionControl={false}
          className="h-full w-full z-0"
          style={{ zIndex: 0 }}
        >
          <TileLayer
            subdomains="abcd"
            maxZoom={20}
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <DraggableMarker lat={lat} lng={lng} onDrag={onDrag} />
          <MapController lat={lat} lng={lng} />
        </MapContainer>
      )}
    </FullscreenMapWrapper>
  );
}
