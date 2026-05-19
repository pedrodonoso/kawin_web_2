"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Search, MapPin, Clock, LayoutGrid, Map, BookOpen, CalendarDays, Brush, GraduationCap, Repeat } from "lucide-react";
import { api, type Workshop, type Category } from "@/lib/api";
import { Modality } from "@/lib/constants";
import { formatPrice } from "@/lib/utils";
import { useUserLocation } from "@/hooks/useUserLocation";

const WorkshopsMap = dynamic(
  () => import("@/components/map/WorkshopsMap").then((m) => m.WorkshopsMap),
  { ssr: false, loading: () => <div className="h-[520px] bg-secondary rounded-xl animate-pulse" /> }
);

const MODALITIES = [
  { value: "all", label: "Todas" },
  { value: "in-person", label: "Presencial" },
  { value: "online", label: "Online" },
  { value: "hybrid", label: "Híbrido" },
];

const TYPES = [
  { value: "all", label: "Todos" },
  { value: "workshop", label: "Taller" },
  { value: "course", label: "Curso" },
  { value: "class", label: "Clase" },
  { value: "event", label: "Evento" },
];

// Fallback mock data while API is being built
const MOCK_WORKSHOPS: Workshop[] = [
  {
    id: "1",
    title: "Acuarela para principiantes",
    slug: "acuarela-principiantes",
    description: "Aprende las bases de la acuarela en un ambiente relajado y creativo.",
    type: "workshop",
    modality: "in-person",
    price: 25000,
    currency: "CLP",
    capacity: 12,
    location: "Santiago, Chile",
    status: "published",
    category: { id: "1", name: "Arte y Creatividad", slug: "arte-creatividad" },
    instructor: { name: "María González" },
    created_at: new Date().toISOString(),
  },
  {
    id: "2",
    title: "Cocina italiana desde cero",
    slug: "cocina-italiana",
    description: "Pasta, risotto y salsas auténticas con ingredientes locales.",
    type: "course",
    modality: "in-person",
    price: 45000,
    currency: "CLP",
    capacity: 8,
    location: "Providencia, Santiago",
    status: "published",
    category: { id: "2", name: "Cocina y Gastronomía", slug: "cocina-gastronomia" },
    instructor: { name: "Carlos Martini" },
    created_at: new Date().toISOString(),
  },
  {
    id: "3",
    title: "Guitarra flamenca online",
    slug: "guitarra-flamenca",
    description: "Técnica y ritmo flamenco para músicos con conocimientos básicos.",
    type: "class",
    modality: "online",
    price: 15000,
    currency: "CLP",
    status: "published",
    category: { id: "3", name: "Música y Danza", slug: "musica-danza" },
    instructor: { name: "Rodrigo Sánchez" },
    created_at: new Date().toISOString(),
  },
  {
    id: "4",
    title: "Yoga restaurativo",
    slug: "yoga-restaurativo",
    description: "Práctica suave enfocada en la recuperación y el bienestar profundo.",
    type: "class",
    modality: "hybrid",
    price: 12000,
    currency: "CLP",
    location: "Las Condes, Santiago",
    status: "published",
    category: { id: "4", name: "Bienestar y Salud", slug: "bienestar-salud" },
    instructor: { name: "Ana Fuentes" },
    created_at: new Date().toISOString(),
  },
  {
    id: "5",
    title: "Fotografía callejera",
    slug: "fotografia-callejera",
    description: "Salimos a las calles de Santiago a capturar el momento decisivo.",
    type: "workshop",
    modality: "in-person",
    price: 30000,
    currency: "CLP",
    capacity: 6,
    location: "Barrio Italia, Santiago",
    status: "published",
    category: { id: "9", name: "Fotografía", slug: "fotografia" },
    instructor: { name: "Tomás Herrera" },
    created_at: new Date().toISOString(),
  },
  {
    id: "6",
    title: "Cerámica a torno",
    slug: "ceramica-torno",
    description: "Iníciate en el fascinante mundo de la cerámica con torno eléctrico.",
    type: "workshop",
    modality: "in-person",
    price: 55000,
    currency: "CLP",
    capacity: 6,
    location: "Ñuñoa, Santiago",
    status: "published",
    category: { id: "10", name: "Artesanía", slug: "artesania" },
    instructor: { name: "Sofía Riquelme" },
    created_at: new Date().toISOString(),
  },
];

function WorkshopCard({ w }: { w: Workshop }) {
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

  const typeColor: Record<string, string> = {
    workshop: "bg-orange-100 text-orange-700",
    course: "bg-amber-100 text-amber-700",
    class: "bg-indigo-100 text-indigo-700",
    event: "bg-emerald-100 text-emerald-700",
  };

  const typeBg: Record<string, string> = {
    workshop: "bg-orange-950/30",
    course: "bg-amber-950/30",
    class: "bg-indigo-950/30",
    event: "bg-emerald-950/30",
  };

  const TypeIcon: Record<string, React.ElementType> = {
    workshop: Brush,
    course: GraduationCap,
    class: Repeat,
    event: CalendarDays,
  };

  const typeIconColor: Record<string, string> = {
    workshop: "text-orange-400",
    course: "text-amber-400",
    class: "text-indigo-400",
    event: "text-emerald-400",
  };

  return (
    <Link href={`/talleres/${w.slug}`}>
      <Card className="hover:shadow-md transition-shadow h-full flex flex-col">
        <div className={`${typeBg[w.type] ?? "bg-secondary"} h-40 rounded-t-lg flex items-center justify-center text-muted-foreground text-sm shrink-0`}>
          {w.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={w.cover_image_url} alt={w.title} className="h-full w-full object-cover rounded-t-lg" />
          ) : (() => {
            const Icon = TypeIcon[w.type] ?? BookOpen;
            return <Icon className={`w-10 h-10 opacity-50 ${typeIconColor[w.type] ?? "text-muted-foreground"}`} />;
          })()}
        </div>
        <CardContent className="p-4 pb-5 flex flex-col flex-1">
          {/* Title | Type */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold leading-tight line-clamp-2">{w.title}</h3>
            <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typeColor[w.type] ?? "bg-muted text-muted-foreground"}`}>
              {typeLabel[w.type] ?? w.type}
            </span>
          </div>

          {w.category && (
            <Badge variant="secondary" className="text-xs mt-2">
              {w.category.name}
            </Badge>
          )}

          <p className="text-sm text-muted-foreground line-clamp-2 mt-2 flex-1">{w.description}</p>

          <div className="mt-3 space-y-3">
            <Separator />

            {/* Location | Modality */}
            <div className="flex items-start justify-between gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 min-w-0">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {w.modality === Modality.ONLINE ? "Online" : w.location ?? "—"}
                </span>
              </span>
              <Badge variant="outline" className="shrink-0 text-xs">
                {modalityLabel[w.modality]}
              </Badge>
            </div>

            <Separator />

            {/* Price + instructor */}
            <div className="flex items-center justify-between">
              {Number(w.price) === 0 ? (
                <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  Gratuito - Aporte consciente
                </span>
              ) : (
                <span className={`font-bold text-sm text-foreground`}>
                  {`$${formatPrice(w.price)} ${w.currency}`}
                </span>
              )}
              {w.instructor && (
                w.instructor_id ? (
                  <Link
                    href={`/talleristas/${w.instructor_id}`}
                    className="text-xs text-muted-foreground/70 hover:text-foreground hover:underline transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    por {w.instructor.name}
                  </Link>
                ) : (
                  <p className="text-xs text-muted-foreground/70">por {w.instructor.name}</p>
                )
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function WorkshopSkeleton() {
  return (
    <Card>
      <Skeleton className="h-40 rounded-t-lg rounded-b-none" />
      <CardContent className="p-4 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </CardContent>
    </Card>
  );
}

function BuscarContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState(() => searchParams?.get("q") ?? "");
  const [modality, setModality] = useState("all");
  const [type, setType] = useState("all");
  const [category, setCategory] = useState(() => searchParams?.get("categoria") ?? "all");
  const [categories, setCategories] = useState<Category[]>([]);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "map">(() =>
    searchParams?.get("vista") === "mapa" ? "map" : "list"
  );
  const { coords: userLocation, isReal: hasUserLocation } = useUserLocation();

  function changeView(v: "list" | "map") {
    setView(v);
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (v === "map") params.set("vista", "mapa");
    else params.set("vista", "talleres");
    router.replace(`/buscar?${params}`, { scroll: false });
  }

  useEffect(() => {
    api
      .getList<Category>("/api/v1/categories")
      .then(setCategories)
      .catch(() => {
        setCategories([]);
      });
  }, []);

  const fetchWorkshops = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (modality !== "all") params.set("modality", modality);
      if (type !== "all") params.set("type", type);
      if (category !== "all") params.set("category", category);
      const data = await api.getList<Workshop>(`/api/v1/workshops?${params}`);
      setWorkshops(data);
    } catch {
      setWorkshops([]);
    } finally {
      setLoading(false);
    }
  }, [query, modality, type, category]);

  useEffect(() => {
    const t = setTimeout(fetchWorkshops, 300);
    return () => clearTimeout(t);
  }, [fetchWorkshops]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    router.push(`/buscar?${params}`);
    fetchWorkshops();
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Search header */}
      <div className="bg-card border-b px-4 py-6">
        <div className="max-w-6xl mx-auto space-y-4">
          <form onSubmit={handleSearch} className="flex gap-2 max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="¿Qué quieres aprender?"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button type="submit">Buscar</Button>
          </form>

          {/* Filters + view toggle */}
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-3">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.slug}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={modality} onValueChange={setModality}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Modalidad" />
                </SelectTrigger>
                <SelectContent>
                  {MODALITIES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* List / Map toggle */}
            <div className="flex items-center gap-1 border rounded-lg p-1 bg-background">
              <button
                onClick={() => changeView("list")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Lista
              </button>
              <button
                onClick={() => changeView("map")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${view === "map" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                <Map className="h-3.5 w-3.5" /> Mapa
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <p className="text-sm text-muted-foreground mb-6">
          {loading ? "Buscando..." : `${workshops?.length ?? 0} resultado${(workshops?.length ?? 0) !== 1 ? "s" : ""}`}
        </p>

        {/* Map view — always mounted to avoid tile reload on tab switch */}
        <div className={view === "map" ? "block" : "hidden"}>
          <WorkshopsMap
            workshops={workshops.filter((w) => w.modality !== Modality.ONLINE)}
            center={userLocation}
            userLocation={hasUserLocation ? userLocation : undefined}
            visible={view === "map"}
          />
        </div>

        {/* List view */}
        {view === "list" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <WorkshopSkeleton key={i} />)
              : workshops.map((w) => <WorkshopCard key={w.id} w={w} />)}
          </div>
        )}

        {!loading && !workshops?.length && (
          <div className="text-center py-20 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">
              {query || modality !== "all" || type !== "all" || category !== "all"
                ? "No encontramos talleres con esos filtros."
                : "No existen talleres."}
            </p>
            {(query || modality !== "all" || type !== "all" || category !== "all") && (
              <p className="text-sm mt-1">Prueba con otras palabras o categorías.</p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

export default function BuscarPage() {
  return (
    <Suspense>
      <BuscarContent />
    </Suspense>
  );
}
