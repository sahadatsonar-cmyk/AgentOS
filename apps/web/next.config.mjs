import { PrismaPlugin } from '@prisma/nextjs-monorepo-workaround-plugin';

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@agent-os/shared',
    '@agent-os/agent-core',
    '@agent-os/database',
  ],
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'prisma'],
  },
  serverExternalPackages: ['@prisma/client', 'prisma'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.plugins = [...config.plugins, new PrismaPlugin()];
    }
    return config;
  },
};

export default nextConfig;
