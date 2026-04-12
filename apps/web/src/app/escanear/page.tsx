"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { default as JsQRFn } from "jsqr";
import { Button } from "@/components/ui/button";
import { ScanLine, Camera, CameraOff, CheckCircle, AlertCircle } from "lucide-react";
import Link from "next/link";

type ScanState = "idle" | "scanning" | "detected" | "error" | "no-permission";

export default function EscanearPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);

  const jsQRRef = useRef<typeof JsQRFn | null>(null);
  const [state, setState] = useState<ScanState>("idle");
  const [detectedUrl, setDetectedUrl] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Carga jsqr dinámicamente (evita problemas de CJS/ESM con Next.js)
  useEffect(() => {
    import("jsqr").then((mod) => { jsQRRef.current = mod.default; });
  }, []);

  // Determina si la URL pertenece a este app y extrae la ruta interna
  function parseUrl(raw: string): { internal: boolean; path: string } {
    try {
      const url = new URL(raw);
      const isInternal =
        url.hostname === window.location.hostname ||
        url.hostname === "localhost";
      return { internal: isInternal, path: url.pathname + url.search };
    } catch {
      // No es una URL válida
      return { internal: false, path: raw };
    }
  }

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    if (!jsQRRef.current) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    const code = jsQRRef.current(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });

    if (code?.data) {
      stopCamera();
      setDetectedUrl(code.data);
      setState("detected");

      // Navegar automáticamente si es URL interna
      const { internal, path } = parseUrl(code.data);
      if (internal) {
        setTimeout(() => router.push(path), 800);
      }
      return;
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [router, stopCamera]);

  const startCamera = useCallback(async () => {
    setState("scanning");
    setDetectedUrl("");
    setErrorMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }, // cámara trasera en móvil
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Permission") || msg.includes("NotAllowed")) {
        setState("no-permission");
      } else {
        setErrorMsg(msg);
        setState("error");
      }
    }
  }, [tick]);

  // Limpiar al desmontar
  useEffect(() => () => stopCamera(), [stopCamera]);

  const { internal } = detectedUrl ? parseUrl(detectedUrl) : { internal: false };

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
            <ScanLine className="h-6 w-6 text-green-400" />
            Escanear QR
          </h1>
          <p className="text-zinc-400 text-sm">
            Apunta la cámara al código QR de un taller
          </p>
        </div>

        {/* Visor */}
        <div className="relative rounded-2xl overflow-hidden bg-zinc-900 aspect-square flex items-center justify-center">

          {/* Video stream */}
          <video
            ref={videoRef}
            className={`w-full h-full object-cover ${state === "scanning" ? "block" : "hidden"}`}
            playsInline
            muted
          />

          {/* Canvas oculto para procesar frames */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Overlay de escaneo */}
          {state === "scanning" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {/* Marco de enfoque */}
              <div className="w-56 h-56 relative">
                <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400 rounded-tl-lg" />
                <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400 rounded-tr-lg" />
                <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400 rounded-bl-lg" />
                <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400 rounded-br-lg" />
                {/* Línea animada */}
                <span className="absolute left-2 right-2 h-0.5 bg-green-400 opacity-80 animate-scan" />
              </div>
            </div>
          )}

          {/* Estado idle */}
          {state === "idle" && (
            <div className="text-center text-zinc-600 space-y-3 p-8">
              <Camera className="h-16 w-16 mx-auto opacity-40" />
              <p className="text-sm">Presiona el botón para activar la cámara</p>
            </div>
          )}

          {/* Detectado */}
          {state === "detected" && (
            <div className="absolute inset-0 bg-zinc-900/90 flex flex-col items-center justify-center gap-4 p-6 text-center">
              <CheckCircle className="h-12 w-12 text-green-400" />
              <p className="text-white font-semibold">¡QR detectado!</p>
              <p className="text-zinc-400 text-xs break-all">{detectedUrl}</p>
              {internal && (
                <p className="text-green-400 text-sm animate-pulse">Abriendo taller...</p>
              )}
            </div>
          )}

          {/* Sin permiso */}
          {state === "no-permission" && (
            <div className="text-center text-zinc-400 space-y-3 p-8">
              <CameraOff className="h-14 w-14 mx-auto text-red-400 opacity-70" />
              <p className="text-sm text-red-300">Sin acceso a la cámara</p>
              <p className="text-xs text-zinc-500">
                Permite el acceso a la cámara en la configuración del navegador y vuelve a intentarlo.
              </p>
            </div>
          )}

          {/* Error */}
          {state === "error" && (
            <div className="text-center text-zinc-400 space-y-2 p-8">
              <AlertCircle className="h-12 w-12 mx-auto text-amber-400 opacity-70" />
              <p className="text-sm text-amber-300">Error al abrir la cámara</p>
              <p className="text-xs text-zinc-500">{errorMsg}</p>
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="space-y-3">
          {state !== "scanning" && (
            <Button
              className="w-full bg-green-500 hover:bg-green-400 text-zinc-950 font-semibold"
              size="lg"
              onClick={startCamera}
            >
              <Camera className="h-5 w-5 mr-2" />
              {state === "detected" || state === "error" || state === "no-permission"
                ? "Escanear otro"
                : "Activar cámara"}
            </Button>
          )}

          {state === "scanning" && (
            <Button
              className="w-full"
              size="lg"
              variant="outline"
              onClick={() => { stopCamera(); setState("idle"); }}
            >
              Cancelar
            </Button>
          )}

          {/* Si detectó URL externa ofrecer abrir */}
          {state === "detected" && !internal && (
            <Button asChild className="w-full" variant="outline" size="lg">
              <a href={detectedUrl} target="_blank" rel="noopener noreferrer">
                Abrir enlace externo
              </a>
            </Button>
          )}

          <Button asChild variant="ghost" className="w-full text-zinc-500">
            <Link href="/">Volver al inicio</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
