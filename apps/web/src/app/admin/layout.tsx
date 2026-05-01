"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BarChart3, BookOpen, ShieldCheck } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) { router.replace("/login"); return; }
    const user = JSON.parse(raw);
    if (user.role !== "admin") { router.replace("/"); return; }
    setChecking(false);
  }, [router]);

  if (checking) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-6 text-sm">
          <span className="flex items-center gap-1.5 font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Panel Admin
          </span>
          <Link href="/admin" className="text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
            <BarChart3 className="h-3.5 w-3.5" />
            Estadísticas
          </Link>
          <Link href="/admin/talleres" className="text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
            <BookOpen className="h-3.5 w-3.5" />
            Talleres
          </Link>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 py-8">{children}</div>
    </div>
  );
}
