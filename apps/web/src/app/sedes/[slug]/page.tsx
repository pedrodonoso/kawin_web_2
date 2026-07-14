import type { ElementType } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { api, type VenueProfile, type ApiResponse, type Schedule } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { ModalityLabel, WorkshopTypeLabel, Modality } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Instagram, Facebook, Phone, MessageCircle, MapPin, Globe,
  ArrowLeft, ExternalLink, Hammer, BookOpen, Users, CalendarDays, Clock,
} from "lucide-react";
import { VenueMiniMap } from "./VenueMiniMap";

const DAYS_SHORT: Record<number, string> = {
  0: "Dom", 1: "Lun", 2: "Mar", 3: "Mié", 4: "Jue", 5: "Vie", 6: "Sáb",
};

/** Regla recurrente de clase → texto compacto. Ej: "Lun, Mié · 18:00" */
function formatScheduleShort(sch: Schedule): string {
  const sorted = [...sch.days_of_week].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
  const days = sorted.map((d) => DAYS_SHORT[d] ?? String(d)).join(", ");
  const time = sch.time_start.slice(0, 5);
  return days ? `${days} · ${time}` : time;
}

/** Próxima sesión → texto compacto. Ej: "sáb 20 jul · 10:00" */
function formatNextSession(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("es-CL", {
    weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
  });
  const time = d.toLocaleTimeString("es-CL", {
    hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  });
  return `${date} · ${time}`;
}

const TYPE_META: Record<string, { iconBg: string; iconColor: string; badgeBg: string; Icon: ElementType }> = {
  workshop: { iconBg: "bg-orange-100", iconColor: "text-orange-600", badgeBg: "bg-orange-100 text-orange-700", Icon: Hammer },
  course:   { iconBg: "bg-amber-100",  iconColor: "text-amber-600",  badgeBg: "bg-amber-100 text-amber-700",  Icon: BookOpen },
  class:    { iconBg: "bg-indigo-100", iconColor: "text-indigo-600", badgeBg: "bg-indigo-100 text-indigo-700", Icon: Users },
  event:    { iconBg: "bg-emerald-100",iconColor: "text-emerald-600",badgeBg: "bg-emerald-100 text-emerald-700", Icon: CalendarDays },
};

async function getVenue(slug: string): Promise<VenueProfile | null> {
  try {
    const res = await api.get<ApiResponse<VenueProfile>>(`/api/v1/venues/${slug}`);
    return res.data;
  } catch {
    return null;
  }
}

export default async function SedePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const venue = await getVenue(slug);
  if (!venue) notFound();

  const hasSocials =
    venue.instagram_url || venue.facebook_url ||
    venue.whatsapp || venue.phone || venue.website;

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* Back */}
        <Link
          href="/buscar?vista=sedes"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a explorar
        </Link>

        {/* Header */}
        <div className="space-y-3">
            <div>
              <h1 className="text-2xl font-bold">{venue.name}</h1>
              {(venue.address || venue.city || venue.country) && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {[venue.address, venue.city, venue.country].filter(Boolean).join(", ")}
                </p>
              )}
            </div>

            {venue.description && (
              <p className="text-foreground/80 leading-relaxed max-w-2xl">{venue.description}</p>
            )}

            {hasSocials && (
              <div className="flex flex-wrap gap-3 pt-1">
                {venue.whatsapp && (
                  <a
                    href={`https://wa.me/${venue.whatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border hover:bg-accent/10 transition-colors"
                  >
                    <MessageCircle className="h-4 w-4 text-green-600" />
                    WhatsApp
                  </a>
                )}
                {venue.phone && (
                  <a
                    href={`tel:${venue.phone}`}
                    className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border hover:bg-accent/10 transition-colors"
                  >
                    <Phone className="h-4 w-4" />
                    {venue.phone}
                  </a>
                )}
                {venue.instagram_url && (
                  <a
                    href={
                      venue.instagram_url.startsWith("http://") || venue.instagram_url.startsWith("https://")
                        ? venue.instagram_url
                        : `https://instagram.com/${venue.instagram_url.replace(/^@/, "")}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border hover:bg-accent/10 transition-colors"
                  >
                    <Instagram className="h-4 w-4" />
                    Instagram
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </a>
                )}
                {venue.facebook_url && (
                  <a
                    href={venue.facebook_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border hover:bg-accent/10 transition-colors"
                  >
                    <Facebook className="h-4 w-4" />
                    Facebook
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </a>
                )}
                {venue.website && (
                  <a
                    href={venue.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border hover:bg-accent/10 transition-colors"
                  >
                    <Globe className="h-4 w-4" />
                    Sitio web
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </a>
                )}
              </div>
            )}
        </div>

        {/* Map */}
        {venue.lat != null && venue.lng != null && (
          <VenueMiniMap lat={venue.lat} lng={venue.lng} label={venue.name} />
        )}

        <Separator />

        {/* Workshops */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">
            Talleres y eventos en esta sede
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({venue.workshops.length})
            </span>
          </h2>

          {venue.workshops.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              Esta sede aún no tiene talleres publicados.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {venue.workshops.map((w) => {
                const meta = TYPE_META[w.type] ?? { iconBg: "bg-muted", iconColor: "text-muted-foreground", badgeBg: "bg-muted text-muted-foreground", Icon: Hammer };
                return (
                <Link key={w.id} href={`/talleres/${w.slug}`}>
                  <Card className="hover:shadow-md transition-shadow h-full flex flex-col">
                    {w.cover_image_url && (
                      <div className="h-40 rounded-t-lg overflow-hidden shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={w.cover_image_url} alt={w.title} className="h-full w-full object-cover" />
                      </div>
                    )}
                    <CardContent className="p-4 pb-5 flex flex-col flex-1">
                      <div className="flex items-start gap-3">
                        <div className={`shrink-0 h-10 w-10 rounded-lg ${meta.iconBg} flex items-center justify-center`}>
                          <meta.Icon className={`h-5 w-5 ${meta.iconColor}`} />
                        </div>
                        <div className="flex items-start justify-between gap-2 flex-1 min-w-0">
                          <h3 className="font-semibold leading-tight line-clamp-2">{w.title}</h3>
                          <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${meta.badgeBg}`}>
                            {WorkshopTypeLabel[w.type] ?? w.type}
                          </span>
                        </div>
                      </div>

                      {w.category_name && (
                        <Badge variant="secondary" className="text-xs mt-2 w-fit">
                          {w.category_name}
                        </Badge>
                      )}

                      {(() => {
                        const lines =
                          w.type === "class"
                            ? (w.schedules ?? []).map(formatScheduleShort)
                            : w.next_session_at
                            ? [formatNextSession(w.next_session_at)]
                            : [];
                        if (lines.length === 0) return null;
                        const shown = lines.slice(0, 2);
                        const extra = lines.length - shown.length;
                        const DateIcon = w.type === "class" ? Clock : CalendarDays;
                        return (
                          <div className="mt-2 space-y-1">
                            {shown.map((line, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-1.5 text-xs text-foreground/70"
                              >
                                <DateIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <span className="truncate">{line}</span>
                              </div>
                            ))}
                            {extra > 0 && (
                              <span className="text-xs text-muted-foreground pl-5">
                                +{extra} horario{extra > 1 ? "s" : ""} más
                              </span>
                            )}
                          </div>
                        );
                      })()}

                      <div className="mt-auto space-y-3 pt-3">
                        <Separator />

                        <div className="flex items-start justify-between gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1 min-w-0">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {w.modality === Modality.ONLINE ? "Online" : venue.city ?? "—"}
                            </span>
                          </span>
                          <Badge variant="outline" className="shrink-0 text-xs">
                            {ModalityLabel[w.modality]}
                          </Badge>
                        </div>

                        <Separator />

                        <div className="flex items-center justify-between">
                          {Number(w.price) === 0 ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-medium text-emerald-700">
                              Gratuito - Aporte consciente
                            </span>
                          ) : (
                            <span className="font-bold text-sm text-foreground">
                              {`$${formatPrice(Number(w.price))} ${w.currency}`}
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
