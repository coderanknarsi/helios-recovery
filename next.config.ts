import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Allow uploading PDF documents (well above the 1MB default).
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
