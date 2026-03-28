"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

interface Props {
  workshopId: string;
  workshopType: string;
}

/**
 * Sidebar booking button for non-class workshops (workshop, course, event).
 * For type=class, the per-session buttons in UpcomingSessionCard handle booking.
 */
export function BookingButton({ workshopId, workshopType }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [booked, setBooked] = useState(false);

  if (workshopType === "class") {
    return (
      <p className="text-sm text-zinc-500 text-center py-2">
        Elige una clase en el listado para reservar.
      </p>
    );
  }

  async function handleBook() {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.push("/login");
      return;
    }
    setLoading(true);
    try {
      await api.post("/api/v1/bookings", { workshop_id: workshopId });
      setBooked(true);
      toast.success("¡Reserva confirmada! Te contactaremos pronto.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al reservar");
    } finally {
      setLoading(false);
    }
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
