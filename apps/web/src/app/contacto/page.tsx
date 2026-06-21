import Link from "next/link";

export const metadata = { title: "Contacto — Kwin" };

export default function ContactoPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center justify-between">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Volver al inicio
          </Link>
          <span className="text-xs text-muted-foreground">
            Respondemos en menos de 48 h
          </span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-16">
        {/* Título */}
        <div className="mb-14">
          <p className="text-sm font-medium text-primary mb-2 uppercase tracking-widest">Soporte</p>
          <h1 className="text-4xl font-bold mb-4">Contacto</h1>
          <p className="text-muted-foreground text-lg max-w-xl">
            ¿Tienes una sugerencia o un reclamo? Escríbenos y te respondemos a la brevedad.
          </p>
        </div>

        {/* Grid: formulario + info lateral */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_280px] gap-12 items-start">
          {/* Formulario */}
          <form
            action="https://formsubmit.co/kwin.latam@gmail.com"
            method="POST"
            className="space-y-5"
          >
            <input type="hidden" name="_captcha" value="false" />
            <input type="hidden" name="_subject" value="Nuevo mensaje desde Kwin" />
            <input type="hidden" name="_next" value="/contacto?enviado=1" />

            <div>
              <label htmlFor="contact-name" className="block text-sm font-medium mb-1.5">
                Nombre
              </label>
              <input
                id="contact-name"
                type="text"
                name="name"
                required
                placeholder="Tu nombre"
                className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label htmlFor="contact-email" className="block text-sm font-medium mb-1.5">
                Correo electrónico
              </label>
              <input
                id="contact-email"
                type="email"
                name="email"
                required
                placeholder="tu@correo.com"
                className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label htmlFor="contact-type" className="block text-sm font-medium mb-1.5">
                Tipo de mensaje
              </label>
              <select
                id="contact-type"
                name="tipo"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Selecciona una opción</option>
                <option value="Sugerencia">Sugerencia</option>
                <option value="Reclamo">Reclamo</option>
              </select>
            </div>

            <div>
              <label htmlFor="contact-message" className="block text-sm font-medium mb-1.5">
                Mensaje
              </label>
              <textarea
                id="contact-message"
                name="message"
                required
                rows={6}
                placeholder="Escribe tu mensaje aquí..."
                className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-primary text-primary-foreground rounded-md py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Enviar mensaje
            </button>
          </form>

          {/* Info lateral */}
          <aside className="space-y-6 pt-1">
            <div className="rounded-xl border bg-secondary/30 p-6">
              <p className="text-sm font-semibold mb-1">Correo directo</p>
              <a
                href="mailto:kwin.latam@gmail.com"
                className="text-sm text-primary hover:underline break-all"
              >
                kwin.latam@gmail.com
              </a>
            </div>

            <div className="rounded-xl border bg-secondary/30 p-6">
              <p className="text-sm font-semibold mb-2">¿Qué tipo de mensaje envío?</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  <span><strong className="text-foreground">Sugerencia</strong> — ideas para mejorar la plataforma.</span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  <span><strong className="text-foreground">Reclamo</strong> — problemas con reservas, pagos o usuarios.</span>
                </li>
              </ul>
            </div>

            <div className="rounded-xl border bg-secondary/30 p-6">
              <p className="text-sm font-semibold mb-1">Privacidad</p>
              <p className="text-sm text-muted-foreground">
                Tus datos son tratados según nuestra{" "}
                <Link href="/privacidad" className="text-primary hover:underline">
                  política de privacidad
                </Link>
                .
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
