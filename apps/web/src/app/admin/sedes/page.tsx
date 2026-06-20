"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminVenuesApi, type Venue } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2, MapPin, Pencil, Plus, Power, RotateCcw, Trash2, Eye,
} from "lucide-react";

export default function AdminSedesPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    adminVenuesApi
      .list()
      .then(setVenues)
      .catch(() => setVenues([]))
      .finally(() => setLoading(false));
  };

  useEffect(reload, []);

  const active = venues.filter((v) => v.status === "active");
  const inactive = venues.filter((v) => v.status === "inactive");

  const archive = async (v: Venue) => {
    if (!confirm(`¿Inhabilitar la sede "${v.name}"? Dejará de aparecer en el sitio público.`)) return;
    await adminVenuesApi.archive(v.id);
    reload();
  };

  const restore = async (v: Venue) => {
    await adminVenuesApi.restore(v.id);
    reload();
  };

  const remove = async (v: Venue) => {
    if ((v.workshops_count ?? 0) > 0) {
      alert("No se puede eliminar: hay talleres asociados a esta sede.");
      return;
    }
    if (!confirm(`¿Eliminar definitivamente la sede "${v.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await adminVenuesApi.delete(v.id);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error al eliminar");
    }
  };

  const renderCard = (v: Venue) => {
    const isInactive = v.status === "inactive";
    return (
      <Card key={v.id}>
        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <h3 className="font-semibold truncate">{v.name}</h3>
              <span className="text-xs text-muted-foreground">
                · {v.workshops_count ?? 0} taller{(v.workshops_count ?? 0) !== 1 ? "es" : ""}
              </span>
            </div>
            {(v.address || v.city) && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{[v.address, v.city].filter(Boolean).join(", ")}</span>
              </p>
            )}
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/sedes/${v.slug}`}>
                <Eye className="h-3.5 w-3.5 mr-1" /> Ver
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/sedes/${v.id}/editar`}>
                <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
              </Link>
            </Button>
            {isInactive ? (
              <>
                <Button variant="outline" size="sm" onClick={() => restore(v)}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restaurar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => remove(v)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => archive(v)}>
                <Power className="h-3.5 w-3.5 mr-1" /> Inhabilitar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderList = (items: Venue[], emptyMsg: string) => {
    if (loading) {
      return (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-secondary animate-pulse" />
          ))}
        </div>
      );
    }
    if (items.length === 0) {
      return <p className="text-muted-foreground text-sm py-8 text-center">{emptyMsg}</p>;
    }
    return <div className="space-y-3">{items.map(renderCard)}</div>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Sedes</h1>
          <p className="text-sm text-muted-foreground">
            Lugares que agrupan talleres, cursos y eventos.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/sedes/nuevo">
            <Plus className="h-4 w-4 mr-1" /> Nueva sede
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="active">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-transparent p-0">
          <TabsTrigger value="active" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5">
            Activas {!loading && <span className="ml-1 text-xs opacity-70">({active.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="inactive" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5">
            Inhabilitadas {!loading && <span className="ml-1 text-xs opacity-70">({inactive.length})</span>}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-4">
          {renderList(active, "No hay sedes activas. Crea la primera.")}
        </TabsContent>
        <TabsContent value="inactive" className="mt-4">
          {renderList(inactive, "No hay sedes inhabilitadas.")}
        </TabsContent>
      </Tabs>
    </div>
  );
}
