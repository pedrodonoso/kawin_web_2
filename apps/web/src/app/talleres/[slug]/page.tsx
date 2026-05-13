import { Badge } from "@/components/ui/badge";
import { FreeBadge } from "@/components/ui/free-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, Calendar, Clock, CheckCircle, Instagram, Facebook, Phone, MessageCircle, Tag, Users } from "lucide-react";
import { api, type Workshop, type Schedule } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { DiscountType, Modality, WorkshopType } from "@/lib/constants";
import { UpcomingSessionsList } from "./UpcomingSessionsList";
import { OnlineUrlDisplay } from "./OnlineUrlDisplay";
import { MiniMapWrapper } from "./MiniMapWrapper";
import { DescriptionSection } from "./DescriptionSection";
import { ShareButtons } from "./ShareButtons";
import { RichTextDisplay } from "@/components/ui/rich-text-display";
import Link from "next/link";

const DAYS_ES: Record<number, string> = {
  0: "domingos", 1: "lunes", 2: "martes", 3: "miércoles",
  4: "jueves", 5: "viernes", 6: "sábados",
};

/** Convierte una regla de schedule en texto legible. Ej: "Lunes y jueves a las 19:00" */
function formatScheduleRule(sch: Schedule): string {
  const sorted = [...sch.days_of_week].sort((a, b) => {
    const av = a === 0 ? 7 : a;
    const bv = b === 0 ? 7 : b;
    return av - bv;
  });
  const dayNames = sorted.map((d) => DAYS_ES[d] ?? String(d));
  const daysStr =
    dayNames.length === 1
      ? dayNames[0]
      : dayNames.slice(0, -1).join(", ") + " y " + dayNames[dayNames.length - 1];
  const time = sch.time_start.slice(0, 5); // "HH:MM"
  return `Clases los ${daysStr} a las ${time} (${sch.duration_min} min)`;
}

async function getWorkshop(slug: string): Promise<Workshop | null> {
  try {
    const res = await api.get<{ data: Workshop } | Workshop>(`/api/v1/workshops/${slug}`);
    const w = (res && "data" in res) ? (res as { data: Workshop }).data : res as Workshop;
    // Normalize flat API fields to nested shape used by the page
    if (w && w.instructor_name && !w.instructor) {
      w.instructor = { name: w.instructor_name, bio: w.instructor_bio };
    }
    if (w && w.category_name && !w.category) {
      w.category = { id: w.category_id ?? "", name: w.category_name, slug: w.category_slug ?? "" };
    }
    return w;
  } catch {
    return null;
  }
}


function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatTime(start: string, end: string) {
  const fmt = (s: string) =>
    new Date(s).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return `${fmt(start)} - ${fmt(end)}`;
}


export default async function TallerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const workshop = await getWorkshop(slug);
  const activeDiscounts = workshop?.discounts ?? [];
  const workshopDiscounts = activeDiscounts.filter((d) => !d.session_id);
  const hasSessionDiscounts = activeDiscounts.some((d) => !!d.session_id);

  if (!workshop) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <p className="text-xl font-semibold">Taller no encontrado</p>
        <Button asChild variant="outline">
          <Link href="/buscar">Ver todos los talleres</Link>
        </Button>
      </main>
    );
  }

  const modalityLabel: Record<string, string> = {
    "in-person": "Presencial",
    online: "Online",
    hybrid: "Híbrido",
  };

  const typeLabel: Record<string, string> = {
    workshop: "Taller",
    course: "Curso",
    class: "Clase",
    event: "Evento",
  };


  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex flex-wrap gap-2">
                <Badge>{typeLabel[workshop.type]}</Badge>
                <Badge variant="outline">{modalityLabel[workshop.modality]}</Badge>
                {workshop.category && <Badge variant="secondary">{workshop.category.name}</Badge>}
              </div>
              <ShareButtons title={workshop.title} />
            </div>
            <h1 className="text-3xl font-bold">{workshop.title}</h1>
            {workshop.instructor && (
              <p className="text-muted-foreground mt-2">por {workshop.instructor.name}</p>
            )}
            <div className="flex items-center gap-1.5 mt-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4 shrink-0" />
              {workshop.capacity
                ? `Máx. ${workshop.capacity} personas`
                : "Sin límite de cupos"}
            </div>
          </div>

          <Separator />

          {/* Description */}
          <DescriptionSection description={workshop.description ?? ""} />

          {/* Notas del taller */}
          {workshop.notes && (
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">Notas</h2>
              <div className="p-4 border rounded-lg bg-accent/10 border-accent/30">
                <RichTextDisplay html={workshop.notes} />
              </div>
            </div>
          )}

          {/* Schedule (recurring classes) */}
          {workshop.schedule && (
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">Horario</h2>
              <div className="flex items-center gap-3 p-4 border rounded-lg bg-accent/10 border-accent/30">
                <Clock className="h-5 w-5 text-accent shrink-0" />
                <p className="text-foreground font-medium">{workshop.schedule}</p>
              </div>
            </div>
          )}

          {/* Schedules como reglas de recurrencia — solo informativo */}
          {workshop.type === WorkshopType.CLASS && workshop.schedules && workshop.schedules.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">Horario</h2>
              <div className="space-y-2">
                {workshop.schedules.map((sch) => (
                  <div key={sch.id} className="flex items-center gap-3 p-3 border rounded-lg bg-accent/10 border-accent/30">
                    <Clock className="h-4 w-4 text-accent shrink-0" />
                    <p className="text-foreground text-sm font-medium">{formatScheduleRule(sch)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sesiones materializadas — type:class */}
          {workshop.type === WorkshopType.CLASS && workshop.sessions && workshop.sessions.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Próximas clases</h2>
              <UpcomingSessionsList
                sessions={workshop.sessions}
                workshopId={workshop.id}
                workshopSlug={workshop.slug}
                instructorId={workshop.instructor_id}
              />
            </div>
          )}

          {/* Estado vacío para clases sin sesiones disponibles */}
          {workshop.type === WorkshopType.CLASS && (!workshop.sessions || workshop.sessions.length === 0) && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Próximas clases</h2>
              <div className="p-6 border rounded-lg bg-secondary/50 text-center text-muted-foreground text-sm">
                Aún no hay clases programadas. Vuelve pronto.
              </div>
            </div>
          )}

          {/* Manual sessions — workshop / course / event */}
          {workshop.type !== WorkshopType.CLASS && workshop.sessions && workshop.sessions.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Fechas disponibles</h2>
              <div className="space-y-3">
                {workshop.sessions!.map((s) => (
                  <div key={s.id} className={`flex items-start gap-3 p-4 border rounded-lg bg-card ${s.cancelled ? "opacity-60" : ""}`}>
                    <Calendar className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className={`font-medium capitalize ${s.cancelled ? "line-through text-muted-foreground/70" : ""}`}>
                        {formatDate(s.starts_at)}
                      </p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        {formatTime(s.starts_at, s.ends_at)}
                      </p>
                      {s.notes && (
                        <div className="mt-1 text-xs text-muted-foreground/70">
                          <RichTextDisplay html={s.notes} className="text-xs" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Map & location */}
          {workshop.lat != null && workshop.lng != null && (
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">Ubicación</h2>
              <MiniMapWrapper lat={workshop.lat} lng={workshop.lng} label={workshop.location} />
              {workshop.address && (
                <p className="text-sm text-muted-foreground flex items-start gap-2">
                  <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                  {workshop.address}
                </p>
              )}
            </div>
          )}

          {/* Instructor */}
          {workshop.instructor && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">El tallerista</h2>
              <div className="flex items-start gap-4 p-4 border rounded-lg bg-card">
                <Avatar className="h-14 w-14 shrink-0">
                  <AvatarFallback className="text-lg">
                    {workshop.instructor.name[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  {workshop.instructor_id ? (
                    <Link href={`/talleristas/${workshop.instructor_id}`} className="font-semibold hover:underline">
                      {workshop.instructor.name}
                    </Link>
                  ) : (
                    <p className="font-semibold">{workshop.instructor.name}</p>
                  )}
                  {workshop.instructor.bio && (
                    <p className="text-sm text-foreground/60 mt-1 leading-relaxed">
                      {workshop.instructor.bio}
                    </p>
                  )}
                  {(workshop.instructor_instagram || workshop.instructor_facebook || workshop.instructor_whatsapp || workshop.instructor_phone) && (
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      {workshop.instructor_whatsapp && (
                        <a
                          href={`https://wa.me/${workshop.instructor_whatsapp.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-green-600"
                        >
                          <MessageCircle className="h-4 w-4" />
                          WhatsApp
                        </a>
                      )}
                      {workshop.instructor_phone && (
                        <a
                          href={`tel:${workshop.instructor_phone}`}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Phone className="h-4 w-4" />
                          {workshop.instructor_phone}
                        </a>
                      )}
                      {workshop.instructor_instagram && (
                        <a
                          href={workshop.instructor_instagram}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Instagram className="h-4 w-4" />
                          Instagram
                        </a>
                      )}
                      {workshop.instructor_facebook && (
                        <a
                          href={workshop.instructor_facebook}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Facebook className="h-4 w-4" />
                          Facebook
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="sticky top-24">
            <CardHeader className="pb-3">
              {(() => {
                const originalPrice = Number(workshop.price);
                if (originalPrice === 0) {
                  return <FreeBadge />;
                }

                // Accumulate all workshop-wide discounts
                let finalPrice = originalPrice;
                for (const d of workshopDiscounts) {
                  const cut = d.type === DiscountType.PERCENT
                    ? finalPrice * d.value / 100
                    : Math.min(d.value, finalPrice);
                  finalPrice = Math.max(0, finalPrice - cut);
                }
                const hasDiscount = workshopDiscounts.length > 0;

                return (
                  <div className="space-y-3">

                    <div>
                      {hasDiscount && (
                        <p className="text-sm text-muted-foreground line-through">
                          ${formatPrice(originalPrice)} {workshop.currency}
                        </p>
                      )}
                      <CardTitle className="text-2xl">
                        ${formatPrice(finalPrice)}
                        <span className="text-base font-normal text-muted-foreground ml-1.5">{workshop.currency}</span>
                      </CardTitle>
                    </div>

                    {/* List each active discount */}
                    {workshopDiscounts.map((d) => {
                      const dateRange = (() => {
                        if (!d.valid_from && !d.valid_until) return null;
                        const fmt = (s: string) =>
                          new Date(s).toLocaleDateString("es-CL", { day: "numeric", month: "short" });
                        if (d.valid_from && d.valid_until)
                          return `${fmt(d.valid_from)} - ${fmt(d.valid_until)}`;
                        if (d.valid_until) return `hasta el ${fmt(d.valid_until)}`;
                        return `desde el ${fmt(d.valid_from!)}`;
                      })();

                      const savingLabel = d.type === DiscountType.PERCENT
                        ? `${d.value}% de descuento`
                        : `-$${formatPrice(d.value)} ${workshop.currency}`;

                      return (
                        <div key={d.id} className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <Tag className="h-3.5 w-3.5 shrink-0 text-green-700" />
                            <span className="text-sm font-bold text-green-700">{savingLabel}</span>
                          </div>
                          {dateRange && (
                            <p className="text-xs text-green-700/70 pl-5">{dateRange}</p>
                          )}
                          {d.max_uses != null && (
                            <p className="text-xs text-green-700/70 pl-5">
                              {d.max_uses - d.uses_count} uso{d.max_uses - d.uses_count !== 1 ? "s" : ""} disponible{d.max_uses - d.uses_count !== 1 ? "s" : ""}
                            </p>
                          )}
                        </div>
                      );
                    })}

                    {hasSessionDiscounts && (
                      <p className="text-xs text-green-700 flex items-center gap-1">
                        <Tag className="h-3 w-3 shrink-0" />
                        Algunas sesiones tienen descuento especial
                      </p>
                    )}
                  </div>
                );
              })()}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Details */}
              <div className="space-y-2 text-sm">
                {workshop.location && (
                  <div className="flex items-center gap-2 text-foreground/60">
                    <MapPin className="h-4 w-4 shrink-0" />
                    {workshop.location}
                  </div>
                )}
                {(workshop.modality === Modality.ONLINE || workshop.modality === Modality.HYBRID) && (
                  <OnlineUrlDisplay
                    workshopId={workshop.id}
                    workshopOnlineUrl={workshop.online_url}
                  />
                )}
              </div>

            </CardContent>
          </Card>

          {/* Audiovisual */}
          {workshop.cover_image_url && (
            <div className="space-y-3">
              <h2 className="text-base font-semibold">Audiovisual</h2>
              <div className="grid grid-cols-1 gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={workshop.cover_image_url}
                  alt={workshop.title}
                  className="w-full rounded-lg object-cover aspect-video"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
