import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// Pin the workspace root to this file's own directory so Turbopack does not
// walk up and adopt a parent folder as the root (a stray lockfile in a parent
// dir otherwise hijacks root detection). Resolved at runtime, no absolute path
// baked in.
const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  devIndicators: false,
  turbopack: { root: projectRoot },
};

export default nextConfig;
