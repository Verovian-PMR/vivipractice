import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@vivipractice/ui", "@vivipractice/types"],
  experimental: {
    optimizePackageImports: ["@vivipractice/ui"],
  },
};

export default nextConfig;
