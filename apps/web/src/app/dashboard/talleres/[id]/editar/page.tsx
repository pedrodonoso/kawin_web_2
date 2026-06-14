"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, adminApi, type Category, type Workshop, type Schedule, type ApiResponse, type PendingChanges } from "@/lib/api";
import { ApprovalStatus, Modality, WorkshopStatus, WorkshopStatusLabel, WorkshopType } from "@/lib/constants";
import { ArrowLeft, Plus, X, AlertCircle, Pencil, Trash2, CalendarDays, Lock, Send, Repeat, RotateCcw, Archive, GitCompare } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { LocationPicker } from "@/components/map/LocationPicker";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { DateTimeRangePicker } from "@/components/ui/date-time-range-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DatePicker } from "@/components/ui/date-picker";
import Link from "next/link";

interface SessionDraft {
  id?: string;
  starts_at: string;
  ends_at: string;
  notes: string;
}

interface ScheduleDraft {
  days_of_week: number[];
  time_start: string;
  duration_min: number;
  valid_from: string;
  valid_until: string;
}

const DAYS = [
  { label: "Lun", value: 1 },
  { label: "Mar", value: 2 },
  { label: "Mié", value: 3 },
  { label: "Jue", value: 4 },
  { label: "Vie", value: 5 },
  { label: "Sáb", value: 6 },
  { label: "Dom", value: 0 },
];

function emptyScheduleDraft(): ScheduleDraft {
  return { days_of_week: [], time_start: "", duration_min: 60, valid_from: "", valid_until: "" };
}

function formatDays(days: number[] | undefined | null): string {
  if (!days) return "—";
  const sorted = [...days].sort((a, b) => {
    // Sort Mon-Sun: treat 0 (Sun) as 7
    const av = a === 0 ? 7 : a;
    const bv = b === 0 ? 7 : b;
    return av - bv;
  });
  return sorted
    .map((d) => DAYS.find((x) => x.value === d)?.label ?? String(d))
    .join(", ");
}

// Inline schedule change form state
interface ChangeForm {
  scheduleId: string;
  days_of_week: number[];
  time_start: string;
  duration_min: number;
  valid_from: string;
  valid_until: string;
  change_date: string;
}

export default function EditarTallerPage() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id ?? "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [bookingsCount, setBookingsCount] = useState(0);
  const [adminObservations, setAdminObservations] = useState<string | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<string>("not_submitted");
  const [categories, setCategories] = useState<Category[]>([]);
  const [sessions, setSessions] = useState<SessionDraft[]>([]);

  // Existing schedules from API
  const [existingSchedules, setExistingSchedules] = useState<Schedule[]>([]);
  // Draft for adding a brand-new schedule
  const [newScheduleDraft, setNewScheduleDraft] = useState<ScheduleDraft | null>(null);
  // Which existing schedule is being edited (change flow)
  const [changeForm, setChangeForm] = useState<ChangeForm | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<PendingChanges | null>(null);
  const [viewingPending, setViewingPending] = useState(false);
  const [publishedSnapshot, setPublishedSnapshot] = useState<typeof form | null>(null);

  const [form, setFormState] = useState({
    title: "",
    description: "",
    type: "workshop",
    modality: "in-person",
    price: "",
    currency: "CLP",
    capacity: "",
    location: "",
    address: "",
    lat: "",
    lng: "",
    online_url: "",
    notes: "",
    category_id: "",
    status: "draft",
  });

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) {
      router.push("/login");
      return;
    }
    if (!id) return;

    const user = JSON.parse(raw);
    const isAdmin = user?.role === "admin";
    setIsAdmin(isAdmin);

    Promise.all([
      api.getList<Category>("/api/v1/categories"),
      isAdmin
        ? adminApi.getWorkshop(id)
        : api.get<ApiResponse<Workshop>>(`/api/v1/my-workshops/${id}`),
    ])
      .then(([cats, res]) => {
        setCategories(cats);
        const w = res.data;
        setBookingsCount(w.bookings_count ?? 0);
        setAdminObservations(w.admin_observations ?? null);
        setApprovalStatus(w.approval_status ?? "not_submitted");
        setPendingChanges(w.pending_changes ?? null);
        setIsPaid(w.price > 0);
        const published = {
          title: w.title,
          description: w.description ?? "",
          type: w.type,
          modality: w.modality,
          price: w.price > 0 ? String(w.price) : "",
          currency: w.currency,
          capacity: w.capacity != null ? String(w.capacity) : "",
          location: w.location ?? "",
          address: w.address ?? "",
          lat: w.lat != null ? String(w.lat) : "",
          lng: w.lng != null ? String(w.lng) : "",
          online_url: w.online_url ?? "",
          notes: w.notes ?? "",
          category_id: w.category_id ?? "",
          status: w.status,
        };
        setPublishedSnapshot(published);
        setFormState(published);
        setSessions(
          (w.sessions ?? []).map((s) => ({
            id: s.id,
            starts_at: s.starts_at,
            ends_at: s.ends_at,
            notes: s.notes ?? "",
          }))
        );

        // Load schedules for all types (class always uses them; others may use recurring)
        if (true) {
          return api
            .getList<Schedule>(`/api/v1/workshops/${id}/schedules`)
            .then((scheds) => {
              setExistingSchedules(scheds);
              if (w.type !== WorkshopType.CLASS && scheds.length > 0) {
                setIsRecurring(true);
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id, router]);

  function setField(field: string, value: string) {
    setFormState((f) => ({ ...f, [field]: value }));
  }

  // ---- Session helpers ----
  function addSession() {
    setSessions((s) => [...s, { starts_at: "", ends_at: "", notes: "" }]);
  }

  function removeSession(i: number) {
    setSessions((s) => s.filter((_, idx) => idx !== i));
  }

  function updateSession(i: number, field: keyof SessionDraft, value: string) {
    setSessions((s) =>
      s.map((sess, idx) => (idx === i ? { ...sess, [field]: value } : sess))
    );
  }

  // ---- New schedule draft helpers ----
  function toggleNewDay(day: number) {
    if (!newScheduleDraft) return;
    const has = newScheduleDraft.days_of_week.includes(day);
    setNewScheduleDraft({
      ...newScheduleDraft,
      days_of_week: has
        ? newScheduleDraft.days_of_week.filter((d) => d !== day)
        : [...newScheduleDraft.days_of_week, day],
    });
  }

  async function saveNewSchedule() {
    if (!newScheduleDraft) return;
    try {
      await api.post<ApiResponse<Schedule>>(
        `/api/v1/workshops/${id}/schedules`,
        {
          days_of_week: newScheduleDraft.days_of_week,
          time_start: newScheduleDraft.time_start,
          duration_min: newScheduleDraft.duration_min,
          valid_from: newScheduleDraft.valid_from || undefined,
          valid_until: newScheduleDraft.valid_until || undefined,
        }
      );
      // Refresh full schedule list so all fields are populated
      const scheds = await api.getList<Schedule>(`/api/v1/workshops/${id}/schedules`);
      setExistingSchedules(scheds);
      setNewScheduleDraft(null);
      toast.success("Horario agregado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar horario");
    }
  }

  // ---- Delete schedule ----
  async function deleteSchedule(scheduleId: string) {
    if (!window.confirm("¿Eliminar este horario? Las reservas existentes no se verán afectadas, pero no se generarán nuevas clases con este horario.")) return;
    try {
      await api.delete(`/api/v1/schedules/${scheduleId}`);
      setExistingSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
      toast.success("Horario eliminado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar horario");
    }
  }

  // ---- Change form helpers ----
  function openChangeForm(sch: Schedule) {
    setChangeForm({
      scheduleId: sch.id,
      days_of_week: [...sch.days_of_week],
      time_start: sch.time_start,
      duration_min: sch.duration_min,
      valid_from: sch.valid_from,
      valid_until: sch.valid_until ?? "",
      change_date: "",
    });
  }

  function toggleChangeDay(day: number) {
    if (!changeForm) return;
    const has = changeForm.days_of_week.includes(day);
    setChangeForm({
      ...changeForm,
      days_of_week: has
        ? changeForm.days_of_week.filter((d) => d !== day)
        : [...changeForm.days_of_week, day],
    });
  }

  async function submitScheduleChange() {
    if (!changeForm) return;
    // change_date es requerido por el backend para saber desde cuándo aplica la nueva regla
    if (!changeForm.change_date) {
      toast.error("Por favor ingresa la fecha de inicio del cambio");
      return;
    }
    try {
      await api.put<ApiResponse<Schedule>>(
        `/api/v1/schedules/${changeForm.scheduleId}`,
        {
          days_of_week: changeForm.days_of_week,
          time_start: changeForm.time_start,
          duration_min: changeForm.duration_min,
          valid_from: changeForm.valid_from || undefined,
          valid_until: changeForm.valid_until || undefined,
          change_date: changeForm.change_date,
        }
      );
      const scheds = await api.getList<Schedule>(`/api/v1/workshops/${id}/schedules`);
      setExistingSchedules(scheds);
      setChangeForm(null);
      toast.success("Horario actualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar horario");
    }
  }

  async function save(status: string) {
    const effectivePrice = isPaid ? Number(form.price) : 0;
    if (effectivePrice > 9_999_999) {
      toast.error("El precio no puede superar 9.999.999");
      return;
    }
    setSaving(true);
    try {
      const coordPayload = {
        lat: form.lat !== "" ? Number(form.lat) : null,
        lng: form.lng !== "" ? Number(form.lng) : null,
      };
      const sendSessions = form.type !== WorkshopType.CLASS && !isRecurring;
      await api.put(`/api/v1/workshops/${id}`, {
        ...form,
        ...coordPayload,
        status,
        price: effectivePrice,
        capacity: form.capacity ? Number(form.capacity) : undefined,
        sessions: sendSessions ? sessions : undefined,
      });
      toast.success("Cambios guardados");
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function saveAndSubmit() {
    const effectivePrice2 = isPaid ? Number(form.price) : 0;
    if (effectivePrice2 > 9_999_999) {
      toast.error("El precio no puede superar 9.999.999");
      return;
    }
    setSaving(true);
    try {
      const coordPayload = {
        lat: form.lat !== "" ? Number(form.lat) : null,
        lng: form.lng !== "" ? Number(form.lng) : null,
      };
      const sendSessions2 = form.type !== WorkshopType.CLASS && !isRecurring;
      await api.put(`/api/v1/workshops/${id}`, {
        ...form,
        ...coordPayload,
        status: form.status,
        price: effectivePrice2,
        capacity: form.capacity ? Number(form.capacity) : undefined,
        sessions: sendSessions2 ? sessions : undefined,
      });

      // Para talleres en borrador también hay que llamar submit-review.
      // Para talleres publicados, el backend detecta los cambios sensibles
      // y los guarda en pending_changes automáticamente al hacer PUT.
      if (form.status !== WorkshopStatus.PUBLISHED) {
        await adminApi.submitForReview(id);
      }

      toast.success("Cambios enviados a revisión");
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al enviar a revisión");
    } finally {
      setSaving(false);
    }
  }

  // —— Loading ——
  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Card>
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  // —— Not found ——
  if (notFound) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertCircle className="h-10 w-10 text-muted-foreground/70 mx-auto" />
          <p className="font-semibold text-foreground/70">Taller no encontrado</p>
          <p className="text-sm text-muted-foreground/70">
            No tienes acceso a este taller o no existe.
          </p>
          <Button variant="outline" asChild>
            <Link href="/dashboard">Volver al dashboard</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Volver
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Editar taller</h1>
            <p className="text-sm text-muted-foreground/70 truncate max-w-xs">{form.title}</p>
          </div>
        </div>

        {/* Banner de taller archivado */}
        {form.status === WorkshopStatus.ARCHIVED && (
          <div className="flex items-start gap-3 rounded-lg border border-muted bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            <Archive className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-foreground/80 mb-0.5">Taller archivado</p>
              <p>Este taller no aparece en el catálogo público. Puedes restaurarlo como borrador para volver a publicarlo.</p>
            </div>
          </div>
        )}

        {/* Observaciones del admin */}
        {adminObservations && (
          <div className="flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-orange-500" />
            <div>
              <p className="font-semibold mb-0.5">Observaciones del administrador</p>
              <p>{adminObservations}</p>
              {approvalStatus === ApprovalStatus.CHANGES_REQUESTED && (
                <p className="mt-1 text-orange-600 font-medium">Corrige los puntos indicados y envía nuevamente a revisión.</p>
              )}
            </div>
          </div>
        )}

        {/* Toggle versión en revisión */}
        {pendingChanges && approvalStatus === ApprovalStatus.PENDING_REVIEW && (
          <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <GitCompare className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
            <div className="flex-1">
              <p className="font-semibold mb-0.5">Tienes cambios enviados a revisión</p>
              <p className="text-blue-700 text-xs">
                {viewingPending
                  ? "Estás viendo la versión enviada a revisión (solo lectura)."
                  : "Estás viendo la versión publicada actualmente."}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0 border-blue-300 text-blue-700 hover:bg-blue-100"
              onClick={() => {
                if (!viewingPending && pendingChanges && publishedSnapshot) {
                  setFormState({
                    ...publishedSnapshot,
                    title: pendingChanges.title ?? publishedSnapshot.title,
                    description: pendingChanges.description ?? publishedSnapshot.description,
                    modality: (pendingChanges.modality as typeof publishedSnapshot.modality) ?? publishedSnapshot.modality,
                    price: pendingChanges.price != null ? String(pendingChanges.price) : publishedSnapshot.price,
                    currency: pendingChanges.currency ?? publishedSnapshot.currency,
                    capacity: pendingChanges.capacity != null ? String(pendingChanges.capacity) : publishedSnapshot.capacity,
                    location: pendingChanges.location ?? publishedSnapshot.location,
                    address: pendingChanges.address ?? publishedSnapshot.address,
                    lat: pendingChanges.lat != null ? String(pendingChanges.lat) : publishedSnapshot.lat,
                    lng: pendingChanges.lng != null ? String(pendingChanges.lng) : publishedSnapshot.lng,
                    online_url: pendingChanges.online_url ?? publishedSnapshot.online_url,
                    notes: pendingChanges.notes ?? publishedSnapshot.notes,
                    category_id: pendingChanges.category_id ?? publishedSnapshot.category_id,
                  });
                  setIsPaid((pendingChanges.price ?? 0) > 0);
                  setViewingPending(true);
                } else if (publishedSnapshot) {
                  setFormState(publishedSnapshot);
                  setIsPaid(Number(publishedSnapshot.price) > 0);
                  setViewingPending(false);
                }
              }}
            >
              {viewingPending ? "Ver versión publicada" : "Ver versión en revisión"}
            </Button>
          </div>
        )}

        {/* Aviso de campos bloqueados */}
        {bookingsCount > 0 && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <Lock className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
            <p>
              Este taller tiene <strong>{bookingsCount} reserva(s) confirmada(s)</strong>. Solo podés modificar el título, descripción, categoría, modalidad y lugar.
            </p>
          </div>
        )}

        <div className={`space-y-6 ${viewingPending ? "opacity-75 pointer-events-none select-none" : ""}`}>
          {/* Información básica */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Información básica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  placeholder="Ej: Cerámica para principiantes"
                  value={form.title}
                  onChange={(e) => setField("title", e.target.value)}
                  disabled={viewingPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <textarea
                  id="description"
                  rows={5}
                  maxLength={2000}
                  placeholder="Describe tu taller: qué aprenderán, qué incluye, quién puede asistir..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60"
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                  disabled={viewingPending}
                />
                <p className="text-xs text-muted-foreground/70 text-right">{form.description.length}/2000</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <div className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground/60">
                    {{ workshop: "Taller", course: "Curso", class: "Clase", event: "Evento" }[form.type] ?? form.type}
                  </div>
                  <p className="text-xs text-muted-foreground/70">El tipo no puede modificarse después de creado.</p>
                </div>

                <div className="space-y-2">
                  <Label>Categoría</Label>
                  <Select
                    value={form.category_id}
                    onValueChange={(v) => setField("category_id", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notas del taller */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Notas del taller (opcional)</Label>
                <RichTextEditor
                  key={`workshop-notes-${loading}`}
                  value={form.notes}
                  onChange={(html) => setField("notes", html)}
                  placeholder="Información adicional para los participantes: qué traer, requisitos, instrucciones especiales..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Modalidad y lugar */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Modalidad y lugar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: "in-person", label: "Presencial" },
                  { value: "online", label: "Online" },
                  { value: "hybrid", label: "Híbrido" },
                ].map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setField("modality", m.value)}
                    className={`py-3 border-2 rounded-lg text-sm font-medium transition-all ${
                      form.modality === m.value
                        ? "border-primary bg-secondary"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {form.modality !== Modality.ONLINE && (
                <>
                  <LocationPicker
                    location={form.location}
                    lat={form.lat}
                    lng={form.lng}
                    onLocationChange={(v) => setField("location", v)}
                    onCoordsChange={(lat, lng) => setFormState((f) => ({ ...f, lat, lng }))}
                  />
                  <div className="space-y-2">
                    <Label htmlFor="address">Indicaciones adicionales</Label>
                    <Input
                      id="address"
                      placeholder="Ej: Piso 3, al lado de Walmart, tocar timbre 4B..."
                      value={form.address}
                      onChange={(e) => setField("address", e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground/70">Instrucciones para llegar o encontrar el lugar.</p>
                  </div>
                </>
              )}
              {(form.modality === Modality.ONLINE || form.modality === Modality.HYBRID) && (
                <div className="space-y-2">
                  <Label htmlFor="online_url">Link de la clase</Label>
                  <Input
                    id="online_url"
                    type="url"
                    placeholder="Ej: https://meet.google.com/abc-xyz"
                    value={form.online_url}
                    onChange={(e) => setField("online_url", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground/70">Zoom, Meet, Teams u otro. Solo visible para estudiantes con reserva confirmada.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Precio y cupos */}
          <Card className={bookingsCount > 0 ? "opacity-60" : ""}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                Precio y cupos
                {bookingsCount > 0 && <Lock className="h-3.5 w-3.5 text-amber-500" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Taller de pago</p>
                  <p className="text-xs text-muted-foreground/70">
                    {bookingsCount > 0 ? "No modificable con reservas activas" : "Por defecto el taller es gratuito"}
                  </p>
                </div>
                <Switch
                  checked={isPaid}
                  disabled={bookingsCount > 0}
                  onCheckedChange={(v) => {
                    setIsPaid(v);
                    if (!v) setField("price", "");
                  }}
                />
              </div>

              {isPaid && (
                <div className="space-y-2">
                  <Label htmlFor="price">Precio *</Label>
                  <div className="flex gap-2">
                    <Select
                      value={form.currency}
                      onValueChange={(v) => setField("currency", v)}
                      disabled={bookingsCount > 0}
                    >
                      <SelectTrigger className="w-24 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CLP">CLP</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="ARS">ARS</SelectItem>
                        <SelectItem value="COP">COP</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      id="price"
                      type="number"
                      min="1"
                      max="9999999"
                      step="1"
                      placeholder="Ej: 15000"
                      value={form.price}
                      onChange={(e) => setField("price", e.target.value.replace(/[.,]/g, ""))}
                      disabled={bookingsCount > 0}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="capacity">Cupos máximos</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  placeholder="Sin límite"
                  value={form.capacity}
                  onChange={(e) => setField("capacity", e.target.value)}
                  disabled={bookingsCount > 0}
                />
                {bookingsCount > 0 && (
                  <p className="text-xs text-muted-foreground/70">No modificable con reservas activas</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Toggle horario recurrente — solo para tipos no-class */}
          {form.type !== WorkshopType.CLASS && (
            <Card className={bookingsCount > 0 ? "opacity-60" : ""}>
              <CardContent className="pt-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Repeat className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium flex items-center gap-2">
                        Horario recurrente
                        {bookingsCount > 0 && <Lock className="h-3.5 w-3.5 text-amber-500" />}
                      </p>
                      <p className="text-xs text-muted-foreground/70">
                        {bookingsCount > 0
                          ? "No modificable con reservas activas"
                          : "Configura días y horarios fijos en vez de fechas individuales"}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={isRecurring}
                    onCheckedChange={setIsRecurring}
                    disabled={bookingsCount > 0}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Horario recurrente (clases siempre, o cuando isRecurring activo) */}
          {(form.type === WorkshopType.CLASS || isRecurring) && (
            <Card className={bookingsCount > 0 ? "opacity-60" : ""}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  Reglas de horario
                  {bookingsCount > 0 && <Lock className="h-3.5 w-3.5 text-amber-500" />}
                </CardTitle>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Define cuándo se ofrecen clases. Las sesiones se materializan desde el{" "}
                  <Link href={`/dashboard/talleres/${id}/calendario`} className="underline text-foreground/60 hover:text-foreground">
                    calendario
                  </Link>.
                </p>
                <div className="flex gap-2 flex-wrap pt-1">
                  {/* Gestionar sesiones — oculto hasta habilitar materialización
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <Link href={`/dashboard/talleres/${id}/calendario`}>
                      <CalendarDays className="h-4 w-4 mr-1" />
                      Gestionar sesiones
                    </Link>
                  </Button>
                  */}
                  {!newScheduleDraft && !bookingsCount && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setNewScheduleDraft(emptyScheduleDraft())}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Agregar regla
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Existing schedules as read-only cards */}
                {existingSchedules.map((sch) => (
                  <div key={sch.id} className="space-y-3">
                    {changeForm?.scheduleId === sch.id ? (
                      /* Change form for this schedule */
                      <div className="border rounded-lg p-4 space-y-4 bg-background">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">Cambiando horario</Badge>
                          <button
                            type="button"
                            onClick={() => setChangeForm(null)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Day picker */}
                        <div className="space-y-2">
                          <Label className="text-xs">Días de la semana</Label>
                          <div className="flex gap-2 flex-wrap">
                            {DAYS.map((d) => {
                              const active = changeForm.days_of_week.includes(d.value);
                              return (
                                <button
                                  key={d.value}
                                  type="button"
                                  onClick={() => toggleChangeDay(d.value)}
                                  className={`w-10 h-10 rounded-full text-xs font-semibold border-2 transition-all ${
                                    active
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-card text-foreground/60 border-border hover:border-primary/50"
                                  }`}
                                >
                                  {d.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Time and duration */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Hora de inicio *</Label>
                            <TimePicker
                              value={changeForm.time_start}
                              onChange={(v) =>
                                setChangeForm({ ...changeForm, time_start: v })
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Duración (minutos)</Label>
                            <Input
                              type="number"
                              min="15"
                              step="15"
                              value={changeForm.duration_min}
                              onChange={(e) =>
                                setChangeForm({
                                  ...changeForm,
                                  duration_min: Number(e.target.value),
                                })
                              }
                            />
                          </div>
                        </div>

                        {/* Valid range */}
                        <div className="space-y-1">
                          <Label className="text-xs">Vigencia (opcional)</Label>
                          <DateRangePicker
                            from={changeForm.valid_from}
                            to={changeForm.valid_until}
                            onFromChange={(v) =>
                              setChangeForm((prev) => prev ? { ...prev, valid_from: v } : prev)
                            }
                            onToChange={(v) =>
                              setChangeForm((prev) => prev ? { ...prev, valid_until: v } : prev)
                            }
                            placeholder="Sin límite de vigencia"
                            minDate={new Date()}
                          />
                        </div>

                        {/* Change date (required) */}
                        <div className="space-y-1 border-t pt-3">
                          <Label className="text-xs font-semibold">
                            Fecha de inicio del cambio *
                          </Label>
                          <DatePicker
                            value={changeForm.change_date}
                            onChange={(v) =>
                              setChangeForm({ ...changeForm, change_date: v })
                            }
                            minDate={changeForm.valid_from ? (() => {
                              const p = changeForm.valid_from.split("-").map(Number)
                              return new Date(p[0], p[1] - 1, p[2])
                            })() : undefined}
                            maxDate={changeForm.valid_until ? (() => {
                              const p = changeForm.valid_until.split("-").map(Number)
                              return new Date(p[0], p[1] - 1, p[2])
                            })() : undefined}
                          />
                          <p className="text-xs text-muted-foreground/70">
                            Las reservas a partir de esta fecha serán afectadas.
                          </p>
                        </div>

                        <div className="flex gap-2 justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setChangeForm(null)}
                          >
                            Cancelar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={submitScheduleChange}
                          >
                            Confirmar cambio
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* Read-only card */
                      <div className="border rounded-lg p-4 flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">
                            {formatDays(sch.days_of_week)} — {sch.time_start} ({sch.duration_min} min)
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Desde {sch.valid_from}
                            {sch.valid_until ? ` hasta ${sch.valid_until}` : " (sin fin)"}
                          </p>
                        </div>
                        {!bookingsCount && (
                          <div className="flex gap-2 shrink-0">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openChangeForm(sch)}
                            >
                              <Pencil className="h-3 w-3 mr-1" />
                              Cambiar
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => deleteSchedule(sch.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {existingSchedules.length === 0 && !newScheduleDraft && (
                  <p className="text-sm text-muted-foreground/70 text-center py-4">
                    Sin horarios configurados. Agrega uno para empezar.
                  </p>
                )}

                {/* New schedule draft form */}
                {newScheduleDraft && (
                  <div className="border rounded-lg p-4 space-y-4 border-dashed">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">Nuevo horario</Badge>
                      <button
                        type="button"
                        onClick={() => setNewScheduleDraft(null)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Day picker */}
                    <div className="space-y-2">
                      <Label className="text-xs">Días de la semana</Label>
                      <div className="flex gap-2 flex-wrap">
                        {DAYS.map((d) => {
                          const active = newScheduleDraft.days_of_week.includes(d.value);
                          return (
                            <button
                              key={d.value}
                              type="button"
                              onClick={() => toggleNewDay(d.value)}
                              className={`w-10 h-10 rounded-full text-xs font-semibold border-2 transition-all ${
                                active
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-card text-foreground/60 border-border hover:border-primary/50"
                              }`}
                            >
                              {d.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Hora de inicio *</Label>
                        <TimePicker
                          value={newScheduleDraft.time_start}
                          onChange={(v) =>
                            setNewScheduleDraft({ ...newScheduleDraft, time_start: v })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Duración (minutos)</Label>
                        <Input
                          type="number"
                          min="15"
                          step="15"
                          value={newScheduleDraft.duration_min}
                          onChange={(e) =>
                            setNewScheduleDraft({
                              ...newScheduleDraft,
                              duration_min: Number(e.target.value),
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Vigencia (opcional)</Label>
                      <DateRangePicker
                        from={newScheduleDraft.valid_from}
                        to={newScheduleDraft.valid_until}
                        onFromChange={(v) =>
                          setNewScheduleDraft((prev) => prev ? { ...prev, valid_from: v } : prev)
                        }
                        onToChange={(v) =>
                          setNewScheduleDraft((prev) => prev ? { ...prev, valid_until: v } : prev)
                        }
                        placeholder="Sin límite de vigencia"
                        minDate={new Date()}
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setNewScheduleDraft(null)}
                      >
                        Cancelar
                      </Button>
                      <Button type="button" size="sm" onClick={saveNewSchedule}>
                        Guardar horario
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Sesiones (tipos no-class sin horario recurrente) */}
          {form.type !== WorkshopType.CLASS && !isRecurring && (
            <Card className={bookingsCount > 0 ? "opacity-60" : ""}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  Sesiones
                  {bookingsCount > 0 && <Lock className="h-3.5 w-3.5 text-amber-500" />}
                </CardTitle>
                {bookingsCount === 0 && (
                  <Button type="button" variant="outline" size="sm" onClick={addSession}>
                    <Plus className="h-4 w-4 mr-1" />
                    Agregar fecha
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {sessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground/70 text-center py-4">
                    Sin fechas agendadas.
                  </p>
                ) : (
                  sessions.map((s, i) => (
                    <div key={i} className="border rounded-lg p-4 space-y-3 relative">
                      {bookingsCount === 0 && (
                        <button
                          type="button"
                          onClick={() => removeSession(i)}
                          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                      <Badge variant="outline" className="text-xs">
                        Sesión {i + 1}
                      </Badge>
                      <DateTimeRangePicker
                        startDate={s.starts_at ? new Date(s.starts_at) : undefined}
                        endDate={s.ends_at ? new Date(s.ends_at) : undefined}
                        onStartChange={(d) => updateSession(i, "starts_at", d.toISOString())}
                        onEndChange={(d) => updateSession(i, "ends_at", d.toISOString())}
                        disabled={bookingsCount > 0}
                      />
                      <div className="space-y-1">
                        <Label className="text-xs">Notas (opcional)</Label>
                        {bookingsCount > 0 ? (
                          <Input value={s.notes} disabled />
                        ) : (
                          <RichTextEditor
                            value={s.notes}
                            onChange={(html) => updateSession(i, "notes", html)}
                            placeholder="Ej: Materiales incluidos"
                          />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Acciones */}
          {viewingPending ? (
            <p className="text-sm text-center text-blue-600 bg-blue-50 border border-blue-200 rounded-lg py-3">
              Modo de solo lectura — estás viendo la versión enviada a revisión. Vuelve a la versión publicada para editar.
            </p>
          ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground/70">
              Estado:{" "}
              <span className="font-medium text-foreground/70">
                {WorkshopStatusLabel[form.status] ?? form.status}
              </span>
            </p>
            {(() => {
              const isArchived = form.status === WorkshopStatus.ARCHIVED;
              const isPublished = form.status === WorkshopStatus.PUBLISHED;
              const hasObservations = approvalStatus === ApprovalStatus.CHANGES_REQUESTED;

              return (
                <div className="flex gap-3">
                  {isArchived ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={saving}
                        onClick={() => save("archived")}
                      >
                        {saving ? "Guardando..." : "Guardar cambios"}
                      </Button>
                      <Button
                        type="button"
                        disabled={saving}
                        onClick={() => save("draft")}
                        className="bg-green-700 hover:bg-green-800 text-white"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        {saving ? "Restaurando..." : "Restaurar como borrador"}
                      </Button>
                    </>
                  ) : isAdmin ? (
                    // Admin: guardar directo sin revisión
                    <>
                      {isPublished && (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={saving}
                          onClick={() => save("draft")}
                        >
                          {saving ? "Guardando..." : "Pasar a borrador"}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant={isPublished ? "default" : "outline"}
                        disabled={saving}
                        onClick={() => save(isPublished ? "published" : "draft")}
                      >
                        {saving ? "Guardando..." : "Guardar cambios"}
                      </Button>
                      {!isPublished && (
                        <Button
                          type="button"
                          disabled={saving}
                          onClick={() => save("published")}
                          className="bg-green-700 hover:bg-green-800 text-white"
                        >
                          {saving ? "Publicando..." : "Publicar"}
                        </Button>
                      )}
                    </>
                  ) : isPublished && !hasObservations ? (
                    // Publicado → siempre requiere revisión
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={saving}
                        onClick={() => save("draft")}
                      >
                        {saving ? "Guardando..." : "Pasar a borrador"}
                      </Button>
                      <Button
                        type="button"
                        disabled={saving}
                        onClick={saveAndSubmit}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {saving ? "Enviando..." : "Guardar y enviar a revisión"}
                      </Button>
                    </>
                  ) : (
                    // Borrador u observaciones pendientes → flujo de revisión
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={saving}
                        onClick={() => save("draft")}
                      >
                        Guardar borrador
                      </Button>
                      <Button
                        type="button"
                        disabled={saving}
                        onClick={saveAndSubmit}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {saving ? "Enviando..." : "Enviar a revisión"}
                      </Button>
                    </>
                  )}
                </div>
              );
            })()}
          </div>
          )}
        </div>
      </div>

    </main>
  );
}
