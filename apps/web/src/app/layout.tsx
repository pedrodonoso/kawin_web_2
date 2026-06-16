import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://kwin-latam.cl"),
  title: {
    default: "kwin - Conocimiento en tu barrio",
    template: "%s | kwin",
  },
  description:
    "Descubre y reserva talleres, cursos y clases cerca de ti. Conectamos talleristas apasionados con personas que quieren aprender.",
  keywords: ["talleres", "cursos", "clases", "América Latina", "aprendizaje", "barrio", "comunidad", "conocimiento", "reservas", "experiencias", "presenciales", "online"],
  icons: {
    icon: [
      { url: "/brand/kwin-favicon-32.png",  sizes: "32x32",  type: "image/png" },
      { url: "/brand/kwin-favicon-256.png", sizes: "256x256", type: "image/png" },
      { url: "/brand/kwin-favicon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/brand/kwin-favicon-light-256.png", sizes: "256x256", type: "image/png" },
      { url: "/brand/kwin-favicon-light-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/brand/kwin-favicon-32.png",
  },
  openGraph: {
    title: "kwin - Conocimiento en tu barrio",
    description: "Descubre y reserva talleres, cursos y clases cerca de ti.",
    type: "website",
    locale: "es_CL",
    images: [{ url: "/brand/kwin-favicon-512.png", width: 512, height: 512 }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Navbar />
        {children}
        <Toaster richColors />
      </body>
    </html>
  );
}
