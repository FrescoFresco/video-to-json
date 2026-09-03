import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
