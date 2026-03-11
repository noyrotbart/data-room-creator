/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow large file serving
  experimental: { instrumentationHook: true },
};

module.exports = nextConfig;
