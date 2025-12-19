'use client'

/**
 * @fileoverview 分頁元件
 * @description
 *   提供分頁導航功能，支援動態頁碼生成。
 *
 * @module src/components/ui/pagination
 * @author Development Team
 * @since Epic 1 - Story 1.3 (User List & Search)
 * @lastModified 2025-12-18
 */

import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PaginationProps {
  /** 當前頁碼 */
  currentPage: number
  /** 總頁數 */
  totalPages: number
  /** 頁碼變更回調 */
  onPageChange: (page: number) => void
}

/**
 * 生成頁碼數組
 * @param current - 當前頁碼
 * @param total - 總頁數
 * @returns 頁碼數組（包含 'ellipsis' 表示省略）
 */
function generatePageNumbers(
  current: number,
  total: number
): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  if (current <= 3) {
    return [1, 2, 3, 4, 5, 'ellipsis', total]
  }

  if (current >= total - 2) {
    return [1, 'ellipsis', total - 4, total - 3, total - 2, total - 1, total]
  }

  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total]
}

/**
 * 分頁元件
 *
 * @description
 *   顯示分頁導航，包含上一頁、下一頁按鈕和頁碼。
 *   當頁數超過 7 頁時，自動顯示省略號。
 *
 * @example
 *   <Pagination
 *     currentPage={1}
 *     totalPages={10}
 *     onPageChange={(page) => setPage(page)}
 *   />
 */
export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  const pages = generatePageNumbers(currentPage, totalPages)

  return (
    <nav className="flex items-center gap-1" aria-label="Pagination">
      {/* 上一頁按鈕 */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="Go to previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* 頁碼按鈕 */}
      {pages.map((page, index) => {
        if (page === 'ellipsis') {
          return (
            <Button
              key={`ellipsis-${index}`}
              variant="ghost"
              size="icon"
              disabled
              aria-hidden="true"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          )
        }

        return (
          <Button
            key={page}
            variant={page === currentPage ? 'default' : 'outline'}
            size="icon"
            onClick={() => onPageChange(page)}
            aria-label={`Go to page ${page}`}
            aria-current={page === currentPage ? 'page' : undefined}
          >
            {page}
          </Button>
        )
      })}

      {/* 下一頁按鈕 */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        aria-label="Go to next page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  )
}
