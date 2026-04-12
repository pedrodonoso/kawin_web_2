"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type Session } from "@/lib/api";

import dynamic from 'next/dynamic'

const SessionTime = dynamic(
  () => import('../../../components/ui/session-time').then(mod => mod.SessionTime), {
  ssr: false,
  loading: () => <p>Loading...</p>,
})

/** Formatea "2026-04-21T19:00:00Z" → "Lun 21 abr" */
function formatSessionDate(isoStr: string) {
  return new Date(isoStr).toLocaleDateString("es-CL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/**
 * Determina la zona de comisión según el lunes de la semana de la sesión.
 * "instructor" si la semana ya comenzó (no penalizamos en la UI, solo informamos).
 */
function getCommissionZone(isoStr: string): "instructor" | "platform" {
  const sessionDate = new Date(isoStr);
  const weekday = sessionDate.getDay();
  const daysFromMonday = (weekday + 6) % 7;
  const cutoffMonday = new Date(sessionDate);
  cutoffMonday.setDate(sessionDate.getDate() - daysFromMonday);
  cutoffMonday.setHours(0, 0, 0, 0);
  return new Date() >= cutoffMonday ? "instructor" : "platform";
}

interface Props {
  session: Session;
  workshopId: string;
  instructorId?: string;
  /** Pre-calculado por el padre (UpcomingSessionsList). undefined = cargando. */
  alreadyBooked?: boolean;
}

export function UpcomingSessionCard({ session, workshopId, instructorId, alreadyBooked: alreadyBookedProp }: Props) {
  const router = useRouter();
  const [booking, setBooking] = useState(false);
  const [alreadyBooked, setAlreadyBooked] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [isInstructor, setIsInstructor] = useState(false);

  useEffect(() => {
    if (alreadyBookedProp !== undefined) setAlreadyBooked(alreadyBookedProp);
  }, [alreadyBookedProp]);

  useEffect(() => {
    if (!instructorId) return;
    try {
      const user = JSON.parse(localStorage.getItem("user") ?? "{}");
      setIsInstructor(user?.id === instructorId);
    } catch { /* ignore */ }
  }, [instructorId]);

  const checkingBooking = alreadyBookedProp === undefined;
  const isCancelled = !!session.cancelled;

  // Derivar estado de la sesión
  const spotsRemaining = session.spots_remaining;
  const isFull = spotsRemaining !== undefined && spotsRemaining <= 0;
  const isAvailable = !isCancelled && !isFull;

  const dateLabel = formatSessionDate(session.starts_at);

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
        session_id: session.id,
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
    const zone = getCommissionZone(session.starts_at);
    const message =
      zone === "instructor"
        ? `¿Cancelar la clase del ${dateLabel}? La comisión será descontada de tu próximo pago.`
        : `¿Cancelar la clase del ${dateLabel}? No se aplicará cargo.`;

    if (!window.confirm(message)) return;

    setCancelling(true);
    try {
      await api.post("/api/v1/sessions/cancel", {
        session_id: session.id,
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
            {dateLabel}
          </p>
          <div className="text-sm text-zinc-500 flex items-center gap-1 mt-0.5">
            <Clock className="h-3 w-3" />
            <SessionTime isoStrStart={session.starts_at} isoStrEnd={session.ends_at}/>
          </div>
          {!isCancelled && (
            <p className="text-xs mt-1 text-zinc-400">
              {spotsRemaining === undefined
                ? "Cupos disponibles"
                : spotsRemaining === 0
                ? "Sin cupos"
                : `${spotsRemaining} cupo${spotsRemaining !== 1 ? "s" : ""} disponible${spotsRemaining !== 1 ? "s" : ""}`}
            </p>
          )}
          {session.notes && (
            <p className="text-xs text-zinc-400 mt-1">{session.notes}</p>
          )}
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-2">
        {isCancelled && (
          <Badge variant="secondary" className="text-xs text-zinc-400 line-through">
            Cancelada
          </Badge>
        )}

        {/* "Reservado" tiene prioridad sobre "Sin cupos": si el usuario ya reservó se muestra
            aunque los cupos estén agotados por sus compañeros. */}
        {!isCancelled && checkingBooking && (
          <Skeleton className="h-8 w-32 rounded-md" />
        )}
        {!isCancelled && !checkingBooking && alreadyBooked && (
          <Badge className="bg-green-100 text-green-700 text-xs px-2 py-1">
            ✓ Reservado
          </Badge>
        )}
        {!isCancelled && !checkingBooking && !alreadyBooked && isFull && (
          <Badge variant="secondary" className="text-xs text-zinc-500">
            Sin cupos
          </Badge>
        )}
        {isAvailable && !checkingBooking && !alreadyBooked && !isInstructor && (
          <Button size="sm" onClick={handleBook} disabled={booking || cancelling}>
            {booking ? "Reservando..." : "Reservar esta clase"}
          </Button>
        )}
        {isAvailable && isInstructor && (
          session.booking_count && session.booking_count > 0 ? (
            <Badge variant="secondary" className="text-xs text-zinc-500">
              {session.booking_count} reserva{session.booking_count !== 1 ? "s" : ""}
            </Badge>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={handleCancel}
              disabled={cancelling || booking}
            >
              {cancelling ? "Cancelando..." : "Cancelar esta clase"}
            </Button>
          )
        )}
      </div>
    </div>
  );
}
