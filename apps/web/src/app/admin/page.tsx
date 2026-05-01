"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  BookOpen, Users, DollarSign, ClipboardCheck,
  AlertCircle, CheckCircle2, Clock, XCircle, ArrowRight,
} from "lucide-react";
import { adminApi, type AdminStats } from "@/lib/api";

function StatCard({
  icon: Icon, label, value, sub, color = "text-foreground",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">
          <Icon className="h-4 w-4" /> {label}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className={`text-3xl font-bold ${color}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  const fmt = (n: number) => n.toLocaleString("es-CL");
  const money = (n: number) => `$${n.toLocaleString("es-CL")}`;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Resumen del negocio</h1>
          <p className="text-muted-foreground mt-1">Vista general de la plataforma Kawin</p>
        </div>
        {stats && stats.pending_review > 0 && (
          <Button asChild>
            <Link href="/admin/talleres?status=pending_review">
              <Clock className="h-4 w-4 mr-2" />
              {stats.pending_review} en revisión
            </Link>
          </Button>
        )}
      </div>

      {/* Talleres */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Talleres</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="p-5"><Skeleton className="h-8 w-20" /></CardContent></Card>
            ))
          ) : (
            <>
              <StatCard icon={BookOpen} label="Total" value={fmt(stats?.total_workshops ?? 0)} />
              <StatCard icon={CheckCircle2} label="Publicados" value={fmt(stats?.published_workshops ?? 0)} color="text-green-600" />
              <StatCard icon={AlertCircle} label="En revisión" value={fmt(stats?.pending_review ?? 0)} color="text-amber-600" />
              <StatCard icon={XCircle} label="Con cambios solicitados" value={fmt(stats?.changes_requested ?? 0)} color="text-orange-600" />
            </>
          )}
        </div>
      </div>

      <Separator />

      {/* Usuarios */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Usuarios</h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
          {loading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <Card key={i}><CardContent className="p-5"><Skeleton className="h-8 w-20" /></CardContent></Card>
            ))
          ) : (
            <>
              <StatCard icon={Users} label="Instructores" value={fmt(stats?.total_instructors ?? 0)} />
              <StatCard icon={Users} label="Estudiantes" value={fmt(stats?.total_students ?? 0)} />
            </>
          )}
        </div>
      </div>

      <Separator />

      {/* Reservas y finanzas */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Reservas y finanzas</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="p-5"><Skeleton className="h-8 w-20" /></CardContent></Card>
            ))
          ) : (
            <>
              <StatCard icon={ClipboardCheck} label="Total reservas" value={fmt(stats?.total_bookings ?? 0)} />
              <StatCard
                icon={CheckCircle2}
                label="Confirmadas"
                value={fmt(stats?.confirmed_bookings ?? 0)}
                color="text-green-600"
                sub={
                  stats?.total_bookings
                    ? `${Math.round((stats.confirmed_bookings / stats.total_bookings) * 100)}% del total`
                    : undefined
                }
              />
              <StatCard icon={XCircle} label="Canceladas" value={fmt(stats?.cancelled_bookings ?? 0)} color="text-red-600" />
              <StatCard
                icon={DollarSign}
                label="Ingresos totales"
                value={money(stats?.total_revenue ?? 0)}
                sub={`Comisión Kawin: ${money(stats?.platform_commission ?? 0)}`}
                color="text-green-700"
              />
            </>
          )}
        </div>
      </div>

      <Separator />

      {/* Acceso rápido */}
      <div className="flex gap-3 flex-wrap">
        <Button variant="outline" asChild>
          <Link href="/admin/talleres?status=pending_review" className="flex items-center gap-2">
            <Clock className="h-4 w-4" /> Ver talleres pendientes
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/admin/talleres" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Ver todos los talleres
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
