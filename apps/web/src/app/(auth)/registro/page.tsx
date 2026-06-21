"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, type AuthResponse } from "@/lib/api";
import { GraduationCap, Hammer } from "lucide-react";
import { UserRole } from "@/lib/constants";

type Role = "student" | "instructor";

const roles: { id: Role; label: string; description: string; icon: React.ReactNode }[] = [
  {
    id: "student",
    label: "Estudiante",
    description: "Quiero aprender y reservar talleres",
    icon: <GraduationCap className="h-6 w-6" />,
  },
  {
    id: "instructor",
    label: "Tallerista",
    description: "Quiero publicar y vender mis talleres",
    icon: <Hammer className="h-6 w-6" />,
  },
];

export default function RegistroPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<Role>("instructor");
  const [form, setForm] = useState({ email: "", password: "", name: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await api.post<AuthResponse>("/api/v1/auth/register", {
        ...form,
        role,
      });
      // Token is set as HttpOnly cookie by the server — do NOT store in localStorage or JS cookies.
      localStorage.setItem("user", JSON.stringify(data.user));
      toast.success("¡Cuenta creada exitosamente!");
      if (role === UserRole.INSTRUCTOR) {
        window.location.href = "/dashboard";
      } else {
        window.location.href = "/buscar";
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al registrarse");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-65px)] flex items-center justify-center px-4 bg-background py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Crear cuenta</CardTitle>
          <CardDescription>Regístrate como tallerista en Kwin</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-5">
            {/* Role selector — oculto hasta habilitar registro de estudiantes
            <div className="grid grid-cols-2 gap-3">
              {roles.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRole(r.id)}
                  className={`flex flex-col items-start gap-2 p-4 border-2 rounded-xl text-left transition-all ${
                    role === r.id
                      ? "border-primary bg-secondary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className={role === r.id ? "text-primary" : "text-muted-foreground"}>
                    {r.icon}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{r.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>
                  </div>
                  {role === r.id && (
                    <Badge variant="secondary" className="text-xs mt-1">
                      Seleccionado
                    </Badge>
                  )}
                </button>
              ))}
            </div>
            */}

            <div className="space-y-2">
              <Label htmlFor="name">Nombre completo</Label>
              <Input
                id="name"
                placeholder="Tu nombre"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 8 caracteres"
                minLength={8}
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Debe incluir mayúscula, minúscula, número y símbolo (@$!%*?&#._-)
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creando cuenta..." : "Crear cuenta"}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              ¿Ya tienes cuenta?{" "}
              <Link href="/login" className="text-foreground font-medium hover:underline">
                Inicia sesión
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
