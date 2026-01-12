'use client';

/**
 * @fileoverview 配置繼承說明組件
 * @description
 *   顯示配置的繼承優先級說明，以及當前生效的配置層級。
 *   優先級：FORMAT > COMPANY > GLOBAL
 *
 * @module src/components/features/formats
 * @since Epic 16 - Story 16.4
 * @lastModified 2026-01-12
 */

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

const LEVEL_LABELS: Record<string, string> = {
  FORMAT: '格式專屬',
  COMPANY: '公司級',
  GLOBAL: '全域',
  NONE: '預設',
};

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
  const promptLevel = inheritance.effectivePromptLevel;
  const mappingLevel = inheritance.effectiveMappingLevel;

  return (
    <Alert>
      <Info className="h-4 w-4" />
      <AlertTitle>配置優先級說明</AlertTitle>
      <AlertDescription>
        <div className="mt-2 space-y-3 text-sm">
          {/* 優先級說明 */}
          <p className="text-muted-foreground">
            系統採用三層配置繼承機制，優先級由高到低：
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="default">FORMAT</Badge>
            <span className="text-muted-foreground">&gt;</span>
            <Badge variant="secondary">COMPANY</Badge>
            <span className="text-muted-foreground">&gt;</span>
            <Badge variant="outline">GLOBAL</Badge>
          </div>
          <p className="text-muted-foreground">
            如未配置格式專屬配置，系統會自動使用公司級或全域配置。
          </p>

          {/* 當前生效配置 */}
          <div className="mt-3 pt-3 border-t space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">Prompt 配置：</span>
              <Badge variant={LEVEL_VARIANTS[promptLevel]}>
                {LEVEL_LABELS[promptLevel]}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium">映射配置：</span>
              <Badge variant={LEVEL_VARIANTS[mappingLevel]}>
                {LEVEL_LABELS[mappingLevel]}
              </Badge>
            </div>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}
