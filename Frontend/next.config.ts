import type { NextConfig } from "next";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") ??
  "http://localhost:5000";

const nextConfig: NextConfig = {
  reactCompiler: true,

  // Optional: proxy /api/* requests through Next.js to the backend
  // (useful when frontend and backend are on the same host)
  async rewrites() {
    return [
      {
        source: "/proxy/:path*",
        destination: `${BACKEND_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
