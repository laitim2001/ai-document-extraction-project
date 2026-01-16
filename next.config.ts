import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

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

  // Webpack configuration
  // FIX-026: 降級到 react-pdf v9 + pdfjs-dist v4 以避免 ESM 問題
  // pdfjs-dist v5.4.x 的 ESM 模組與 webpack eval-based source maps 不兼容
  //
  // 參考:
  // - https://github.com/mozilla/pdf.js/issues/20478
  // - https://github.com/wojtekmaj/react-pdf/issues/1813
  webpack: (config, { isServer }) => {
    // Client-side: disable canvas (not available in browser)
    if (!isServer) {
      config.resolve.alias.canvas = false
    }

    // Mark native modules and PDF libraries as external for server to avoid bundling issues
    if (isServer) {
      config.externals = config.externals || []
      config.externals.push({
        canvas: 'commonjs canvas',
        'pdf-to-img': 'commonjs pdf-to-img',
        'pdfjs-dist': 'commonjs pdfjs-dist',
      })
    }

    return config
  },
}

export default withNextIntl(nextConfig)
