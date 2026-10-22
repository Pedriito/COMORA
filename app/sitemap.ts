import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteConfig.url, changeFrequency: "weekly", priority: 1 },
    { url: `${siteConfig.url}/cgv`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteConfig.url}/confidentialite`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
