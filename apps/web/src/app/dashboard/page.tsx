"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, BookOpen, Users, DollarSign, Eye, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, type Workshop } from "@/lib/api";

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

const MOCK_WORKSHOPS: Workshop[] = [
  {
    id: "1",
    title: "Acuarela para principiantes",
    slug: "acuarela-principiantes",
    description: "Aprende las bases de la acuarela.",
    type: "workshop",
    modality: "in-person",
    price: 25000,
    currency: "CLP",
    capacity: 12,
    status: "published",
    created_at: new Date().toISOString(),
  },
  {
    id: "2",
    title: "Retrato al óleo — nivel avanzado",
    slug: "retrato-oleo-avanzado",
    description: "Técnicas de retrato con óleo.",
    type: "course",
    modality: "in-person",
    price: 60000,
    currency: "CLP",
    capacity: 6,
    status: "draft",
    created_at: new Date().toISOString(),
  },
];

const statusStyle: Record<string, string> = {
  published: "bg-green-100 text-green-700",
  draft: "bg-yellow-100 text-yellow-700",
  archived: "bg-zinc-100 text-zinc-500",
};

const statusLabel: Record<string, string> = {
  published: "Publicado",
  draft: "Borrador",
  archived: "Archivado",
};

export default function DashboardPage() {
  const router = useRouter();
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [bookings, setBookings] = useState<InstructorBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) {
      router.push("/login");
      return;
    }
    const u = JSON.parse(raw);
    setUserName(u.email?.split("@")[0] ?? "tallerista");

    api
      .getList<Workshop>("/api/v1/my-workshops")
      .then(setWorkshops)
      .catch(() => setWorkshops(MOCK_WORKSHOPS))
      .finally(() => setLoading(false));

    api
      .getList<InstructorBooking>("/api/v1/instructor-bookings")
      .then(setBookings)
      .catch(() => setBookings([]))
      .finally(() => setBookingsLoading(false));
  }, [router]);

  async function archiveWorkshop(id: string, title: string) {
    if (!window.confirm(`¿Archivar "${title}"? No aparecerá en los resultados de búsqueda.`)) return;
    try {
      await api.delete(`/api/v1/workshops/${id}`);
      setWorkshops((ws) => ws.filter((w) => w.id !== id));
      toast.success("Taller archivado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al archivar");
    }
  }

  const published = workshops.filter((w) => w.status === "published").length;
  const totalRevenue = workshops
    .filter((w) => w.status === "published")
    .reduce((acc, w) => acc + w.price, 0);

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Hola, {userName} 👋</h1>
            <p className="text-zinc-500 mt-1">Gestiona tus talleres y reservas</p>
          </div>
          <Button asChild>
            <Link href="/dashboard/talleres/nuevo">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo taller
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" /> Talleres publicados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{loading ? "—" : published}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Users className="h-4 w-4" /> Reservas este mes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">0</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" /> Ingresos totales
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {loading ? "—" : `$${totalRevenue.toLocaleString("es-CL")}`}
              </p>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Workshops list */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Mis talleres</h2>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Card key={i}>
                  <CardContent className="p-5 flex justify-between items-center">
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-8 w-20" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : workshops.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-zinc-400">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-40" />
                <p className="font-medium">Aún no tienes talleres</p>
                <p className="text-sm mt-1">Crea tu primer taller y comienza a recibir reservas.</p>
                <Button className="mt-4" asChild>
                  <Link href="/dashboard/talleres/nuevo">
                    <Plus className="h-4 w-4 mr-2" />
                    Crear taller
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {workshops.map((w) => (
                <Card key={w.id}>
                  <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{w.title}</h3>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyle[w.status]}`}
                        >
                          {statusLabel[w.status]}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-500">
                        {w.type === "workshop" ? "Taller" : w.type === "course" ? "Curso" : "Clase"} ·{" "}
                        {w.modality === "in-person" ? "Presencial" : w.modality === "online" ? "Online" : "Híbrido"} ·{" "}
                        <span className="font-medium">
                          ${w.price.toLocaleString("es-CL")} {w.currency}
                        </span>
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/talleres/${w.slug}`}>
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Ver
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/talleres/${w.id}/editar`}>
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          Editar
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => archiveWorkshop(w.id, w.title)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Recent bookings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Reservas recientes</h2>
            {/* TODO: add /dashboard/reservas page */}
            <button className="text-sm text-zinc-400 cursor-not-allowed" disabled>
              Ver todas
            </button>
          </div>

          {bookingsLoading ? (
            <Card>
              <CardContent className="p-5 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex justify-between">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : bookings.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-zinc-400 text-sm">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>Aún no tienes reservas en tus talleres.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-zinc-50 text-zinc-500">
                      <th className="text-left px-4 py-3 font-medium">Estudiante</th>
                      <th className="text-left px-4 py-3 font-medium">Taller</th>
                      <th className="text-left px-4 py-3 font-medium">Fecha/Hora sesión</th>
                      <th className="text-left px-4 py-3 font-medium">Estado</th>
                      <th className="text-right px-4 py-3 font-medium">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.slice(0, 10).map((b) => (
                      <tr key={b.booking_id} className="border-b last:border-0 hover:bg-zinc-50">
                        <td className="px-4 py-3">{b.student_name}</td>
                        <td className="px-4 py-3 text-zinc-600 max-w-[180px] truncate">{b.workshop_title}</td>
                        <td className="px-4 py-3 text-zinc-500">
                          {b.session_date
                            ? new Date(b.session_date).toLocaleString("es-CL", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              b.status === "confirmed"
                                ? "bg-green-100 text-green-700"
                                : b.status === "pending"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-600"
                            }`}
                          >
                            {b.status === "confirmed"
                              ? "Confirmada"
                              : b.status === "pending"
                              ? "Pendiente"
                              : "Cancelada"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          ${b.amount.toLocaleString("es-CL")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
