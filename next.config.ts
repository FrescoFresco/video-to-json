import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Keep the Next.js badge off the bottom nav on phones during `next dev`
  devIndicators: {
    position: "top-right",
  },
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "*.cursor.sh",
    "*.cursor.com",
  ],
  experimental: {
    optimizePackageImports: ["lucide-react"],
    proxyClientMaxBodySize: "80mb",
  },
};

export default nextConfig;
