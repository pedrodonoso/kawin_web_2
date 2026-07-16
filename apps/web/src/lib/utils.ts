import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extrae texto plano de un string HTML (p. ej. el que genera el editor de
 * texto enriquecido) para mostrar previews limpios en cards y popups.
 * Elimina etiquetas, decodifica entidades básicas y colapsa espacios.
 */
export function htmlToPlainText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<\/(p|div|li|h[1-6]|br)>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Formatea un monto en pesos chilenos: sin decimales y con punto como
 * separador de miles (p. ej. 65000 -> "65.000"). Acepta number o string.
 * El agrupado se hace manualmente para no depender de los datos de locale
 * del entorno (algunos runtimes no agrupan con "es-CL").
 */
export function formatPrice(n: number | string): string {
  const value = Math.round(Number(n) || 0);
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Convierte un Date local (el que emite el date-picker) a un string ISO
 * "naive": conserva la hora de pared elegida y le agrega el sufijo Z, SIN
 * conversión de zona horaria. Ej: el usuario elige 12:00 → "2026-07-20T12:00:00Z".
 *
 * Es la convención que usa el backend al materializar sesiones de clases y la
 * que asumen todas las vistas al mostrar sesiones con timeZone "UTC". Evita el
 * corrimiento de horas que producía `Date.toISOString()` (que sí convierte a UTC
 * real, p. ej. 12:00 en Chile → 16:00Z).
 */
export function localDateToNaiveISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00Z`;
}

/**
 * Inversa de {@link localDateToNaiveISO}: toma un timestamp almacenado (hora de
 * pared, normalmente con sufijo Z o `+00`) y devuelve un Date local con la misma
 * hora de pared, para que el date-picker muestre la hora correcta.
 */
export function naiveISOToLocalDate(iso: string): Date {
  const m = iso.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return new Date(iso);
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
}
