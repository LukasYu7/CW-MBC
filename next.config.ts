import type { NextConfig } from 'next';

const basePath = process.env.GITHUB_PAGES_BASE_PATH || '';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath,
  assetPrefix: basePath || undefined,
};

export default nextConfig;
