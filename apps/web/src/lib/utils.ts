import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
