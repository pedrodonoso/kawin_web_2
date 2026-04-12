import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, Users, Calendar, Clock, Globe, CheckCircle, Instagram, Facebook, Phone, MessageCircle } from "lucide-react";
import { api, type Workshop, type Schedule } from "@/lib/api";
import { UpcomingSessionsList } from "./UpcomingSessionsList";
import { BookingButton } from "./BookingButton";
import { DescriptionSection } from "./DescriptionSection";
import { ShareButtons } from "./ShareButtons";
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
  return `${fmt(start)} – ${fmt(end)}`;
}


export default async function TallerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const workshop = await getWorkshop(slug);

  if (!workshop) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 text-zinc-500">
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
    <main className="min-h-screen bg-zinc-50">
      {/* Cover */}
      <div className="bg-zinc-900 h-56 flex items-center justify-center text-zinc-600">
        {workshop.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={workshop.cover_image_url}
            alt={workshop.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-5xl">🎨</span>
        )}
      </div>

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
              <p className="text-zinc-500 mt-2">por {workshop.instructor.name}</p>
            )}
          </div>

          <Separator />

          {/* Description */}
          <DescriptionSection description={workshop.description ?? ""} />

          {/* Schedule (recurring classes) */}
          {workshop.schedule && (
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">Horario</h2>
              <div className="flex items-center gap-3 p-4 border rounded-lg bg-amber-50 border-amber-200">
                <Clock className="h-5 w-5 text-amber-600 shrink-0" />
                <p className="text-amber-900 font-medium">{workshop.schedule}</p>
              </div>
            </div>
          )}

          {/* Schedules como reglas de recurrencia — solo informativo */}
          {workshop.type === "class" && workshop.schedules && workshop.schedules.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">Horario</h2>
              <div className="space-y-2">
                {workshop.schedules.map((sch) => (
                  <div key={sch.id} className="flex items-center gap-3 p-3 border rounded-lg bg-amber-50 border-amber-200">
                    <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                    <p className="text-amber-900 text-sm font-medium">{formatScheduleRule(sch)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sesiones materializadas — type:class */}
          {workshop.type === "class" && workshop.sessions && workshop.sessions.length > 0 && (
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
          {workshop.type === "class" && (!workshop.sessions || workshop.sessions.length === 0) && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Próximas clases</h2>
              <div className="p-6 border rounded-lg bg-zinc-50 text-center text-zinc-500 text-sm">
                Aún no hay clases programadas. Vuelve pronto.
              </div>
            </div>
          )}

          {/* Manual sessions — workshop / course / event */}
          {workshop.type !== "class" && workshop.sessions && workshop.sessions.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Fechas disponibles</h2>
              <div className="space-y-3">
                {(() => {
                  const spotsLeft = workshop.capacity != null
                    ? workshop.capacity - (workshop.bookings_count ?? 0)
                    : null;
                  return workshop.sessions!.map((s) => (
                    <div key={s.id} className={`flex items-start gap-3 p-4 border rounded-lg bg-white ${s.cancelled ? "opacity-60" : ""}`}>
                      <Calendar className="h-5 w-5 text-zinc-400 shrink-0 mt-0.5" />
                      <div>
                        <p className={`font-medium capitalize ${s.cancelled ? "line-through text-zinc-400" : ""}`}>
                          {formatDate(s.starts_at)}
                        </p>
                        <p className="text-sm text-zinc-500 flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          {formatTime(s.starts_at, s.ends_at)}
                        </p>
                        {!s.cancelled && spotsLeft !== null && (
                          <p className="text-xs mt-1 text-zinc-400">
                            {spotsLeft <= 0
                              ? "Sin cupos disponibles"
                              : `${spotsLeft} cupo${spotsLeft !== 1 ? "s" : ""} disponible${spotsLeft !== 1 ? "s" : ""}`}
                          </p>
                        )}
                        {s.notes && (
                          <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            {s.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {/* Instructor */}
          {workshop.instructor && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">El tallerista</h2>
              <div className="flex items-start gap-4 p-4 border rounded-lg bg-white">
                <Avatar className="h-14 w-14 shrink-0">
                  <AvatarFallback className="text-lg">
                    {workshop.instructor.name[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{workshop.instructor.name}</p>
                  {workshop.instructor.bio && (
                    <p className="text-sm text-zinc-600 mt-1 leading-relaxed">
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
                          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-green-600"
                        >
                          <MessageCircle className="h-4 w-4" />
                          WhatsApp
                        </a>
                      )}
                      {workshop.instructor_phone && (
                        <a
                          href={`tel:${workshop.instructor_phone}`}
                          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900"
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
                          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900"
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
                          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900"
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

        {/* Sidebar booking */}
        <div>
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle className="text-2xl">
                {workshop.price === 0
                  ? "Gratis"
                  : `$${workshop.price.toLocaleString("es-CL")}`}
                {workshop.price > 0 && (
                  <span className="text-base font-normal text-zinc-500 ml-1">
                    {workshop.currency}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Details */}
              <div className="space-y-2 text-sm">
                {workshop.location && (
                  <div className="flex items-center gap-2 text-zinc-600">
                    <MapPin className="h-4 w-4 shrink-0" />
                    {workshop.location}
                  </div>
                )}
                {workshop.modality === "online" && (
                  <div className="flex items-center gap-2 text-zinc-600">
                    <Globe className="h-4 w-4 shrink-0" />
                    Sesión online (link al confirmar)
                  </div>
                )}
                {workshop.capacity && (
                  <div className="flex items-center gap-2 text-zinc-600">
                    <Users className="h-4 w-4 shrink-0" />
                    {workshop.capacity - (workshop.bookings_count ?? 0) > 0
                      ? `${workshop.capacity - (workshop.bookings_count ?? 0)} de ${workshop.capacity} cupos disponibles`
                      : "Sin cupos disponibles"}
                  </div>
                )}
              </div>

              <Separator />

              <BookingButton
                workshopId={workshop.id}
                workshopType={workshop.type}
                capacity={workshop.capacity ?? null}
                bookingsCount={workshop.bookings_count ?? 0}
                instructorId={workshop.instructor_id}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
