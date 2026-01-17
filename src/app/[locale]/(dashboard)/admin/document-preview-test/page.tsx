/**
 * @fileoverview 文件預覽整合測試頁面入口
 * @description
 *   提供 Epic 13 各 Story 組件的整合測試環境，包含：
 *   - PDF 預覽與欄位高亮 (Story 13-1)
 *   - 提取欄位面板 (Story 13-2)
 *   - 映射配置面板 (Story 13-3)
 *
 * @module src/app/(dashboard)/admin/document-preview-test
 * @since Epic 13 - Story 13.6 (文件預覽整合測試頁面)
 * @lastModified 2026-01-03
 *
 * @access ADMIN only
 * @route /admin/document-preview-test
 */

import { getTranslations } from 'next-intl/server';
import { DocumentPreviewTestPage } from './components/DocumentPreviewTestPage';

// ============================================================
// Metadata
// ============================================================

export async function generateMetadata() {
  const t = await getTranslations('documentPreview');
  return {
    title: t('testPage.metadata.title'),
    description: t('testPage.metadata.description'),
  };
}

// ============================================================
// Page Component
// ============================================================

/**
 * 文件預覽整合測試頁面
 *
 * @description
 *   Server Component 入口點，渲染客戶端主組件。
 *   權限檢查由 middleware 處理（ADMIN only）。
 *
 * @returns 文件預覽整合測試頁面
 */
export default function DocumentPreviewTestPageRoute() {
  return <DocumentPreviewTestPage />;
}
