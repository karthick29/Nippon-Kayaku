import path from 'node:path';
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
  webpack(config) {
    // Ketcher depends on paper.js. paper-full.js requires its Node shim
    // (dist/node/self.js, extend.js → jsdom, canvas); paper's package.json
    // "browser" field maps those to `false`, but Next doesn't honour that
    // field. The shim fails to compile — on the server too: even with
    // next/dynamic `ssr: false`, Next compiles the client component for its
    // SSR pass. Ketcher never runs on the server and paper never runs its
    // Node path in a browser, so apply paper's own mapping to every build.
    const paperNode = path.join(path.dirname(require.resolve('paper/package.json')), 'dist', 'node');
    config.resolve.alias = {
      ...config.resolve.alias,
      [path.join(paperNode, 'self.js')]: false,
      [path.join(paperNode, 'extend.js')]: false,
      jsdom: false,
      canvas: false,
      // paper's optional PaperScript parser (try/catch require); Ketcher doesn't use PaperScript.
      acorn: false,
    };
    return config;
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
