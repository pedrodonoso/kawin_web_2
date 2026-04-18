"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

const MAX_CHARS = 800;

interface Props {
  description: string;
}

export function DescriptionSection({ description }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isLong = description.length > MAX_CHARS;

  const displayed = isLong && !expanded ? description.slice(0, MAX_CHARS) : description;
  const paragraphs = displayed.split("\n\n").filter(Boolean);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Descripción</h2>
      {paragraphs.map((p, i) => (
        <p key={i} className="text-foreground/60 leading-relaxed">
          {p}
          {isLong && !expanded && i === paragraphs.length - 1 && "..."}
        </p>
      ))}
      {isLong && (
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
