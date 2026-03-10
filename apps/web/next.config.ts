import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { hostname: "localhost" },
      { hostname: "kawin.app" },
    ],
  },
};

export default nextConfig;
