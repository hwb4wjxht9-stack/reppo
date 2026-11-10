import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app lives in a subfolder of a bigger repo; tell Next.js where its root is.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
