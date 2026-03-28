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
import { api, type Category, type Workshop, type ApiResponse } from "@/lib/api";
import { ArrowLeft, Plus, X, AlertCircle } from "lucide-react";
import Link from "next/link";

interface SessionDraft {
  id?: string;
  starts_at: string;
  ends_at: string;
  notes: string;
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

export default function EditarTallerPage() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id ?? "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sessions, setSessions] = useState<SessionDraft[]>([]);

  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "workshop",
    modality: "in-person",
    price: "",
    currency: "CLP",
    capacity: "",
    location: "",
    category_id: "",
    schedule: "",
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
        setForm({
          title: w.title,
          description: w.description ?? "",
          type: w.type,
          modality: w.modality,
          price: String(w.price),
          currency: w.currency,
          capacity: w.capacity != null ? String(w.capacity) : "",
          location: w.location ?? "",
          category_id: w.category_id ?? "",
          schedule: w.schedule ?? "",
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
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id, router]);

  function setField(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

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

  async function save(status: string) {
    setSaving(true);
    try {
      await api.put(`/api/v1/workshops/${id}`, {
        ...form,
        status,
        price: Number(form.price),
        capacity: form.capacity ? Number(form.capacity) : undefined,
        sessions,
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
                  placeholder="Describe tu taller: qué aprenderán, qué incluye, quién puede asistir..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={form.type} onValueChange={(v) => setField("type", v)}>
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
              <CardHeader>
                <CardTitle className="text-base">Horario recurrente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Label htmlFor="schedule">¿Cuándo se repite esta clase?</Label>
                <Input
                  id="schedule"
                  placeholder="Ej: Todos los martes a las 19:00 hrs (90 min)"
                  value={form.schedule}
                  onChange={(e) => setField("schedule", e.target.value)}
                />
                <p className="text-xs text-zinc-400">
                  Este texto aparece destacado en la página del taller.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Sesiones */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                {form.type === "class" ? "Próximas clases" : "Sesiones"}
              </CardTitle>
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
