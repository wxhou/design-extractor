/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['sql.js', 'playwright-core'],
};

export default nextConfig;