import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function CondicionesInstructorPage() {
  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Volver al dashboard
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Condiciones para instructores</h1>
          <p className="text-zinc-500 mt-1">Política de comisiones y cancelaciones</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Comisión de plataforma</h2>
          <p className="text-zinc-600 text-sm leading-relaxed">
            Kawin cobra una comisión del <strong>15%</strong> sobre el valor de cada reserva confirmada.
            Esta comisión cubre los costos operativos de la plataforma, procesamiento de pagos y soporte.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">¿Cuándo la comisión es a cargo del instructor?</h2>
          <p className="text-zinc-600 text-sm leading-relaxed">
            La responsabilidad de la comisión depende del momento en que se produce la cancelación
            o cambio de horario:
          </p>
          <ul className="space-y-2 text-sm text-zinc-600">
            <li className="flex gap-2">
              <span className="text-red-500 font-bold shrink-0">•</span>
              <span>
                <strong>Comisión a cargo del instructor:</strong> si la clase cancelada o migrada
                pertenece a la semana actual o a una semana pasada (es decir, hoy es igual o posterior
                al domingo de inicio de la semana de la clase). En este caso, la comisión ya fue
                generada y será descontada de tu próximo pago.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-green-500 font-bold shrink-0">•</span>
              <span>
                <strong>Sin cargo:</strong> si la clase pertenece a una semana futura (hoy es anterior
                al domingo de inicio de esa semana). La comisión aún no fue generada y no se aplica
                ningún descuento.
              </span>
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Ejemplo práctico</h2>
          <div className="rounded-lg border bg-white p-4 text-sm text-zinc-600 space-y-2">
            <p>Tienes una clase el <strong>miércoles 2 de abril</strong>. La semana comienza el lunes 31 de marzo.</p>
            <p>
              Si cambias el horario <strong>antes del lunes 31 de marzo</strong> →{" "}
              <span className="text-green-700 font-medium">Sin cargo</span>
            </p>
            <p>
              Si cambias el horario <strong>el lunes 31 de marzo o después</strong> →{" "}
              <span className="text-red-700 font-medium">Comisión a tu cargo (15%)</span>
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Reembolsos a alumnos</h2>
          <p className="text-zinc-600 text-sm leading-relaxed">
            Cuando cancelas o migras reservas, los alumnos afectados reciben una notificación y,
            en caso de devolución, el reembolso se procesa en un plazo de <strong>3 a 5 días hábiles</strong>.
          </p>
        </section>

        <p className="text-xs text-zinc-400 border-t pt-4">
          Estas condiciones pueden actualizarse. Última revisión: marzo 2026.
          Ante cualquier duda escríbenos a{" "}
          <a href="mailto:soporte@kawin.app" className="underline">soporte@kawin.app</a>.
        </p>
      </div>
    </main>
  );
}
