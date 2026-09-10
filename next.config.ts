import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "300mb" },
    // The auth middleware buffers request bodies, and the default 10MB cap
    // truncated bid-package zips mid-upload ("Unexpected end of form" on
    // /bids). Must cover MAX_UPLOAD_BYTES (300MB, documents/upload.ts).
    proxyClientMaxBodySize: "300mb",
  },
  // PGlite ships WASM assets that break when bundled — load it from node_modules at runtime.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
