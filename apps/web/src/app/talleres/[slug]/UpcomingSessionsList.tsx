"use client";

import { useState, useEffect } from "react";
import { api, type UpcomingSession } from "@/lib/api";
import { UpcomingSessionCard } from "./UpcomingSessionCard";

interface MyBooking {
  workshop_id: string;
  schedule_id: string;
  session_day: string;
  status: string;
}

interface Props {
  sessions: UpcomingSession[];
  workshopId: string;
  workshopSlug: string;
  instructorId?: string;
}

/**
 * Fetches my-bookings once for this workshop and passes the result
 * to each UpcomingSessionCard — avoids N individual API calls.
 */
export function UpcomingSessionsList({ sessions, workshopId, workshopSlug, instructorId }: Props) {
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
              (b) =>
                b.schedule_id === s.schedule_id &&
                b.session_day === s.date &&
                b.status === "confirmed"
            )
          : undefined; // undefined = still loading

        return (
          <UpcomingSessionCard
            key={`${s.schedule_id}-${s.date}`}
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
