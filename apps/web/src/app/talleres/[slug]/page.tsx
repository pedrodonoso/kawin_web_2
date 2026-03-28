import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, Users, Calendar, Clock, Globe, CheckCircle } from "lucide-react";
import { api, type Workshop } from "@/lib/api";
import { UpcomingSessionCard } from "./UpcomingSessionCard";
import { BookingButton } from "./BookingButton";
import Link from "next/link";

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
  });
}

function formatTime(start: string, end: string) {
  const fmt = (s: string) =>
    new Date(s).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
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

  const paragraphs = workshop.description?.split("\n\n") ?? [];

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
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge>{typeLabel[workshop.type]}</Badge>
              <Badge variant="outline">{modalityLabel[workshop.modality]}</Badge>
              {workshop.category && <Badge variant="secondary">{workshop.category.name}</Badge>}
            </div>
            <h1 className="text-3xl font-bold">{workshop.title}</h1>
            {workshop.instructor && (
              <p className="text-zinc-500 mt-2">por {workshop.instructor.name}</p>
            )}
          </div>

          <Separator />

          {/* Description */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Descripción</h2>
            {paragraphs.map((p, i) => (
              <p key={i} className="text-zinc-600 leading-relaxed">
                {p}
              </p>
            ))}
          </div>

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

          {/* Upcoming sessions — type:class with schedules */}
          {workshop.type === "class" && workshop.upcoming_sessions && workshop.upcoming_sessions.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Próximas clases</h2>
              <div className="space-y-3">
                {workshop.upcoming_sessions.map((s) => (
                  <UpcomingSessionCard key={`${s.schedule_id}-${s.date}`} session={s} workshopId={workshop.id} instructorId={workshop.instructor_id} />
                ))}
              </div>
            </div>
          )}

          {/* Empty state for class type with no sessions computed yet */}
          {workshop.type === "class" && (!workshop.upcoming_sessions || workshop.upcoming_sessions.length === 0) && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Próximas clases</h2>
              <div className="p-6 border rounded-lg bg-zinc-50 text-center text-zinc-500 text-sm">
                Aún no hay clases programadas para las próximas semanas.
              </div>
            </div>
          )}

          {/* Manual sessions — workshop / course / event */}
          {workshop.type !== "class" && workshop.sessions && workshop.sessions.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Fechas disponibles</h2>
              <div className="space-y-3">
                {workshop.sessions.map((s) => (
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
                      {s.notes && (
                        <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          {s.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
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
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
