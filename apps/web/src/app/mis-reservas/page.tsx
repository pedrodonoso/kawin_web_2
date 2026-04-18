"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Clock, ArrowLeft, X } from "lucide-react";
import { api } from "@/lib/api";

interface MyBooking {
  id: string;
  workshop_id: string;
  workshop_title: string;
  workshop_slug: string;
  session_id?: string;
  status: string;
  payment_status: string;
  amount: number;
  session_date?: string;
  created_at: string;
}

function statusBadge(status: string) {
  switch (status) {
    case "confirmed":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Confirmada</Badge>;
    case "pending":
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pendiente</Badge>;
    case "cancelled":
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Cancelada</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatDate(iso: string) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("es-CL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatTime(iso: string) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

export default function MisReservasPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) {
      router.push("/login");
      return;
    }
    api
      .get<{ data: MyBooking[] }>("/api/v1/my-bookings")
      .then((res) => setBookings(res.data ?? []))
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  }, [router]);

  function handleCancelled(bookingId: string) {
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status: "cancelled" } : b))
    );
  }

  const upcoming = bookings.filter(
    (b) => b.status !== "cancelled" && b.session_date && new Date(b.session_date) >= new Date()
  );
  const past = bookings.filter(
    (b) => b.status === "cancelled" || !b.session_date || new Date(b.session_date) < new Date()
  );

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Inicio
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Mis reservas</h1>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <Calendar className="h-12 w-12 text-zinc-300 mx-auto" />
            <div>
              <p className="font-semibold text-zinc-600">Sin reservas aún</p>
              <p className="text-sm text-zinc-400 mt-1">
                Explora talleres y reserva tu primera clase
              </p>
            </div>
            <Button asChild>
              <Link href="/buscar">Explorar talleres</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Upcoming */}
            {upcoming.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-base font-semibold text-zinc-700">Próximas</h2>
                {upcoming.map((b) => (
                  <BookingCard key={b.id} booking={b} onCancelled={handleCancelled} />
                ))}
              </section>
            )}

            {/* Past / cancelled */}
            {past.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-base font-semibold text-zinc-400">Historial</h2>
                {past.map((b) => (
                  <BookingCard key={b.id} booking={b} muted />
                ))}
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function BookingCard({
  booking: b,
  muted = false,
  onCancelled,
}: {
  booking: MyBooking;
  muted?: boolean;
  onCancelled?: (id: string) => void;
}) {
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateStr = formatDate(b.session_date ?? b.created_at);
  const timeStr = formatTime(b.session_date ?? "");
  const canCancel = b.status === "confirmed" || b.status === "pending";

  async function handleCancel() {
    if (!confirm(`¿Cancelar tu reserva en "${b.workshop_title}"?`)) return;
    setCancelling(true);
    setError(null);
    try {
      await api.post(`/api/v1/bookings/${b.id}/cancel`, {});
      onCancelled?.(b.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cancelar");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div
      className={`bg-white border rounded-lg p-4 space-y-2 ${muted ? "opacity-70" : ""}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <Link
            href={`/talleres/${b.workshop_slug}`}
            className="font-semibold text-zinc-900 hover:underline truncate block"
          >
            {b.workshop_title}
          </Link>
          {dateStr && (
            <div className="flex items-center gap-1 text-sm text-zinc-500">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span className="capitalize">{dateStr}</span>
              {timeStr && (
                <>
                  <Clock className="h-3.5 w-3.5 shrink-0 ml-1" />
                  <span>{timeStr}</span>
                </>
              )}
            </div>
          )}
          <p className="text-sm font-medium text-zinc-700">
            ${b.amount.toLocaleString("es-CL")}
            <span className="text-xs text-zinc-400 ml-1 font-normal">CLP</span>
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-2">
          {statusBadge(b.status)}
          {canCancel && onCancelled && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2"
              onClick={handleCancel}
              disabled={cancelling}
            >
              <X className="h-3 w-3 mr-1" />
              {cancelling ? "Cancelando..." : "Cancelar"}
            </Button>
          )}
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
