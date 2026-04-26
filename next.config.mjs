/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', 'node-pty', 'pino', 'pino-pretty'],
    instrumentationHook: true,
  },
  transpilePackages: ['geist'],
};
export default nextConfig;
