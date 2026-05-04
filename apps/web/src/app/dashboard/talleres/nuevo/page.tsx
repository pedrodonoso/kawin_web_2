"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, adminApi, type Category } from "@/lib/api";
import { Modality, WorkshopType } from "@/lib/constants";
import { LocationPicker } from "@/components/map/LocationPicker";
import { ArrowLeft, Plus, Send, X } from "lucide-react";
import Link from "next/link";

interface SessionDraft {
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

function emptySchedule(): ScheduleDraft {
  return { days_of_week: [], time_start: "", duration_min: 60, valid_from: "", valid_until: "" };
}

export default function NuevoTallerPage() {
  const router = useRouter();
  const submitModeRef = useRef<"draft" | "review" | "publish">("draft");
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sessions, setSessions] = useState<SessionDraft[]>([]);
  const [schedules, setSchedules] = useState<ScheduleDraft[]>([emptySchedule()]);

  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "workshop",
    modality: "in-person",
    price: "",
    currency: "CLP",
    capacity: "",
    location: "",
    lat: "",
    lng: "",
    online_url: "",
    category_id: "",
    status: "draft",
  });

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) { router.push("/login"); return; }
    try {
      const user = JSON.parse(raw);
      if (user?.role === "admin") setIsAdmin(true);
    } catch { /* ignore */ }
    api.getList<Category>("/api/v1/categories").then(setCategories).catch(() => {});
  }, [router]);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  // --- Session helpers ---
  function addSession() {
    setSessions((s) => [...s, { starts_at: "", ends_at: "", notes: "" }]);
  }

  function removeSession(i: number) {
    setSessions((s) => s.filter((_, idx) => idx !== i));
  }

  function updateSession(i: number, field: keyof SessionDraft, value: string) {
    setSessions((s) => s.map((sess, idx) => (idx === i ? { ...sess, [field]: value } : sess)));
  }

  // --- Schedule helpers ---
  function addSchedule() {
    setSchedules((s) => [...s, emptySchedule()]);
  }

  function removeSchedule(i: number) {
    setSchedules((s) => s.filter((_, idx) => idx !== i));
  }

  function updateSchedule<K extends keyof ScheduleDraft>(i: number, field: K, value: ScheduleDraft[K]) {
    setSchedules((s) => s.map((sch, idx) => (idx === i ? { ...sch, [field]: value } : sch)));
  }

  function toggleDay(scheduleIdx: number, day: number) {
    setSchedules((s) =>
      s.map((sch, idx) => {
        if (idx !== scheduleIdx) return sch;
        const has = sch.days_of_week.includes(day);
        return {
          ...sch,
          days_of_week: has
            ? sch.days_of_week.filter((d) => d !== day)
            : [...sch.days_of_week, day],
        };
      })
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const mode = submitModeRef.current;
    try {
      if (Number(form.price) > 9_999_999) {
        toast.error("El precio no puede superar 9.999.999");
        setLoading(false);
        return;
      }

      let workshopId: string | undefined;

      const coordPayload = {
        lat: form.lat !== "" ? Number(form.lat) : null,
        lng: form.lng !== "" ? Number(form.lng) : null,
      };

      if (form.type === WorkshopType.CLASS) {
        const res = await api.post<{ data: { id: string } }>("/api/v1/workshops", {
          ...form,
          ...coordPayload,
          status: "draft",
          price: Number(form.price),
          capacity: form.capacity ? Number(form.capacity) : undefined,
        });
        workshopId = res?.data?.id;
        if (workshopId) {
          for (const sch of schedules) {
            if (sch.days_of_week.length > 0 && sch.time_start) {
              await api.post(`/api/v1/workshops/${workshopId}/schedules`, {
                days_of_week: sch.days_of_week,
                time_start: sch.time_start,
                duration_min: sch.duration_min,
                valid_from: sch.valid_from || undefined,
                valid_until: sch.valid_until || undefined,
              });
            }
          }
        }
      } else {
        const res = await api.post<{ data: { id: string } }>("/api/v1/workshops", {
          ...form,
          ...coordPayload,
          status: "draft",
          price: Number(form.price),
          capacity: form.capacity ? Number(form.capacity) : undefined,
          sessions,
        });
        workshopId = res?.data?.id;
      }

      if (mode === "publish" && workshopId) {
        await adminApi.reviewWorkshop(workshopId, "approve");
        toast.success("¡Taller publicado!");
      } else if (mode === "review" && workshopId) {
        await adminApi.submitForReview(workshopId);
        toast.success("¡Taller enviado a revisión!");
      } else {
        toast.success("¡Taller guardado como borrador!");
      }
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear el taller");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Volver
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Nuevo taller</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
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
                  required
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
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
                  onChange={(e) => set("description", e.target.value)}
                />
                <p className="text-xs text-muted-foreground/70 text-right">{form.description.length}/2000</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={form.type} onValueChange={(v) => set("type", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="workshop">Taller</SelectItem>
                      <SelectItem value="course">Curso</SelectItem>
                      <SelectItem value="class">Clase</SelectItem>
                      <SelectItem value="event">Evento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Categoría</Label>
                  <Select value={form.category_id} onValueChange={(v) => set("category_id", v)}>
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
                    onClick={() => set("modality", m.value)}
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
                <LocationPicker
                  location={form.location}
                  lat={form.lat}
                  lng={form.lng}
                  onLocationChange={(v) => set("location", v)}
                  onCoordsChange={(lat, lng) => setForm((f) => ({ ...f, lat, lng }))}
                />
              )}
              {(form.modality === Modality.ONLINE || form.modality === Modality.HYBRID) && (
                <div className="space-y-2">
                  <Label htmlFor="online_url">Link de la clase</Label>
                  <Input
                    id="online_url"
                    type="url"
                    placeholder="Ej: https://meet.google.com/abc-xyz"
                    value={form.online_url}
                    onChange={(e) => set("online_url", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground/70">Zoom, Meet, Teams u otro. Solo visible para estudiantes con reserva confirmada.</p>
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
                    <Select value={form.currency} onValueChange={(v) => set("currency", v)}>
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
                      required
                      value={form.price}
                      onChange={(e) => set("price", e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground/70">Ingresa 0 para talleres gratuitos</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="capacity">Cupos máximos</Label>
                  <Input
                    id="capacity"
                    type="number"
                    min="1"
                    placeholder="Sin límite"
                    value={form.capacity}
                    onChange={(e) => set("capacity", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Schedule editor — only for type === "class" */}
          {form.type === WorkshopType.CLASS && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Horario recurrente</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addSchedule}>
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar franja
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {schedules.map((sch, i) => (
                  <div key={i} className="border rounded-lg p-4 space-y-4 relative">
                    {schedules.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSchedule(i)}
                        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    <Badge variant="outline" className="text-xs">Franja {i + 1}</Badge>

                    {/* Day picker */}
                    <div className="space-y-2">
                      <Label className="text-xs">Días de la semana</Label>
                      <div className="flex gap-2 flex-wrap">
                        {DAYS.map((d) => {
                          const active = sch.days_of_week.includes(d.value);
                          return (
                            <button
                              key={d.value}
                              type="button"
                              onClick={() => toggleDay(i, d.value)}
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
                        <Input
                          type="time"
                          value={sch.time_start}
                          onChange={(e) => updateSchedule(i, "time_start", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Duración (minutos)</Label>
                        <Input
                          type="number"
                          min="15"
                          step="15"
                          placeholder="60"
                          value={sch.duration_min}
                          onChange={(e) =>
                            updateSchedule(i, "duration_min", Number(e.target.value))
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
                          value={sch.valid_from}
                          onChange={(e) => updateSchedule(i, "valid_from", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Válido hasta (opcional)</Label>
                        <Input
                          type="date"
                          value={sch.valid_until}
                          onChange={(e) => updateSchedule(i, "valid_until", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Manual sessions editor — for non-class types */}
          {form.type !== WorkshopType.CLASS && (
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
                  <p className="text-sm text-muted-foreground/70 text-center py-4">
                    Sin fechas — puedes agregarlas ahora o más tarde.
                  </p>
                ) : (
                  sessions.map((s, i) => (
                    <div key={i} className="border rounded-lg p-4 space-y-3 relative">
                      <button
                        type="button"
                        onClick={() => removeSession(i)}
                        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <Badge variant="outline" className="text-xs">Sesión {i + 1}</Badge>
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

          {/* Actions */}
          <div className="flex justify-end gap-3">
            {isAdmin ? (
              <Button
                type="submit"
                disabled={loading}
                onClick={() => { submitModeRef.current = "publish"; }}
              >
                <Send className="h-4 w-4 mr-2" />
                {loading ? "Publicando..." : "Publicar"}
              </Button>
            ) : (
              <>
                <Button
                  type="submit"
                  variant="outline"
                  disabled={loading}
                  onClick={() => { submitModeRef.current = "draft"; }}
                >
                  Guardar borrador
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  onClick={() => { submitModeRef.current = "review"; }}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {loading ? "Enviando..." : "Enviar a revisión"}
                </Button>
              </>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}
