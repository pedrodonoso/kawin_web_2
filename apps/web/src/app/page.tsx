"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, MapPin, ArrowRight, CalendarDays, Route,
  Palette, ChefHat, Music, Heart, Code, Globe, Activity,
  Briefcase, Camera, Scissors,
  type LucideIcon,
} from "lucide-react";
import InstallAppSection from "./InstallAppSection";

const categories: { name: string; Icon: LucideIcon; slug: string }[] = [
  { name: "Arte y Creatividad",   Icon: Palette,   slug: "arte-creatividad" },
  { name: "Cocina y Gastronomía", Icon: ChefHat,   slug: "cocina-gastronomia" },
  { name: "Música y Danza",       Icon: Music,     slug: "musica-danza" },
  { name: "Bienestar y Salud",    Icon: Heart,     slug: "bienestar-salud" },
  { name: "Tecnología",           Icon: Code,      slug: "tecnologia" },
  { name: "Idiomas",              Icon: Globe,     slug: "idiomas" },
  { name: "Deportes",             Icon: Activity,  slug: "deportes" },
  { name: "Negocios",             Icon: Briefcase, slug: "negocios" },
  { name: "Fotografía",           Icon: Camera,    slug: "fotografia" },
  { name: "Artesanía",            Icon: Scissors,  slug: "artesania" },
];

const manifesto = [
  { phrase: "Sal del feed.", sub: "El aprendizaje pasa en persona, no en una pantalla." },
  { phrase: "Sin tutoriales.", sub: "Con personas reales que ya lo saben y quieren enseñarlo." },
  { phrase: "Tu barrio sabe.", sub: "Cada cuadra guarda alguien con algo valioso para darte." },
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

      {/* ── Hero ── */}
      <section className="relative bg-primary text-primary-foreground overflow-hidden">
        {/* fondo decorativo */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <div className="relative max-w-4xl mx-auto px-4 py-28 text-center space-y-8">
          {/* tag */}
          <span className="inline-flex items-center gap-2 bg-primary-foreground/10 border border-primary-foreground/20 text-primary-foreground/80 rounded-full px-4 py-1.5 text-sm font-medium">
            <MapPin className="h-3.5 w-3.5" />
            El punto de reunión de tu barrio
          </span>

          <h1 className="text-5xl md:text-7xl font-extrabold leading-[1.05] tracking-tight">
            Aprendamos juntos.<br />
            <span className="text-primary-foreground/50">En la calle.</span>
          </h1>

          <p className="text-primary-foreground/65 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            En Kwin, las personas se reunen para enseñarse lo que saben.
            Sin pantallas de por medio, sin algoritmos decidiendo por ti. Solo gente con ganas de compartir.
          </p>

          <form onSubmit={handleSearch} className="flex gap-2 max-w-lg mx-auto">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40 h-4 w-4" />
              <Input
                type="text"
                placeholder="¿Qué quieres aprender?"
                className="pl-10 bg-background text-foreground border-0 h-12 rounded-xl"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Button size="lg" type="submit" className="bg-background text-foreground hover:bg-secondary h-12 rounded-xl px-6">
              Buscar
            </Button>
          </form>

          <p className="text-primary-foreground/40 text-sm">
            Talleres, cursos, clases y eventos presenciales cerca de ti
          </p>
        </div>
      </section>

      {/* ── Manifesto ── */}
      <section className="py-20 px-4 bg-background">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border rounded-2xl overflow-hidden">
            {manifesto.map(({ phrase, sub }) => (
              <div key={phrase} className="bg-background px-8 py-10 space-y-2">
                <p className="text-2xl font-bold tracking-tight">{phrase}</p>
                <p className="text-muted-foreground text-sm leading-relaxed">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Que es kawinear ── */}
      <section className="py-20 px-4 bg-secondary/30">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">El concepto</p>
          <h2 className="text-4xl md:text-5xl font-extrabold leading-tight">
            ¿Qué es <span className="text-primary">kawinear</span>?
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
            Kawinear es salir a la calle y aprender algo con las manos. Es que el panadero del barrio te enseñe masa madre. 
            Que la vecina te dé tu primera clase de cerámica. Es aprender de personas reales, en lugares reales.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button size="lg" asChild className="rounded-xl">
              <Link href="/buscar">
                Quiero kawinear <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="rounded-xl">
              <Link href="/registro">Quiero enseñar</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Categorías ── */}
      <section className="py-20 px-4 bg-background">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="flex items-end justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Aprende lo que tu barrio enseña</p>
              <h2 className="text-2xl font-bold">¿Qué quieres aprender hoy?</h2>
            </div>
            <Link
              href="/buscar"
              className="text-sm text-primary font-medium hover:underline hidden sm:flex items-center gap-1"
            >
              Ver todo <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {categories.map(({ name, Icon, slug }) => (
              <Link
                key={slug}
                href={`/buscar?categoria=${slug}`}
                className="group flex flex-col items-center gap-2 p-5 border rounded-2xl hover:border-primary hover:bg-primary/5 transition-all text-center"
              >
                <Icon className="h-7 w-7 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-xs font-medium leading-tight">{name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Explora ── */}
      <section className="py-20 px-4 bg-secondary/30">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Descubre</p>
            <h2 className="text-3xl md:text-4xl font-extrabold">Todo en un solo punto de reunión</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <Link
              href="/buscar"
              className="group border bg-background rounded-2xl p-7 space-y-3 hover:border-primary hover:shadow-sm transition-all"
            >
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Search className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-bold group-hover:text-primary transition-colors">Talleres y clases</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Arte, cocina, baile, idiomas, oficios — personas de tu ciudad que ya saben y quieren enseñar.
              </p>
            </Link>

            <Link
              href="/buscar?vista=mapa"
              className="group border bg-background rounded-2xl p-7 space-y-3 hover:border-primary hover:shadow-sm transition-all"
            >
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-bold group-hover:text-primary transition-colors">Mapa de talleres</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Activa la ubicación y encuentra lo que está pasando ahora mismo cerca de ti, en el mapa.
              </p>
            </Link>

            <Link
              href="/buscar?tipo=event"
              className="group border bg-background rounded-2xl p-7 space-y-3 hover:border-primary hover:shadow-sm transition-all"
            >
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-bold group-hover:text-primary transition-colors">Eventos</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Ferias, encuentros y actividades únicas — experiencias que suceden una sola vez.
              </p>
            </Link>

            <div className="border border-dashed bg-background rounded-2xl p-7 space-y-3 opacity-70">
              <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                <Route className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">Rutas turísticas</h3>
                <span className="text-xs font-semibold bg-primary/10 text-primary rounded-full px-2 py-0.5">Pronto</span>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Panoramas y rutas curadas — descubre tu ciudad de otra forma, guiado por quienes la conocen de verdad.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Cómo funciona ── */}
      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-2">
            <p className="text-xs font-semibold tracking-widest text-primary-foreground/50 uppercase">Así de simple</p>
            <h2 className="text-3xl md:text-4xl font-extrabold">De la pantalla a la calle, en tres pasos</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { n: "01", title: "Encuentra", desc: "Busca un taller cerca de ti. Arte, cocina, baile, idiomas — lo que tu barrio tiene." },
              { n: "02", title: "Reserva", desc: "Agenda en segundos. Sin cuentas de banco, sin complicaciones." },
              { n: "03", title: "Kawinea", desc: "Aparece. Conoce a quien lo enseña. Aprende con las manos." },
            ].map(({ n, title, desc }) => (
              <div key={n} className="space-y-3">
                <span className="text-5xl font-black text-primary-foreground/20">{n}</span>
                <h3 className="text-xl font-bold">{title}</h3>
                <p className="text-primary-foreground/60 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center">
            <Button size="lg" variant="secondary" asChild className="rounded-xl">
              <Link href="/buscar">Buscar talleres cerca</Link>
            </Button>
          </div>
        </div>
      </section>

      <InstallAppSection />

      {/* ── CTA Talleristas ── */}
      <section className="py-24 px-4 bg-background">
        <div className="max-w-3xl mx-auto text-center space-y-5">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Para talleristas</p>
          <h2 className="text-4xl font-extrabold leading-tight">
            Tu barrio tiene ganas de aprender<br />
            <span className="text-primary">lo que sabes.</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Crea tu taller, pon tu precio y empieza a reunir personas.
            Kawin hace el resto.
          </p>
          <Button size="lg" className="mt-2 rounded-xl" asChild>
            <Link href="/registro">
              Comenzar a enseñar <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <span>© 2025 Kawin. Aprendamos juntos.</span>
          <div className="flex gap-6">
            <Link href="/privacidad" className="hover:text-foreground">Privacidad</Link>
            <Link href="/contacto" className="hover:text-foreground">Contacto</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
