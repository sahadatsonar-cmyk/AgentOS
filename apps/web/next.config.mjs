/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@agent-os/shared',
    '@agent-os/agent-core',
    '@agent-os/database',
  ],
  // Keep Prisma out of the webpack/turbopack bundle so Query Engine binaries are available at runtime
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'prisma'],
  },
  serverExternalPackages: ['@prisma/client', 'prisma'],
};

export default nextConfig;
