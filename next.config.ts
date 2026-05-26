import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "secure.img1-fg.wfcdn.com" },
      { protocol: "https", hostname: "secure.img2-fg.wfcdn.com" },
      { protocol: "https", hostname: "assets.wfcdn.com" },
      { protocol: "https", hostname: "**.wfcdn.com" },
    ],
  },
};

export default nextConfig;
