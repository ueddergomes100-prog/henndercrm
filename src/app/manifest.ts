import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Hennder CRM",
    short_name: "Hennder",
    description: "Inteligencia comercial, recompra e recuperacao de clientes.",
    lang: "pt-BR",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#0753a6",
    theme_color: "#0753a6",
    categories: ["business", "productivity"],
    prefer_related_applications: false,
    icons: [
      {
        src: "/icons/hennder-icon-72.png",
        sizes: "72x72",
        type: "image/png",
      },
      {
        src: "/icons/hennder-icon-96.png",
        sizes: "96x96",
        type: "image/png",
      },
      {
        src: "/icons/hennder-icon-128.png",
        sizes: "128x128",
        type: "image/png",
      },
      {
        src: "/icons/hennder-icon-144.png",
        sizes: "144x144",
        type: "image/png",
      },
      {
        src: "/icons/hennder-icon-152.png",
        sizes: "152x152",
        type: "image/png",
      },
      {
        src: "/icons/hennder-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/hennder-icon-384.png",
        sizes: "384x384",
        type: "image/png",
      },
      {
        src: "/icons/hennder-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/hennder-icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
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
