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
  // FIX-010: react-pdf v10 + pdfjs-dist v5 兼容性配置
  //
  // 問題: pdfjs-dist v5.4.x 的 ESM 模組與 webpack eval-based source maps 不兼容
  // 錯誤: "Object.defineProperty called on non-object"
  // 解決: 使用 npm overrides 將 pdfjs-dist 降級到 5.3.93 (見 package.json)
  //
  // 參考:
  // - https://github.com/mozilla/pdf.js/issues/20478
  // - https://github.com/wojtekmaj/react-pdf/issues/1813
  // - claudedocs/4-changes/bug-fixes/FIX-010-pdfjs-dist-esm-module-error.md
  webpack: (config, { isServer, dev }) => {
    // Client-side: disable canvas (not available in browser)
    if (!isServer) {
      config.resolve.alias.canvas = false

      // Note: 嘗試設定 devtool = 'source-map' 但 Next.js 會自動覆蓋回 'false'
      // 最終解決方案是透過 npm overrides 降級 pdfjs-dist
      if (dev) {
        config.devtool = 'source-map'
      }
    }

    // Mark native modules and PDF libraries as external for server to avoid bundling issues
    // This prevents webpack from bundling these modules, which fixes ESM compatibility issues
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

export default nextConfig
