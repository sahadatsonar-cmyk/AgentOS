/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@agent-os/shared',
    '@agent-os/agent-core',
    '@agent-os/database',
  ],
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },
};

export default nextConfig;
