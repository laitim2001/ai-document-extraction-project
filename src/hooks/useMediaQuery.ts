/**
 * @fileoverview Media Query Hook
 * @description
 *   監聽瀏覽器 media query 變化，用於實現響應式佈局邏輯。
 *   在 SSR 環境下預設返回 false，客戶端 hydration 後更新。
 *
 * @module src/hooks/useMediaQuery
 * @since Epic 3 - Story 3.2 (並排 PDF 審核介面)
 * @lastModified 2025-12-18
 */

import { useEffect, useState } from 'react'

/**
 * Media Query Hook
 *
 * @param query - CSS media query 字串
 * @returns 是否符合 media query 條件
 *
 * @example
 * ```tsx
 * function ResponsiveLayout({ children }) {
 *   const isMobile = useMediaQuery('(max-width: 768px)')
 *   const isTablet = useMediaQuery('(max-width: 1024px)')
 *
 *   if (isMobile) {
 *     return <MobileLayout>{children}</MobileLayout>
 *   }
 *
 *   return <DesktopLayout>{children}</DesktopLayout>
 * }
 * ```
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    // SSR 安全檢查
    if (typeof window === 'undefined') return

    const media = window.matchMedia(query)

    // 設定初始值
    setMatches(media.matches)

    // 監聽變化
    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [query])

  return matches
}
