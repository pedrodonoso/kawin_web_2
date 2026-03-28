"use client";

import { useState, useEffect } from "react";
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
  const [alreadyBooked, setAlreadyBooked] = useState(false);
  const [checkingBooking, setCheckingBooking] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [isInstructor, setIsInstructor] = useState(isInstructorProp);

  useEffect(() => {
    // Check instructor status
    if (isInstructorProp) { setIsInstructor(true); }
    else if (instructorId) {
      try {
        const user = JSON.parse(localStorage.getItem("user") ?? "{}");
        setIsInstructor(user?.id === instructorId);
      } catch { /* ignore */ }
    }

    // Check if user already has a confirmed booking for this session
    const token = localStorage.getItem("token");
    if (!token) { setCheckingBooking(false); return; }

    api
      .getList<{ workshop_id: string; schedule_id: string; session_day: string; status: string }>(
        "/api/v1/my-bookings"
      )
      .then((bookings) => {
        const found = bookings.some(
          (b) =>
            b.workshop_id === workshopId &&
            b.schedule_id === session.schedule_id &&
            b.session_day === session.date &&
            b.status === "confirmed"
        );
        setAlreadyBooked(found);
      })
      .catch(() => {})
      .finally(() => setCheckingBooking(false));
  }, [workshopId, session.schedule_id, session.date, instructorId, isInstructorProp]);

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
        {isAvailable && checkingBooking && (
          <Button size="sm" disabled variant="outline">...</Button>
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
