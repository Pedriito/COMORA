import type { NextConfig } from "next";

// Pages privées : jamais indexées, jamais mises en cache, adresse jamais transmise.
const privateHeaders = [
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Cache-Control", value: "private, no-store" },
];

const nextConfig: NextConfig = {
  // Le design system est consommé depuis ses sources TypeScript (workspace npm).
  transpilePackages: ["@comora/ui"],
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb", // photos et PDF jusqu'à ~5 Mo
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "api.qrserver.com" },
      { protocol: "https", hostname: "**.unsplash.com" },
    ],
  },
  async headers() {
    return [
      { source: "/admin", headers: privateHeaders },
      { source: "/inscription/:token", headers: privateHeaders },
      { source: "/espace/:path*", headers: privateHeaders },
      { source: "/partage/:token", headers: privateHeaders },
    ];
  },
};

export default nextConfig;
