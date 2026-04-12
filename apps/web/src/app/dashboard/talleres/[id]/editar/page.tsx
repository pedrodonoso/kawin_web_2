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
import { api, type Category, type Workshop, type Schedule, type ApiResponse } from "@/lib/api";
import { ArrowLeft, Plus, X, AlertCircle, Pencil, Trash2, CalendarDays } from "lucide-react";
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

// Convierte ISO a valor compatible con datetime-local input
function toLocalInput(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso.slice(0, 16);
  }
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [sessions, setSessions] = useState<SessionDraft[]>([]);

  // Existing schedules from API
  const [existingSchedules, setExistingSchedules] = useState<Schedule[]>([]);
  // Draft for adding a brand-new schedule
  const [newScheduleDraft, setNewScheduleDraft] = useState<ScheduleDraft | null>(null);
  // Which existing schedule is being edited (change flow)
  const [changeForm, setChangeForm] = useState<ChangeForm | null>(null);

  const [form, setFormState] = useState({
    title: "",
    description: "",
    type: "workshop",
    modality: "in-person",
    price: "",
    currency: "CLP",
    capacity: "",
    location: "",
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

    Promise.all([
      api.getList<Category>("/api/v1/categories"),
      api.get<ApiResponse<Workshop>>(`/api/v1/my-workshops/${id}`),
    ])
      .then(([cats, res]) => {
        setCategories(cats);
        const w = res.data;
        setFormState({
          title: w.title,
          description: w.description ?? "",
          type: w.type,
          modality: w.modality,
          price: String(w.price),
          currency: w.currency,
          capacity: w.capacity != null ? String(w.capacity) : "",
          location: w.location ?? "",
          category_id: w.category_id ?? "",
          status: w.status,
        });
        setSessions(
          (w.sessions ?? []).map((s) => ({
            id: s.id,
            starts_at: toLocalInput(s.starts_at),
            ends_at: toLocalInput(s.ends_at),
            notes: s.notes ?? "",
          }))
        );

        // Load schedules for class type
        if (w.type === "class") {
          return api
            .getList<Schedule>(`/api/v1/workshops/${id}/schedules`)
            .then((scheds) => setExistingSchedules(scheds))
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
    if (Number(form.price) > 9_999_999) {
      toast.error("El precio no puede superar 9.999.999");
      return;
    }
    setSaving(true);
    try {
      await api.put(`/api/v1/workshops/${id}`, {
        ...form,
        status,
        price: Number(form.price),
        capacity: form.capacity ? Number(form.capacity) : undefined,
        sessions: form.type !== "class" ? sessions : undefined,
      });
      toast.success(status === "published" ? "Taller publicado" : "Cambios guardados");
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  // —— Loading ——
  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50">
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
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertCircle className="h-10 w-10 text-zinc-400 mx-auto" />
          <p className="font-semibold text-zinc-700">Taller no encontrado</p>
          <p className="text-sm text-zinc-400">
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
    <main className="min-h-screen bg-zinc-50">
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
            <p className="text-sm text-zinc-400 truncate max-w-xs">{form.title}</p>
          </div>
        </div>

        <div className="space-y-6">
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
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <textarea
                  id="description"
                  rows={5}
                  maxLength={2000}
                  placeholder="Describe tu taller: qué aprenderán, qué incluye, quién puede asistir..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                />
                <p className="text-xs text-zinc-400 text-right">{form.description.length}/2000</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <div className="flex h-10 w-full items-center rounded-md border border-input bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                    {{ workshop: "Taller", course: "Curso", class: "Clase", event: "Evento" }[form.type] ?? form.type}
                  </div>
                  <p className="text-xs text-zinc-400">El tipo no puede modificarse después de creado.</p>
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
                        ? "border-zinc-900 bg-zinc-50"
                        : "border-zinc-200 hover:border-zinc-400"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {form.modality !== "online" && (
                <div className="space-y-2">
                  <Label htmlFor="location">Ubicación</Label>
                  <Input
                    id="location"
                    placeholder="Ej: Barrio Italia, Santiago"
                    value={form.location}
                    onChange={(e) => setField("location", e.target.value)}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Precio y cupos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Precio y cupos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Precio *</Label>
                  <div className="flex gap-2">
                    <Select
                      value={form.currency}
                      onValueChange={(v) => setField("currency", v)}
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
                      min="0"
                      max="9999999"
                      placeholder="0"
                      value={form.price}
                      onChange={(e) => setField("price", e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-zinc-400">Ingresa 0 para talleres gratuitos</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="capacity">Cupos máximos</Label>
                  <Input
                    id="capacity"
                    type="number"
                    min="1"
                    placeholder="Sin límite"
                    value={form.capacity}
                    onChange={(e) => setField("capacity", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Horario recurrente (solo clases) */}
          {form.type === "class" && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Reglas de horario</CardTitle>
                  <p className="text-xs text-zinc-400 mt-1">
                    Define cuándo se ofrecen clases. Las sesiones se materializan desde el{" "}
                    <Link href={`/dashboard/talleres/${id}/calendario`} className="underline text-zinc-600 hover:text-zinc-900">
                      calendario
                    </Link>.
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
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
                  {!newScheduleDraft && (
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
                      <div className="border rounded-lg p-4 space-y-4 bg-zinc-50">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">Cambiando horario</Badge>
                          <button
                            type="button"
                            onClick={() => setChangeForm(null)}
                            className="text-zinc-400 hover:text-zinc-900"
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
                                      ? "bg-zinc-900 text-white border-zinc-900"
                                      : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
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
                            <Input
                              type="time"
                              value={changeForm.time_start}
                              onChange={(e) =>
                                setChangeForm({ ...changeForm, time_start: e.target.value })
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
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Válido desde (opcional)</Label>
                            <Input
                              type="date"
                              value={changeForm.valid_from}
                              onChange={(e) =>
                                setChangeForm({ ...changeForm, valid_from: e.target.value })
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Válido hasta (opcional)</Label>
                            <Input
                              type="date"
                              value={changeForm.valid_until}
                              onChange={(e) =>
                                setChangeForm({ ...changeForm, valid_until: e.target.value })
                              }
                            />
                          </div>
                        </div>

                        {/* Change date (required) */}
                        <div className="space-y-1 border-t pt-3">
                          <Label className="text-xs font-semibold">
                            Fecha de inicio del cambio *
                          </Label>
                          <Input
                            type="date"
                            value={changeForm.change_date}
                            onChange={(e) =>
                              setChangeForm({ ...changeForm, change_date: e.target.value })
                            }
                          />
                          <p className="text-xs text-zinc-400">
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
                          <p className="text-xs text-zinc-500">
                            Desde {sch.valid_from}
                            {sch.valid_until ? ` hasta ${sch.valid_until}` : " (sin fin)"}
                          </p>
                        </div>
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
                      </div>
                    )}
                  </div>
                ))}

                {existingSchedules.length === 0 && !newScheduleDraft && (
                  <p className="text-sm text-zinc-400 text-center py-4">
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
                        className="text-zinc-400 hover:text-zinc-900"
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
                                  ? "bg-zinc-900 text-white border-zinc-900"
                                  : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
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
                        <Input
                          type="time"
                          value={newScheduleDraft.time_start}
                          onChange={(e) =>
                            setNewScheduleDraft({ ...newScheduleDraft, time_start: e.target.value })
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

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Válido desde (opcional)</Label>
                        <Input
                          type="date"
                          value={newScheduleDraft.valid_from}
                          onChange={(e) =>
                            setNewScheduleDraft({ ...newScheduleDraft, valid_from: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Válido hasta (opcional)</Label>
                        <Input
                          type="date"
                          value={newScheduleDraft.valid_until}
                          onChange={(e) =>
                            setNewScheduleDraft({
                              ...newScheduleDraft,
                              valid_until: e.target.value,
                            })
                          }
                        />
                      </div>
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

          {/* Sesiones (non-class types) */}
          {form.type !== "class" && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Sesiones</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addSession}>
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar fecha
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {sessions.length === 0 ? (
                  <p className="text-sm text-zinc-400 text-center py-4">
                    Sin fechas agendadas.
                  </p>
                ) : (
                  sessions.map((s, i) => (
                    <div key={i} className="border rounded-lg p-4 space-y-3 relative">
                      <button
                        type="button"
                        onClick={() => removeSession(i)}
                        className="absolute top-3 right-3 text-zinc-400 hover:text-zinc-900"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <Badge variant="outline" className="text-xs">
                        Sesión {i + 1}
                      </Badge>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Inicio</Label>
                          <Input
                            type="datetime-local"
                            value={s.starts_at}
                            onChange={(e) => updateSession(i, "starts_at", e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Fin</Label>
                          <Input
                            type="datetime-local"
                            value={s.ends_at}
                            onChange={(e) => updateSession(i, "ends_at", e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Notas (opcional)</Label>
                        <Input
                          placeholder="Ej: Materiales incluidos"
                          value={s.notes}
                          onChange={(e) => updateSession(i, "notes", e.target.value)}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Acciones */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-400">
              Estado:{" "}
              <span className="font-medium text-zinc-700">
                {form.status === "published"
                  ? "Publicado"
                  : form.status === "draft"
                  ? "Borrador"
                  : "Archivado"}
              </span>
            </p>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() =>
                  save(form.status === "published" ? "draft" : "draft")
                }
              >
                {form.status === "published" ? "Pasar a borrador" : "Guardar borrador"}
              </Button>
              <Button
                type="button"
                disabled={saving}
                onClick={() => save("published")}
              >
                {saving ? "Guardando..." : "Publicar"}
              </Button>
            </div>
          </div>
        </div>
      </div>

    </main>
  );
}
