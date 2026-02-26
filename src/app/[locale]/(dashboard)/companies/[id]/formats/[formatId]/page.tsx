/**
 * @fileoverview 格式詳情頁面
 * @description
 *   顯示格式的完整資訊，包含基本資訊、常見術語和關聯文件。
 *   支援編輯格式名稱。
 *
 * @module src/app/(dashboard)/companies/[id]/formats/[formatId]
 * @since Epic 16 - Story 16.2
 * @lastModified 2026-01-12
 */

import { FormatDetailView } from '@/components/features/formats/FormatDetailView';

interface PageProps {
  params: Promise<{
    id: string;
    formatId: string;
  }>;
}

export default async function FormatDetailPage({ params }: PageProps) {
  const { id: companyId, formatId } = await params;

  return <FormatDetailView companyId={companyId} formatId={formatId} />;
}
