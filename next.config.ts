import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    serverActions: {
      // 设置为你需要的大小，例如 10MB 或 20MB
      bodySizeLimit: "1000MB",
    },
  },
};

export default nextConfig;
