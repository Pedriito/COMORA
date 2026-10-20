import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

// Application installable (PWA) : l'espace de gestion de l'église.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: siteConfig.name,
    description: `${siteConfig.signature} Plannings, chants et communication de votre église.`,
    start_url: "/espace/dashboard",
    display: "standalone",
    orientation: "portrait",
    theme_color: "#16241f",
    background_color: "#efece3",
    lang: "fr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Planification", short_name: "Plans", url: "/espace/admin/plans" },
      { name: "Chants", short_name: "Chants", url: "/espace/chants" },
    ],
  };
}
