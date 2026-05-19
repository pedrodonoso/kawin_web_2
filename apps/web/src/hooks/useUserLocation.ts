"use client";

import { useState, useEffect } from "react";

const DEFAULT_CENTER: [number, number] = [-33.45, -70.65];

interface UserLocation {
  coords: [number, number];
  isReal: boolean;
}

export function useUserLocation(): UserLocation {
  const [state, setState] = useState<UserLocation>({ coords: DEFAULT_CENTER, isReal: false });

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setState({ coords: [pos.coords.latitude, pos.coords.longitude], isReal: true }),
      () => {},
      { timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  return state;
}
