"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="es">
      <body>
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="text-4xl font-bold">Algo salió mal</h1>
          <button
            onClick={reset}
            className="underline underline-offset-4"
          >
            Intentar de nuevo
          </button>
        </main>
      </body>
    </html>
  );
}
