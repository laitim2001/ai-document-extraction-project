/**
 * @fileoverview 模版匹配整合測試頁面
 * @description
 *   提供 6 步驟的測試向導，驗證完整的模版匹配流程
 *
 * @module src/app/[locale]/(dashboard)/admin/test/template-matching
 * @since Epic 19 - Story 19.8
 * @lastModified 2026-01-23
 */

import { getTranslations } from 'next-intl/server';
import { TemplateMatchingTestClient } from './components/TemplateMatchingTestClient';

export default async function TemplateMatchingTestPage() {
  const t = await getTranslations('templateMatchingTest');

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('page.title')}</h1>
        <p className="text-muted-foreground mt-1">{t('page.description')}</p>
      </div>

      <TemplateMatchingTestClient />
    </div>
  );
}
