"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Plus, X,
  Check, Pencil, CalendarDays, Users, Wifi, WifiOff, Trash2,
  LayoutGrid, CalendarRange,
} from "lucide-react";
import Link from "next/link";
import { api, type AvailableSlot, type Schedule, type ApiResponse } from "@/lib/api";

// ——— Constantes ————————————————————————————————————————————————

const DAYS = [
  { label: "Lun", value: 1 },
  { label: "Mar", value: 2 },
  { label: "Mié", value: 3 },
  { label: "Jue", value: 4 },
  { label: "Vie", value: 5 },
  { label: "Sáb", value: 6 },
  { label: "Dom", value: 0 },
];

// ——— Tipos ——————————————————————————————————————————————————————

interface ScheduleDraft {
  days_of_week: number[];
  time_start: string;
  duration_min: number;
  valid_from: string;
  valid_until: string;
}
interface ChangeForm extends ScheduleDraft {
  scheduleId: string;
  change_date: string;
}

function emptyDraft(): ScheduleDraft {
  return { days_of_week: [], time_start: "", duration_min: 60, valid_from: "", valid_until: "" };
}
function formatDays(days: number[] | undefined | null): string {
  if (!days?.length) return "—";
  return [...days]
    .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
    .map((d) => DAYS.find((x) => x.value === d)?.label ?? String(d))
    .join(", ");
}

// ——— Helpers fecha ——————————————————————————————————————————————

function addDays(date: Date, n: number) {
  const d = new Date(date); d.setDate(d.getDate() + n); return d;
}
function toYMD(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function startOfWeek(date: Date) {
  const d = new Date(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}
function formatTime(t: string) {
  if (t.includes("T")) return new Date(t).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  return t.slice(0, 5);
}

type SlotStatus = AvailableSlot["status"];
type ViewMode = "week" | "day";

const STATUS_BG: Record<SlotStatus, string> = {
  not_materialized: "bg-muted/40 border-dashed",
  available:        "bg-emerald-50 border-emerald-200",
  full:             "bg-amber-50 border-amber-200",
  cancelled:        "bg-red-50/60 border-red-100 opacity-60",
};
const STATUS_DOT: Record<SlotStatus, string> = {
  not_materialized: "bg-muted-foreground/30",
  available:        "bg-emerald-400",
  full:             "bg-amber-400",
  cancelled:        "bg-red-300",
};
const STATUS_LABEL: Record<SlotStatus, string> = {
  not_materialized: "Sin crear",
  available:        "Activa",
  full:             "Llena",
  cancelled:        "Cancelada",
};

// ——— DayPicker ——————————————————————————————————————————————————

function DayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {DAYS.map((d) => {
        const active = value.includes(d.value);
        return (
          <button key={d.value} type="button"
            onClick={() => onChange(active ? value.filter((x) => x !== d.value) : [...value, d.value])}
            className={`w-10 h-10 rounded-full text-xs font-semibold border-2 transition-all ${
              active ? "bg-primary text-primary-foreground border-primary"
                     : "bg-card text-foreground/60 border-border hover:border-primary/50"
            }`}>
            {d.label}
          </button>
        );
      })}
    </div>
  );
}

// ——— ScheduleForm ——————————————————————————————————————————————

function ScheduleForm({
  title, value, showChangeDate = false, changeDate = "", onChangeDate,
  onChange, onSave, onCancel, saving,
}: {
  title: string;
  value: ScheduleDraft;
  showChangeDate?: boolean;
  changeDate?: string;
  onChangeDate?: (v: string) => void;
  onChange: (v: ScheduleDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  saving?: boolean;
}) {
  return (
    <div className="border rounded-xl p-4 space-y-4 bg-background">
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="text-xs">{title}</Badge>
        <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Días de la semana</Label>
        <DayPicker value={value.days_of_week} onChange={(v) => onChange({ ...value, days_of_week: v })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Hora de inicio *</Label>
          <Input type="time" value={value.time_start} onChange={(e) => onChange({ ...value, time_start: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Duración (min)</Label>
          <Input type="number" min={15} step={15} value={value.duration_min}
            onChange={(e) => onChange({ ...value, duration_min: Number(e.target.value) })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Válido desde (opcional)</Label>
          <Input type="date" value={value.valid_from} onChange={(e) => onChange({ ...value, valid_from: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Válido hasta (opcional)</Label>
          <Input type="date" value={value.valid_until} onChange={(e) => onChange({ ...value, valid_until: e.target.value })} />
        </div>
      </div>
      {showChangeDate && (
        <div className="space-y-1.5 border-t pt-3">
          <Label className="text-xs font-semibold">Fecha de inicio del cambio *</Label>
          <Input type="date" value={changeDate} onChange={(e) => onChangeDate?.(e.target.value)} />
          <p className="text-xs text-muted-foreground">Las reservas a partir de esta fecha serán afectadas.</p>
        </div>
      )}
      <div className="flex gap-2 justify-end pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button type="button" size="sm" disabled={saving} onClick={onSave}>
          {saving ? "Guardando…" : showChangeDate ? "Confirmar cambio" : "Guardar regla"}
        </Button>
      </div>
    </div>
  );
}

// ——— SlotCard ———————————————————————————————————————————————————

function SlotCard({
  slot, busy, dayView,
  editingURL, urlDraft,
  onMaterialize, onCancel, onEditURL, onSaveURL, onCancelURL, onUrlDraftChange,
}: {
  slot: AvailableSlot;
  busy: boolean;
  dayView: boolean;
  editingURL: string | null;
  urlDraft: string;
  onMaterialize: () => void;
  onCancel: () => void;
  onEditURL: () => void;
  onSaveURL: () => void;
  onCancelURL: () => void;
  onUrlDraftChange: (v: string) => void;
}) {
  const hasCap   = slot.spots_remaining !== undefined;
  const totalCap = hasCap ? (slot.booking_count ?? 0) + slot.spots_remaining! : null;
  const isEditing = editingURL === slot.session_id;

  return (
    <div className={`rounded-xl border flex flex-col gap-2 transition-opacity
      ${dayView ? "p-4" : "p-2.5 text-xs"}
      ${STATUS_BG[slot.status]} ${busy ? "opacity-50 pointer-events-none" : ""}`}>

      {/* Hora + estado */}
      <div className="flex items-center justify-between gap-2">
        <span className={`font-bold leading-tight ${dayView ? "text-base" : "text-sm"}`}>
          {formatTime(slot.time)}
        </span>
        <div className="flex items-center gap-1.5">
          {dayView && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium
              ${slot.status === "available" ? "bg-emerald-100 text-emerald-700"
              : slot.status === "full" ? "bg-amber-100 text-amber-700"
              : slot.status === "cancelled" ? "bg-red-100 text-red-500"
              : "bg-muted text-muted-foreground"}`}>
              {STATUS_LABEL[slot.status]}
            </span>
          )}
          <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[slot.status]}`} />
        </div>
      </div>

      <div className={`text-muted-foreground font-medium uppercase tracking-wide ${dayView ? "text-xs" : "text-[10px]"}`}>
        {slot.duration_min} min{!dayView && ` · ${STATUS_LABEL[slot.status]}`}
      </div>

      {/* Reservas / cupos */}
      {slot.status !== "not_materialized" && slot.status !== "cancelled" && (
        <div className="space-y-1">
          {totalCap !== null ? (
            <>
              <div className={`flex items-center justify-between text-muted-foreground ${dayView ? "text-xs" : "text-[10px]"}`}>
                <span className="flex items-center gap-1">
                  <Users className={dayView ? "h-3 w-3" : "h-2.5 w-2.5"} />
                  {slot.booking_count ?? 0}/{totalCap}
                </span>
                <span>{slot.spots_remaining} cupos libres</span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${slot.status === "full" ? "bg-amber-400" : "bg-emerald-400"}`}
                  style={{ width: `${Math.min(((slot.booking_count ?? 0) / totalCap) * 100, 100)}%` }}
                />
              </div>
            </>
          ) : (slot.booking_count ?? 0) > 0 ? (
            <span className={`flex items-center gap-1 text-muted-foreground ${dayView ? "text-xs" : "text-[10px]"}`}>
              <Users className={dayView ? "h-3 w-3" : "h-2.5 w-2.5"} />
              {slot.booking_count} reserva{slot.booking_count !== 1 ? "s" : ""}
            </span>
          ) : (
            <span className={`text-muted-foreground ${dayView ? "text-xs" : "text-[10px]"}`}>Sin reservas</span>
          )}
        </div>
      )}

      {/* Link online */}
      {slot.session_id && (
        isEditing ? (
          <div className="flex gap-1.5">
            <input
              className={`flex-1 border rounded-md px-2 py-1 min-w-0 bg-background ${dayView ? "text-sm" : "text-xs"}`}
              placeholder="https://meet.google.com/..."
              value={urlDraft}
              onChange={(e) => onUrlDraftChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onSaveURL(); if (e.key === "Escape") onCancelURL(); }}
              autoFocus
            />
            <button className="text-emerald-600 hover:text-emerald-700 shrink-0 p-1" onClick={onSaveURL}>
              <Check className={dayView ? "h-4 w-4" : "h-3.5 w-3.5"} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            {slot.online_url
              ? <Wifi className={`text-blue-500 shrink-0 ${dayView ? "h-3.5 w-3.5" : "h-3 w-3"}`} />
              : <WifiOff className={`text-muted-foreground/50 shrink-0 ${dayView ? "h-3.5 w-3.5" : "h-3 w-3"}`} />}
            {slot.online_url ? (
              <a href={slot.online_url} target="_blank" rel="noopener noreferrer"
                className={`text-blue-600 hover:underline truncate flex-1 ${dayView ? "text-xs" : "text-[10px]"}`}
                title={slot.online_url}>
                {slot.online_url.replace(/^https?:\/\//, "").slice(0, dayView ? 30 : 18)}…
              </a>
            ) : (
              <span className={`text-muted-foreground/60 italic flex-1 ${dayView ? "text-xs" : "text-[10px]"}`}>Sin link</span>
            )}
            <button className="text-muted-foreground/50 hover:text-muted-foreground shrink-0" onClick={onEditURL}>
              <Pencil className={dayView ? "h-3.5 w-3.5" : "h-2.5 w-2.5"} />
            </button>
          </div>
        )
      )}

      {/* Acciones */}
      {slot.status === "not_materialized" && (
        dayView ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={onMaterialize}
            className="w-full border-dashed">
            <Plus className="h-3.5 w-3.5 mr-1" />
            {busy ? "Creando…" : "Crear sesión"}
          </Button>
        ) : (
          <button disabled={busy} onClick={onMaterialize}
            className="w-full flex items-center justify-center gap-1 rounded-lg border border-dashed border-muted-foreground/30
              py-1.5 text-[11px] font-medium text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors">
            <Plus className="h-3 w-3" />
            {busy ? "Creando…" : "Crear sesión"}
          </button>
        )
      )}

      {(slot.status === "available" || slot.status === "full") && (
        slot.booking_count > 0 ? (
          <div className={`text-muted-foreground/60 text-center py-0.5 ${dayView ? "text-xs" : "text-[10px]"}`}>
            Con reservas — no cancelable
          </div>
        ) : (
          dayView ? (
            <Button size="sm" variant="outline" disabled={busy} onClick={onCancel}
              className="w-full text-red-600 border-red-200 hover:bg-red-50">
              <X className="h-3.5 w-3.5 mr-1" />
              {busy ? "Cancelando…" : "Cancelar sesión"}
            </Button>
          ) : (
            <button disabled={busy} onClick={onCancel}
              className="w-full flex items-center justify-center gap-1 rounded-lg border border-red-200
                py-1.5 text-[11px] font-medium text-red-500 hover:bg-red-50 transition-colors">
              <X className="h-3 w-3" />
              {busy ? "Cancelando…" : "Cancelar"}
            </button>
          )
        )
      )}
    </div>
  );
}

// ——— Página principal ————————————————————————————————————————————

export default function CalendarioTallerPage() {
  const router     = useRouter();
  const params     = useParams();
  const workshopId = Array.isArray(params?.id) ? params.id[0] : (params?.id ?? "");

  // Vista
  const [viewMode, setViewMode]       = useState<ViewMode>("week");
  const [selectedDay, setSelectedDay] = useState(() => new Date());

  // Calendario
  const [loading, setLoading]             = useState(true);
  const [weekStart, setWeekStart]         = useState(() => startOfWeek(new Date()));
  const [slots, setSlots]                 = useState<AvailableSlot[]>([]);
  const [workshopTitle, setWorkshopTitle] = useState("");
  const [operating, setOperating]         = useState<string | null>(null);
  const [editingURL, setEditingURL]       = useState<string | null>(null);
  const [urlDraft, setUrlDraft]           = useState("");

  // Reglas
  const [schedules, setSchedules]         = useState<Schedule[]>([]);
  const [newDraft, setNewDraft]           = useState<ScheduleDraft | null>(null);
  const [changeForm, setChangeForm]       = useState<ChangeForm | null>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Rango a cargar según vista
  const weekEnd  = addDays(weekStart, 6);
  const fromStr  = viewMode === "week" ? toYMD(weekStart) : toYMD(selectedDay);
  const toStr    = viewMode === "week" ? toYMD(weekEnd)   : toYMD(selectedDay);

  const loadSlots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<AvailableSlot[]>>(
        `/api/v1/workshops/${workshopId}/available-slots?from=${fromStr}&to=${toStr}`
      );
      setSlots(res.data ?? []);
    } catch {
      toast.error("Error al cargar el calendario");
    } finally {
      setLoading(false);
    }
  }, [workshopId, fromStr, toStr]);

  const loadSchedules = useCallback(async () => {
    try {
      const list = await api.getList<Schedule>(`/api/v1/workshops/${workshopId}/schedules`);
      setSchedules(list);
    } catch {}
  }, [workshopId]);

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) { router.push("/login"); return; }
    if (!workshopId) return;
    api.get<ApiResponse<{ title: string }>>(`/api/v1/my-workshops/${workshopId}`)
      .then((r) => setWorkshopTitle(r.data?.title ?? ""))
      .catch(() => {});
    loadSlots();
    loadSchedules();
  }, [workshopId, router, loadSlots, loadSchedules]);

  // ——— Navegación ——————————————————————————————————————————————

  function prevPeriod() {
    if (viewMode === "week") setWeekStart((w) => addDays(w, -7));
    else setSelectedDay((d) => addDays(d, -1));
  }
  function nextPeriod() {
    if (viewMode === "week") setWeekStart((w) => addDays(w, 7));
    else setSelectedDay((d) => addDays(d, 1));
  }
  function goToday() {
    const today = new Date();
    setSelectedDay(today);
    setWeekStart(startOfWeek(today));
  }

  // Al cambiar vista sincronizar día seleccionado con la semana actual
  function switchView(v: ViewMode) {
    if (v === "day" && viewMode === "week") {
      // Seleccionar hoy si está en la semana visible, si no el lunes
      const today = new Date();
      const todayYMD = toYMD(today);
      const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
      const inWeek = days.some((d) => toYMD(d) === todayYMD);
      setSelectedDay(inWeek ? today : weekStart);
    }
    if (v === "week" && viewMode === "day") {
      setWeekStart(startOfWeek(selectedDay));
    }
    setViewMode(v);
  }

  // ——— Acciones slots ———————————————————————————————————————————

  function slotKey(s: AvailableSlot) { return `${s.schedule_id}:${s.date}`; }

  async function handleMaterialize(slot: AvailableSlot) {
    const key = slotKey(slot);
    setOperating(key);
    try {
      await api.post("/api/v1/sessions/materialize", {
        workshop_id: workshopId, schedule_id: slot.schedule_id, date: slot.date,
      });
      toast.success(`Sesión del ${slot.date} creada`);
      await loadSlots();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear sesión");
    } finally { setOperating(null); }
  }

  async function handleCancel(slot: AvailableSlot) {
    if (!slot.session_id) return;
    if (!window.confirm(`¿Cancelar la sesión del ${slot.date} a las ${slot.time}?`)) return;
    const key = slotKey(slot);
    setOperating(key);
    try {
      const res = await api.post<ApiResponse<{ cancelled_bookings: number }>>(
        "/api/v1/sessions/cancel", { session_id: slot.session_id }
      );
      const n = res.data?.cancelled_bookings ?? 0;
      toast.success(n > 0 ? `Sesión cancelada · ${n} reserva${n !== 1 ? "s" : ""} devuelta${n !== 1 ? "s" : ""}` : "Sesión cancelada");
      await loadSlots();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cancelar");
    } finally { setOperating(null); }
  }

  async function handleUpdateURL(slot: AvailableSlot) {
    if (!slot.session_id) return;
    try {
      await api.patch(`/api/v1/sessions/${slot.session_id}/url`, { online_url: urlDraft });
      toast.success("Link actualizado");
      setEditingURL(null);
      await loadSlots();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  // ——— Acciones reglas ——————————————————————————————————————————

  async function saveNewSchedule() {
    if (!newDraft) return;
    setSavingSchedule(true);
    try {
      await api.post(`/api/v1/workshops/${workshopId}/schedules`, {
        days_of_week: newDraft.days_of_week, time_start: newDraft.time_start,
        duration_min: newDraft.duration_min,
        valid_from:   newDraft.valid_from  || undefined,
        valid_until:  newDraft.valid_until || undefined,
      });
      toast.success("Regla creada");
      setNewDraft(null);
      await Promise.all([loadSchedules(), loadSlots()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally { setSavingSchedule(false); }
  }

  async function submitScheduleChange() {
    if (!changeForm) return;
    setSavingSchedule(true);
    try {
      await api.put(`/api/v1/schedules/${changeForm.scheduleId}`, {
        days_of_week: changeForm.days_of_week, time_start: changeForm.time_start,
        duration_min: changeForm.duration_min,
        valid_from:   changeForm.valid_from  || undefined,
        valid_until:  changeForm.valid_until || undefined,
        change_date:  changeForm.change_date || undefined,
      });
      toast.success("Regla actualizada");
      setChangeForm(null);
      await Promise.all([loadSchedules(), loadSlots()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar");
    } finally { setSavingSchedule(false); }
  }

  async function deleteSchedule(id: string) {
    if (!window.confirm("¿Eliminar esta regla? Las sesiones ya materializadas no se ven afectadas.")) return;
    try {
      await api.delete(`/api/v1/schedules/${id}`);
      setSchedules((prev) => prev.filter((s) => s.id !== id));
      toast.success("Regla eliminada");
      await loadSlots();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  }

  // ——— Render helpers ——————————————————————————————————————————

  const todayYMD   = toYMD(new Date());
  const slotsByDay: Record<string, AvailableSlot[]> = {};
  for (const s of slots) {
    if (!slotsByDay[s.date]) slotsByDay[s.date] = [];
    slotsByDay[s.date].push(s);
  }

  function renderSlotCard(slot: AvailableSlot, dayView: boolean) {
    const key = slotKey(slot);
    return (
      <SlotCard
        key={key}
        slot={slot}
        busy={operating === key}
        dayView={dayView}
        editingURL={editingURL}
        urlDraft={urlDraft}
        onMaterialize={() => handleMaterialize(slot)}
        onCancel={() => handleCancel(slot)}
        onEditURL={() => { setEditingURL(slot.session_id!); setUrlDraft(slot.online_url ?? ""); }}
        onSaveURL={() => handleUpdateURL(slot)}
        onCancelURL={() => setEditingURL(null)}
        onUrlDraftChange={setUrlDraft}
      />
    );
  }

  // ——— Render ——————————————————————————————————————————————————

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/dashboard/talleres/${workshopId}/editar`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-muted-foreground" />
                Calendario
              </h1>
              {workshopTitle && (
                <p className="text-sm text-muted-foreground mt-0.5 truncate max-w-xs">{workshopTitle}</p>
              )}
            </div>
          </div>

          {/* Toggle vista */}
          <div className="flex items-center gap-1 rounded-lg border p-1 bg-muted/30">
            <button
              onClick={() => switchView("day")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === "day"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}>
              <CalendarRange className="h-3.5 w-3.5" />
              Día
            </button>
            <button
              onClick={() => switchView("week")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === "week"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}>
              <LayoutGrid className="h-3.5 w-3.5" />
              Semana
            </button>
          </div>
        </div>

        {/* Navegación */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevPeriod}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextPeriod}>
            <ChevronRight className="h-4 w-4" />
          </Button>

          <span className="text-sm font-medium px-1 flex-1">
            {viewMode === "week" ? (
              <>
                {weekStart.toLocaleDateString("es-CL", { day: "numeric", month: "long" })}
                {" – "}
                {weekEnd.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })}
              </>
            ) : (
              selectedDay.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
            )}
          </span>

          <Button variant="ghost" size="sm" className="text-muted-foreground h-8" onClick={goToday}>
            Hoy
          </Button>
        </div>

        {/* ——— Vista SEMANA ——————————————————————————————————— */}
        {viewMode === "week" && (
          loading ? (
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-14 w-full rounded-xl" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((day) => {
                const ymd      = toYMD(day);
                const isToday  = ymd === todayYMD;
                const daySlots = slotsByDay[ymd] ?? [];
                return (
                  <div key={ymd} className="flex flex-col gap-2">
                    {/* Cabecera día — clic para ir a vista día */}
                    <button
                      onClick={() => { setSelectedDay(day); switchView("day"); }}
                      className={`rounded-xl px-2 py-2 text-center transition-colors w-full
                        ${isToday ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted/70"}`}>
                      <div className="text-[10px] font-semibold uppercase tracking-wide">
                        {day.toLocaleDateString("es-CL", { weekday: "short" })}
                      </div>
                      <div className={`text-lg font-bold leading-tight ${isToday ? "" : "text-foreground"}`}>
                        {day.getDate()}
                      </div>
                      <div className="text-[10px] opacity-70">
                        {day.toLocaleDateString("es-CL", { month: "short" })}
                      </div>
                    </button>

                    {daySlots.length === 0
                      ? <div className="flex-1 min-h-16 rounded-xl border border-dashed border-border/50" />
                      : daySlots.map((slot) => renderSlotCard(slot, false))
                    }
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ——— Vista DÍA ——————————————————————————————————————— */}
        {viewMode === "day" && (
          <div className="space-y-3">
            {/* Mini strip semanal para navegar días */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(selectedDay), i)).map((day) => {
                const ymd      = toYMD(day);
                const isToday  = ymd === todayYMD;
                const isActive = ymd === toYMD(selectedDay);
                const hasSlots = (slotsByDay[ymd]?.length ?? 0) > 0;
                return (
                  <button
                    key={ymd}
                    onClick={() => setSelectedDay(day)}
                    className={`rounded-lg py-2 text-center transition-colors text-xs
                      ${isActive ? "bg-primary text-primary-foreground"
                      : isToday  ? "bg-primary/15 text-primary font-semibold"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted/70"}`}>
                    <div className="text-[10px] font-medium uppercase">
                      {day.toLocaleDateString("es-CL", { weekday: "short" })}
                    </div>
                    <div className="font-bold">{day.getDate()}</div>
                    {hasSlots && (
                      <div className={`w-1 h-1 rounded-full mx-auto mt-0.5 ${isActive ? "bg-primary-foreground" : "bg-primary"}`} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Slots del día seleccionado */}
            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
              </div>
            ) : (slotsByDay[toYMD(selectedDay)] ?? []).length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                <CalendarDays className="h-8 w-8 opacity-30" />
                <p className="text-sm">Sin sesiones para este día</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(slotsByDay[toYMD(selectedDay)] ?? []).map((slot) => renderSlotCard(slot, true))}
              </div>
            )}
          </div>
        )}

        {/* Estado vacío global */}
        {!loading && slots.length === 0 && schedules.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
            <CalendarDays className="h-10 w-10 opacity-30" />
            <p className="text-sm font-medium">Agrega una regla de horario abajo para empezar</p>
          </div>
        )}

        {/* ——— Leyenda ————————————————————————————————————————— */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {(["not_materialized", "available", "full", "cancelled"] as SlotStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${STATUS_DOT[s]}`} />
              {STATUS_LABEL[s]}
            </span>
          ))}
        </div>

        {/* ——— Reglas de horario ——————————————————————————————— */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Reglas de horario</CardTitle>
            {!newDraft && !changeForm && (
              <Button type="button" variant="outline" size="sm" onClick={() => setNewDraft(emptyDraft())}>
                <Plus className="h-4 w-4 mr-1" /> Agregar regla
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {schedules.map((sch) => (
              <div key={sch.id}>
                {changeForm?.scheduleId === sch.id ? (
                  <ScheduleForm
                    title="Modificar regla"
                    value={changeForm}
                    showChangeDate
                    changeDate={changeForm.change_date}
                    onChangeDate={(v) => setChangeForm({ ...changeForm, change_date: v })}
                    onChange={(v) => setChangeForm({ ...changeForm, ...v })}
                    onSave={submitScheduleChange}
                    onCancel={() => setChangeForm(null)}
                    saving={savingSchedule}
                  />
                ) : (
                  <div className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-sm font-medium">
                        {formatDays(sch.days_of_week)}
                        <span className="text-muted-foreground font-normal"> · {sch.time_start} · {sch.duration_min} min</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Desde {sch.valid_from}{sch.valid_until ? ` hasta ${sch.valid_until}` : " (sin fin)"}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button type="button" variant="outline" size="sm"
                        onClick={() => setChangeForm({
                          scheduleId:   sch.id,
                          days_of_week: [...sch.days_of_week],
                          time_start:   sch.time_start,
                          duration_min: sch.duration_min,
                          valid_from:   sch.valid_from,
                          valid_until:  sch.valid_until ?? "",
                          change_date:  "",
                        })}>
                        <Pencil className="h-3 w-3 mr-1" /> Modificar
                      </Button>
                      <Button type="button" variant="outline" size="sm"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => deleteSchedule(sch.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {schedules.length === 0 && !newDraft && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Sin reglas configuradas. Agrega una para generar sesiones recurrentes.
              </p>
            )}

            {newDraft && (
              <ScheduleForm
                title="Nueva regla"
                value={newDraft}
                onChange={setNewDraft}
                onSave={saveNewSchedule}
                onCancel={() => setNewDraft(null)}
                saving={savingSchedule}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
