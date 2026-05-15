/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // 确保静态资源在 standalone 构建中被复制
  experimental: {
    // Force copy static files
  },
};

export default nextConfig;
