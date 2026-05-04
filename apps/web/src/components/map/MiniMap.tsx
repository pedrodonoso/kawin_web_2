"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const C = { accent: "#b54a2c", bg: "#f4efe6", primary: "#1a1916" };
const PIN_SIZE = 38;
const iconPath = `
  <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0
    C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
  <circle cx="12" cy="10" r="3"/>`;
const iconSize = PIN_SIZE * 0.42;
const cx = PIN_SIZE / 2 - iconSize / 2;
const cy = PIN_SIZE / 2 - 4 - iconSize / 2;
const pinSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${PIN_SIZE}" height="${PIN_SIZE + 8}" viewBox="0 0 ${PIN_SIZE} ${PIN_SIZE + 8}">
    <ellipse cx="${PIN_SIZE / 2}" cy="${PIN_SIZE + 5}" rx="${PIN_SIZE * 0.3}" ry="3" fill="${C.primary}" opacity="0.18"/>
    <circle cx="${PIN_SIZE / 2}" cy="${PIN_SIZE / 2 - 4}" r="${PIN_SIZE / 2 - 1}" fill="${C.accent}"/>
    <polygon points="${PIN_SIZE / 2 - 5},${PIN_SIZE - 9} ${PIN_SIZE / 2 + 5},${PIN_SIZE - 9} ${PIN_SIZE / 2},${PIN_SIZE + 2}" fill="${C.accent}"/>
    <svg x="${cx}" y="${cy}" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24"
         fill="none" stroke="${C.bg}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      ${iconPath}
    </svg>
  </svg>`;
const icon = L.divIcon({
  html: pinSvg,
  className: "",
  iconSize: [PIN_SIZE, PIN_SIZE + 8],
  iconAnchor: [PIN_SIZE / 2, PIN_SIZE + 8],
  popupAnchor: [0, -(PIN_SIZE + 8)],
});

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => { map.setView([lat, lng]); }, [lat, lng, map]);
  return null;
}

interface Props {
  lat: number;
  lng: number;
  label?: string;
}

export function MiniMap({ lat, lng, label }: Props) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={15}
      scrollWheelZoom={false}
      attributionControl={false}
      className="h-48 w-full rounded-lg z-0"
      style={{ zIndex: 0 }}
    >
      <TileLayer
        subdomains="abcd"
        maxZoom={20}
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <Marker position={[lat, lng]} icon={icon}>
        {label && <Popup>{label}</Popup>}
      </Marker>
      <Recenter lat={lat} lng={lng} />
    </MapContainer>
  );
}
