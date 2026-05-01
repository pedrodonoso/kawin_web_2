"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Share2, MoreVertical, Plus } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallAppSection() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const ios =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !(window.navigator as { standalone?: boolean }).standalone;
    setIsIOS(ios);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setIsInstalled(true);
    }
  }

  if (isInstalled) return null;
  if (!deferredPrompt && !isIOS) return null;

  return (
    <section className="py-16 px-4 bg-primary/5 border-y">
      <div className="max-w-3xl mx-auto text-center space-y-6">
        <div className="flex justify-center">
          <Image
            src="/brand/kwin-favicon-256.png"
            alt="kwin"
            width={72}
            height={72}
            className="rounded-2xl shadow-md"
          />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Lleva kwin en tu bolsillo</h2>
          <p className="text-muted-foreground">
            Agrega el acceso directo a tu pantalla de inicio y reserva talleres
            en segundos.
          </p>
        </div>

        {deferredPrompt && (
          <Button size="lg" onClick={handleInstall}>
            Agregar a inicio
          </Button>
        )}

        {isIOS && !deferredPrompt && (
          <div className="inline-flex flex-col items-start gap-3 text-sm text-left bg-background border rounded-xl px-6 py-4 mx-auto">
            <p className="font-medium text-center w-full mb-1">
              Instalar en iPhone / iPad
            </p>
            <div className="flex items-center gap-3">
              <Share2 className="h-5 w-5 shrink-0 text-blue-500" />
              <span>
                Toca <strong>Compartir</strong> en Safari
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Plus className="h-5 w-5 shrink-0 text-blue-500" />
              <span>
                Selecciona <strong>Agregar a inicio</strong>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <MoreVertical className="h-5 w-5 shrink-0 text-blue-500" />
              <span>Confirma tocando Agregar</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
