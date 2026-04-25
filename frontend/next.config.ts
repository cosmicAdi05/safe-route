import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Allow builds to succeed even with TypeScript/ESLint warnings
  typescript:  { ignoreBuildErrors: true },
  eslint:      { ignoreDuringBuilds: true },
  // Production rewrites — proxies API calls through Next.js to avoid CORS in prod
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    const mlUrl      = process.env.NEXT_PUBLIC_ML_URL  || "http://localhost:8000";
    return [
      { source: "/api/:path*",    destination: `${backendUrl}/api/:path*` },
      { source: "/ml/:path*",     destination: `${mlUrl}/:path*` },
    ];
  },
};

export default nextConfig;
