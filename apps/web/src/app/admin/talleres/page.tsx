"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Eye, Pencil, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { adminApi, type AdminWorkshop } from "@/lib/api";
import { ModalityLabel, WorkshopTypeLabel } from "@/lib/constants";

const STATUS_LABEL: Record<string, string> = {
  published: "Publicado",
  draft:     "Borrador",
  archived:  "Archivado",
};

const STATUS_STYLE: Record<string, string> = {
  published: "bg-green-100 text-green-700",
  draft:     "bg-yellow-100 text-yellow-700",
  archived:  "bg-muted text-muted-foreground",
};

const APPROVAL_LABEL: Record<string, string> = {
  not_submitted: "Sin enviar",
  pending_review: "En revisión",
  approved: "Aprobado",
  changes_requested: "Cambios solicitados",
};

const APPROVAL_STYLE: Record<string, string> = {
  not_submitted: "bg-muted text-muted-foreground",
  pending_review: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  changes_requested: "bg-orange-100 text-orange-700",
};

const APPROVAL_ICON: Record<string, React.ElementType> = {
  not_submitted: BookOpen,
  pending_review: Clock,
  approved: CheckCircle2,
  changes_requested: AlertCircle,
};

const STATUS_FILTERS = [
  { value: "", label: "Todos" },
  { value: "pending_review", label: "En revisión" },
  { value: "changes_requested", label: "Cambios solicitados" },
  { value: "approved", label: "Aprobados" },
  { value: "not_submitted", label: "Sin enviar" },
];

export default function AdminTalleresPage() {
  const searchParams = useSearchParams();
  const [activeFilter, setActiveFilter] = useState(searchParams.get("status") ?? "");
  const [workshops, setWorkshops] = useState<AdminWorkshop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminApi.getWorkshops(activeFilter || undefined)
      .then(setWorkshops)
      .catch(() => setWorkshops([]))
      .finally(() => setLoading(false));
  }, [activeFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gestión de talleres</h1>
        <p className="text-muted-foreground mt-1">Revisa y aprueba talleres enviados por instructores</p>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f.value}
            variant={activeFilter === f.value ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
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
      ) : !workshops.length ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <p className="font-medium">No hay talleres en esta categoría</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {workshops.map((w) => {
            const ApprIcon = APPROVAL_ICON[w.approval_status ?? "not_submitted"];
            return (
              <Card key={w.id}>
                <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{w.title}</h3>
                      <span
                        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[w.status ?? "draft"]}`}
                      >
                        {STATUS_LABEL[w.status ?? "draft"]}
                      </span>
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
                    <Button size="sm" asChild>
                      <Link href={`/admin/talleres/${w.id}`}>
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Revisar
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
