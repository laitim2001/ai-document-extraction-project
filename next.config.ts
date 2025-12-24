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

  // Webpack configuration for pdfjs-dist compatibility
  webpack: (config) => {
    // Handle canvas module for pdfjs-dist (server-side)
    config.resolve.alias.canvas = false

    // Ensure pdfjs-dist ESM modules are handled correctly
    config.resolve.alias['pdfjs-dist'] = 'pdfjs-dist/legacy/build/pdf'

    return config
  },
}

export default nextConfig
