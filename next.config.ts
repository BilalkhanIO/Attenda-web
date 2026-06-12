import type { NextConfig } from "next";
import path from "path";

const BACKEND = process.env.BACKEND_API_URL || 'http://localhost:5000/api/v1';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${BACKEND}/:path*`,
      },
    ];
  },
};

export default nextConfig;
