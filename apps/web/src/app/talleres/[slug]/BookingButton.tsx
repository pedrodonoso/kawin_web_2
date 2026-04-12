"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

interface Props {
  workshopId: string;
  workshopType: string;
  capacity?: number | null;
  bookingsCount?: number;
  instructorId?: string;
}

/**
 * Sidebar booking button for non-class workshops (workshop, course, event).
 * For type=class, the per-session buttons in UpcomingSessionCard handle booking.
 */
export function BookingButton({ workshopId, workshopType, capacity, bookingsCount = 0, instructorId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [booked, setBooked] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [currentCount, setCurrentCount] = useState(bookingsCount);
  const [isInstructor, setIsInstructor] = useState(false);
  const isFull = capacity != null && currentCount >= capacity;

  useEffect(() => {
    const token = localStorage.getItem("token");

    // Check if current user is the instructor
    if (instructorId) {
      try {
        const user = JSON.parse(localStorage.getItem("user") ?? "{}");
        if (user?.id === instructorId) {
          setIsInstructor(true);
          setCheckingStatus(false);
          return;
        }
      } catch { /* ignore */ }
    }

    if (!token || workshopType === "class") {
      setCheckingStatus(false);
      return;
    }
    api
      .getList<{ workshop_id: string; status: string }>(`/api/v1/my-bookings?workshop_id=${workshopId}`)
      .then((bookings) => {
        const existing = bookings.find(
          (b) => b.workshop_id === workshopId && b.status === "confirmed"
        );
        if (existing) setBooked(true);
      })
      .catch(() => {})
      .finally(() => setCheckingStatus(false));
  }, [workshopId, workshopType, instructorId]);

  if (workshopType === "class") {
    return (
      <p className="text-sm text-zinc-500 text-center py-2">
        Elige una clase en el listado para reservar.
      </p>
    );
  }

  async function handleBook() {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    setLoading(true);
    try {
      await api.post("/api/v1/bookings", { workshop_id: workshopId });
      setBooked(true);
      setCurrentCount((c) => c + 1);
      toast.success("¡Reserva confirmada! Te contactaremos pronto.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al reservar");
    } finally {
      setLoading(false);
    }
  }

  if (checkingStatus) {
    return <Button className="w-full" size="lg" disabled>Cargando...</Button>;
  }

  if (isInstructor) {
    return (
      <Button className="w-full" size="lg" disabled variant="outline">
        Eres el organizador
      </Button>
    );
  }

  if (booked) {
    return (
      <div className="space-y-2">
        <Button className="w-full" size="lg" disabled variant="outline">
          ✓ Reserva confirmada
        </Button>
        <p className="text-xs text-zinc-400 text-center">
          Recibirás los detalles pronto.
        </p>
      </div>
    );
  }

  if (isFull) {
    return (
      <Button className="w-full" size="lg" disabled variant="outline">
        Sin cupos disponibles
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <Button className="w-full" size="lg" onClick={handleBook} disabled={loading}>
        {loading ? "Reservando..." : "Reservar cupo"}
      </Button>
      <p className="text-xs text-zinc-400 text-center">
        No se te cobrará hasta confirmar tu reserva
      </p>
    </div>
  );
}
