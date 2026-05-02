import { notFound } from "next/navigation";
import Link from "next/link";
import { api, type InstructorProfile, type ApiResponse } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Instagram, Facebook, Phone, MessageCircle, MapPin,
  ArrowLeft, ExternalLink,
} from "lucide-react";

const MODALITY: Record<string, string> = {
  "in-person": "Presencial",
  online: "Online",
  hybrid: "Híbrido",
};

const TYPE: Record<string, string> = {
  workshop: "Taller",
  course: "Curso",
  class: "Clase",
  event: "Evento",
};

async function getProfile(id: string): Promise<InstructorProfile | null> {
  try {
    const res = await api.get<ApiResponse<InstructorProfile>>(
      `/api/v1/instructors/${id}/profile`
    );
    return res.data;
  } catch {
    return null;
  }
}

export default async function TalleristaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) notFound();

  const hasSocials =
    profile.instagram_url || profile.facebook_url ||
    profile.whatsapp || profile.phone;

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* Back */}
        <Link
          href="/buscar"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a explorar
        </Link>

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <Avatar className="h-24 w-24 shrink-0">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt={profile.name} className="object-cover" />
            ) : (
              <AvatarFallback className="text-3xl font-semibold">
                {profile.name?.[0]?.toUpperCase() ?? "?"}
              </AvatarFallback>
            )}
          </Avatar>

          <div className="flex-1 space-y-3">
            <div>
              <h1 className="text-2xl font-bold">{profile.name}</h1>
              {(profile.city || profile.country) && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {[profile.city, profile.country].filter(Boolean).join(", ")}
                </p>
              )}
            </div>

            {profile.bio && (
              <p className="text-foreground/80 leading-relaxed max-w-2xl">{profile.bio}</p>
            )}

            {/* Social links */}
            {hasSocials && (
              <div className="flex flex-wrap gap-3 pt-1">
                {profile.whatsapp && (
                  <a
                    href={`https://wa.me/${profile.whatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border hover:bg-accent/10 transition-colors"
                  >
                    <MessageCircle className="h-4 w-4 text-green-600" />
                    WhatsApp
                  </a>
                )}
                {profile.phone && (
                  <a
                    href={`tel:${profile.phone}`}
                    className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border hover:bg-accent/10 transition-colors"
                  >
                    <Phone className="h-4 w-4" />
                    {profile.phone}
                  </a>
                )}
                {profile.instagram_url && (
                  <a
                    href={profile.instagram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border hover:bg-accent/10 transition-colors"
                  >
                    <Instagram className="h-4 w-4" />
                    Instagram
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </a>
                )}
                {profile.facebook_url && (
                  <a
                    href={profile.facebook_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border hover:bg-accent/10 transition-colors"
                  >
                    <Facebook className="h-4 w-4" />
                    Facebook
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Workshops */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">
            Talleres de {profile.name}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({profile.workshops.length})
            </span>
          </h2>

          {profile.workshops.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              Este tallerista aún no tiene talleres publicados.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {profile.workshops.map((w) => (
                <Link key={w.id} href={`/talleres/${w.slug}`}>
                  <Card className="hover:shadow-md transition-shadow h-full">
                    <div className="h-36 rounded-t-lg bg-secondary flex items-center justify-center overflow-hidden">
                      {w.cover_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={w.cover_image_url}
                          alt={w.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-muted-foreground text-xs">Sin imagen</span>
                      )}
                    </div>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-sm leading-tight line-clamp-2">
                          {w.title}
                        </h3>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {MODALITY[w.modality]}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="secondary" className="text-xs">
                          {TYPE[w.type]}
                        </Badge>
                        {w.category_name && (
                          <Badge className="text-xs bg-primary/10 text-primary border-0">
                            {w.category_name}
                          </Badge>
                        )}
                      </div>
                      {w.location && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {w.location.split(",").map(s => s.trim()).find(p => !/^\d+$/.test(p)) ?? w.location.split(",")[0]}
                        </p>
                      )}
                      <p className="text-sm font-bold pt-1">
                        {Number(w.price) === 0
                          ? "Gratis"
                          : `$${formatPrice(Number(w.price))} ${w.currency}`}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
