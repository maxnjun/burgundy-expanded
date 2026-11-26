import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  async headers(){
    return [{
      source:"/_art/:asset([a-f0-9]{64}\\.(?:webp|png|svg|wav))",
      headers:[{key:"Cache-Control",value:"public, max-age=31536000, immutable"}],
    }];
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
