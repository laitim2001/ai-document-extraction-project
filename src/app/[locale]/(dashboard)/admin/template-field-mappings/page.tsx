/**
 * @fileoverview 模版欄位映射列表頁面
 * @module src/app/[locale]/(dashboard)/admin/template-field-mappings
 * @since Epic 19 - Story 19.4
 * @lastModified 2026-01-22
 */

import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { TemplateFieldMappingList } from '@/components/features/template-field-mapping';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('templateFieldMapping');

  return {
    title: t('page.title'),
    description: t('page.description'),
  };
}

export default async function TemplateFieldMappingsPage() {
  const t = await getTranslations('templateFieldMapping');

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('page.title')}</h1>
        <p className="text-muted-foreground">{t('page.description')}</p>
      </div>

      <TemplateFieldMappingList />
    </div>
  );
}
