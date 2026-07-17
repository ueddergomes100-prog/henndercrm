import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hennder CRM",
    short_name: "Hennder CRM",
    description: "Inteligencia comercial, recompra e recuperacao de clientes.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0753a6",
    theme_color: "#0753a6",
    icons: [
      {
        src: "/icons/hennder-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/hennder-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/hennder-icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
