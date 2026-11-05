import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Self-contained server bundle in .next/standalone — used by `npm run build:external`.
  output: 'standalone',
  // RDKit.js loads its .wasm from its own package directory at runtime — keep it
  // out of the server bundle, and make sure the standalone trace copies the binary.
  serverExternalPackages: ['@rdkit/rdkit'],
  outputFileTracingIncludes: {
    '/**': ['./node_modules/@rdkit/rdkit/dist/RDKit_minimal.wasm'],
  },
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'date-fns', '@tanstack/react-table'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
