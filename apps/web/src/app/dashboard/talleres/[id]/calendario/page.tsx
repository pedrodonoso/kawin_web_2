"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, X, AlertCircle, Globe, Check, Pencil } from "lucide-react";
import Link from "next/link";
import { api, type AvailableSlot, type ApiResponse } from "@/lib/api";

// ——— Helpers de fecha ————————————————————————————————————————————

function addDays(date: Date, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toYMD(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Dom
  const diff = (day + 6) % 7; // Mon=0, ..., Sun=6
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatHeader(date: Date) {
  return date.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" });
}

function formatTime(isoOrHHMM: string) {
  if (isoOrHHMM.includes("T")) {
    return new Date(isoOrHHMM).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  }
  return isoOrHHMM.slice(0, 5);
}

// ——— Estado del slot ————————————————————————————————————————————

type SlotStatus = AvailableSlot["status"];

function statusLabel(status: SlotStatus, bookingCount?: number): string {
  switch (status) {
    case "not_materialized": return "Disponible para crear";
    case "available": return bookingCount ? `${bookingCount} reserva${bookingCount !== 1 ? "s" : ""}` : "Sin reservas";
    case "full": return "Lleno";
    case "cancelled": return "Cancelada";
  }
}

function statusColor(status: SlotStatus): string {
  switch (status) {
    case "not_materialized": return "border-dashed border-zinc-300 bg-zinc-50 text-zinc-400";
    case "available": return "border-green-200 bg-green-50 text-green-800";
    case "full": return "border-amber-200 bg-amber-50 text-amber-800";
    case "cancelled": return "border-red-100 bg-red-50 text-red-400 opacity-60";
  }
}

// ——— Componente principal ————————————————————————————————————————

export default function CalendarioTallerPage() {
  const router = useRouter();
  const params = useParams();
  const workshopId = Array.isArray(params?.id) ? params.id[0] : (params?.id ?? "");

  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [workshopTitle, setWorkshopTitle] = useState("");
  const [operating, setOperating] = useState<string | null>(null); // slot key being operated on
  const [editingURL, setEditingURL] = useState<string | null>(null);   // session_id editando url
  const [urlDraft, setUrlDraft] = useState("");

  const weekEnd = addDays(weekStart, 6);
  const fromStr = toYMD(weekStart);
  const toStr = toYMD(weekEnd);

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

    // Cargar nombre del taller
    api.get<ApiResponse<{ title: string }>>(`/api/v1/my-workshops/${workshopId}`)
      .then((r) => setWorkshopTitle(r.data?.title ?? ""))
      .catch(() => {});

    loadSlots();
  }, [workshopId, router, loadSlots]);

  // ——— Acciones ————————————————————————————————————————————————

  function slotKey(slot: AvailableSlot) {
    return `${slot.schedule_id}:${slot.date}`;
  }

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
    if (!window.confirm(`¿Cancelar la sesión del ${slot.date} a las ${slot.time}? Se devolverán las reservas activas.`)) return;

    const key = slotKey(slot);
    setOperating(key);
    try {
      const res = await api.post<ApiResponse<{ cancelled_bookings: number }>>(
        "/api/v1/sessions/cancel",
        { session_id: slot.session_id }
      );
      const count = res.data?.cancelled_bookings ?? 0;
      toast.success(count > 0 ? `Sesión cancelada · ${count} reserva${count !== 1 ? "s" : ""} devuelta${count !== 1 ? "s" : ""}` : "Sesión cancelada");
      await loadSlots();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cancelar sesión");
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

  // ——— Render ——————————————————————————————————————————————————

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Agrupar slots por fecha
  const slotsByDay: Record<string, AvailableSlot[]> = {};
  for (const slot of slots) {
    if (!slotsByDay[slot.date]) slotsByDay[slot.date] = [];
    slotsByDay[slot.date].push(slot);
  }

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/dashboard/talleres/${workshopId}/editar`}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Volver
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Calendario de sesiones</h1>
            {workshopTitle && (
              <p className="text-sm text-zinc-400 truncate max-w-xs">{workshopTitle}</p>
            )}
          </div>
        </div>

        {/* Leyenda */}
        <div className="flex flex-wrap gap-3 text-xs text-zinc-600">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border border-dashed border-zinc-400 inline-block" />
            Disponible para crear
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-green-200 inline-block" />
            Con sesión activa
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-200 inline-block" />
            Llena
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-100 inline-block" />
            Cancelada
          </span>
        </div>

        {/* Navegación semana */}
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setWeekStart((w) => addDays(w, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-zinc-700 min-w-48 text-center">
            {weekStart.toLocaleDateString("es-CL", { day: "numeric", month: "long" })}
            {" – "}
            {weekEnd.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })}
          </span>
          <Button variant="outline" size="sm" onClick={() => setWeekStart((w) => addDays(w, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="ml-2 text-zinc-500" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            Hoy
          </Button>
        </div>

        {/* Grilla de 7 columnas */}
        {loading ? (
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {days.map((day) => {
              const ymd = toYMD(day);
              const daySlots = slotsByDay[ymd] ?? [];
              const isToday = toYMD(new Date()) === ymd;

              return (
                <div key={ymd} className="space-y-2">
                  {/* Cabecera del día */}
                  <div className={`text-center py-1 rounded text-xs font-semibold ${isToday ? "bg-zinc-900 text-white" : "text-zinc-500"}`}>
                    {formatHeader(day)}
                  </div>

                  {/* Slots del día */}
                  {daySlots.length === 0 ? (
                    <div className="min-h-16 border border-dashed border-zinc-200 rounded-lg" />
                  ) : (
                    daySlots.map((slot) => {
                      const key = slotKey(slot);
                      const busy = operating === key;
                      const bookingCount = slot.spots_remaining !== undefined && slot.status !== "not_materialized"
                        ? undefined // booking count not directly available; use spots_remaining for display
                        : undefined;

                      return (
                        <div
                          key={key}
                          className={`border rounded-lg p-2 text-xs space-y-1.5 transition-opacity ${statusColor(slot.status)} ${busy ? "opacity-50" : ""}`}
                        >
                          <div className="font-semibold">
                            {formatTime(slot.time)}
                            <span className="font-normal text-zinc-400 ml-1">({slot.duration_min}m)</span>
                          </div>

                          <div className="text-xs leading-tight">
                            {statusLabel(slot.status, slot.booking_count)}
                          </div>

                          {slot.spots_remaining !== undefined && slot.status !== "not_materialized" && (
                            <div className="text-xs text-zinc-500">
                              {slot.spots_remaining} cupo{slot.spots_remaining !== 1 ? "s" : ""} libre{slot.spots_remaining !== 1 ? "s" : ""}
                            </div>
                          )}

                          {/* Acciones */}
                          {slot.status === "not_materialized" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full h-6 text-xs border-zinc-300"
                              disabled={busy}
                              onClick={() => handleMaterialize(slot)}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              {busy ? "Creando..." : "Crear sesión"}
                            </Button>
                          )}

                          {(slot.status === "available" || slot.status === "full") && (
                            slot.booking_count > 0 ? (
                              <div
                                className="w-full h-6 text-xs text-zinc-400 text-center flex items-center justify-center gap-1"
                                title={`${slot.booking_count} reserva(s) activa(s) — no se puede cancelar`}
                              >
                                <X className="h-3 w-3" />
                                {slot.booking_count} reserva{slot.booking_count !== 1 ? "s" : ""}
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full h-6 text-xs text-red-600 border-red-200 hover:bg-red-50"
                                disabled={busy}
                                onClick={() => handleCancel(slot)}
                              >
                                <X className="h-3 w-3 mr-1" />
                                {busy ? "Cancelando..." : "Cancelar"}
                              </Button>
                            )
                          )}

                          {/* Link online — editable por sesión */}
                          {slot.session_id && (
                            editingURL === slot.session_id ? (
                              <div className="flex gap-1 mt-1">
                                <input
                                  className="flex-1 text-xs border rounded px-1 py-0.5 min-w-0"
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
                                  className="text-green-600 hover:text-green-700 shrink-0"
                                  onClick={() => handleUpdateURL(slot)}
                                  title="Guardar"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 mt-1">
                                <Globe className="h-3 w-3 text-zinc-400 shrink-0" />
                                {slot.online_url ? (
                                  <a
                                    href={slot.online_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:underline truncate flex-1"
                                    title={slot.online_url}
                                  >
                                    {slot.online_url.replace(/^https?:\/\//, "").slice(0, 22)}…
                                  </a>
                                ) : (
                                  <span className="text-xs text-zinc-400 italic flex-1">Sin link</span>
                                )}
                                <button
                                  className="text-zinc-400 hover:text-zinc-600 shrink-0"
                                  onClick={() => { setEditingURL(slot.session_id!); setUrlDraft(slot.online_url ?? ""); }}
                                  title="Editar link"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                              </div>
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
          <div className="flex flex-col items-center gap-3 py-16 text-zinc-400">
            <AlertCircle className="h-8 w-8" />
            <p className="text-sm">No hay reglas de horario activas para este período.</p>
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
