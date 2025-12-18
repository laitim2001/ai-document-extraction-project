/**
 * @fileoverview 應用程式首頁
 * @description
 *   AI Document Extraction 系統的首頁，顯示項目初始化狀態和導航入口。
 *   當前為開發階段的佔位頁面，後續將替換為完整的登入頁面或儀表板。
 *
 * @module src/app/page
 * @author Development Team
 * @since Epic 1 - Story 1.0 (Project Init Foundation)
 * @lastModified 2025-12-17
 *
 * @features
 *   - 項目狀態展示
 *   - 導航入口點
 *
 * @related
 *   - src/app/layout.tsx - 根佈局
 *   - src/components/ui/ - UI 組件庫
 */

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * @component Home
 * @description 應用程式首頁組件
 */
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">AI Document Extraction</CardTitle>
          <CardDescription>
            Intelligent document processing powered by AI
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-sm text-gray-500">
            Project initialized successfully. Ready for development.
          </p>
          <div className="flex justify-center gap-4">
            <Button variant="outline">Documentation</Button>
            <Button>Get Started</Button>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
