"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Eye, Pencil, Clock, CheckCircle2, AlertCircle, Plus, Archive, RotateCcw, FileText, Globe, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { adminApi, api, type AdminWorkshop } from "@/lib/api";
import { ModalityLabel, WorkshopTypeLabel } from "@/lib/constants";

const APPROVAL_LABEL: Record<string, string> = {
  not_submitted:     "Sin enviar",
  pending_review:    "En revisión",
  approved:          "Aprobado",
  changes_requested: "Cambios solicitados",
};

const APPROVAL_STYLE: Record<string, string> = {
  not_submitted:     "bg-muted text-muted-foreground",
  pending_review:    "bg-amber-100 text-amber-700",
  approved:          "bg-green-100 text-green-700",
  changes_requested: "bg-orange-100 text-orange-700",
};

const APPROVAL_ICON: Record<string, React.ElementType> = {
  not_submitted:     BookOpen,
  pending_review:    Clock,
  approved:          CheckCircle2,
  changes_requested: AlertCircle,
};

type TabKey = "published" | "draft" | "archived";

const PAGE_SIZE = 5;

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "published", label: "Publicados", icon: Globe },
  { key: "draft",     label: "Borradores", icon: FileText },
  { key: "archived",  label: "Archivados", icon: Archive },
];

export default function AdminTalleresPage() {
  const [allWorkshops, setAllWorkshops] = useState<AdminWorkshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<Record<TabKey, number>>({ published: 1, draft: 1, archived: 1 });
  const [activeTab, setActiveTab] = useState<TabKey>("published");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      adminApi.getWorkshops().catch(() => [] as AdminWorkshop[]),
      adminApi.getWorkshops("archived").catch(() => [] as AdminWorkshop[]),
    ])
      .then(([active, archived]) => {
        const seen = new Set(active.map((w) => w.id));
        const merged = [...active, ...archived.filter((w) => !seen.has(w.id))];
        setAllWorkshops(merged);
      })
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => {
    const map: Record<TabKey, AdminWorkshop[]> = {
      published: [], draft: [], archived: [],
    };
    for (const w of allWorkshops) {
      const key = (w.status === "published" || w.status === "archived") ? w.status : "draft";
      map[key].push(w);
    }
    return map;
  }, [allWorkshops]);

  const paginated = useCallback((key: TabKey) => {
    const items = grouped[key];
    const currentPage = page[key];
    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    const safePage = Math.min(currentPage, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return { items: items.slice(start, start + PAGE_SIZE), totalPages, currentPage: safePage, total: items.length };
  }, [grouped, page]);

  function setTabPage(tab: TabKey, p: number) {
    setPage((prev) => ({ ...prev, [tab]: p }));
  }

  async function archiveWorkshop(id: string, title: string) {
    if (!window.confirm(`¿Archivar "${title}"? No aparecerá en los resultados de búsqueda.`)) return;
    try {
      await api.delete(`/api/v1/admin/workshops/${id}`);
      setAllWorkshops((ws) => ws.map((w) => w.id === id ? { ...w, status: "archived" } : w));
      toast.success("Taller archivado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al archivar");
    }
  }

  async function restoreWorkshop(w: AdminWorkshop) {
    if (!window.confirm(`¿Restaurar "${w.title}"? Quedará como borrador.`)) return;
    try {
      await api.post(`/api/v1/admin/workshops/${w.id}/restore`, {});
      setAllWorkshops((ws) => ws.map((x) => x.id === w.id ? { ...x, status: "draft", approval_status: "not_submitted" } : x));
      toast.success("Taller restaurado como borrador");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al restaurar");
    }
  }

  async function deleteWorkshop(id: string, title: string) {
    if (!window.confirm(`¿Eliminar permanentemente "${title}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/api/v1/admin/workshops/${id}/permanent`);
      setAllWorkshops((ws) => ws.filter((w) => w.id !== id));
      toast.success("Taller eliminado permanentemente");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  }

  function renderWorkshopCard(w: AdminWorkshop) {
    const ApprIcon = APPROVAL_ICON[w.approval_status ?? "not_submitted"];
    const isArchived = w.status === "archived";
    return (
      <Card key={w.id}>
        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold truncate">{w.title}</h3>
              <span
                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${APPROVAL_STYLE[w.approval_status ?? "not_submitted"]}`}
              >
                <ApprIcon className="h-3 w-3" />
                {APPROVAL_LABEL[w.approval_status ?? "not_submitted"]}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">{w.instructor_name || w.instructor_email}</span>
              {" · "}
              {WorkshopTypeLabel[w.type] ?? w.type}
              {" · "}
              {ModalityLabel[w.modality] ?? w.modality}
              {" · "}
              <span className="font-medium">${Math.round(Number(w.price)).toLocaleString("es-CL", { maximumFractionDigits: 0 })} {w.currency}</span>
            </p>
            {w.admin_observations && (
              <p className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded mt-1 truncate max-w-lg">
                Observación: {w.admin_observations}
              </p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/talleres/${w.slug}`}>
                <Eye className="h-3.5 w-3.5 mr-1" /> Ver
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/talleres/${w.id}/editar`}>
                <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
              </Link>
            </Button>
            {isArchived ? (
              <>
                <Button variant="outline" size="sm" onClick={() => restoreWorkshop(w)}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restaurar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => deleteWorkshop(w.id, w.title)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => archiveWorkshop(w.id, w.title)}>
                  <Archive className="h-3.5 w-3.5 mr-1" /> Archivar
                </Button>
                <Button size="sm" asChild>
                  <Link href={`/admin/talleres/${w.id}`}>
                    Revisar
                  </Link>
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderEmpty() {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-40" />
          <p className="font-medium">No hay talleres en esta sección</p>
        </CardContent>
      </Card>
    );
  }

  function renderSkeleton() {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-5 flex justify-between items-center">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-64" />
              </div>
              <Skeleton className="h-8 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gestión de talleres</h1>
          <p className="text-muted-foreground mt-1">Revisa y aprueba talleres enviados por instructores</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/talleres/nuevo">
            <Plus className="h-4 w-4 mr-1" /> Crear taller
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="published" onValueChange={(v) => setActiveTab(v as TabKey)}>
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-transparent p-0">
          {TABS.map(({ key, label, icon: Icon }) => (
            <TabsTrigger
              key={key}
              value={key}
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5"
            >
              <Icon className="h-4 w-4" />
              {label}
              {!loading && (
                <span className="ml-1 text-xs opacity-70">({grouped[key].length})</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map(({ key }) => {
          const { items, totalPages, currentPage, total } = paginated(key);
          return (
            <TabsContent key={key} value={key} className="mt-4 space-y-4">
              {loading
                ? renderSkeleton()
                : total === 0
                  ? renderEmpty()
                  : (
                    <>
                      <div className="space-y-3">{items.map(renderWorkshopCard)}</div>
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-2">
                          <p className="text-sm text-muted-foreground">
                            {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, total)} de {total}
                          </p>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              disabled={currentPage <= 1}
                              onClick={() => setTabPage(key, currentPage - 1)}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                              <Button
                                key={p}
                                variant={p === currentPage ? "default" : "outline"}
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setTabPage(key, p)}
                              >
                                {p}
                              </Button>
                            ))}
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              disabled={currentPage >= totalPages}
                              onClick={() => setTabPage(key, currentPage + 1)}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )
              }
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
