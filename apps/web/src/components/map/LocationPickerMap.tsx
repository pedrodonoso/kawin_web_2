"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
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
    <MapContainer
      center={[lat, lng]}
      zoom={15}
      scrollWheelZoom={false}
      className="h-52 w-full rounded-lg z-0"
      style={{ zIndex: 0 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <DraggableMarker lat={lat} lng={lng} onDrag={onDrag} />
      <MapController lat={lat} lng={lng} />
    </MapContainer>
  );
}
