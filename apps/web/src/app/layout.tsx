import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Kawin — Talleres y Cursos en América Latina",
    template: "%s | Kawin",
  },
  description:
    "Descubre y reserva talleres, cursos y clases cerca de ti. Conectamos talleristas apasionados con personas que quieren aprender.",
  keywords: ["talleres", "cursos", "clases", "América Latina", "aprendizaje"],
  openGraph: {
    title: "Kawin — Talleres y Cursos en América Latina",
    description:
      "Descubre y reserva talleres, cursos y clases cerca de ti.",
    type: "website",
    locale: "es_CL",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
