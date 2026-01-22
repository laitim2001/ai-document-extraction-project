/**
 * @fileoverview 模版實例詳情頁面
 * @description
 *   顯示單一模版實例的完整詳情，包括：
 *   - 統計概覽
 *   - 數據行表格（動態列）
 *   - 行編輯和批量操作
 *
 * @module src/app/[locale]/(dashboard)/template-instances/[id]/page
 * @since Epic 19 - Story 19.5
 * @lastModified 2026-01-22
 */

import { getTranslations } from 'next-intl/server';
import { TemplateInstanceDetail } from '@/components/features/template-instance';

interface PageProps {
  params: Promise<{
    id: string;
    locale: string;
  }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const t = await getTranslations('templateInstance');

  return {
    title: `${t('pageTitle')} - ${id}`,
    description: t('pageDescription'),
  };
}

export default async function TemplateInstanceDetailPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="container mx-auto py-6">
      <TemplateInstanceDetail instanceId={id} />
    </div>
  );
}
