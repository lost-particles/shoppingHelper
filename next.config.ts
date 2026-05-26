import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "assets.wfcdn.com" },
      { protocol: "https", hostname: "**.wfcdn.com" },
    ],
  },
};

export default nextConfig;
