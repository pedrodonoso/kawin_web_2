"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Plus, Tag, Trash2, ToggleLeft, ToggleRight, Users,
  Calendar, Clock, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { api, discountApi, type Discount, type Session, type Workshop } from "@/lib/api";

interface InstructorBooking {
  booking_id: string;
  workshop_id: string;
  workshop_title: string;
  student_name: string;
  session_date: string;
  status: string;
  payment_status: string;
  amount: number;
  created_at: string;
}

const STATUS_STYLE: Record<string, string> = {
  confirmed: "bg-green-100 text-green-700",
  pending:   "bg-yellow-100 text-yellow-700",
  cancelled: "bg-red-100 text-red-600",
};
const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmada",
  pending:   "Pendiente",
  cancelled: "Cancelada",
};

type Tab = "reservas" | "descuentos";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL", {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
  });
}
function fmtTime(start: string, end?: string) {
  const fmt = (s: string) =>
    new Date(s).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start);
}

export default function WorkshopReservasPage() {
  const params     = useParams<{ id: string }>();
  const router     = useRouter();
  const workshopId = params.id;

  const [tab, setTab]               = useState<Tab>("reservas");
  const [workshop, setWorkshop]     = useState<Workshop | null>(null);

  // Reservas
  const [bookings, setBookings]               = useState<InstructorBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [statusFilter, setStatusFilter]       = useState("");

  // Discounts
  const [discounts, setDiscounts]             = useState<Discount[]>([]);
  const [discountsLoading, setDiscountsLoading] = useState(true);
  const [showForm, setShowForm]               = useState(false);

  // Sessions for the picker
  const [sessions, setSessions]               = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [applyToSession, setApplyToSession]   = useState(false);

  // Form state
  const EMPTY_FORM = {
    type:       "percent" as "percent" | "flat",
    value:      "",
    label:      "",
    max_uses:   "",
    session_id: "",
    valid_from: "",
    valid_until: "",
  };
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // ── Load on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) { router.push("/login"); return; }

    // Fetch workshop (title + type + sessions for non-class workshops)
    api.get<{ data: Workshop }>(`/api/v1/workshops/${workshopId}`)
      .then((r) => setWorkshop(r.data ?? null))
      .catch(() => {});

    loadBookings();
    loadDiscounts();
  }, [workshopId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === "reservas") loadBookings();
  }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── When switch is toggled on, load sessions once ─────────────────────────
  useEffect(() => {
    if (!applyToSession || sessions.length > 0) return;
    setSessionsLoading(true);
    api.get<{ data: Workshop }>(`/api/v1/workshops/${workshopId}`)
      .then((r) => {
        const s = r.data?.sessions ?? [];
        setSessions(s.filter((x) => !x.cancelled));
      })
      .catch(() => setSessions([]))
      .finally(() => setSessionsLoading(false));
  }, [applyToSession]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Data loaders ──────────────────────────────────────────────────────────
  function loadBookings() {
    setBookingsLoading(true);
    const qs = new URLSearchParams({ workshop_id: workshopId });
    if (statusFilter) qs.set("status", statusFilter);
    api.getList<InstructorBooking>(`/api/v1/instructor-bookings?${qs}`)
      .then(setBookings)
      .catch(() => setBookings([]))
      .finally(() => setBookingsLoading(false));
  }

  function loadDiscounts() {
    setDiscountsLoading(true);
    discountApi.list(workshopId)
      .then(setDiscounts)
      .catch(() => setDiscounts([]))
      .finally(() => setDiscountsLoading(false));
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  async function handleCreateDiscount(e: React.FormEvent) {
    e.preventDefault();
    if (!form.value || !form.label) return;
    if (applyToSession && !form.session_id) {
      toast.error("Selecciona una sesión o desactiva la opción de sesión específica");
      return;
    }
    setSaving(true);
    try {
      const body: Parameters<typeof discountApi.create>[1] = {
        type:       form.type,
        value:      parseFloat(form.value),
        label:      form.label,
        active:     true,
        max_uses:   form.max_uses ? parseInt(form.max_uses) : undefined,
        session_id: applyToSession ? form.session_id : undefined,
        valid_from: form.valid_from  ? `${form.valid_from}:00` : undefined,
        valid_until: form.valid_until ? `${form.valid_until}:00` : undefined,
      };
      const created = await discountApi.create(workshopId, body);
      setDiscounts((d) => [created, ...d]);
      setShowForm(false);
      setForm(EMPTY_FORM);
      setApplyToSession(false);
      toast.success("Descuento creado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear descuento");
    } finally {
      setSaving(false);
    }
  }

  async function toggleDiscount(d: Discount) {
    try {
      await discountApi.update(d.id, { active: !d.active });
      setDiscounts((ds) => ds.map((x) => x.id === d.id ? { ...x, active: !d.active } : x));
    } catch {
      toast.error("Error al actualizar descuento");
    }
  }

  async function deleteDiscount(id: string) {
    if (!window.confirm("¿Eliminar este descuento?")) return;
    try {
      await discountApi.delete(id);
      setDiscounts((ds) => ds.filter((d) => d.id !== id));
      toast.success("Descuento eliminado");
    } catch {
      toast.error("Error al eliminar descuento");
    }
  }

  function formatDiscount(d: Discount) {
    return d.type === "percent"
      ? `${d.value}% de descuento`
      : `$${d.value.toLocaleString("es-CL")} de descuento`;
  }

  // Session label for discount card (resolves from loaded sessions)
  function sessionLabel(sessionId: string) {
    const s = sessions.find((x) => x.id === sessionId);
    if (!s) return `Sesión ${sessionId.slice(0, 8)}…`;
    return fmtDate(s.starts_at) + " · " + fmtTime(s.starts_at, s.ends_at);
  }

  const workshopTitle = workshop?.title ?? "";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2 text-muted-foreground" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">{workshopTitle || "Taller"}</h1>
          <p className="text-muted-foreground mt-0.5">Gestión de reservas y descuentos</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b">
          {(["reservas", "descuentos"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                tab === t
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "reservas" ? "Reservas" : "Descuentos"}
            </button>
          ))}
        </div>

        {/* ── RESERVAS TAB ──────────────────────────────────────────────── */}
        {tab === "reservas" && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap items-center">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-sm border rounded-md px-3 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Todos los estados</option>
                <option value="confirmed">Confirmadas</option>
                <option value="pending">Pendientes</option>
                <option value="cancelled">Canceladas</option>
              </select>
              <span className="text-sm text-muted-foreground ml-auto">
                {bookingsLoading ? "…" : `${bookings.length} reserva${bookings.length !== 1 ? "s" : ""}`}
              </span>
            </div>

            {bookingsLoading ? (
              <Card><CardContent className="p-5 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex justify-between">
                    <Skeleton className="h-4 w-40" /><Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </CardContent></Card>
            ) : !bookings.length ? (
              <Card><CardContent className="py-14 text-center text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No hay reservas con este filtro.</p>
              </CardContent></Card>
            ) : (
              <Card><CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-secondary/50 text-muted-foreground">
                      <th className="text-left px-4 py-3 font-medium">Estudiante</th>
                      <th className="text-left px-4 py-3 font-medium">Sesión</th>
                      <th className="text-left px-4 py-3 font-medium">Estado</th>
                      <th className="text-right px-4 py-3 font-medium">Monto</th>
                      <th className="text-right px-4 py-3 font-medium">Reservado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((b) => (
                      <tr key={b.booking_id} className="border-b last:border-0 hover:bg-secondary/20">
                        <td className="px-4 py-3 font-medium">{b.student_name}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {b.session_date
                            ? new Date(b.session_date).toLocaleString("es-CL", {
                                day: "numeric", month: "short", year: "numeric",
                                hour: "2-digit", minute: "2-digit", timeZone: "UTC",
                              })
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[b.status] ?? ""}`}>
                            {STATUS_LABEL[b.status] ?? b.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          ${Number(b.amount).toLocaleString("es-CL")}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                          {new Date(b.created_at).toLocaleDateString("es-CL")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent></Card>
            )}
          </div>
        )}

        {/* ── DESCUENTOS TAB ────────────────────────────────────────────── */}
        {tab === "descuentos" && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Los descuentos activos se aplican automáticamente al reservar.
                Los descuentos por sesión tienen prioridad sobre los de todo el taller.
              </p>
              <Button size="sm" className="shrink-0" onClick={() => { setShowForm((v) => !v); setApplyToSession(false); setForm(EMPTY_FORM); }}>
                <Plus className="h-4 w-4 mr-1" />
                Nuevo descuento
              </Button>
            </div>

            {/* ── CREATE FORM ─────────────────────────────────────────── */}
            {showForm && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Crear descuento</CardTitle>
                  <CardDescription>
                    Configura el descuento y decide si aplica a todo el taller o a una sesión específica.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateDiscount} className="space-y-5">

                    {/* Row 1: etiqueta + tipo */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Etiqueta *</label>
                        <input
                          value={form.label}
                          onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                          placeholder="Ej: Early bird, 10 primeros cupos…"
                          required
                          className="w-full text-sm border rounded-md px-3 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Tipo *</label>
                        <select
                          value={form.type}
                          onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as "percent" | "flat" }))}
                          className="w-full text-sm border rounded-md px-3 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="percent">Porcentaje (%)</option>
                          <option value="flat">Monto fijo ($)</option>
                        </select>
                      </div>
                    </div>

                    {/* Row 2: valor + max_uses */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">
                          Valor * {form.type === "percent" ? "(0–100%)" : "(CLP)"}
                        </label>
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          value={form.value}
                          onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                          required
                          className="w-full text-sm border rounded-md px-3 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Máximo de usos</label>
                        <input
                          type="number"
                          min="1"
                          placeholder="Sin límite"
                          value={form.max_uses}
                          onChange={(e) => setForm((f) => ({ ...f, max_uses: e.target.value }))}
                          className="w-full text-sm border rounded-md px-3 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <p className="text-xs text-muted-foreground">Ej: 10 = primeros 10 cupos con descuento</p>
                      </div>
                    </div>

                    {/* Row 3: válido desde + hasta (juntos) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Válido desde</label>
                        <input
                          type="datetime-local"
                          value={form.valid_from}
                          onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))}
                          className="w-full text-sm border rounded-md px-3 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Válido hasta</label>
                        <input
                          type="datetime-local"
                          value={form.valid_until}
                          onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))}
                          className="w-full text-sm border rounded-md px-3 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>

                    {/* Switch: sesión específica */}
                    <div className="border rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setApplyToSession((v) => !v);
                          setForm((f) => ({ ...f, session_id: "" }));
                        }}
                        className="w-full flex items-center justify-between px-4 py-3 bg-secondary/40 hover:bg-secondary/60 transition-colors text-left"
                      >
                        <div>
                          <p className="text-sm font-medium">Aplicar a una sesión específica</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {applyToSession
                              ? "Selecciona la sesión a continuación"
                              : "Actualmente aplica a todo el taller"}
                          </p>
                        </div>
                        {applyToSession
                          ? <ToggleRight className="h-6 w-6 text-primary shrink-0" />
                          : <ToggleLeft  className="h-6 w-6 text-muted-foreground shrink-0" />}
                      </button>

                      {/* Session picker */}
                      {applyToSession && (
                        <div className="divide-y border-t">
                          {sessionsLoading ? (
                            <div className="p-4 space-y-2">
                              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
                            </div>
                          ) : !sessions.length ? (
                            <div className="p-6 text-center text-muted-foreground text-sm">
                              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
                              No hay sesiones disponibles para este taller.
                            </div>
                          ) : (
                            sessions.map((s) => {
                              const isSelected = form.session_id === s.id;
                              const spotsLeft = s.spots_remaining;
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => setForm((f) => ({ ...f, session_id: s.id }))}
                                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                                    isSelected
                                      ? "bg-primary/8 border-l-2 border-primary"
                                      : "hover:bg-secondary/40"
                                  }`}
                                >
                                  {/* Checkmark */}
                                  <div className={`h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                                    isSelected ? "border-primary bg-primary" : "border-muted-foreground"
                                  }`}>
                                    {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium capitalize ${isSelected ? "text-primary" : ""}`}>
                                      {fmtDate(s.starts_at)}
                                    </p>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                      <Clock className="h-3 w-3 shrink-0" />
                                      {fmtTime(s.starts_at, s.ends_at)}
                                      {spotsLeft != null && (
                                        <span className="ml-2">
                                          · {spotsLeft > 0
                                            ? `${spotsLeft} cupo${spotsLeft !== 1 ? "s" : ""} disponible${spotsLeft !== 1 ? "s" : ""}`
                                            : "Sin cupos"}
                                        </span>
                                      )}
                                    </p>
                                  </div>

                                  {isSelected && (
                                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                                  )}
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button type="submit" size="sm" disabled={saving}>
                        {saving ? "Guardando…" : "Crear descuento"}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => { setShowForm(false); setApplyToSession(false); setForm(EMPTY_FORM); }}>
                        Cancelar
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* ── DISCOUNTS LIST ──────────────────────────────────────── */}
            {discountsLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
            ) : !discounts.length ? (
              <Card>
                <CardContent className="py-14 text-center text-muted-foreground">
                  <Tag className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No hay descuentos configurados para este taller.</p>
                  <p className="text-xs mt-1">Crea uno para que los estudiantes lo vean al reservar.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {discounts.map((d) => (
                  <Card key={d.id} className={d.active ? "" : "opacity-60"}>
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{d.label}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary">
                            {formatDiscount(d)}
                          </span>
                          {d.active ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Activo</span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">Inactivo</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                          {d.session_id ? (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {sessionLabel(d.session_id)}
                            </span>
                          ) : (
                            <span>Aplica a todo el taller</span>
                          )}
                          {d.max_uses != null && (
                            <span>Usos: {d.uses_count}/{d.max_uses}</span>
                          )}
                          {(d.valid_from || d.valid_until) && (
                            <span>
                              {d.valid_from && d.valid_until
                                ? `${new Date(d.valid_from).toLocaleDateString("es-CL")} – ${new Date(d.valid_until).toLocaleDateString("es-CL")}`
                                : d.valid_until
                                ? `hasta ${new Date(d.valid_until).toLocaleDateString("es-CL")}`
                                : `desde ${new Date(d.valid_from!).toLocaleDateString("es-CL")}`}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button variant="outline" size="sm" onClick={() => toggleDiscount(d)} title={d.active ? "Desactivar" : "Activar"}>
                          {d.active
                            ? <ToggleRight className="h-4 w-4 text-green-600" />
                            : <ToggleLeft  className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                        <Button
                          variant="outline" size="sm"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => deleteDiscount(d.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
