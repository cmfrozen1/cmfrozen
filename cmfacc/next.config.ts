import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  distDir: "../public/cmfacc",
  basePath: "/cmfacc",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
