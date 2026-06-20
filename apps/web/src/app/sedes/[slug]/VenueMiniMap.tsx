"use client";

import dynamic from "next/dynamic";

const MiniMap = dynamic(
  () => import("@/components/map/MiniMap").then((m) => m.MiniMap),
  { ssr: false }
);

interface Props {
  lat: number;
  lng: number;
  label?: string;
}

export function VenueMiniMap({ lat, lng, label }: Props) {
  return <MiniMap lat={lat} lng={lng} label={label} />;
}
