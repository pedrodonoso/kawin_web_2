import type { NextConfig } from "next";

const apiInternalUrl = process.env.API_INTERNAL_URL ?? "http://api:8080";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["jsqr"],
  images: {
    remotePatterns: [
      { hostname: "localhost" },
      { hostname: "kawin.app" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiInternalUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
