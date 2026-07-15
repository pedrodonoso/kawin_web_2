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
import { api, adminApi, venuesApi, type Category, type Venue } from "@/lib/api";
import { Modality, WorkshopType } from "@/lib/constants";
import { LocationPicker } from "@/components/map/LocationPicker";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { DateTimeRangePicker } from "@/components/ui/date-time-range-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { localDateToNaiveISO, naiveISOToLocalDate } from "@/lib/utils";
import { ArrowLeft, Plus, Send, X, Repeat, Info } from "lucide-react";
import { Switch } from "@/components/ui/switch";
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
  const [venues, setVenues] = useState<Venue[]>([]);
  const [sessions, setSessions] = useState<SessionDraft[]>([]);
  const [schedules, setSchedules] = useState<ScheduleDraft[]>([emptySchedule()]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [isPaid, setIsPaid] = useState(false);

  const [form, setForm] = useState({
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
    maps_url: "",
    online_url: "",
    notes: "",
    category_id: "",
    venue_id: "",
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
    venuesApi.list().then(setVenues).catch(() => {});
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
      const effectivePrice = isPaid ? Number(form.price) : 0;
      if (effectivePrice > 9_999_999) {
        toast.error("El precio no puede superar 9.999.999");
        setLoading(false);
        return;
      }

      let workshopId: string | undefined;

      const coordPayload = {
        lat: form.lat !== "" ? Number(form.lat) : null,
        lng: form.lng !== "" ? Number(form.lng) : null,
      };

      const usesSchedules = form.type === WorkshopType.CLASS || isRecurring;

      if (usesSchedules) {
        const res = await api.post<{ data: { id: string } }>("/api/v1/workshops", {
          ...form,
          ...coordPayload,
          status: "draft",
          price: effectivePrice,
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
          price: effectivePrice,
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
                <RichTextEditor
                  value={form.description}
                  onChange={(html) => set("description", html)}
                  placeholder="Describe tu taller: qué aprenderán, qué incluye, quién puede asistir..."
                />
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
              {/* Type info box */}
              {(() => {
                const typeInfo: Record<string, { color: string; title: string; desc: string; sessions: string; recurring: string }> = {
                  workshop: {
                    color: "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-200",
                    title: "Taller",
                    desc: "Actividad puntual o de pocas sesiones con fecha(s) definida(s). Ideal para experiencias únicas.",
                    sessions: "Por defecto defines cada sesión con fecha y hora manualmente.",
                    recurring: "También puedes activar horario recurrente: defines días y hora fijos, y luego materializas las sesiones desde el calendario cuando quieras habilitarlas.",
                  },
                  course: {
                    color: "bg-purple-50 border-purple-200 text-purple-900 dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-200",
                    title: "Curso",
                    desc: "Programa de aprendizaje estructurado con varias sesiones secuenciales. Los estudiantes reservan el curso completo.",
                    sessions: "Por defecto defines cada sesión del programa manualmente.",
                    recurring: "También puedes activar horario recurrente: defines el patrón de días y hora, y luego materializas las sesiones desde el calendario.",
                  },
                  class: {
                    color: "bg-green-50 border-green-200 text-green-900 dark:bg-green-950/40 dark:border-green-800 dark:text-green-200",
                    title: "Clase recurrente",
                    desc: "Actividad que se repite en horarios fijos semana a semana. Los estudiantes reservan sesiones individuales.",
                    sessions: "El horario recurrente está siempre activo para este tipo.",
                    recurring: "Defines días de la semana, hora y duración. Las sesiones no se crean solas — debes materializarlas manualmente desde el calendario antes de que los estudiantes puedan reservarlas.",
                  },
                  event: {
                    color: "bg-orange-50 border-orange-200 text-orange-900 dark:bg-orange-950/40 dark:border-orange-800 dark:text-orange-200",
                    title: "Evento",
                    desc: "Acontecimiento especial con fecha fija: charla, presentación, demo, etc. Sin estructura de aprendizaje.",
                    sessions: "Por defecto defines cada sesión del evento manualmente.",
                    recurring: "También puedes activar horario recurrente si el evento se repite en días y hora fijos (p. ej. feria mensual), y materializar las sesiones desde el calendario.",
                  },
                };
                const info = typeInfo[form.type];
                if (!info) return null;
                return (
                  <div className={`flex gap-3 rounded-lg border p-3 text-sm ${info.color}`}>
                    <Info className="h-4 w-4 mt-0.5 shrink-0 opacity-70" />
                    <div className="space-y-1.5">
                      <p className="font-medium">{info.title}</p>
                      <p className="opacity-80">{info.desc}</p>
                      <p className="opacity-70 text-xs">📅 {info.sessions}</p>
                      <p className="opacity-70 text-xs">🔁 {info.recurring}</p>
                    </div>
                  </div>
                );
              })()}
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
                  value={form.notes}
                  onChange={(html) => set("notes", html)}
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
                <>
                  {venues.length > 0 && (
                    <div className="space-y-2">
                      <Label>Sede (opcional)</Label>
                      <Select
                        value={form.venue_id || "none"}
                        onValueChange={(v) => set("venue_id", v === "none" ? "" : v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sin sede" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin sede</SelectItem>
                          {venues.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground/70">
                        Si eliges una sede, su dirección y ubicación en el mapa se usan para este taller.
                      </p>
                    </div>
                  )}

                  {form.venue_id ? (
                    <div className="space-y-2">
                      <Label htmlFor="address">Indicaciones adicionales</Label>
                      <Input
                        id="address"
                        placeholder="Ej: Piso 3, sala 2, tocar timbre 4B..."
                        value={form.address}
                        onChange={(e) => set("address", e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground/70">La ubicación principal la define la sede.</p>
                    </div>
                  ) : (
                    <>
                      <LocationPicker
                        location={form.location}
                        lat={form.lat}
                        lng={form.lng}
                        onLocationChange={(v) => set("location", v)}
                        onCoordsChange={(lat, lng) => setForm((f) => ({ ...f, lat, lng }))}
                        onMapsUrlChange={(v) => set("maps_url", v)}
                      />
                      <div className="space-y-2">
                        <Label htmlFor="address">Indicaciones adicionales</Label>
                        <Input
                          id="address"
                          placeholder="Ej: Piso 3, al lado de Walmart, tocar timbre 4B..."
                          value={form.address}
                          onChange={(e) => set("address", e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground/70">Instrucciones para llegar o encontrar el lugar.</p>
                      </div>
                    </>
                  )}
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
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Taller de pago</p>
                  <p className="text-xs text-muted-foreground/70">Por defecto el taller es gratuito</p>
                </div>
                <Switch
                  checked={isPaid}
                  onCheckedChange={(v) => {
                    setIsPaid(v);
                    if (!v) set("price", "");
                  }}
                />
              </div>

              {isPaid && (
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
                      min="1"
                      max="9999999"
                      step="1"
                      placeholder="Ej: 15000"
                      required
                      value={form.price}
                      onChange={(e) => set("price", e.target.value.replace(/[.,]/g, ""))}
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
                  onChange={(e) => set("capacity", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Toggle horario recurrente — solo para tipos no-class */}
          {form.type !== WorkshopType.CLASS && (
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Repeat className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Horario recurrente</p>
                      <p className="text-xs text-muted-foreground/70">
                        Configura días y horarios fijos en vez de fechas individuales
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={isRecurring}
                    onCheckedChange={setIsRecurring}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Schedule editor — para class (siempre) o cuando isRecurring está activo */}
          {(form.type === WorkshopType.CLASS || isRecurring) && (
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
                        <TimePicker
                          value={sch.time_start}
                          onChange={(v) => updateSchedule(i, "time_start", v)}
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
                    <div className="space-y-1">
                      <Label className="text-xs">Vigencia (opcional)</Label>
                      <DateRangePicker
                        from={sch.valid_from}
                        to={sch.valid_until}
                        onFromChange={(v) => updateSchedule(i, "valid_from", v)}
                        onToChange={(v) => updateSchedule(i, "valid_until", v)}
                        placeholder="Sin límite de vigencia"
                        minDate={new Date()}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Manual sessions editor — tipos no-class sin horario recurrente */}
          {form.type !== WorkshopType.CLASS && !isRecurring && (
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
                      <DateTimeRangePicker
                        startDate={s.starts_at ? naiveISOToLocalDate(s.starts_at) : undefined}
                        endDate={s.ends_at ? naiveISOToLocalDate(s.ends_at) : undefined}
                        onStartChange={(d) => updateSession(i, "starts_at", localDateToNaiveISO(d))}
                        onEndChange={(d) => updateSession(i, "ends_at", localDateToNaiveISO(d))}
                      />
                      <div className="space-y-1">
                        <Label className="text-xs">Notas (opcional)</Label>
                        <RichTextEditor
                          value={s.notes}
                          onChange={(html) => updateSession(i, "notes", html)}
                          placeholder="Ej: Materiales incluidos"
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
                  onClick={() => { submitModeRef.current = "publish"; }}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {loading ? "Publicando..." : "Publicar"}
                </Button>
              </>
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
