"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Search } from "lucide-react";
import { api } from "@/lib/api";

interface InstructorBooking {
  booking_id: string;
  workshop_id: string;
  workshop_title: string;
  student_name: string;
  session_date: string;
  status: string;
  payment_status: string;
  amount: number;
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
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-CL", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function ReservasPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<InstructorBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) {
      router.push("/login");
      return;
    }
    api
      .get<{ data: InstructorBooking[] }>("/api/v1/instructor-bookings")
      .then((res) => setBookings(res.data ?? []))
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  }, [router]);

  const filtered = bookings.filter((b) => {
    const matchStatus = statusFilter === "all" || b.status === statusFilter;
    const matchSearch =
      search === "" ||
      b.student_name.toLowerCase().includes(search.toLowerCase()) ||
      b.workshop_title.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const totals = {
    confirmed: bookings.filter((b) => b.status === "confirmed").length,
    pending: bookings.filter((b) => b.status === "pending").length,
    cancelled: bookings.filter((b) => b.status === "cancelled").length,
    revenue: bookings
      .filter((b) => b.status === "confirmed")
      .reduce((acc, b) => acc + b.amount, 0),
  };

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Volver
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Reservas</h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Confirmadas", value: totals.confirmed, color: "text-green-700" },
            { label: "Pendientes", value: totals.pending, color: "text-yellow-700" },
            { label: "Canceladas", value: totals.cancelled, color: "text-red-700" },
            {
              label: "Ingresos confirmados",
              value: `$${totals.revenue.toLocaleString("es-CL")}`,
              color: "text-zinc-800",
            },
          ].map((s) => (
            <div key={s.label} className="bg-white border rounded-lg p-4">
              <p className="text-xs text-zinc-400 mb-1">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              placeholder="Buscar por estudiante o taller..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="confirmed">Confirmadas</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
              <SelectItem value="cancelled">Canceladas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-zinc-400">
            <p className="text-lg font-medium">Sin reservas</p>
            <p className="text-sm mt-1">
              {search || statusFilter !== "all"
                ? "Intenta con otros filtros"
                : "Aún no tienes reservas confirmadas"}
            </p>
          </div>
        ) : (
          <div className="bg-white border rounded-lg overflow-hidden">
            {/* Header row */}
            <div className="hidden md:grid grid-cols-[2fr_2fr_1.5fr_1fr_1fr] gap-4 px-4 py-2 bg-zinc-50 border-b text-xs font-medium text-zinc-500 uppercase tracking-wide">
              <span>Estudiante</span>
              <span>Taller</span>
              <span>Sesión</span>
              <span>Estado</span>
              <span className="text-right">Monto</span>
            </div>
            <div className="divide-y">
              {filtered.map((b) => (
                <div
                  key={b.booking_id}
                  className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1.5fr_1fr_1fr] gap-2 md:gap-4 px-4 py-3 items-center text-sm hover:bg-zinc-50 transition-colors"
                >
                  <span className="font-medium truncate">{b.student_name}</span>
                  <span className="text-zinc-600 truncate">{b.workshop_title}</span>
                  <span className="text-zinc-500 text-xs">{formatDate(b.session_date)}</span>
                  <span>{statusBadge(b.status)}</span>
                  <span className="text-right font-medium">
                    ${b.amount.toLocaleString("es-CL")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-zinc-400 text-center">
          Mostrando {filtered.length} de {bookings.length} reservas
        </p>
      </div>
    </main>
  );
}
