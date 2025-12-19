'use client'

/**
 * @fileoverview 用戶列表載入骨架屏
 * @description
 *   顯示用戶列表載入中的骨架屏效果。
 *   包含搜尋欄、篩選器和表格的骨架。
 *
 * @module src/components/features/admin/UserListSkeleton
 * @author Development Team
 * @since Epic 1 - Story 1.3 (User List & Search)
 * @lastModified 2025-12-18
 */

import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

/**
 * 用戶列表骨架屏組件
 *
 * @description
 *   在用戶列表資料載入期間顯示的骨架屏。
 *   模擬實際 UI 結構，提供更好的載入體驗。
 *
 * @example
 *   <Suspense fallback={<UserListSkeleton />}>
 *     <UserList />
 *   </Suspense>
 */
export function UserListSkeleton() {
  return (
    <div className="space-y-4">
      {/* 搜尋欄和篩選器骨架 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* 搜尋欄 */}
        <Skeleton className="h-10 w-full sm:w-72" />
        {/* 篩選器 */}
        <div className="flex gap-2">
          <Skeleton className="h-10 w-[150px]" />
          <Skeleton className="h-10 w-[150px]" />
          <Skeleton className="h-10 w-[120px]" />
        </div>
      </div>

      {/* 表格骨架 */}
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {/* 表頭 */}
            <div className="flex gap-4 p-4 bg-muted/50">
              <Skeleton className="h-4 w-[300px]" />
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-4 w-[80px]" />
              <Skeleton className="h-4 w-[100px]" />
            </div>

            {/* 資料列（模擬 10 筆） */}
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                {/* 用戶資訊（頭像 + 名稱） */}
                <div className="flex items-center gap-3 w-[300px]">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-[120px]" />
                    <Skeleton className="h-3 w-[180px]" />
                  </div>
                </div>
                {/* 角色 */}
                <Skeleton className="h-5 w-[80px]" />
                {/* 城市 */}
                <Skeleton className="h-4 w-[60px]" />
                {/* 狀態 */}
                <Skeleton className="h-5 w-[60px]" />
                {/* 最後登入 */}
                <Skeleton className="h-4 w-[80px]" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 分頁骨架 */}
      <div className="flex justify-center gap-2">
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-9 w-9" />
      </div>
    </div>
  )
}
