"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { api, type Profile } from "@/lib/api";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";

export default function PerfilPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Profile>({
    name: "",
    bio: "",
    phone: "",
    whatsapp: "",
    instagram_url: "",
    facebook_url: "",
    show_phone: true,
    show_whatsapp: true,
    show_instagram: true,
    show_facebook: true,
  });

  useEffect(() => {
    const user = localStorage.getItem("user");
    if (!user) {
      router.push("/login");
      return;
    }
    api
      .get<{ data: Profile }>("/api/v1/my-profile")
      .then((res) => setForm({
        name: res.data.name ?? "",
        bio: res.data.bio ?? "",
        phone: res.data.phone ?? "",
        whatsapp: res.data.whatsapp ?? "",
        instagram_url: res.data.instagram_url ?? "",
        facebook_url: res.data.facebook_url ?? "",
        show_phone: res.data.show_phone ?? true,
        show_whatsapp: res.data.show_whatsapp ?? true,
        show_instagram: res.data.show_instagram ?? true,
        show_facebook: res.data.show_facebook ?? true,
      }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  function set(field: keyof Profile, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function normalizeInstagram(value: string): string {
    if (!value) return value;
    const trimmed = value.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
    const username = trimmed.replace(/^@/, "");
    return `https://instagram.com/${username}`;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put("/api/v1/my-profile", {
        ...form,
        instagram_url: normalizeInstagram(form.instagram_url),
      });
      toast.success("Perfil actualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted-foreground">
        Cargando...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Volver
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Mi perfil</h1>
        </div>

        <form onSubmit={handleSave}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Información personal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  required
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Biografía</Label>
                <textarea
                  id="bio"
                  rows={4}
                  maxLength={500}
                  placeholder="Cuéntanos sobre ti..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={form.bio}
                  onChange={(e) => set("bio", e.target.value)}
                />
                <p className="text-xs text-muted-foreground/70 text-right">{form.bio.length}/500</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <VisibilityField
                  id="phone"
                  label="Teléfono"
                  placeholder="+56 9 XXXX XXXX"
                  value={form.phone}
                  visible={form.show_phone}
                  onValueChange={(v) => set("phone", v)}
                  onVisibilityChange={(v) => set("show_phone", v)}
                />
                <VisibilityField
                  id="whatsapp"
                  label="WhatsApp"
                  placeholder="+56 9 XXXX XXXX"
                  value={form.whatsapp}
                  visible={form.show_whatsapp}
                  onValueChange={(v) => set("whatsapp", v)}
                  onVisibilityChange={(v) => set("show_whatsapp", v)}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Redes sociales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <VisibilityField
                id="instagram_url"
                label="Instagram"
                placeholder="@tu_usuario o https://instagram.com/tu_usuario"
                value={form.instagram_url}
                visible={form.show_instagram}
                onValueChange={(v) => set("instagram_url", v)}
                onVisibilityChange={(v) => set("show_instagram", v)}
              />
              <VisibilityField
                id="facebook_url"
                label="Facebook"
                type="url"
                placeholder="https://facebook.com/tu_pagina"
                value={form.facebook_url}
                visible={form.show_facebook}
                onValueChange={(v) => set("facebook_url", v)}
                onVisibilityChange={(v) => set("show_facebook", v)}
              />
            </CardContent>
          </Card>

          <div className="mt-6 flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground text-center leading-relaxed">
            Tu información de contacto podría ser usada exclusivamente por Kawin para comunicarnos contigo
            en caso de necesitar consultar tu experiencia en el sitio, recibir sugerencias o
            atender reclamos. Nunca será compartida con terceros sin tu consentimiento.
            Recuerda que si decides mostrar tu teléfono o redes sociales, esta información sí será visible para otros usuarios en tu perfil público.
          </p>
        </form>
      </div>
    </main>
  );
}

interface VisibilityFieldProps {
  id: string;
  label: string;
  placeholder?: string;
  type?: string;
  value: string;
  visible: boolean;
  onValueChange: (v: string) => void;
  onVisibilityChange: (v: boolean) => void;
}

function VisibilityField({
  id, label, placeholder, type = "text",
  value, visible, onValueChange, onVisibilityChange,
}: VisibilityFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        <div className="flex items-center gap-1.5">
          {visible
            ? <Eye className="h-3.5 w-3.5 text-muted-foreground" />
            : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
          }
          <Switch
            id={`${id}_visible`}
            checked={visible}
            onCheckedChange={onVisibilityChange}
            aria-label={`Mostrar ${label} en público`}
          />
        </div>
      </div>
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className={!visible ? "opacity-50" : ""}
      />
      {!visible && (
        <p className="text-xs text-muted-foreground">No visible en tu perfil público</p>
      )}
    </div>
  );
}
