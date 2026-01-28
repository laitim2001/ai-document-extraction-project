/**
 * @fileoverview 文件 Blob 串流 Proxy 端點
 * @description
 *   透過伺服器端串流 Blob 內容，避免瀏覽器直接請求 Azure Blob Storage 時的 CORS 問題。
 *   此端點：
 *   - 驗證使用者身份
 *   - 從 Azure Blob Storage 下載文件
 *   - 串流回應給客戶端，附帶正確的 Content-Type 和 Content-Disposition
 *
 *   端點：
 *   - GET /api/documents/[id]/blob
 *
 * @module src/app/api/documents/[id]/blob/route
 * @author Development Team
 * @since CHANGE-018 - Invoice 詳情頁 API 增強
 * @lastModified 2026-01-28
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/lib/prisma - Prisma Client
 *   - @/lib/azure-blob - Azure Blob 下載
 *
 * @related
 *   - src/app/api/documents/[id]/route.ts - 文件詳情 API
 *   - src/components/features/document-preview/PDFViewer.tsx - PDF 預覽器
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { downloadBlob } from '@/lib/azure-blob'

// ============================================================
// Types
// ============================================================

interface RouteParams {
  params: Promise<{ id: string }>
}

// ============================================================
// Content-Type 映射
// ============================================================

const EXTENSION_CONTENT_TYPE: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
}

// ============================================================
// GET /api/documents/[id]/blob
// ============================================================

/**
 * GET /api/documents/[id]/blob
 * 串流文件 Blob 內容（避免 CORS 問題）
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // 認證檢查
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params

    // 查詢文件取得 blobName 和 fileName
    const document = await prisma.document.findUnique({
      where: { id },
      select: { blobName: true, fileName: true, fileType: true },
    })

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      )
    }

    if (!document.blobName) {
      return NextResponse.json(
        { success: false, error: 'Document has no blob data' },
        { status: 404 }
      )
    }

    // 從 Azure Blob Storage 下載
    const buffer = await downloadBlob(document.blobName)

    // 決定 Content-Type
    const ext = (document.fileName || document.blobName)
      .split('.')
      .pop()
      ?.toLowerCase() || ''
    const contentType =
      document.fileType ||
      EXTENSION_CONTENT_TYPE[ext] ||
      'application/octet-stream'

    // 回傳串流（使用 Uint8Array 以相容 NextResponse BodyInit）
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(buffer.length),
        'Content-Disposition': `inline; filename="${encodeURIComponent(document.fileName || 'document')}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    console.error('[Document Blob] Error streaming blob:', error)

    return NextResponse.json(
      { success: false, error: 'Failed to stream document' },
      { status: 500 }
    )
  }
}
