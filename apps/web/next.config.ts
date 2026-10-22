import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ict/core"],
  serverExternalPackages: ["node:sqlite"],
};

export default nextConfig;
