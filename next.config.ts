import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '192.168.100.96',
    '192.168.100.96:3000',
    '192.168.100.*',
    '192.168.*',
    '10.*',
    '172.16.*',
    'localhost',
    '127.0.0.1',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        protocol: 'https',
        hostname: 'gexfcndaymqdnuobjxnb.supabase.co',
      },
    ],
  },
};

export default nextConfig;
