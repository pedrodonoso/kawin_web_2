"use client";

import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Globe } from "lucide-react";
import { type Session } from "@/lib/api";

import dynamic from 'next/dynamic'

const SessionTime = dynamic(
  () => import('../../../components/ui/session-time').then(mod => mod.SessionTime), {
  ssr: false,
  loading: () => <p>Loading...</p>,
})

function formatSessionDate(isoStr: string) {
  return new Date(isoStr).toLocaleDateString("es-CL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

interface Props {
  session: Session;
  workshopId: string;
  instructorId?: string;
  alreadyBooked?: boolean;
}

export function UpcomingSessionCard({ session }: Props) {
  const isCancelled = !!session.cancelled;
  const spotsRemaining = session.spots_remaining;
  const dateLabel = formatSessionDate(session.starts_at);

  return (
    <div
      className={`flex items-start justify-between gap-3 p-4 border rounded-lg bg-card ${
        isCancelled ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <Calendar className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
        <div>
          <p className={`font-medium capitalize ${isCancelled ? "line-through text-muted-foreground" : ""}`}>
            {dateLabel}
          </p>
          <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
            <Clock className="h-3 w-3" />
            <SessionTime isoStrStart={session.starts_at} isoStrEnd={session.ends_at} />
          </div>
          {session.notes && (
            <p className="text-xs text-muted-foreground/70 mt-1">{session.notes}</p>
          )}
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-2">
        {isCancelled && (
          <Badge variant="secondary" className="text-xs text-muted-foreground line-through">
            Cancelada
          </Badge>
        )}
        {!isCancelled && session.online_url && (
          <a
            href={session.online_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md
              bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
          >
            <Globe className="h-3 w-3" />
            Unirse a la clase
          </a>
        )}
      </div>
    </div>
  );
}
