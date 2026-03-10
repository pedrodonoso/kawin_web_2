"use client";

import { useEffect, useState } from "react";
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
import { api, type Category } from "@/lib/api";
import { ArrowLeft, Plus, X } from "lucide-react";
import Link from "next/link";

interface SessionDraft {
  starts_at: string;
  ends_at: string;
  notes: string;
}

export default function NuevoTallerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
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
    if (!raw) { router.push("/login"); return; }
    api.get<Category[]>("/api/v1/categories").then(setCategories).catch(() => {});
  }, [router]);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function addSession() {
    setSessions((s) => [...s, { starts_at: "", ends_at: "", notes: "" }]);
  }

  function removeSession(i: number) {
    setSessions((s) => s.filter((_, idx) => idx !== i));
  }

  function updateSession(i: number, field: keyof SessionDraft, value: string) {
    setSessions((s) => s.map((sess, idx) => (idx === i ? { ...sess, [field]: value } : sess)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/api/v1/workshops", {
        ...form,
        price: Number(form.price),
        capacity: form.capacity ? Number(form.capacity) : undefined,
        sessions,
      });
      toast.success("¡Taller creado exitosamente!");
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear el taller");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50">
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
                  placeholder="Describe tu taller: qué aprenderán, qué incluye, quién puede asistir..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
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
                    onChange={(e) => set("location", e.target.value)}
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
                      placeholder="0"
                      required
                      value={form.price}
                      onChange={(e) => set("price", e.target.value)}
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
                    onChange={(e) => set("capacity", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Horario recurrente (solo para clases) */}
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
                  onChange={(e) => set("schedule", e.target.value)}
                />
                <p className="text-xs text-zinc-400">
                  Este texto aparecerá destacado en la página del taller.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Fechas / Sesiones */}
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
                  Sin fechas — puedes agregarlas ahora o más tarde.
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

          <Separator />

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              type="submit"
              variant="outline"
              disabled={loading}
              onClick={() => set("status", "draft")}
            >
              Guardar borrador
            </Button>
            <Button
              type="submit"
              disabled={loading}
              onClick={() => set("status", "published")}
            >
              {loading ? "Publicando..." : "Publicar taller"}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
