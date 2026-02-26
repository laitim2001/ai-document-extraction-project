/**
 * @fileoverview 應用程式根佈局組件
 * @description
 *   Next.js App Router 的根佈局文件。
 *   由於使用 i18n 路由，實際的佈局邏輯在 [locale]/layout.tsx 中處理。
 *   此檔案只作為 passthrough，不包含 html/body 標籤。
 *
 * @module src/app/layout
 * @author Development Team
 * @since Epic 17 - Story 17.1 (i18n Infrastructure Setup)
 * @lastModified 2026-01-16
 *
 * @related
 *   - src/app/[locale]/layout.tsx - 語言感知佈局
 */

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}
