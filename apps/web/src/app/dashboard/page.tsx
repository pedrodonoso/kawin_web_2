"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, BookOpen, Users, DollarSign, Eye, Pencil } from "lucide-react";
import { api, type Workshop } from "@/lib/api";

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
  }, [router]);

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
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
