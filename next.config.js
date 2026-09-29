import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['sql.js', 'playwright-core'],
  // debt: 家目录存在 package-lock.json 时 Turbopack 会误判 workspace 根，导致内部字体模块解析失败；上游修复后可移除
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
  images: {
    // 本地 E2E 时代理工具 fake-IP DNS 会把图床解析成私有 IP，优化器拒绝上游请求；E2E 只验证加载行为
    unoptimized: process.env.PLAYWRIGHT_IMAGES_UNOPTIMIZED === '1',
    remotePatterns: [
      { protocol: 'https', hostname: 'images.refero.design' },
      { protocol: 'https', hostname: '**.public.blob.vercel-storage.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
  },
};

export default nextConfig;