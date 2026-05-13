import { cn } from "@/lib/utils";

interface Props {
  html: string;
  className?: string;
}

export function RichTextDisplay({ html, className }: Props) {
  if (!html) return null;
  return (
    <div
      className={cn(
        "prose prose-sm max-w-none text-foreground",
        "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_li]:my-0.5 [&_p]:my-1 [&_strong]:font-semibold [&_u]:underline",
        className
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
