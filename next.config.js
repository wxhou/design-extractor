/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['sql.js'],
  // 配置路径别名指向 src 目录
};

export default nextConfig;