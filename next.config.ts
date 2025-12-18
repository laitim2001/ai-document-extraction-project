import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Configure image domains if needed
  images: {
    remotePatterns: [],
  },

  // Experimental features
  experimental: {
    // Enable server actions
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

export default nextConfig
