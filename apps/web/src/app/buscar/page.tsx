"use client";

import { useEffect, useState, useCallback } from "react";
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
import { Search, MapPin, Clock, LayoutGrid, Map } from "lucide-react";
import { api, type Workshop, type Category } from "@/lib/api";

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
    workshop: "bg-primary/10 text-primary",
    course: "bg-accent/20 text-accent",
    class: "bg-accent/30 text-accent",
    event: "bg-primary/15 text-primary",
  };

  return (
    <Link href={`/talleres/${w.slug}`}>
      <Card className="hover:shadow-md transition-shadow h-full">
        <div className="bg-secondary h-40 rounded-t-lg flex items-center justify-center text-muted-foreground text-sm">
          {w.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={w.cover_image_url} alt={w.title} className="h-full w-full object-cover rounded-t-lg" />
          ) : (
            "Sin imagen"
          )}
        </div>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold leading-tight line-clamp-2">{w.title}</h3>
            <Badge variant="outline" className="shrink-0 text-xs">
              {modalityLabel[w.modality]}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typeColor[w.type] ?? "bg-muted text-muted-foreground"}`}>
              {typeLabel[w.type] ?? w.type}
            </span>
          </div>
          {w.category && (
            <Badge variant="secondary" className="text-xs">
              {w.category.name}
            </Badge>
          )}
          <p className="text-sm text-muted-foreground line-clamp-2">{w.description}</p>
          <Separator />
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-3 text-muted-foreground">
              {w.modality === "online" ? (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Online
                </span>
              ) : w.location ? (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {w.location.split(",")[0]}
                </span>
              ) : null}
            </div>
            <span className="font-bold text-foreground">
              {w.price === 0
                ? "Gratis"
                : `$${w.price.toLocaleString("es-CL")} ${w.currency}`}
            </span>
          </div>
          {w.instructor && (
            <p className="text-xs text-muted-foreground/70">por {w.instructor.name}</p>
          )}
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

export default function BuscarPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [modality, setModality] = useState("all");
  const [type, setType] = useState("all");
  const [category, setCategory] = useState(searchParams.get("categoria") ?? "all");
  const [categories, setCategories] = useState<Category[]>([]);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "map">("list");

  useEffect(() => {
    api
      .getList<Category>("/api/v1/categories")
      .then(setCategories)
      .catch(() => {});
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
              onClick={() => setView("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Lista
            </button>
            <button
              onClick={() => setView("map")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                view === "map" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
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

        {/* Map view */}
        {view === "map" && !loading && (
          <WorkshopsMap
            workshops={workshops.filter((w) => w.modality !== "online")}
          />
        )}

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
