"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail } from "lucide-react";

export function ContactSection() {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      toast.success("Mensaje enviado. ¡Gracias por escribirnos!");
      setForm({ name: "", email: "", message: "" });
    } catch {
      toast.error("No pudimos enviar tu mensaje. Intenta de nuevo más tarde.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="contacto" className="bg-zinc-50 py-20 px-4">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-10 space-y-2">
          <div className="flex justify-center mb-3">
            <Mail className="h-8 w-8 text-zinc-700" />
          </div>
          <h2 className="text-3xl font-bold">Contacto</h2>
          <p className="text-zinc-500">
            ¿Tienes sugerencias o reclamos? Escríbenos y te responderemos a la brevedad.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              name="name"
              placeholder="Tu nombre"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="tu@correo.com"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="message">Mensaje</Label>
            <textarea
              id="message"
              name="message"
              placeholder="Escribe tu sugerencia o reclamo..."
              value={form.message}
              onChange={handleChange}
              required
              rows={5}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Enviando..." : "Enviar mensaje"}
          </Button>
        </form>
      </div>
    </section>
  );
}
