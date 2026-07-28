// next.config.js
const nextConfig = {
  distDir: '.next',
  output: 'standalone',
}

module.exports = nextConfig

// scripts
// "build:external": "npm run build && rm -rf ../output && cp -R .next ../output"