/** @type {import('next').NextConfig} */
const nextConfig = {
  // instrumentation.ts is stable in 14.2+ -- no experimental flag needed
  // Server external packages for better-sqlite3 native module (Next.js 14 key)
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
    instrumentationHook: true,
  },
};
export default nextConfig;
