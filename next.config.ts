import type { NextConfig } from "next";

// Pages privées : jamais indexées, jamais mises en cache, adresse jamais transmise.
const privateHeaders = [
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Cache-Control", value: "private, no-store" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/admin", headers: privateHeaders },
      { source: "/inscription/:token", headers: privateHeaders },
    ];
  },
};

export default nextConfig;
