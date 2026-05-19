import { Tag } from "lucide-react";

export function FreeBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-positive/10 text-positive border border-positive/20 text-sm font-semibold">
      <Tag className="h-3.5 w-3.5" />
      Gratuito - Aporte consciente
    </span>
  );
}
