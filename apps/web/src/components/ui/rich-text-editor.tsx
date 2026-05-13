"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { useEffect, useRef } from "react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { Bold, Underline as UnderlineIcon, List, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({ value, onChange, placeholder, className }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
      }),
      Underline,
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: "min-h-[120px] px-3 py-2 text-sm outline-none prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5",
      },
    },
    onUpdate({ editor }) {
      const html = editor.isEmpty ? "" : editor.getHTML();
      onChange(html);
    },
  });

  const initialized = useRef(false);

  // Carga el contenido inicial cuando llegan los datos async (solo una vez)
  useEffect(() => {
    if (!editor || initialized.current) return;
    if (value) {
      editor.commands.setContent(value, { emitUpdate: false });
      initialized.current = true;
    }
  }, [value, editor]);

  if (!editor) return null;

  const btn = (active: boolean) =>
    cn(
      "p-1.5 rounded hover:bg-accent transition-colors",
      active && "bg-accent text-accent-foreground"
    );

  return (
    <div className={cn("border rounded-md overflow-hidden", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1 border-b bg-muted/40">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={btn(editor.isActive("bold"))}
          title="Negrita"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={btn(editor.isActive("underline"))}
          title="Subrayado"
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </button>
        <div className="w-px h-4 bg-border mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={btn(editor.isActive("bulletList"))}
          title="Lista"
        >
          <List className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={btn(editor.isActive("orderedList"))}
          title="Lista numerada"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Editor area */}
      <div className="relative">
        {editor.isEmpty && placeholder && (
          <p className="absolute top-2 left-3 text-sm text-muted-foreground pointer-events-none select-none">
            {placeholder}
          </p>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
