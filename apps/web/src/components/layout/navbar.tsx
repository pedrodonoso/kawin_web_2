"use client";

import Link from "next/link";
import { UserRole } from "@/lib/constants";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, LayoutDashboard, User, ScanLine, ShieldCheck, Search } from "lucide-react";
import { NotificationBell } from "@/components/layout/NotificationBell";

interface AuthUser {
  email: string;
  role: string;
}

export function Navbar() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (raw) setUser(JSON.parse(raw));
  }, []);

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    document.cookie = "token=; path=/; max-age=0";
    setUser(null);
    window.location.href = "/";
  }

  return (
    <header className="border-b sticky top-0 bg-background z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <Image
            src="/brand/kwin-wordmark-600.png"
            alt="kwin"
            width={90}
            height={30}
            priority
          />
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link href="/buscar" className="text-foreground/60 hover:text-foreground transition-colors">
            Explorar
          </Link>
          {(user?.role === UserRole.INSTRUCTOR || user?.role === UserRole.BOTH) && (
            <Link href="/dashboard" className="text-foreground/60 hover:text-foreground transition-colors">
              Mi panel
            </Link>
          )}
          {user?.role === UserRole.ADMIN && (
            <Link href="/admin" className="text-foreground/60 hover:text-foreground transition-colors flex items-center gap-1">
              <ShieldCheck className="h-4 w-4" />
              Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {user && <NotificationBell />}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs">
                      {user.email[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden md:inline text-sm">{user.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href="/buscar" className="flex items-center gap-2">
                    <Search className="h-4 w-4" /> Explorar
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/perfil" className="flex items-center gap-2">
                    <User className="h-4 w-4" /> Mi perfil
                  </Link>
                </DropdownMenuItem>
                {(user.role === UserRole.INSTRUCTOR || user.role === UserRole.BOTH) && (
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="flex items-center gap-2">
                      <LayoutDashboard className="h-4 w-4" /> Panel tallerista
                    </Link>
                  </DropdownMenuItem>
                )}
                {user.role === UserRole.ADMIN && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin" className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" /> Panel admin
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/escanear" className="flex items-center gap-2">
                    <ScanLine className="h-4 w-4" /> Escanear QR
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-red-600 flex items-center gap-2">
                  <LogOut className="h-4 w-4" /> Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild className="px-2">
                <Link href="/escanear" aria-label="Escanear QR">
                  <ScanLine className="h-5 w-5" />
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Iniciar sesión</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/registro">Soy tallerista</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
