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
    <div className="flex items-center gap-2 text-zinc-500">
      <Globe className="h-4 w-4 shrink-0" />
      {booked && workshopOnlineUrl ? (
        <a
          href={workshopOnlineUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:underline truncate"
        >
          Acceder a la clase online
        </a>
      ) : (
        <span className="italic text-sm">Link disponible al confirmar reserva</span>
      )}
    </div>
  );
}
