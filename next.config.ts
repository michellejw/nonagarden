import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/library", destination: "/archive", permanent: true },
      { source: "/library/:slug", destination: "/archive", permanent: true },
    ];
  },
};

export default nextConfig;
