"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { adminVenuesApi, type VenueProfile, type VenueInput } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocationPicker } from "@/components/map/LocationPicker";
import { ArrowLeft } from "lucide-react";

interface Props {
  /** When present → edit mode. */
  venue?: VenueProfile;
}

export function SedeForm({ venue }: Props) {
  const router = useRouter();
  const isEdit = !!venue;

  const [form, setForm] = useState({
    name: venue?.name ?? "",
    description: venue?.description ?? "",
    address: venue?.address ?? "",
    city: venue?.city ?? "",
    country: venue?.country ?? "Chile",
    lat: venue?.lat != null ? String(venue.lat) : "",
    lng: venue?.lng != null ? String(venue.lng) : "",
    cover_image_url: venue?.cover_image_url ?? "",
    phone: venue?.phone ?? "",
    whatsapp: venue?.whatsapp ?? "",
    instagram_url: venue?.instagram_url ?? "",
    facebook_url: venue?.facebook_url ?? "",
    website: venue?.website ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    setError("");

    const payload: VenueInput = {
      ...form,
      lat: form.lat !== "" ? Number(form.lat) : null,
      lng: form.lng !== "" ? Number(form.lng) : null,
    };

    try {
      if (isEdit) {
        await adminVenuesApi.update(venue!.id, payload);
      } else {
        await adminVenuesApi.create(payload);
      }
      router.push("/admin/sedes");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link
        href="/admin/sedes"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a sedes
      </Link>

      <h1 className="text-2xl font-bold">{isEdit ? "Editar sede" : "Nueva sede"}</h1>

      <form onSubmit={submit} className="space-y-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Información básica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                placeholder="Ej: Casa Taller La Quinta"
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <textarea
                id="description"
                rows={4}
                maxLength={2000}
                placeholder="Describe la sede: qué tipo de actividades alberga, ambiente, etc."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cover_image_url">Imagen (URL)</Label>
              <Input
                id="cover_image_url"
                type="url"
                placeholder="https://..."
                value={form.cover_image_url}
                onChange={(e) => set("cover_image_url", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ubicación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <LocationPicker
              location={form.address}
              lat={form.lat}
              lng={form.lng}
              onLocationChange={(v) => set("address", v)}
              onCoordsChange={(lat, lng) => setForm((f) => ({ ...f, lat, lng }))}
            />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">Ciudad</Label>
                <Input
                  id="city"
                  placeholder="Ej: Santiago"
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">País</Label>
                <Input
                  id="country"
                  value={form.country}
                  onChange={(e) => set("country", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contacto y redes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input id="phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input id="whatsapp" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="instagram_url">Instagram</Label>
              <Input id="instagram_url" placeholder="@usuario o URL" value={form.instagram_url} onChange={(e) => set("instagram_url", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="facebook_url">Facebook (URL)</Label>
              <Input id="facebook_url" type="url" placeholder="https://facebook.com/..." value={form.facebook_url} onChange={(e) => set("facebook_url", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Sitio web</Label>
              <Input id="website" type="url" placeholder="https://..." value={form.website} onChange={(e) => set("website", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear sede"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/sedes">Cancelar</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
