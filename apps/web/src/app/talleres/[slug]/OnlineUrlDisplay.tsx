"use client";

import { useState, useEffect } from "react";
import { Globe } from "lucide-react";
import { api } from "@/lib/api";

interface Props {
  workshopId: string;
  workshopOnlineUrl?: string; // URL definida en "Modalidad y lugar"
}

/**
 * Muestra el link del taller (definido en "Modalidad y lugar") solo si el usuario
 * tiene una reserva confirmada. No usa el URL de sesiones individuales.
 */
export function OnlineUrlDisplay({ workshopId, workshopOnlineUrl }: Props) {
  const [booked, setBooked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token || !workshopOnlineUrl) return;

    api
      .getList<{ workshop_id: string; status: string }>(
        `/api/v1/my-bookings?workshop_id=${workshopId}`
      )
      .then((bookings) => {
        const confirmed = bookings.find(
          (b) => b.workshop_id === workshopId && b.status === "confirmed"
        );
        if (confirmed) setBooked(true);
      })
      .catch(() => {});
  }, [workshopId, workshopOnlineUrl]);

  return (
    <div className="flex items-center gap-2">
      {booked && workshopOnlineUrl ? (
        <a
          href={workshopOnlineUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md
            bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
        >
          <Globe className="h-3.5 w-3.5" />
          Unirse a la clase online
        </a>
      ) : (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Globe className="h-4 w-4 shrink-0" />
          <span className="italic text-sm">Link disponible al confirmar reserva</span>
        </div>
      )}
    </div>
  );
}
