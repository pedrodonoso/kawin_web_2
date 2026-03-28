"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock } from "lucide-react";
import { api, type UpcomingSession } from "@/lib/api";

/** Formats a "YYYY-MM-DD" string into "Lun 7 abr" */
function formatSessionDate(dateStr: string) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("es-CL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Adds duration_min minutes to "HH:MM" and returns "HH:MM" */
function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

interface Props {
  session: UpcomingSession;
  workshopId: string;
  /** The workshop's instructor_id — compared to localStorage user.id to show the cancel button */
  instructorId?: string;
  isInstructor?: boolean;
}

/**
 * Returns "instructor" if today is on or after the Sunday that starts the week
 * containing sessionDate (i.e. the class is in the current or past week).
 * Returns "platform" if the class is in a future week.
 */
function getCommissionZone(sessionDateStr: string): "instructor" | "platform" {
  const sessionDate = new Date(`${sessionDateStr}T12:00:00`);
  const weekday = sessionDate.getDay(); // 0 = Sun
  const cutoffSunday = new Date(sessionDate);
  cutoffSunday.setDate(sessionDate.getDate() - weekday);
  cutoffSunday.setHours(0, 0, 0, 0);
  return new Date() >= cutoffSunday ? "instructor" : "platform";
}

export function UpcomingSessionCard({ session, workshopId, instructorId, isInstructor: isInstructorProp = false }: Props) {
  const router = useRouter();
  const [booking, setBooking] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Determine if the current user is the instructor
  const isInstructor = isInstructorProp || (() => {
    if (typeof window === "undefined" || !instructorId) return false;
    try {
      const user = JSON.parse(localStorage.getItem("user") ?? "{}");
      return user?.id === instructorId;
    } catch { return false; }
  })();

  const isCancelled = session.status === "cancelled";
  const isFull = session.status === "full";
  const isAvailable = session.status === "available";
  const endTime = addMinutes(session.time, session.duration_min);

  async function handleBook() {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.push("/login");
      return;
    }
    setBooking(true);
    try {
      await api.post("/api/v1/bookings", {
        workshop_id: workshopId,
        schedule_id: session.schedule_id,
        date: session.date,
      });
      toast.success("¡Reserva confirmada!");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al reservar");
    } finally {
      setBooking(false);
    }
  }

  async function handleCancel() {
    const zone = getCommissionZone(session.date);
    const dateLabel = formatSessionDate(session.date);
    const message =
      zone === "instructor"
        ? `¿Cancelar la clase del ${dateLabel}? La comisión será descontada de tu próximo pago.`
        : `¿Cancelar la clase del ${dateLabel}? No se aplicará cargo.`;

    if (!window.confirm(message)) return;

    setCancelling(true);
    try {
      await api.post("/api/v1/sessions/cancel", {
        schedule_id: session.schedule_id,
        date: session.date,
      });
      toast.success("Clase cancelada");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cancelar");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div
      className={`flex items-start justify-between gap-3 p-4 border rounded-lg bg-white ${
        isCancelled ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <Calendar className="h-5 w-5 text-zinc-400 shrink-0 mt-0.5" />
        <div>
          <p className={`font-medium capitalize ${isCancelled ? "line-through text-zinc-400" : ""}`}>
            {formatSessionDate(session.date)}
          </p>
          <p className="text-sm text-zinc-500 flex items-center gap-1 mt-0.5">
            <Clock className="h-3 w-3" />
            {session.time} – {endTime}
            <span className="text-zinc-400">({session.duration_min} min)</span>
          </p>
          {session.spots_remaining !== undefined && !isCancelled && (
            <p className="text-xs mt-1 text-zinc-400">
              {session.spots_remaining === 0
                ? "Sin cupos"
                : `${session.spots_remaining} cupo${session.spots_remaining !== 1 ? "s" : ""} disponible${session.spots_remaining !== 1 ? "s" : ""}`}
            </p>
          )}
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {isCancelled && (
          <Badge variant="secondary" className="text-xs text-zinc-400 line-through">
            Cancelada
          </Badge>
        )}
        {isFull && !isCancelled && (
          <Badge variant="secondary" className="text-xs text-zinc-500">
            Sin cupos
          </Badge>
        )}
        {isAvailable && (
          <Button size="sm" onClick={handleBook} disabled={booking || cancelling}>
            {booking ? "Reservando..." : "Reservar esta clase"}
          </Button>
        )}
        {isAvailable && isInstructor && (
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50"
            onClick={handleCancel}
            disabled={cancelling || booking}
          >
            {cancelling ? "Cancelando..." : "Cancelar esta clase"}
          </Button>
        )}
      </div>
    </div>
  );
}
