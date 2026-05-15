"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, CheckCircle2, MessageSquare, Pencil, Save, UserCircle, X,
} from "lucide-react";
import { adminApi, type AdminWorkshop, type Category, type PendingChanges, type Schedule, api } from "@/lib/api";
import { ApprovalStatus, ModalityLabel, WorkshopStatusLabel, WorkshopTypeLabel } from "@/lib/constants";
import { AdminContactCard } from "@/components/AdminContactCard";
import dynamic from "next/dynamic";

const MiniMapWrapper = dynamic(
  () => import("@/app/talleres/[slug]/MiniMapWrapper").then((m) => m.MiniMapWrapper),
  { ssr: false, loading: () => <div className="h-48 rounded-lg bg-secondary animate-pulse" /> }
);

const LocationPicker = dynamic(
  () => import("@/components/map/LocationPicker").then((m) => m.LocationPicker),
  { ssr: false, loading: () => <div className="h-64 rounded-lg bg-secondary animate-pulse" /> }
);

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

export default function AdminWorkshopReviewPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const router = useRouter();

  const [workshop, setWorkshop] = useState<AdminWorkshop | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<AdminWorkshop>>({});
  const [saving, setSaving] = useState(false);

  const [observations, setObservations] = useState("");
  const [sendingObs, setSendingObs] = useState(false);
  const [approving, setApproving] = useState(false);
  const [showObsForm, setShowObsForm] = useState(false);
  const [editingContact, setEditingContact] = useState(false);

  useEffect(() => {
    Promise.all([
      adminApi.getWorkshop(id).then((res) => res.data),
      api.getList<Category>("/api/v1/categories"),
      api.getList<Schedule>(`/api/v1/workshops/${id}/schedules`).catch(() => [] as Schedule[]),
    ])
      .then(([w, cats, scheds]) => {
        setWorkshop(w);
        setForm(w ?? {});
        setCategories(cats);
        setSchedules(scheds);
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function saveEdits() {
    if (!workshop) return;
    setSaving(true);
    try {
      await adminApi.updateWorkshop(workshop.id, {
        title: form.title,
        description: form.description,
        modality: form.modality,
        price: form.price,
        currency: form.currency,
        capacity: form.capacity,
        location: form.location,
        lat: form.lat,
        lng: form.lng,
        online_url: form.online_url,
        category_id: form.category_id,
      });
      setWorkshop((prev) => prev ? { ...prev, ...form } : prev);
      setEditing(false);
      toast.success("Taller actualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function approve() {
    if (!workshop) return;
    if (!window.confirm("¿Aprobar y publicar este taller?")) return;
    setApproving(true);
    try {
      await adminApi.reviewWorkshop(workshop.id, "approve");
      setWorkshop((prev) => prev ? { ...prev, approval_status: "approved", status: "published" } : prev);
      toast.success("Taller aprobado y publicado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al aprobar");
    } finally {
      setApproving(false);
    }
  }

  async function sendObservations() {
    if (!workshop || !observations.trim()) return;
    setSendingObs(true);
    try {
      await adminApi.reviewWorkshop(workshop.id, "send_observations", observations);
      setWorkshop((prev) => prev ? { ...prev, approval_status: "changes_requested", admin_observations: observations } : prev);
      setShowObsForm(false);
      setObservations("");
      toast.success("Observaciones enviadas al instructor");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al enviar observaciones");
    } finally {
      setSendingObs(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!workshop) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>Taller no encontrado.</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/admin/talleres">Volver</Link>
        </Button>
      </div>
    );
  }

  const approvalStatus = workshop.approval_status ?? "not_submitted";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/talleres"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold">{workshop.title}</h1>
            <p className="text-sm text-muted-foreground">
              Instructor: {workshop.instructor_name || workshop.instructor_email}
              {workshop.instructor_email && workshop.instructor_name && ` (${workshop.instructor_email})`}
            </p>
          </div>
        </div>
        <span className={`text-sm px-3 py-1 rounded-full font-medium ${APPROVAL_STYLE[approvalStatus]}`}>
          {APPROVAL_LABEL[approvalStatus]}
        </span>
      </div>

      {/* Observaciones actuales */}
      {workshop.admin_observations && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-orange-800 mb-1">Observaciones enviadas al instructor:</p>
            <p className="text-sm text-orange-700">{workshop.admin_observations}</p>
          </CardContent>
        </Card>
      )}

      {/* Acciones de revisión */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acciones de revisión</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <Button
              onClick={approve}
              disabled={approving || approvalStatus === ApprovalStatus.APPROVED}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {approving ? "Aprobando..." : approvalStatus === ApprovalStatus.APPROVED ? "Ya aprobado" : "Aprobar y publicar"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowObsForm((v) => !v)}
              disabled={approvalStatus === ApprovalStatus.APPROVED}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Enviar observaciones
            </Button>
            <Button
              variant="outline"
              onClick={() => { setEditing(true); setForm(workshop); }}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Editar taller
            </Button>
            <Button
              variant="outline"
              onClick={() => setEditingContact((v) => !v)}
            >
              <UserCircle className="h-4 w-4 mr-2" />
              Contacto
            </Button>
          </div>

          {showObsForm && (
            <div className="space-y-3 pt-2 border-t">
              <Label>Observaciones para el instructor</Label>
              <Textarea
                placeholder="Describe los cambios que debe realizar el instructor antes de la aprobación..."
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                rows={4}
              />
              <div className="flex gap-2">
                <Button onClick={sendObservations} disabled={sendingObs || !observations.trim()}>
                  {sendingObs ? "Enviando..." : "Enviar"}
                </Button>
                <Button variant="outline" onClick={() => { setShowObsForm(false); setObservations(""); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

        </CardContent>
      </Card>

      <AdminContactCard
        entityId={id}
        entityType="workshop"
        currentContactId={workshop.guest_contact_id}
        useGuestContact={workshop.use_guest_contact ?? true}
        realInstructorName={workshop.instructor_name || ""}
        realInstructorEmail={workshop.instructor_email}
        editing={editingContact}
        onEditingChange={setEditingContact}
        onSaved={(cId, useG) => setWorkshop((prev) => prev ? { ...prev, guest_contact_id: cId, use_guest_contact: useG } : prev)}
      />

      {/* Datos del taller — edición inline */}
      {editing && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Editar datos</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
              <Button size="sm" onClick={saveEdits} disabled={saving}>
                <Save className="h-4 w-4 mr-1" />
                {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1">
                <Label>Título</Label>
                <Input value={form.title ?? ""} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <Label>Descripción</Label>
                <Textarea
                  value={form.description ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={4}
                />
              </div>
              <div className="space-y-1">
                <Label>Modalidad</Label>
                <Select value={form.modality} onValueChange={(v) => setForm((f) => ({ ...f, modality: v as AdminWorkshop["modality"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in-person">Presencial</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="hybrid">Híbrido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Categoría</Label>
                <Select value={form.category_id ?? ""} onValueChange={(v) => setForm((f) => ({ ...f, category_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Precio ({form.currency ?? "CLP"})</Label>
                <Input
                  type="number"
                  value={form.price ?? 0}
                  onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Capacidad</Label>
                <Input
                  type="number"
                  value={form.capacity ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value ? Number(e.target.value) : undefined }))}
                />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <LocationPicker
                  location={form.location ?? ""}
                  lat={form.lat != null ? String(form.lat) : ""}
                  lng={form.lng != null ? String(form.lng) : ""}
                  onLocationChange={(v) => setForm((f) => ({ ...f, location: v }))}
                  onCoordsChange={(lat, lng) => setForm((f) => ({ ...f, lat: parseFloat(lat), lng: parseFloat(lng) }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Indicaciones adicionales</Label>
                <Input value={form.address ?? ""} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>URL online</Label>
                <Input value={form.online_url ?? ""} onChange={(e) => setForm((f) => ({ ...f, online_url: e.target.value }))} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vista de revisión por secciones */}
      {!editing && (
        <div className="space-y-4">
          {/* Información básica */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Información básica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <DiffDetail
                label="Título"
                value={workshop.title}
                proposed={workshop.pending_changes?.title}
              />
              <div className="grid grid-cols-2 gap-4">
                <Detail label="Tipo" value={WorkshopTypeLabel[workshop.type] ?? workshop.type} />
                <Detail label="Estado" value={WorkshopStatusLabel[workshop.status] ?? workshop.status} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <DiffDetail
                  label="Categoría"
                  value={workshop.category_name || "—"}
                  proposed={
                    workshop.pending_changes?.category_id && workshop.pending_changes.category_id !== workshop.category_id
                      ? `ID: ${workshop.pending_changes.category_id}`
                      : undefined
                  }
                />
              </div>
              <DiffDetail
                label="Descripción"
                value={workshop.description || "—"}
                proposed={workshop.pending_changes?.description}
                multiline
              />
              <DiffRichText
                label="Notas para participantes"
                value={workshop.notes || null}
                proposed={workshop.pending_changes?.notes !== undefined ? (workshop.pending_changes.notes ?? null) : undefined}
              />
            </CardContent>
          </Card>

          {/* Modalidad y lugar */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Modalidad y lugar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <DiffDetail
                label="Modalidad"
                value={ModalityLabel[workshop.modality] ?? workshop.modality}
                proposed={
                  workshop.pending_changes?.modality
                    ? ModalityLabel[workshop.pending_changes.modality] ?? workshop.pending_changes.modality
                    : undefined
                }
              />
              {workshop.modality !== "online" && (
                <>
                  <DiffDetail
                    label="Ubicación"
                    value={workshop.location || "—"}
                    proposed={
                      workshop.pending_changes?.location !== undefined &&
                      workshop.pending_changes.location !== workshop.location
                        ? workshop.pending_changes.location || "—"
                        : undefined
                    }
                  />
                  <DiffDetail
                    label="Indicaciones adicionales"
                    value={workshop.address || "—"}
                    proposed={
                      workshop.pending_changes?.address !== undefined &&
                      (workshop.pending_changes.address ?? "") !== (workshop.address ?? "")
                        ? workshop.pending_changes.address || "—"
                        : undefined
                    }
                  />
                  {/* Mapa */}
                  {(() => {
                    const hasCoordChange =
                      workshop.pending_changes?.lat !== undefined &&
                      (workshop.pending_changes.lat !== workshop.lat || workshop.pending_changes.lng !== workshop.lng);

                    if (hasCoordChange) {
                      const proposedLat = workshop.pending_changes!.lat;
                      const proposedLng = workshop.pending_changes!.lng;
                      return (
                        <div className="rounded-lg border border-amber-200 overflow-hidden">
                          <div className="bg-muted/50 px-3 py-2 border-b border-amber-200">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Actual (en vivo)</p>
                            {workshop.lat != null && workshop.lng != null
                              ? <MiniMapWrapper lat={workshop.lat} lng={workshop.lng} label={workshop.location} />
                              : <p className="text-sm text-muted-foreground">Sin coordenadas</p>}
                          </div>
                          <div className="bg-amber-50 px-3 py-2">
                            <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mb-2">Propuesto por instructor</p>
                            {proposedLat != null && proposedLng != null
                              ? <MiniMapWrapper lat={proposedLat} lng={proposedLng} label={workshop.pending_changes!.location || workshop.location} />
                              : <p className="text-sm text-amber-900 font-semibold">Sin coordenadas</p>}
                          </div>
                        </div>
                      );
                    }

                    if (workshop.lat == null || workshop.lng == null) return null;
                    return <MiniMapWrapper lat={workshop.lat} lng={workshop.lng} label={workshop.location} />;
                  })()}
                </>
              )}
              {(workshop.modality === "online" || workshop.modality === "hybrid") && (
                <DiffDetail
                  label="URL online"
                  value={workshop.online_url || "—"}
                  proposed={
                    workshop.pending_changes?.online_url !== undefined &&
                    workshop.pending_changes.online_url !== workshop.online_url
                      ? workshop.pending_changes.online_url || "—"
                      : undefined
                  }
                />
              )}
            </CardContent>
          </Card>

          {/* Precio y cupos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Precio y cupos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <DiffDetail
                  label="Precio"
                  value={
                    workshop.price > 0
                      ? `$${Math.round(Number(workshop.price)).toLocaleString("es-CL", { maximumFractionDigits: 0 })} ${workshop.currency}`
                      : "Gratuito"
                  }
                  proposed={
                    workshop.pending_changes?.price !== undefined &&
                    Number(workshop.pending_changes.price) !== Number(workshop.price)
                      ? workshop.pending_changes.price! > 0
                        ? `$${Math.round(workshop.pending_changes.price!).toLocaleString("es-CL", { maximumFractionDigits: 0 })} ${workshop.pending_changes.currency ?? workshop.currency}`
                        : "Gratuito"
                      : undefined
                  }
                />
                <DiffDetail
                  label="Cupos máximos"
                  value={workshop.capacity != null ? String(workshop.capacity) : "Sin límite"}
                  proposed={
                    workshop.pending_changes?.capacity !== undefined &&
                    workshop.pending_changes.capacity !== workshop.capacity
                      ? workshop.pending_changes.capacity != null ? String(workshop.pending_changes.capacity) : "Sin límite"
                      : undefined
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Sesiones */}
          {workshop.sessions && workshop.sessions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sesiones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {workshop.sessions.map((s, i) => (
                  <div key={s.id ?? i} className="border rounded-lg p-3 space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sesión {i + 1}</p>
                    <p>
                      <span className="font-medium">Inicio:</span>{" "}
                      {new Date(s.starts_at).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                    <p>
                      <span className="font-medium">Fin:</span>{" "}
                      {new Date(s.ends_at).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                    {s.notes && (
                      <div
                        className="prose prose-sm max-w-none text-xs text-muted-foreground"
                        dangerouslySetInnerHTML={{ __html: s.notes }}
                      />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Horarios recurrentes */}
          {schedules.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Horarios recurrentes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {schedules.map((sch) => {
                  const DAYS = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
                  const dayLabels = [...sch.days_of_week]
                    .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
                    .map((d) => DAYS[d])
                    .join(", ");
                  return (
                    <div key={sch.id} className="border rounded-lg p-3 space-y-1">
                      <p className="font-medium">{dayLabels} — {sch.time_start} ({sch.duration_min} min)</p>
                      <p className="text-muted-foreground">
                        Desde {sch.valid_from}{sch.valid_until ? ` hasta ${sch.valid_until}` : " (sin fin)"}
                      </p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" asChild>
          <Link href="/admin/talleres"><ArrowLeft className="h-4 w-4 mr-2" />Volver a la lista</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/talleres/${workshop.slug}`} target="_blank">Ver taller público</Link>
        </Button>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground font-medium text-xs uppercase tracking-wide mb-0.5">{label}</p>
      <p>{value}</p>
    </div>
  );
}

const richTextCls = "[&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 text-sm";

function DiffRichText({
  label, value, proposed,
}: {
  label: string;
  value: string | null;
  proposed?: string | null;
}) {
  const changed = proposed !== undefined && proposed !== value;
  if (!changed && !value) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <p className="text-muted-foreground font-medium text-xs uppercase tracking-wide">{label}</p>
        {changed && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
            Cambio propuesto
          </span>
        )}
      </div>
      {changed ? (
        <div className="rounded-lg border border-amber-200 overflow-hidden">
          <div className="bg-muted/50 px-3 py-2 border-b border-amber-200">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Actual (en vivo)</p>
            {value
              ? <div className={`${richTextCls} text-muted-foreground`} dangerouslySetInnerHTML={{ __html: value }} />
              : <p className="text-sm text-muted-foreground">—</p>}
          </div>
          <div className="bg-amber-50 px-3 py-2">
            <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mb-2">Propuesto por instructor</p>
            {proposed
              ? <div className={`${richTextCls} text-amber-900 font-medium`} dangerouslySetInnerHTML={{ __html: proposed }} />
              : <p className="text-sm text-amber-900 font-semibold">—</p>}
          </div>
        </div>
      ) : value ? (
        <div className={`${richTextCls} rounded-md border bg-muted/20 px-3 py-2`} dangerouslySetInnerHTML={{ __html: value }} />
      ) : null}
    </div>
  );
}

function DiffDetail({
  label, value, proposed, multiline = false,
}: {
  label: string;
  value: string;
  proposed?: string;
  multiline?: boolean;
}) {
  const changed = proposed !== undefined && proposed !== value;
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <p className="text-muted-foreground font-medium text-xs uppercase tracking-wide">{label}</p>
      </div>
      {changed ? (
        <div className="rounded-lg border border-amber-200 overflow-hidden">
          <div className="bg-muted/50 px-3 py-2 border-b border-amber-200">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Actual (en vivo)</p>
            <p className={`text-sm text-muted-foreground ${multiline ? "whitespace-pre-wrap" : ""}`}>
              {value || "—"}
            </p>
          </div>
          <div className="bg-amber-50 px-3 py-2">
            <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mb-1">Propuesto por instructor</p>
            <p className={`text-sm font-semibold text-amber-900 ${multiline ? "whitespace-pre-wrap" : ""}`}>
              {proposed || "—"}
            </p>
          </div>
        </div>
      ) : (
        <p className={multiline ? "whitespace-pre-wrap text-sm" : "text-sm"}>{value}</p>
      )}
    </div>
  );
}
