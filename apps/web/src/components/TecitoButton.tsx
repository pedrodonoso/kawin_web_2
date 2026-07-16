import { Coffee } from "lucide-react";

/**
 * Botón de donación de tecito.app ("Aporte con un tecito").
 *
 * El widget oficial de tecito.app (button.v1.3.js) inyecta el botón vía
 * document.writeln(), que es un no-op cuando el script se carga de forma
 * asíncrona o después de que la página ya cargó (React/Next). Por eso el
 * widget nunca aparecía. En la práctica ese widget solo genera un enlace a
 * https://tecito.app/<slug>, así que lo replicamos de forma nativa: sin
 * script externo, sin document.write y sin tocar la CSP.
 */
export default function TecitoButton() {
  return (
    <a
      href="https://tecito.app/kwin"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
    >
      <Coffee className="h-4 w-4" />
      Aporte con un tecito
    </a>
  );
}