import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  // pdfkit resolves its .afm font metrics relative to its own __dirname at
  // runtime. If webpack bundles it into .next/server/chunks, that path no
  // longer points at node_modules/pdfkit/js/data. Keep it external so it's
  // require()'d straight from node_modules instead.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
