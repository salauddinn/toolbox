import path from "node:path";
import type { NextConfig } from "next";

/**
 * Long-lived single-process host (ADR-0015).
 * Active runs and snapshots stay in memory; do not deploy as stateless serverless.
 */
const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
