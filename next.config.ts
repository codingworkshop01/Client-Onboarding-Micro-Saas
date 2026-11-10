import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server output for the Docker image (see Dockerfile).
  output: "standalone",
  poweredByHeader: false,
};

export default nextConfig;
