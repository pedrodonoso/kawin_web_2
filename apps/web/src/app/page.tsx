"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, MapPin, ArrowRight, Code2, ShieldCheck,
  Palette, ChefHat, Music, Sprout, Hammer, Globe, Activity,
  HandHeart, Camera, Scissors,
  CalendarCheck, GraduationCap, Repeat, PartyPopper,
  type LucideIcon,
} from "lucide-react";
import InstallAppSection from "./InstallAppSection";

const categories: { name: string; Icon: LucideIcon; slug: string }[] = [
  { name: "Arte y Creatividad",   Icon: Palette,   slug: "arte-creatividad" },
  { name: "Cocina y Gastronomía", Icon: ChefHat,   slug: "cocina-gastronomia" },
  { name: "Oficios y Reparación", Icon: Hammer,    slug: "oficios" },
  { name: "Tierra y Huerta",      Icon: Sprout,    slug: "tierra-huerta" },
  { name: "Música y Danza",       Icon: Music,     slug: "musica-danza" },
  { name: "Cuerpo y Salud",       Icon: Activity,  slug: "bienestar-salud" },
  { name: "Idiomas",              Icon: Globe,     slug: "idiomas" },
  { name: "Cuidados y Crianza",   Icon: HandHeart, slug: "cuidados" },
  { name: "Fotografía",           Icon: Camera,    slug: "fotografia" },
  { name: "Artesanía",            Icon: Scissors,  slug: "artesania" },
];

const activityTypes: {
  name: string;
  Icon: LucideIcon;
  tagline: string;
  desc: string;
  example: string;
}[] = [
  {
    name: "Taller",
    Icon: CalendarCheck,
    tagline: "Una experiencia puntual",
    desc: "Uno o pocos encuentros con fecha fija. Te contactas con quien lo hace y vas.",
    example: "Ej: taller de cerámica, un sábado por la tarde.",
  },
  {
    name: "Curso",
    Icon: GraduationCap,
    tagline: "Aprende paso a paso",
    desc: "Un programa de varias sesiones en orden. Coordinas con quien lo imparte y lo sigues de principio a fin.",
    example: "Ej: curso de guitarra para principiantes, 6 clases.",
  },
  {
    name: "Clase",
    Icon: Repeat,
    tagline: "A tu ritmo, los días que quieras",
    desc: "Una actividad que se repite en horarios fijos. Contactas a quien la da y eliges a qué sesiones ir.",
    example: "Ej: yoga los lunes y miércoles a las 19:00.",
  },
  {
    name: "Evento",
    Icon: PartyPopper,
    tagline: "Un encuentro especial",
    desc: "Un acontecimiento con fecha fija, sin estructura de clases. Contactas a quien lo organiza y participas.",
    example: "Ej: feria de productores, charla o tocata.",
  },
];

const manifesto = [
  { phrase: "Compartir.", sub: "Nadie lo sabe todo, todos sabemos algo. Acá puedes compartirlo." },
  { phrase: "El valor del trabajo.", sub: "Quien enseña su oficio merece reconocimiento, no caridad ni propina." },
  { phrase: "Autogestión.", sub: "Cada quien pone su precio, su tiempo y sus reglas." },
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
      <section className="relative bg-foreground text-background overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        <div aria-hidden className="absolute top-0 inset-x-0 h-1.5 bg-primary" />

        <div className="relative max-w-4xl mx-auto px-4 py-28 text-center space-y-8">
          <span className="inline-flex items-center gap-2 bg-primary/15 border border-primary/40 text-primary rounded-full px-4 py-1.5 text-sm font-medium">
            <MapPin className="h-3.5 w-3.5" />
            El punto de reunión del barrio
          </span>

          <h1 className="text-5xl md:text-7xl font-extrabold leading-[1.05] tracking-tight">
            El conocimiento es de quien<br />
            <span className="text-primary">lo trabaja.</span>
          </h1>

          <p className="text-background/65 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            El conocimiento vive en el territorio: en las manos del vecino, en la mesa común,
            en el taller de la esquina. Acá nos juntamos a aprenderlo cara a cara,
            sin algoritmos decidiendo por ti.
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
            <Button size="lg" type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90 h-12 rounded-xl px-6">
              Buscar
            </Button>
          </form>

          <p className="text-background/40 text-sm">
            Talleres, oficios, clases y encuentros presenciales cerca de ti
          </p>
        </div>
      </section>

      {/* ── Manifiesto ── */}
      <section className="py-20 px-4 bg-background">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <p className="text-xs font-semibold tracking-widest text-primary uppercase">Nuestra forma de hacer</p>
            <h2 className="text-3xl md:text-4xl font-extrabold">Un mercado que no se siente como mercado</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-foreground rounded-2xl overflow-hidden">
            {manifesto.map(({ phrase, sub }) => (
              <div key={phrase} className="bg-background px-8 py-10 space-y-2">
                <p className="text-2xl font-bold tracking-tight">
                  <span className="text-primary">/</span> {phrase}
                </p>
                <p className="text-muted-foreground text-sm leading-relaxed">{sub}</p>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground text-base leading-relaxed text-center max-w-2xl mx-auto">
            Todo trabajo tiene valor. Si encuentras un kawin gratuito, esperamos que como comunidad
            aportemos de forma consciente a quien comparte su tiempo y su saber.
          </p>
        </div>
      </section>

      {/* ── El nombre y el concepto ── */}
      <section className="py-20 px-4 bg-foreground text-background">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <p className="text-xs font-semibold tracking-widest text-primary uppercase">El nombre</p>
            <h2 className="text-3xl md:text-4xl font-extrabold leading-tight">
              Kawin viene de <span className="text-primary">kawiñ</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-px bg-background/15 rounded-2xl overflow-hidden">
            <div className="bg-foreground px-8 py-10 space-y-3">
              <p className="text-sm font-semibold tracking-widest text-primary uppercase">Mapudungun</p>
              <p className="text-2xl font-bold leading-snug">
                <span lang="arn">kawiñ</span>
              </p>
              <p className="text-background/70 text-base leading-relaxed">
                Palabra del pueblo mapuche para la <strong className="text-background">fiesta o reunión</strong>:
                el encuentro donde la gente se junta, comparte y celebra.
              </p>
            </div>
            <div className="bg-foreground px-8 py-10 space-y-3">
              <p className="text-sm font-semibold tracking-widest text-primary uppercase">Hoy en Chile</p>
              <p className="text-2xl font-bold leading-snug">el cahuín</p>
              <p className="text-background/70 text-base leading-relaxed">
                Con el tiempo, en el habla cotidiana <span lang="arn">kawiñ</span> derivó en
                <strong className="text-background"> cahuín</strong>: la junta, la conversa que se alarga.
                Sigue siendo, en el fondo, gente reunida que comparte.
              </p>
            </div>
          </div>

          <p className="text-background/65 text-lg max-w-2xl mx-auto leading-relaxed text-center">
            Nos quedamos con la raíz: <strong className="text-background">reunirse</strong>.
          </p>

          {/* ── Qué es kawinear ── */}
          <div className="pt-10 border-t border-background/15 text-center space-y-6">
            <p className="text-xs font-semibold tracking-widest text-primary uppercase">El concepto</p>
            <h2 className="text-4xl md:text-5xl font-extrabold leading-tight">
              ¿Qué es <span className="text-primary">kawinear</span>?
            </h2>
            <p className="text-background/65 text-lg max-w-2xl mx-auto leading-relaxed">
              Kawin es el punto de reunión donde el barrio se encuentra cara a cara para aprender, compartir un oficio, un evento de tu interés, una pichanga, una feria de moda, un café, un club de lectura o simplemente conversar. Una fiesta de saberes, hecha comunidad.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button size="lg" asChild className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
                <Link href="/buscar">
                  Quiero kawinear <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="rounded-xl border-background/30 bg-transparent text-background hover:bg-background/10 hover:text-background">
                <Link href="/registro">Quiero enseñar lo que sé</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Categorías ── */}
      <section className="py-20 px-4 bg-background">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="flex items-end justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold tracking-widest text-primary uppercase">Lo que tu territorio enseña</p>
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

      {/* ── Territorio ── */}
      <section className="py-20 px-4 bg-secondary/40">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10 items-center">
          <div className="space-y-5">
            <p className="text-xs font-semibold tracking-widest text-primary uppercase">Pertenecer</p>
            <h2 className="text-3xl md:text-4xl font-extrabold leading-tight">
              El territorio se aprende <span className="text-primary">en la calle.</span>
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              No somos una plataforma para consumir contenido. Somos un punto de encuentro
              entre quienes habitan un mismo lugar. Activa tu ubicación y descubre lo que
              está pasando ahora mismo, a la vuelta de la esquina.
            </p>
            <Button size="lg" asChild className="rounded-xl">
              <Link href="/buscar?vista=mapa">
                <MapPin className="mr-2 h-4 w-4" /> Ver el mapa del barrio
              </Link>
            </Button>
            <p className="text-muted-foreground text-sm leading-relaxed">
              No guardamos tus datos de ubicación: solo se usan para marcar tu posición en las
              funcionalidades con mapa, en tu propio dispositivo. La ubicación puede fallar si tu equipo
              tiene desactivada la función de geolocalización del navegador o restricciones de uso del GPS.
            </p>
          </div>
          <Link
            href="/buscar?vista=mapa"
            className="group relative h-64 rounded-2xl border-2 border-dashed border-foreground/20 bg-background flex flex-col items-center justify-center gap-3 hover:border-primary transition-colors overflow-hidden"
          >
            <div
              aria-hidden
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
                backgroundSize: "32px 32px",
              }}
            />
            <MapPin className="h-10 w-10 text-primary relative" />
            <span className="text-sm text-muted-foreground relative">Encuentros cerca de ti</span>
          </Link>
        </div>
      </section>

      {/* ── Cómo funciona ── */}
      <section className="py-20 px-4 bg-foreground text-background">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-2">
            <p className="text-xs font-semibold tracking-widest text-primary uppercase">Así de simple</p>
            <h2 className="text-3xl md:text-4xl font-extrabold">De la pantalla a la calle, en tres pasos</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { n: "01", title: "Encuentra", desc: "Busca un taller cerca de ti. Arte, cocina, oficios, huerta — lo que tu barrio tiene para dar." },
              { n: "02", title: "Contacta", desc: "Por ahora la reserva no se hace en la plataforma: escríbele directo por sus redes sociales o datos de contacto y coordinan entre ustedes." },
              { n: "03", title: "Reúnete", desc: "Aparece. Conoce a la persona. Aprende con las manos y quédate a conversar." },
            ].map(({ n, title, desc }) => (
              <div key={n} className="space-y-3">
                <span className="text-5xl font-black text-primary">{n}</span>
                <h3 className="text-xl font-bold">{title}</h3>
                <p className="text-background/60 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center">
            <Button size="lg" asChild className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
              <Link href="/buscar">Buscar talleres cerca</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Tipos de actividad ── */}
      <section className="py-20 px-4 bg-background">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <p className="text-xs font-semibold tracking-widest text-primary uppercase">Distintas formas de juntarse</p>
            <h2 className="text-3xl md:text-4xl font-extrabold">No todos los encuentros son iguales</h2>
            <p className="text-muted-foreground text-base leading-relaxed pt-1">
              En Kawin cada publicación tiene un formato según cómo funciona. Esto te dice qué esperar
              antes de escribirle a quien la organiza.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {activityTypes.map(({ name, Icon, tagline, desc, example }) => (
              <div
                key={name}
                className="flex flex-col gap-3 p-6 border rounded-2xl hover:border-primary hover:bg-primary/5 transition-all"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold leading-tight">{name}</h3>
                  <p className="text-primary text-sm font-medium">{tagline}</p>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed flex-1">{desc}</p>
                <p className="text-muted-foreground/80 text-xs leading-relaxed italic border-t pt-3">{example}</p>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed text-center max-w-2xl mx-auto">
            <strong className="text-foreground">¿La gran diferencia?</strong> Una <strong className="text-foreground">Clase</strong> se
            repite y eliges a qué días ir. Un <strong className="text-foreground">Taller</strong>,
            <strong className="text-foreground"> Curso</strong> o <strong className="text-foreground">Evento</strong> es una actividad
            puntual que tomas completa. En todos los casos coordinas directamente con quien la hace, escribiéndole por sus redes o contacto.
          </p>
        </div>
      </section>

      {/* ── Infraestructura y cuidado ── */}
      <section className="py-20 px-4 bg-secondary/40">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Code2 className="h-6 w-6 text-primary" />
              <p className="text-xs font-semibold tracking-widest text-primary uppercase">Infraestructura modesta</p>
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold leading-tight">
              Un proyecto <span className="text-primary">pequeño y honesto.</span>
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Kawin no usa servicios de Google ni Amazon. Los servicios se levantan en
              <strong className="text-foreground"> Railway</strong>, y para encontrar lugares usamos la
              capa demo de <strong className="text-foreground">Photon</strong> (photon.komoot.io). Es una
              infraestructura modesta y de bajo costo: te pedimos paciencia y consideración al usar el
              sitio, porque sostiene una comunidad, no una gran corporación.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                "Railway", "Photon (demo)",
              ].map((tech) => (
                <span
                  key={tech}
                  className="text-sm font-medium border border-foreground/20 bg-background rounded-full px-3 py-1"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 text-primary" />
              <p className="text-xs font-semibold tracking-widest text-primary uppercase">Cuidado de la comunidad</p>
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold leading-tight">
              Un espacio <span className="text-primary">cuidado.</span>
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Para que el barrio se mantenga sano, Kawin necesita administración. Revisamos las
              publicaciones para evitar el spam y los avisos mal intencionados, de modo que lo que
              encuentres sean talleres y encuentros reales de personas reales. Cuida nuestro espacio.
            </p>
          </div>
        </div>
      </section>

      {/* ── Aporta talleres y encuentros ── */}
      <section className="py-20 px-4 bg-background">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">Aporta a la comunidad</p>
          <h2 className="text-3xl md:text-4xl font-extrabold leading-tight">
            ¿Conoces algo que <span className="text-primary">vale la pena compartir?</span>
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Si quieres aportar con talleres que no gestionas pero te parecen interesantes —eventos,
            clases, encuentros y más—, escríbenos a la administración. Nos contactaremos contigo y con
            tus referencias para hacer esta comunidad más grande, segura y abierta.
          </p>
          <div className="pt-2">
            <Button size="lg" asChild className="rounded-xl">
              <Link href="/contacto">
                Escribir a la administración <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed pt-4">
            ¿Tienes sugerencias sobre la experiencia de uso o encontraste algún error en la plataforma?
            Se agradece que nos lo comentes en la{" "}
            <Link href="/contacto" className="text-primary font-medium hover:underline">sección de contacto</Link>{" "}
            o directamente al correo{" "}
            <a href="mailto:oasis.latam.info@gmail.com" className="text-primary font-medium hover:underline">
              oasis.latam.info@gmail.com
            </a>.
          </p>
        </div>
      </section>

      <InstallAppSection />

      {/* ── Footer ── */}
      <footer className="border-t py-8 px-4 bg-background">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <span>© 2026 Kawin · Conocimiento y territorio</span>
          <div className="flex gap-6">
            <Link href="/privacidad" className="hover:text-foreground">Privacidad</Link>
            <Link href="/contacto" className="hover:text-foreground">Contacto</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
