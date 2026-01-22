/**
 * @fileoverview 模版實例列表頁面
 * @description
 *   顯示模版實例列表，支援篩選、搜尋、分頁和創建新實例
 *
 * @module src/app/[locale]/(dashboard)/template-instances/page
 * @since Epic 19 - Story 19.5
 * @lastModified 2026-01-22
 */

import { getTranslations } from 'next-intl/server';
import { TemplateInstanceList } from '@/components/features/template-instance';

export async function generateMetadata() {
  const t = await getTranslations('templateInstance');

  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
  };
}

export default async function TemplateInstancesPage() {
  const t = await getTranslations('templateInstance');

  return (
    <div className="container mx-auto py-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{t('pageTitle')}</h1>
        <p className="text-muted-foreground mt-1">{t('pageDescription')}</p>
      </div>

      {/* Instance List */}
      <TemplateInstanceList />
    </div>
  );
}
