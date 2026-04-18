/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Headers HTTP pour le PWA et la sécurité
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options",    value: "nosniff"       },
          { key: "X-Frame-Options",           value: "DENY"          },
          { key: "X-XSS-Protection",          value: "1; mode=block" },
          { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // Cache permanent pour les assets statiques (immutables)
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // Service Worker doit être servi sans cache
        source: "/sw.js",
        headers: [
          { key: "Cache-Control",  value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
