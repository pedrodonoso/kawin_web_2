"use client";

import { type Session } from "@/lib/api";
import { UpcomingSessionCard } from "./UpcomingSessionCard";

interface Props {
  sessions: Session[];
  workshopId: string;
  workshopSlug: string;
  instructorId?: string;
}

export function UpcomingSessionsList({ sessions, workshopId, instructorId }: Props) {
  return (
    <div className="space-y-3">
      {sessions.map((s) => (
        <UpcomingSessionCard
          key={s.id}
          session={s}
          workshopId={workshopId}
          instructorId={instructorId}
          alreadyBooked={false}
        />
      ))}
    </div>
  );
}
