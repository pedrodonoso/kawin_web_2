"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { RichTextDisplay } from "@/components/ui/rich-text-display";

const COLLAPSED_MAX_HEIGHT = 320; // px

interface Props {
  description: string;
}

export function DescriptionSection({ description }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Detecta si el contenido supera la altura colapsada para mostrar "Ver más"
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    setIsOverflowing(el.scrollHeight > COLLAPSED_MAX_HEIGHT + 8);
  }, [description]);

  if (!description) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Descripción</h2>
      <div className="relative">
        <div
          ref={contentRef}
          className="overflow-hidden transition-[max-height] duration-300"
          style={{
            maxHeight: isOverflowing && !expanded ? COLLAPSED_MAX_HEIGHT : undefined,
          }}
        >
          <RichTextDisplay html={description} className="text-foreground/60 leading-relaxed" />
        </div>
        {isOverflowing && !expanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" />
        )}
      </div>
      {isOverflowing && (
        <Button
          variant="ghost"
          size="sm"
          className="px-0 text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Ver menos" : "Ver más"}
        </Button>
      )}
    </div>
  );
}
