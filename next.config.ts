import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "*.cursor.sh",
    "*.cursor.com",
  ],
  experimental: {
    proxyClientMaxBodySize: "80mb",
  },
};

export default nextConfig;
