import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "kwin",
    short_name: "kwin",
    description: "Descubre talleres, cursos y clases cerca de ti.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/brand/kwin-favicon-256.png",
        sizes: "256x256",
        type: "image/png",
      },
      {
        src: "/brand/kwin-favicon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
