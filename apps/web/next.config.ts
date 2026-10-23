import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ict/core"],
  serverExternalPackages: ["@libsql/client", "node:sqlite"],
};

export default nextConfig;
