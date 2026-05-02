export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
      <p className="text-xl font-medium">Página no encontrada</p>
      <a href="/" className="text-primary underline underline-offset-4">
        Volver al inicio
      </a>
    </main>
  );
}
