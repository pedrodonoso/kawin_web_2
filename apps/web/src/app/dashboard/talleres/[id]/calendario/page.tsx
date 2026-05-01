"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Plus, X, Globe,
  Check, Pencil, CalendarDays, Users, Wifi, WifiOff,
} from "lucide-react";
import Link from "next/link";
import { api, type AvailableSlot, type ApiResponse } from "@/lib/api";

// ——— Helpers ————————————————————————————————————————————————————

function addDays(date: Date, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
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

// ——— Componente principal ————————————————————————————————————————

export default function CalendarioTallerPage() {
  const router = useRouter();
  const params = useParams();
  const workshopId = Array.isArray(params?.id) ? params.id[0] : (params?.id ?? "");

  const [loading, setLoading]           = useState(true);
  const [weekStart, setWeekStart]       = useState(() => startOfWeek(new Date()));
  const [slots, setSlots]               = useState<AvailableSlot[]>([]);
  const [workshopTitle, setWorkshopTitle] = useState("");
  const [operating, setOperating]       = useState<string | null>(null);
  const [editingURL, setEditingURL]     = useState<string | null>(null);
  const [urlDraft, setUrlDraft]         = useState("");

  const weekEnd = addDays(weekStart, 6);
  const fromStr = toYMD(weekStart);
  const toStr   = toYMD(weekEnd);

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

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) { router.push("/login"); return; }
    if (!workshopId) return;
    api.get<ApiResponse<{ title: string }>>(`/api/v1/my-workshops/${workshopId}`)
      .then((r) => setWorkshopTitle(r.data?.title ?? ""))
      .catch(() => {});
    loadSlots();
  }, [workshopId, router, loadSlots]);

  function slotKey(s: AvailableSlot) { return `${s.schedule_id}:${s.date}`; }

  async function handleMaterialize(slot: AvailableSlot) {
    const key = slotKey(slot);
    setOperating(key);
    try {
      await api.post<ApiResponse<{ id: string }>>("/api/v1/sessions/materialize", {
        workshop_id: workshopId,
        schedule_id: slot.schedule_id,
        date: slot.date,
      });
      toast.success(`Sesión del ${slot.date} creada`);
      await loadSlots();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear sesión");
    } finally {
      setOperating(null);
    }
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
    } finally {
      setOperating(null);
    }
  }

  async function handleUpdateURL(slot: AvailableSlot) {
    if (!slot.session_id) return;
    try {
      await api.patch(`/api/v1/sessions/${slot.session_id}/url`, { online_url: urlDraft });
      toast.success("Link actualizado");
      setEditingURL(null);
      await loadSlots();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar link");
    }
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const slotsByDay: Record<string, AvailableSlot[]> = {};
  for (const s of slots) {
    if (!slotsByDay[s.date]) slotsByDay[s.date] = [];
    slotsByDay[s.date].push(s);
  }
  const todayYMD = toYMD(new Date());

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/dashboard/talleres/${workshopId}/editar`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-muted-foreground" />
                Calendario de sesiones
              </h1>
              {workshopTitle && (
                <p className="text-sm text-muted-foreground mt-0.5 truncate max-w-xs">{workshopTitle}</p>
              )}
            </div>
          </div>

          {/* Leyenda */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {(["not_materialized", "available", "full", "cancelled"] as SlotStatus[]).map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${STATUS_DOT[s]}`} />
                {STATUS_LABEL[s]}
              </span>
            ))}
          </div>
        </div>

        {/* Navegación semana */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart((w) => addDays(w, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart((w) => addDays(w, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium px-2">
            {weekStart.toLocaleDateString("es-CL", { day: "numeric", month: "long" })}
            {" – "}
            {weekEnd.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })}
          </span>
          <Button
            variant="ghost" size="sm"
            className="text-muted-foreground h-8"
            onClick={() => setWeekStart(startOfWeek(new Date()))}
          >
            Hoy
          </Button>
        </div>

        {/* Grilla */}
        {loading ? (
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {days.map((day) => {
              const ymd   = toYMD(day);
              const today = ymd === todayYMD;
              const daySlots = slotsByDay[ymd] ?? [];

              return (
                <div key={ymd} className="flex flex-col gap-2">
                  {/* Cabecera del día */}
                  <div className={`rounded-xl px-2 py-2 text-center transition-colors ${
                    today
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/40 text-muted-foreground"
                  }`}>
                    <div className="text-[10px] font-semibold uppercase tracking-wide">
                      {day.toLocaleDateString("es-CL", { weekday: "short" })}
                    </div>
                    <div className={`text-lg font-bold leading-tight ${today ? "" : "text-foreground"}`}>
                      {day.getDate()}
                    </div>
                    <div className="text-[10px] opacity-70">
                      {day.toLocaleDateString("es-CL", { month: "short" })}
                    </div>
                  </div>

                  {/* Slots */}
                  {daySlots.length === 0 ? (
                    <div className="flex-1 min-h-16 rounded-xl border border-dashed border-border/50" />
                  ) : (
                    daySlots.map((slot) => {
                      const key  = slotKey(slot);
                      const busy = operating === key;
                      const hasCap = slot.spots_remaining !== undefined;
                      const totalCap = hasCap ? (slot.booking_count ?? 0) + slot.spots_remaining! : null;

                      return (
                        <div
                          key={key}
                          className={`rounded-xl border p-2.5 text-xs flex flex-col gap-2 transition-opacity ${STATUS_BG[slot.status]} ${busy ? "opacity-50 pointer-events-none" : ""}`}
                        >
                          {/* Hora + estado */}
                          <div className="flex items-start justify-between gap-1">
                            <span className="font-bold text-sm leading-tight">
                              {formatTime(slot.time)}
                            </span>
                            <span className={`w-2 h-2 rounded-full mt-0.5 shrink-0 ${STATUS_DOT[slot.status]}`} />
                          </div>

                          <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                            {slot.duration_min}min · {STATUS_LABEL[slot.status]}
                          </div>

                          {/* Reservas / cupos */}
                          {slot.status !== "not_materialized" && slot.status !== "cancelled" && (
                            <div className="space-y-1">
                              {totalCap !== null ? (
                                <>
                                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                    <span className="flex items-center gap-0.5">
                                      <Users className="h-2.5 w-2.5" />
                                      {slot.booking_count ?? 0}/{totalCap}
                                    </span>
                                    <span>{slot.spots_remaining} libre{slot.spots_remaining !== 1 ? "s" : ""}</span>
                                  </div>
                                  <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${slot.status === "full" ? "bg-amber-400" : "bg-emerald-400"}`}
                                      style={{ width: `${Math.min(((slot.booking_count ?? 0) / totalCap) * 100, 100)}%` }}
                                    />
                                  </div>
                                </>
                              ) : (slot.booking_count ?? 0) > 0 ? (
                                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                  <Users className="h-2.5 w-2.5" />
                                  {slot.booking_count} reserva{slot.booking_count !== 1 ? "s" : ""}
                                </span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">Sin reservas</span>
                              )}
                            </div>
                          )}

                          {/* Link online */}
                          {slot.session_id && (
                            editingURL === slot.session_id ? (
                              <div className="flex gap-1">
                                <input
                                  className="flex-1 text-xs border rounded-md px-1.5 py-1 min-w-0 bg-background"
                                  placeholder="https://meet.google.com/..."
                                  value={urlDraft}
                                  onChange={(e) => setUrlDraft(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleUpdateURL(slot);
                                    if (e.key === "Escape") setEditingURL(null);
                                  }}
                                  autoFocus
                                />
                                <button
                                  className="text-emerald-600 hover:text-emerald-700 shrink-0 p-0.5"
                                  onClick={() => handleUpdateURL(slot)}
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                {slot.online_url
                                  ? <Wifi className="h-3 w-3 text-blue-500 shrink-0" />
                                  : <WifiOff className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                                }
                                {slot.online_url ? (
                                  <a
                                    href={slot.online_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] text-blue-600 hover:underline truncate flex-1"
                                    title={slot.online_url}
                                  >
                                    {slot.online_url.replace(/^https?:\/\//, "").slice(0, 18)}…
                                  </a>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground/60 italic flex-1">Sin link</span>
                                )}
                                <button
                                  className="text-muted-foreground/50 hover:text-muted-foreground shrink-0"
                                  onClick={() => { setEditingURL(slot.session_id!); setUrlDraft(slot.online_url ?? ""); }}
                                >
                                  <Pencil className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            )
                          )}

                          {/* Acciones */}
                          {slot.status === "not_materialized" && (
                            <button
                              disabled={busy}
                              onClick={() => handleMaterialize(slot)}
                              className="w-full flex items-center justify-center gap-1 rounded-lg border border-dashed border-muted-foreground/30 py-1.5 text-[11px] font-medium text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
                            >
                              <Plus className="h-3 w-3" />
                              {busy ? "Creando…" : "Crear sesión"}
                            </button>
                          )}

                          {(slot.status === "available" || slot.status === "full") && (
                            slot.booking_count > 0 ? (
                              <div className="text-[10px] text-muted-foreground/60 text-center py-0.5">
                                Con reservas — no cancelable
                              </div>
                            ) : (
                              <button
                                disabled={busy}
                                onClick={() => handleCancel(slot)}
                                className="w-full flex items-center justify-center gap-1 rounded-lg border border-red-200 py-1.5 text-[11px] font-medium text-red-500 hover:bg-red-50 transition-colors"
                              >
                                <X className="h-3 w-3" />
                                {busy ? "Cancelando…" : "Cancelar"}
                              </button>
                            )
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Estado vacío */}
        {!loading && slots.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
            <CalendarDays className="h-10 w-10 opacity-30" />
            <p className="text-sm font-medium">No hay reglas de horario activas para este período</p>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/talleres/${workshopId}/editar`}>
                Agregar regla de horario
              </Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
