"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, BarChart2, DollarSign, Users, CalendarCheck, TrendingUp } from "lucide-react";
import { instructorApi, type InstructorStats } from "@/lib/api";

function StatCard({ label, value, icon: Icon, sub }: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">
          <Icon className="h-4 w-4" /> {label}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 bg-secondary rounded-full h-2 overflow-hidden">
        <div className="bg-primary h-2 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-6 text-right">{value}</span>
    </div>
  );
}

export default function EstadisticasPage() {
  const router = useRouter();
  const [stats, setStats] = useState<InstructorStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) { router.push("/login"); return; }

    instructorApi.getStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [router]);

  const maxConfirmed = stats
    ? Math.max(...(stats.by_workshop?.map((w) => w.confirmed) ?? [1]), 1)
    : 1;
  const maxBookings = stats
    ? Math.max(...(stats.over_time?.map((m) => m.bookings) ?? [1]), 1)
    : 1;
  const maxStudentBookings = stats
    ? Math.max(...(stats.top_students?.map((s) => s.booking_count) ?? [1]), 1)
    : 1;

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2 text-muted-foreground" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
            </Link>
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart2 className="h-6 w-6" /> Estadísticas
          </h1>
          <p className="text-muted-foreground mt-1">Resumen de tus talleres y clientes</p>
        </div>

        {/* Global stats */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : !stats ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              No se pudieron cargar las estadísticas.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                label="Reservas confirmadas"
                value={stats.confirmed_bookings}
                icon={CalendarCheck}
                sub={`${stats.cancelled_bookings} canceladas`}
              />
              <StatCard
                label="Ingresos totales"
                value={`$${stats.total_revenue.toLocaleString("es-CL")}`}
                icon={DollarSign}
                sub="CLP confirmado"
              />
              <StatCard
                label="Este mes"
                value={stats.this_month_bookings}
                icon={TrendingUp}
                sub={`$${stats.this_month_revenue.toLocaleString("es-CL")} CLP`}
              />
              <StatCard
                label="Estudiantes únicos"
                value={stats.top_students?.length ?? 0}
                icon={Users}
                sub="con reservas confirmadas"
              />
            </div>

            {/* Bookings over time */}
            {stats.over_time?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Reservas por mes (últimos 6 meses)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stats.over_time.map((m) => (
                      <div key={m.month} className="flex items-center gap-3 text-sm">
                        <span className="w-16 text-muted-foreground shrink-0">{m.month}</span>
                        <MiniBar value={m.bookings} max={maxBookings} />
                        <span className="text-xs text-muted-foreground w-28 text-right shrink-0">
                          ${m.revenue.toLocaleString("es-CL")}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Per workshop */}
            {stats.by_workshop?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Reservas por taller</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 font-medium">Taller</th>
                        <th className="text-left py-2 font-medium hidden sm:table-cell">Confirmadas</th>
                        <th className="text-left py-2 font-medium hidden sm:table-cell">Canceladas</th>
                        <th className="text-right py-2 font-medium">Ingresos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.by_workshop.map((w) => (
                        <tr key={w.workshop_id} className="border-b last:border-0">
                          <td className="py-2.5 pr-4">
                            <span className="font-medium">{w.workshop_title}</span>
                            <div className="mt-1 sm:hidden">
                              <MiniBar value={w.confirmed} max={maxConfirmed} />
                            </div>
                          </td>
                          <td className="py-2.5 hidden sm:table-cell">
                            <MiniBar value={w.confirmed} max={maxConfirmed} />
                          </td>
                          <td className="py-2.5 text-muted-foreground hidden sm:table-cell">
                            {w.cancelled}
                          </td>
                          <td className="py-2.5 text-right font-medium">
                            ${w.revenue.toLocaleString("es-CL")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}

            {/* Top students */}
            {stats.top_students?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Clientes frecuentes</CardTitle>
                  <CardDescription>Ordenados por cantidad de reservas confirmadas</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 font-medium">Estudiante</th>
                        <th className="text-left py-2 font-medium hidden sm:table-cell">Último taller</th>
                        <th className="text-left py-2 font-medium">Reservas</th>
                        <th className="text-right py-2 font-medium">Total gastado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.top_students.map((s, i) => (
                        <tr key={s.student_email} className="border-b last:border-0">
                          <td className="py-2.5 pr-4">
                            <div className="font-medium">{s.student_name}</div>
                            <div className="text-xs text-muted-foreground">{s.student_email}</div>
                          </td>
                          <td className="py-2.5 text-muted-foreground text-xs hidden sm:table-cell max-w-[160px] truncate">
                            {s.last_workshop || "—"}
                          </td>
                          <td className="py-2.5">
                            <div className="flex items-center gap-2">
                              <MiniBar value={s.booking_count} max={maxStudentBookings} />
                            </div>
                          </td>
                          <td className="py-2.5 text-right font-medium">
                            ${s.total_spent.toLocaleString("es-CL")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </main>
  );
}
