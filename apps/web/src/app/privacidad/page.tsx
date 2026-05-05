import Link from "next/link";

export const metadata = { title: "Política de Privacidad — Kawin" };

const sections = [
  {
    number: "01",
    title: "Información que recopilamos",
    content:
      "Al registrarte o usar Kawin recopilamos datos como nombre y correo electrónico. En el caso de talleristas, también información sobre los talleres que publicas. Adicionalmente recopilamos datos de uso de forma anónima para mejorar la plataforma.",
  },
  {
    number: "02",
    title: "Uso de la información",
    items: [
      "Gestionar tu cuenta y tus reservas.",
      "Comunicarte novedades relevantes sobre la plataforma (puedes darte de baja en cualquier momento).",
      "Mejorar la experiencia de uso mediante análisis agregados y anónimos.",
    ],
  },
  {
    number: "03",
    title: "Compartir datos con terceros",
    content:
      "No vendemos ni cedemos tus datos personales a terceros. Podemos compartir información mínima con proveedores de servicios (como pasarelas de pago) únicamente para completar las operaciones que tú solicitas.",
  },
  {
    number: "04",
    title: "Seguridad",
    content:
      "Aplicamos medidas técnicas y organizativas razonables para proteger tu información. Sin embargo, ningún sistema es 100% seguro; te recomendamos usar contraseñas robustas y no compartirlas.",
  },
  {
    number: "05",
    title: "Tus derechos",
    content: "Puedes solicitar el acceso, corrección o eliminación de tus datos en cualquier momento escribiéndonos a ",
    email: true,
  },
  {
    number: "06",
    title: "Cambios a esta política",
    content:
      "Podemos actualizar esta política ocasionalmente. Te notificaremos por correo en caso de cambios significativos.",
  },
];

export default function PrivacidadPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center justify-between">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Volver al inicio
          </Link>
          <span className="text-xs text-muted-foreground">Última actualización: mayo 2025</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-16">
        {/* Título */}
        <div className="mb-14">
          <p className="text-sm font-medium text-primary mb-2 uppercase tracking-widest">Legal</p>
          <h1 className="text-4xl font-bold mb-4">Política de Privacidad</h1>
          <p className="text-muted-foreground text-lg max-w-xl">
            En Kawin nos tomamos en serio la privacidad de tus datos. Aquí te explicamos qué
            información recopilamos, cómo la usamos y cuáles son tus derechos.
          </p>
        </div>

        {/* Secciones */}
        <div className="space-y-0 divide-y">
          {sections.map((s) => (
            <div key={s.number} className="grid grid-cols-1 sm:grid-cols-[80px_1fr] gap-4 py-10">
              <span className="text-3xl font-bold text-muted-foreground/30 tabular-nums">
                {s.number}
              </span>
              <div>
                <h2 className="text-lg font-semibold mb-3">{s.title}</h2>
                {s.content && !s.email && (
                  <p className="text-muted-foreground leading-relaxed">{s.content}</p>
                )}
                {s.email && (
                  <p className="text-muted-foreground leading-relaxed">
                    {s.content}
                    <a
                      href="mailto:oasis.latam.info@gmail.com"
                      className="text-primary hover:underline"
                    >
                      oasis.latam.info@gmail.com
                    </a>
                    .
                  </p>
                )}
                {s.items && (
                  <ul className="space-y-2 mt-1">
                    {s.items.map((item) => (
                      <li key={item} className="flex gap-2 text-muted-foreground">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* CTA contacto */}
        <div className="mt-16 rounded-xl border bg-secondary/30 px-8 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="font-semibold text-lg mb-1">¿Tienes dudas sobre tu privacidad?</p>
            <p className="text-muted-foreground text-sm">
              Escríbenos directamente y te respondemos a la brevedad.
            </p>
          </div>
          <Link
            href="/contacto"
            className="shrink-0 bg-primary text-primary-foreground rounded-md px-5 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Ir a Contacto
          </Link>
        </div>
      </div>
    </main>
  );
}
