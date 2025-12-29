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
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Server-side: allow canvas module for PDF rendering
      // Don't alias canvas to false on server
    } else {
      // Client-side: disable canvas (not available in browser)
      config.resolve.alias.canvas = false
    }

    // Ensure pdfjs-dist ESM modules are handled correctly
    config.resolve.alias['pdfjs-dist'] = 'pdfjs-dist/legacy/build/pdf'

    // Mark pdfjs-dist as external for server to avoid bundling issues
    if (isServer) {
      config.externals = config.externals || []
      config.externals.push({
        'pdfjs-dist/legacy/build/pdf.mjs': 'pdfjs-dist/legacy/build/pdf.mjs',
        canvas: 'commonjs canvas',
      })
    }

    return config
  },
}

export default nextConfig
