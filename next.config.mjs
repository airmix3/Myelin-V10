/** @type {import('next').NextConfig} */
const nextConfig = {
  // instrumentation.ts is stable in 14.2+ -- no experimental flag needed
  // Server external packages for better-sqlite3 native module
  serverExternalPackages: ['better-sqlite3'],
};
export default nextConfig;
