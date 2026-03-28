"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
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
  instructorId?: string;
  isInstructor?: boolean;
  /** Pre-computed by parent (UpcomingSessionsList). undefined = still loading. */
  alreadyBooked?: boolean;
}

/**
 * Returns "instructor" if today is on or after the Sunday that starts the week
 * containing sessionDate (i.e. the class is in the current or past week).
 * Returns "platform" if the class is in a future week.
 */
function getCommissionZone(sessionDateStr: string): "instructor" | "platform" {
  const sessionDate = new Date(`${sessionDateStr}T12:00:00`);
  const weekday = sessionDate.getDay(); // 0=Sun,1=Mon,...,6=Sat
  const daysFromMonday = (weekday + 6) % 7; // Mon→0, Tue→1, ..., Sun→6
  const cutoffMonday = new Date(sessionDate);
  cutoffMonday.setDate(sessionDate.getDate() - daysFromMonday);
  cutoffMonday.setHours(0, 0, 0, 0);
  return new Date() >= cutoffMonday ? "instructor" : "platform";
}

export function UpcomingSessionCard({ session, workshopId, instructorId, isInstructor: isInstructorProp = false, alreadyBooked: alreadyBookedProp }: Props) {
  const router = useRouter();
  const [booking, setBooking] = useState(false);
  const [alreadyBooked, setAlreadyBooked] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [isInstructor, setIsInstructor] = useState(isInstructorProp);

  // Sync alreadyBooked from parent when it resolves
  useEffect(() => {
    if (alreadyBookedProp !== undefined) setAlreadyBooked(alreadyBookedProp);
  }, [alreadyBookedProp]);

  useEffect(() => {
    if (isInstructorProp) { setIsInstructor(true); return; }
    if (!instructorId) return;
    try {
      const user = JSON.parse(localStorage.getItem("user") ?? "{}");
      setIsInstructor(user?.id === instructorId);
    } catch { /* ignore */ }
  }, [instructorId, isInstructorProp]);

  // checkingBooking: true while parent hasn't resolved yet (alreadyBookedProp === undefined)
  const checkingBooking = alreadyBookedProp === undefined;

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
      setAlreadyBooked(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al reservar";
      toast.error(msg);
      // If the schedule expired, reload the page to show updated sessions
      if (msg.includes("ya no está disponible")) {
        setTimeout(() => window.location.reload(), 2000);
      }
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
          {!isCancelled && (
            <p className="text-xs mt-1 text-zinc-400">
              {session.spots_remaining === null || session.spots_remaining === undefined
                ? "Cupos disponibles"
                : session.spots_remaining === 0
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
        {isAvailable && checkingBooking && (
          <Skeleton className="h-8 w-32 rounded-md" />
        )}
        {isAvailable && !checkingBooking && alreadyBooked && (
          <Badge className="bg-green-100 text-green-700 text-xs px-2 py-1">
            ✓ Reservado
          </Badge>
        )}
        {isAvailable && !checkingBooking && !alreadyBooked && (
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
