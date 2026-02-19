import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone build for clearer deployment
  output: "standalone",

  // Proxy /api/ requests to the Indexer (Port 3001) during local development
  // This mimics Nginx's behavior in production
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:3001/:path*", // Proxy to Indexer
      },
    ];
  },
};

export default nextConfig;
