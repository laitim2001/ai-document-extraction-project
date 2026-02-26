'use client'

/**
 * @fileoverview 用戶搜尋欄組件
 * @description
 *   提供用戶名稱或電子郵件的搜尋功能。
 *   使用 debounce 減少 API 請求頻率。
 *
 * @module src/components/features/admin/UserSearchBar
 * @author Development Team
 * @since Epic 1 - Story 1.3 (User List & Search)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/hooks/use-debounce - 防抖處理
 */

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useDebounce } from '@/hooks/use-debounce'

interface UserSearchBarProps {
  /** 當前搜尋值 */
  value: string
  /** 值變更回調（debounced） */
  onChange: (value: string) => void
}

/**
 * 用戶搜尋欄組件
 *
 * @description
 *   提供即時搜尋體驗，但使用 300ms debounce 減少 API 呼叫。
 *   搜尋圖標提供視覺提示。
 *
 * @example
 *   <UserSearchBar
 *     value={search}
 *     onChange={(value) => updateParams({ search: value })}
 *   />
 */
export function UserSearchBar({ value, onChange }: UserSearchBarProps) {
  const t = useTranslations('admin')
  const [inputValue, setInputValue] = useState(value)
  const debouncedValue = useDebounce(inputValue, 300)

  // 當 debounced 值變化時，通知父組件
  useEffect(() => {
    if (debouncedValue !== value) {
      onChange(debouncedValue)
    }
  }, [debouncedValue, onChange, value])

  // 當外部值變化時，同步輸入框
  useEffect(() => {
    setInputValue(value)
  }, [value])

  return (
    <div className="relative w-full sm:w-72">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        placeholder={t('users.search.placeholder')}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        className="pl-9"
        aria-label="Search users by name or email"
      />
    </div>
  )
}
