"use client";

import { use, useEffect, useState } from "react";
import { adminVenuesApi, type VenueProfile } from "@/lib/api";
import { SedeForm } from "../../SedeForm";

export default function EditarSedePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [venue, setVenue] = useState<VenueProfile | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    adminVenuesApi
      .get(id)
      .then(setVenue)
      .catch(() => setError(true));
  }, [id]);

  if (error) {
    return <p className="text-muted-foreground py-12 text-center">Sede no encontrada.</p>;
  }
  if (!venue) {
    return <div className="h-64 rounded-lg bg-secondary animate-pulse" />;
  }

  return <SedeForm venue={venue} />;
}
