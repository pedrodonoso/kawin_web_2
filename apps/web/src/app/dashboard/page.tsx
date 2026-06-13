"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, BookOpen, Users, DollarSign, Eye, Pencil, Trash2, FileEdit, Archive, UserCircle, AlertCircle, Clock, BarChart2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { api, type Workshop, type Profile } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { ApprovalStatus, BookingStatus, ModalityLabel, UserRole, WorkshopStatus, WorkshopTypeLabel } from "@/lib/constants";

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
  published: "bg-positive/15 text-positive",
  draft: "bg-yellow-100 text-yellow-700",
  archived: "bg-muted text-muted-foreground",
};

const statusLabel: Record<string, string> = {
  published: "Publicado",
  draft: "Borrador",
  archived: "Archivado",
};

const approvalStyle: Record<string, string> = {
  not_submitted: "bg-muted text-muted-foreground",
  pending_review: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  changes_requested: "bg-orange-100 text-orange-700",
};

const approvalLabel: Record<string, string> = {
  not_submitted: "Sin enviar a revisión",
  pending_review: "En revisión",
  approved: "Aprobado",
  changes_requested: "Observaciones pendientes",
};

export default function DashboardPage() {
  const router = useRouter();
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [bookings, setBookings] = useState<InstructorBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    draft: true,
    archived: true,
  });

  function toggleSection(key: string) {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) {
      router.push("/login");
      return;
    }
    const u = JSON.parse(raw);
    if (u.role === UserRole.ADMIN) {
      router.replace("/admin");
      return;
    }
    setIsAdmin(u.role === UserRole.ADMIN);

    api
      .get<{ data: Profile }>("/api/v1/my-profile")
      .then((r) => setUserName(r.data.name || u.email?.split("@")[0] || ""))
      .catch(() => setUserName(u.email?.split("@")[0] ?? ""));

    api
      .getList<Workshop>("/api/v1/my-workshops")
      .then(setWorkshops)
      .catch(() => setWorkshops([]))
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
      setWorkshops((ws) => ws.map((w) => w.id === id ? { ...w, status: "archived" as const } : w));
      toast.success("Taller archivado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al archivar");
    }
  }

  async function restoreWorkshop(w: Workshop) {
    if (!window.confirm(`¿Restaurar "${w.title}"? Quedará como borrador.`)) return;
    try {
      await api.put(`/api/v1/workshops/${w.id}`, {
        title: w.title,
        type: w.type,
        modality: w.modality,
        status: "draft",
      });
      setWorkshops((ws) => ws.map((x) => x.id === w.id ? { ...x, status: "draft" as const } : x));
      toast.success("Taller restaurado como borrador");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al restaurar");
    }
  }

  async function deleteWorkshop(id: string, title: string) {
    if (!window.confirm(`¿Eliminar permanentemente "${title}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/api/v1/workshops/${id}/permanent`);
      setWorkshops((ws) => ws.filter((w) => w.id !== id));
      toast.success("Taller eliminado permanentemente");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  }

  const published = workshops?.filter((w) => w.status === WorkshopStatus.PUBLISHED).length;
  const now = new Date();
  const bookingsThisMonth = bookings?.filter((b) => {
    const d = new Date(b.created_at);
    return b.status === BookingStatus.CONFIRMED && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length ?? 0;
  const totalRevenue = bookings?.filter((b) => b.status === BookingStatus.CONFIRMED).reduce((acc, b) => acc + Number(b.amount), 0) ?? 0;

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Hola, {userName} 👋</h1>
            <p className="text-muted-foreground mt-1">Gestiona tus talleres y reservas</p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <Button variant="outline" asChild>
              <Link href="/perfil">
                <UserCircle className="h-4 w-4 mr-2" />
                Mi perfil
              </Link>
            </Button>
            {/* <Button variant="outline" asChild>
              <Link href="/dashboard/estadisticas">
                <BarChart2 className="h-4 w-4 mr-2" />
                Estadísticas
              </Link>
            </Button> */}
            <Button asChild>
              <Link href="/dashboard/talleres/nuevo">
                <Plus className="h-4 w-4 mr-2" />
                Nuevo taller
              </Link>
            </Button>
          </div>
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
              <p className="text-3xl font-bold">{bookingsLoading ? "—" : bookingsThisMonth}</p>
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
                {loading ? "—" : (
                  <>
                    ${formatPrice(totalRevenue)}
                    <span className="ml-1.5 text-base font-normal text-muted-foreground">CLP</span>
                  </>
                )}
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
          ) : !workshops?.length ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-40" />
                <p className="font-medium">No existen talleres</p>
                <p className="text-sm mt-1">Crea tu primer taller y comienza a recibir reservas.</p>
                <Button className="mt-4" asChild>
                  <Link href="/dashboard/talleres/nuevo">
                    <Plus className="h-4 w-4 mr-2" />
                    Crear taller
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (() => {
            const groups: { key: string; label: string; items: Workshop[] }[] = [
              { key: "published", label: "Publicados", items: workshops.filter((w) => w.status === WorkshopStatus.PUBLISHED) },
              { key: "draft", label: "Borradores", items: workshops.filter((w) => w.status === "draft") },
              { key: "archived", label: "Archivados", items: workshops.filter((w) => w.status === WorkshopStatus.ARCHIVED) },
            ].filter((g) => g.items.length > 0);

            if (!groups.length) return (
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-40" />
                  <p className="font-medium">No existen talleres</p>
                  <p className="text-sm mt-1">Crea tu primer taller y comienza a recibir reservas.</p>
                  <Button className="mt-4" asChild>
                    <Link href="/dashboard/talleres/nuevo">
                      <Plus className="h-4 w-4 mr-2" />
                      Crear taller
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );

            return (
              <div className="space-y-4">
                {groups.map(({ key, label, items }) => {
                  const isCollapsed = !!collapsedSections[key];
                  return (
                    <div key={key} className="space-y-2">
                      <button
                        onClick={() => toggleSection(key)}
                        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        {label}
                        <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">{items.length}</span>
                      </button>
                      {!isCollapsed && (
                        <div className="space-y-3">
                          {items.map((w) => (
                            <Card key={w.id}>
                              <CardContent className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                <div className="space-y-1.5 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="font-semibold">{w.title}</h3>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyle[w.status]}`}>
                                      {statusLabel[w.status]}
                                    </span>
                                    {w.approval_status && w.approval_status !== ApprovalStatus.APPROVED && (
                                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${approvalStyle[w.approval_status]}`}>
                                        {w.approval_status === ApprovalStatus.PENDING_REVIEW && <Clock className="h-3 w-3" />}
                                        {w.approval_status === ApprovalStatus.CHANGES_REQUESTED && <AlertCircle className="h-3 w-3" />}
                                        {approvalLabel[w.approval_status]}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {WorkshopTypeLabel[w.type] ?? w.type} ·{" "}
                                    {ModalityLabel[w.modality] ?? w.modality} ·{" "}
                                    <span className="font-medium">${formatPrice(w.price)} {w.currency}</span>
                                  </p>
                                  {w.admin_observations && (
                                    <p className="text-xs text-orange-700 bg-orange-50 px-2 py-1.5 rounded border border-orange-200 mt-1">
                                      <span className="font-medium">Observación del admin:</span> {w.admin_observations}
                                    </p>
                                  )}
                                </div>
                                <div className="flex gap-2 shrink-0 flex-wrap">
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
                                  {w.status === WorkshopStatus.ARCHIVED ? (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-amber-700 border-amber-200 hover:bg-amber-50"
                                        onClick={() => restoreWorkshop(w)}
                                      >
                                        <FileEdit className="h-3.5 w-3.5 mr-1" />
                                        Restaurar
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                                        onClick={() => deleteWorkshop(w.id, w.title)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                                        Eliminar
                                      </Button>
                                    </>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-muted-foreground border-muted hover:bg-muted"
                                      onClick={() => archiveWorkshop(w.id, w.title)}
                                    >
                                      <Archive className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {isAdmin && <Separator />}

        {/* Recent bookings - hidden
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Reservas recientes</h2>
            <Link href="/dashboard/reservas" className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2">
              Ver todas
            </Link>
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
          ) : !bookings?.length ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>No existen reservas recientes.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-secondary/50 text-muted-foreground">
                      <th className="text-left px-4 py-3 font-medium">Estudiante</th>
                      <th className="text-left px-4 py-3 font-medium">Taller</th>
                      <th className="text-left px-4 py-3 font-medium">Fecha/Hora sesión</th>
                      <th className="text-left px-4 py-3 font-medium">Estado</th>
                      <th className="text-right px-4 py-3 font-medium">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings?.slice(0, 10).map((b) => (
                      <tr key={b.booking_id} className="border-b last:border-0 hover:bg-secondary/30">
                        <td className="px-4 py-3">{b.student_name}</td>
                        <td className="px-4 py-3 text-foreground/60 max-w-[180px] truncate">{b.workshop_title}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {b.session_date
                            ? new Date(b.session_date).toLocaleString("es-CL", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZone: "UTC",
                              })
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              b.status === BookingStatus.CONFIRMED
                                ? "bg-green-100 text-green-700"
                                : b.status === BookingStatus.PENDING
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-600"
                            }`}
                          >
                            {b.status === BookingStatus.CONFIRMED
                              ? "Confirmada"
                              : b.status === BookingStatus.PENDING
                              ? "Pendiente"
                              : "Cancelada"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          ${formatPrice(b.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div> */}
      </div>
    </main>
  );
}
