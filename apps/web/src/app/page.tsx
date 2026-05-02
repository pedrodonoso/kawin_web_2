"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, MapPin, Users, Star,
  Palette, ChefHat, Music, Heart, Code, Globe, Activity,
  Briefcase, Camera, Scissors,
  type LucideIcon,
} from "lucide-react";
import InstallAppSection from "./InstallAppSection";

const categories: { name: string; Icon: LucideIcon; slug: string }[] = [
  { name: "Arte y Creatividad",   Icon: Palette,  slug: "arte-creatividad" },
  { name: "Cocina y Gastronomía", Icon: ChefHat,  slug: "cocina-gastronomia" },
  { name: "Música y Danza",       Icon: Music,    slug: "musica-danza" },
  { name: "Bienestar y Salud",    Icon: Heart,    slug: "bienestar-salud" },
  { name: "Tecnología",           Icon: Code,     slug: "tecnologia" },
  { name: "Idiomas",              Icon: Globe,    slug: "idiomas" },
  { name: "Deportes",             Icon: Activity, slug: "deportes" },
  { name: "Negocios",             Icon: Briefcase,slug: "negocios" },
  { name: "Fotografía",           Icon: Camera,   slug: "fotografia" },
  { name: "Artesanía",            Icon: Scissors, slug: "artesania" },
];

export default function Home() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = query ? `?q=${encodeURIComponent(query)}` : "";
    router.push(`/buscar${params}`);
  }

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="bg-primary text-primary-foreground py-24 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h1 className="text-4xl md:text-6xl font-bold leading-tight">
            Aprende algo nuevo<br />
            <span className="text-primary-foreground/60">con quien lo ama.</span>
          </h1>
          <p className="text-primary-foreground/60 text-lg md:text-xl">
            Descubre talleres, cursos y clases cerca de ti.
            Conectamos talleristas apasionados con personas que quieren aprender.
          </p>

          <form onSubmit={handleSearch} className="flex gap-2 max-w-xl mx-auto mt-8">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40 h-4 w-4" />
              <Input
                type="text"
                placeholder="¿Qué quieres aprender?"
                className="pl-10 bg-background text-foreground border-0 h-12"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Button size="lg" type="submit" className="bg-background text-foreground hover:bg-secondary h-12">
              Buscar
            </Button>
          </form>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-8">Explorar por categoría</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {categories.map(({ name, Icon, slug }) => (
              <Link
                key={slug}
                href={`/buscar?categoria=${slug}`}
                className="flex flex-col items-center gap-2 p-6 border rounded-xl hover:border-primary hover:shadow-sm transition-all text-center"
              >
                <Icon className="h-8 w-8 text-primary" />
                <span className="text-sm font-medium">{name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-secondary/50 py-16 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          <div>
            <div className="flex justify-center mb-2">
              <Users className="h-8 w-8 text-accent" />
            </div>
            <p className="text-3xl font-bold">10</p>
            <p className="text-muted-foreground mt-1">Categorías disponibles</p>
          </div>
          <div>
            <div className="flex justify-center mb-2">
              <Star className="h-8 w-8 text-accent" />
            </div>
            <p className="text-3xl font-bold">0% comisión</p>
            <p className="text-muted-foreground mt-1">Durante el lanzamiento</p>
          </div>
          <div>
            <div className="flex justify-center mb-2">
              <MapPin className="h-8 w-8 text-accent" />
            </div>
            <p className="text-3xl font-bold">Chile</p>
            <p className="text-muted-foreground mt-1">Disponible en todo el territorio</p>
          </div>
        </div>
      </section>

      <InstallAppSection />

      {/* CTA Talleristas */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <h2 className="text-3xl font-bold">¿Tienes algo que enseñar?</h2>
          <p className="text-muted-foreground text-lg">
            Crea tu perfil de tallerista, publica tu taller y comienza a recibir reservas.
            Sin complicaciones.
          </p>
          <Button size="lg" className="mt-4" asChild>
            <Link href="/registro">Comenzar como tallerista</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <span>© 2025 kwin. Todos los derechos reservados.</span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-foreground">Términos</a>
            <a href="#" className="hover:text-foreground">Privacidad</a>
            <a href="#" className="hover:text-foreground">Contacto</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
