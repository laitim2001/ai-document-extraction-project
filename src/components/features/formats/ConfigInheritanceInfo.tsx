'use client';

/**
 * @fileoverview 配置繼承說明組件
 * @description
 *   顯示配置的繼承優先級說明，以及當前生效的配置層級。
 *   優先級：FORMAT > COMPANY > GLOBAL
 *
 * @module src/components/features/formats
 * @since Epic 16 - Story 16.4
 * @lastModified 2026-02-26
 */

import { useTranslations } from 'next-intl';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface ConfigInheritance {
  hasFormatPrompt: boolean;
  hasCompanyPrompt: boolean;
  hasGlobalPrompt: boolean;
  hasFormatMapping: boolean;
  hasCompanyMapping: boolean;
  hasGlobalMapping: boolean;
  effectivePromptLevel: 'FORMAT' | 'COMPANY' | 'GLOBAL' | 'NONE';
  effectiveMappingLevel: 'FORMAT' | 'COMPANY' | 'GLOBAL' | 'NONE';
}

export interface ConfigInheritanceInfoProps {
  inheritance: ConfigInheritance;
}

// ============================================================================
// Constants
// ============================================================================

const LEVEL_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  FORMAT: 'default',
  COMPANY: 'secondary',
  GLOBAL: 'outline',
  NONE: 'outline',
};

// ============================================================================
// Component
// ============================================================================

/**
 * 配置繼承說明組件
 *
 * @description
 *   顯示配置的三層繼承機制說明，以及目前 Prompt 和映射各自生效的層級。
 */
export function ConfigInheritanceInfo({ inheritance }: ConfigInheritanceInfoProps) {
  const t = useTranslations('formats');
  const promptLevel = inheritance.effectivePromptLevel;
  const mappingLevel = inheritance.effectiveMappingLevel;

  return (
    <Alert>
      <Info className="h-4 w-4" />
      <AlertTitle>{t('detail.configs.inheritance.title')}</AlertTitle>
      <AlertDescription>
        <div className="mt-2 space-y-3 text-sm">
          {/* 優先級說明 */}
          <p className="text-muted-foreground">
            {t('detail.configs.inheritance.description')}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="default">FORMAT</Badge>
            <span className="text-muted-foreground">&gt;</span>
            <Badge variant="secondary">COMPANY</Badge>
            <span className="text-muted-foreground">&gt;</span>
            <Badge variant="outline">GLOBAL</Badge>
          </div>
          <p className="text-muted-foreground">
            {t('detail.configs.inheritance.fallback')}
          </p>

          {/* 當前生效配置 */}
          <div className="mt-3 pt-3 border-t space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">{t('detail.configs.inheritance.promptLabel')}</span>
              <Badge variant={LEVEL_VARIANTS[promptLevel]}>
                {t(`detail.configs.inheritance.levels.${promptLevel}`)}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium">{t('detail.configs.inheritance.mappingLabel')}</span>
              <Badge variant={LEVEL_VARIANTS[mappingLevel]}>
                {t(`detail.configs.inheritance.levels.${mappingLevel}`)}
              </Badge>
            </div>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}
