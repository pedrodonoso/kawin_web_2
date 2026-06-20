import { MapPin, Info } from "lucide-react";

interface Props {
  /** Dirección en palabras (campo `location` del taller). */
  location?: string;
  /** Indicaciones adicionales para llegar (campo `address` del taller). */
  address?: string;
}

/**
 * Muestra la dirección en palabras y las indicaciones adicionales del taller.
 * No renderiza nada si ambos campos están vacíos.
 */
export function LocationDetails({ location, address }: Props) {
  if (!location && !address) return null;

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      {location && (
        <div className="flex items-start gap-2.5">
          <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dirección</p>
            <p className="text-sm font-medium">{location}</p>
          </div>
        </div>
      )}
      {address && (
        <div className="flex items-start gap-2.5">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Indicaciones adicionales</p>
            <p className="text-sm text-muted-foreground">{address}</p>
          </div>
        </div>
      )}
    </div>
  );
}
