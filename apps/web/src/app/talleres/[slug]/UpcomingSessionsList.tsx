"use client";

import { useState, useEffect } from "react";
import { api, type Session } from "@/lib/api";
import { UpcomingSessionCard } from "./UpcomingSessionCard";

interface MyBooking {
  session_id?: string;
  status: string;
}

interface Props {
  sessions: Session[];
  workshopId: string;
  workshopSlug: string;
  instructorId?: string;
}

/**
 * Carga las reservas del usuario para este taller una sola vez
 * y distribuye el resultado a cada UpcomingSessionCard.
 */
export function UpcomingSessionsList({ sessions, workshopId, instructorId }: Props) {
  const [myBookings, setMyBookings] = useState<MyBooking[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { setLoaded(true); return; }

    api
      .getList<MyBooking>(`/api/v1/my-bookings?workshop_id=${workshopId}`)
      .then(setMyBookings)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [workshopId]);

  return (
    <div className="space-y-3">
      {sessions.map((s) => {
        const alreadyBooked = loaded
          ? myBookings.some(
              (b) => b.session_id === s.id && b.status === "confirmed"
            )
          : undefined; // undefined = cargando

        return (
          <UpcomingSessionCard
            key={s.id}
            session={s}
            workshopId={workshopId}
            instructorId={instructorId}
            alreadyBooked={alreadyBooked}
          />
        );
      })}
    </div>
  );
}
