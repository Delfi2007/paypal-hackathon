import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a second production build live next to a running dev server (used for recording the demo).
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
