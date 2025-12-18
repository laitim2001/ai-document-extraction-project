/**
 * @fileoverview 發票上傳頁面
 * @description
 *   提供發票文件上傳功能的頁面。
 *   支援拖放上傳、批量上傳和進度追蹤。
 *
 * @module src/app/(dashboard)/invoices/upload/page
 * @author Development Team
 * @since Epic 2 - Story 2.1 (File Upload Interface & Validation)
 * @lastModified 2025-12-18
 *
 * @related
 *   - src/components/features/invoice/FileUploader.tsx - 上傳組件
 *   - src/app/api/documents/upload/route.ts - 上傳 API
 */

import { Suspense } from 'react'
import { FileUploader } from '@/components/features/invoice'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * 頁面元數據
 */
export const metadata = {
  title: '上傳發票 | AI Document Extraction',
  description: '上傳發票文件以進行 AI 處理和數據提取',
}

/**
 * 發票上傳頁面
 *
 * @component UploadPage
 * @description 發票文件上傳頁面，提供拖放上傳功能
 */
export default function UploadPage() {
  return (
    <div className="container mx-auto py-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>上傳發票文件</CardTitle>
          <CardDescription>
            上傳發票文件以進行 AI 處理和數據提取。支援 PDF、JPG、PNG 格式。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<UploadSkeleton />}>
            <FileUploader />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * 上傳組件載入骨架
 */
function UploadSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-48 w-full rounded-lg" />
      <Skeleton className="h-10 w-full" />
    </div>
  )
}
