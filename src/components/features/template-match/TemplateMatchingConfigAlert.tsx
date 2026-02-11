'use client';

/**
 * @fileoverview 模板匹配配置提醒組件
 * @description
 *   在公司詳情頁面顯示自動匹配配置狀態提醒。
 *   若公司未配置預設模板，顯示警告訊息。
 *
 * @module src/components/features/template-match/TemplateMatchingConfigAlert
 * @since CHANGE-037 - Data Template 匹配流程完善
 * @lastModified 2026-02-11
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - /api/v1/template-matching/check-config - 配置檢查 API
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface TemplateMatchingConfigAlertProps {
  companyId: string;
}

interface CheckConfigResult {
  hasDefaultTemplate: boolean;
  defaultTemplateName: string | null;
  source: string | null;
}

// ============================================================================
// Component
// ============================================================================

/**
 * 模板匹配配置提醒
 *
 * @description
 *   呼叫 check-config API 檢查公司配置狀態，
 *   顯示相應的提醒訊息。
 */
export function TemplateMatchingConfigAlert({ companyId }: TemplateMatchingConfigAlertProps) {
  const t = useTranslations('companies');

  const [config, setConfig] = React.useState<CheckConfigResult | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const checkConfig = async () => {
      try {
        const response = await fetch(
          `/api/v1/template-matching/check-config?companyId=${encodeURIComponent(companyId)}`
        );
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setConfig(result.data);
          }
        }
      } catch {
        // 靜默失敗，不影響頁面
      } finally {
        setIsLoading(false);
      }
    };

    checkConfig();
  }, [companyId]);

  if (isLoading || !config) return null;

  if (config.hasDefaultTemplate) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
        <div className="text-sm text-green-800 dark:text-green-200">
          <span className="font-medium">{t('form.defaultTemplate.configured')}</span>
          {': '}
          {config.defaultTemplateName}
          {config.source && (
            <span className="ml-1 text-green-600 dark:text-green-400">
              ({config.source})
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="text-sm text-amber-800 dark:text-amber-200">
        {t('form.defaultTemplate.notConfigured')}
      </div>
    </div>
  );
}
