"use client";

import { Globe } from "lucide-react";

interface Props {
  workshopId: string;
  workshopOnlineUrl?: string;
}

export function OnlineUrlDisplay({ workshopOnlineUrl }: Props) {
  if (!workshopOnlineUrl) return null;

  return (
    <div className="flex items-center gap-2">
      <a
        href={workshopOnlineUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md
          bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
      >
        <Globe className="h-3.5 w-3.5" />
        Unirse a la clase online
      </a>
    </div>
  );
}
