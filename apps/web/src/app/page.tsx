import { Button } from "@/components/ui/button";
import { Search, MapPin, Users, Star } from "lucide-react";

const categories = [
  { name: "Arte y Creatividad", icon: "🎨", slug: "arte-creatividad" },
  { name: "Cocina y Gastronomía", icon: "🍳", slug: "cocina-gastronomia" },
  { name: "Música y Danza", icon: "🎵", slug: "musica-danza" },
  { name: "Bienestar y Salud", icon: "🧘", slug: "bienestar-salud" },
  { name: "Tecnología", icon: "💻", slug: "tecnologia" },
  { name: "Idiomas", icon: "🌎", slug: "idiomas" },
  { name: "Deportes", icon: "⚽", slug: "deportes" },
  { name: "Artesanía", icon: "✂️", slug: "artesania" },
];

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Nav */}
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight">kawin</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm">Iniciar sesión</Button>
            <Button size="sm">Soy tallerista</Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-zinc-950 text-white py-24 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h1 className="text-4xl md:text-6xl font-bold leading-tight">
            Aprende algo nuevo<br />
            <span className="text-zinc-400">con quien lo ama.</span>
          </h1>
          <p className="text-zinc-400 text-lg md:text-xl">
            Descubre talleres, cursos y clases cerca de ti.
            Conectamos talleristas apasionados con personas que quieren aprender.
          </p>

          {/* Search bar */}
          <div className="flex gap-2 max-w-xl mx-auto mt-8">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 h-4 w-4" />
              <input
                type="text"
                placeholder="¿Qué quieres aprender?"
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-white text-zinc-900 outline-none"
              />
            </div>
            <Button size="lg" className="bg-white text-zinc-900 hover:bg-zinc-100">
              Buscar
            </Button>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-8">Explorar por categoría</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {categories.map((cat) => (
              <button
                key={cat.slug}
                className="flex flex-col items-center gap-2 p-6 border rounded-xl hover:border-zinc-900 hover:shadow-sm transition-all text-center"
              >
                <span className="text-3xl">{cat.icon}</span>
                <span className="text-sm font-medium">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-zinc-50 py-16 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          <div>
            <div className="flex justify-center mb-2">
              <Users className="h-8 w-8 text-zinc-700" />
            </div>
            <p className="text-3xl font-bold">+500</p>
            <p className="text-zinc-500 mt-1">Talleristas activos</p>
          </div>
          <div>
            <div className="flex justify-center mb-2">
              <Star className="h-8 w-8 text-zinc-700" />
            </div>
            <p className="text-3xl font-bold">+1.200</p>
            <p className="text-zinc-500 mt-1">Talleres disponibles</p>
          </div>
          <div>
            <div className="flex justify-center mb-2">
              <MapPin className="h-8 w-8 text-zinc-700" />
            </div>
            <p className="text-3xl font-bold">5 países</p>
            <p className="text-zinc-500 mt-1">América Latina</p>
          </div>
        </div>
      </section>

      {/* CTA Talleristas */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <h2 className="text-3xl font-bold">¿Tienes algo que enseñar?</h2>
          <p className="text-zinc-500 text-lg">
            Crea tu perfil de tallerista, publica tu taller y comienza a recibir reservas.
            Sin complicaciones.
          </p>
          <Button size="lg" className="mt-4">
            Comenzar como tallerista
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-zinc-500">
          <span>© 2025 Kawin. Todos los derechos reservados.</span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-zinc-900">Términos</a>
            <a href="#" className="hover:text-zinc-900">Privacidad</a>
            <a href="#" className="hover:text-zinc-900">Contacto</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
