'use client';

/**
 * @fileoverview 識別規則編輯器
 * @description
 *   編輯文件格式的識別規則，包含：
 *   - Logo 特徵配置
 *   - 關鍵字配置
 *   - 版面特徵描述
 *   - 識別優先級
 *
 * @module src/components/features/formats
 * @since Epic 16 - Story 16.3
 * @lastModified 2026-01-31
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { LogoPatternEditor } from './LogoPatternEditor';
import { KeywordTagInput } from './KeywordTagInput';
import { identificationRulesSchema } from '@/validations/document-format';
import {
  type IdentificationRules,
  type LogoPattern,
  DEFAULT_IDENTIFICATION_RULES,
} from '@/types/document-format';
import { Save, RotateCcw } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface IdentificationRulesEditorProps {
  /** 格式 ID */
  formatId: string;
  /** 初始識別規則（null 表示未設定） */
  initialRules: IdentificationRules | null;
  /** 保存成功回調 */
  onSuccess: () => void;
}

interface RulesState {
  logoPatterns: LogoPattern[];
  keywords: string[];
  layoutHints: string;
  priority: number;
}

// ============================================================================
// Component
// ============================================================================

/**
 * 識別規則編輯器
 *
 * @description
 *   完整的識別規則編輯介面，包含四個區塊：
 *   1. Logo 特徵 - 定義文件中 Logo 的位置和描述
 *   2. 關鍵字 - 文件中應包含的關鍵字
 *   3. 版面特徵 - 版面佈局的文字描述
 *   4. 優先級 - 識別時的優先級設定
 */
export function IdentificationRulesEditor({
  formatId,
  initialRules,
  onSuccess,
}: IdentificationRulesEditorProps) {
  const t = useTranslations('formats.detail.rules');
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isDirty, setIsDirty] = React.useState(false);

  // --- State ---
  const [rules, setRules] = React.useState<RulesState>(() => ({
    logoPatterns: initialRules?.logoPatterns || DEFAULT_IDENTIFICATION_RULES.logoPatterns,
    keywords: initialRules?.keywords || DEFAULT_IDENTIFICATION_RULES.keywords,
    layoutHints: initialRules?.layoutHints || DEFAULT_IDENTIFICATION_RULES.layoutHints,
    priority: initialRules?.priority ?? DEFAULT_IDENTIFICATION_RULES.priority,
  }));

  // --- Handlers ---

  const updateRules = React.useCallback((updates: Partial<RulesState>) => {
    setRules((prev) => ({ ...prev, ...updates }));
    setIsDirty(true);
  }, []);

  const handleReset = React.useCallback(() => {
    setRules({
      logoPatterns: initialRules?.logoPatterns || DEFAULT_IDENTIFICATION_RULES.logoPatterns,
      keywords: initialRules?.keywords || DEFAULT_IDENTIFICATION_RULES.keywords,
      layoutHints: initialRules?.layoutHints || DEFAULT_IDENTIFICATION_RULES.layoutHints,
      priority: initialRules?.priority ?? DEFAULT_IDENTIFICATION_RULES.priority,
    });
    setIsDirty(false);
  }, [initialRules]);

  const handleSubmit = React.useCallback(async () => {
    try {
      // 驗證
      const validated = identificationRulesSchema.parse(rules);

      setIsSubmitting(true);
      const response = await fetch(`/api/v1/formats/${formatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificationRules: validated }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.detail || t('toast.saveError'));
      }

      toast({
        title: t('toast.saveSuccess'),
        description: t('toast.saveSuccessDescription'),
      });
      setIsDirty(false);
      onSuccess();
    } catch (error) {
      toast({
        title: t('toast.saveError'),
        description: error instanceof Error ? error.message : t('toast.saveErrorRetry'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [rules, formatId, toast, onSuccess, t]);

  // --- Helpers ---

  const getPriorityLabel = (priority: number): string => {
    if (priority >= 70) return t('priority.high');
    if (priority >= 30) return t('priority.medium');
    return t('priority.low');
  };

  // --- Render ---

  return (
    <div className="space-y-6">
      {/* Logo 特徵 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('logoPatterns.title')}</CardTitle>
          <CardDescription>
            {t('logoPatterns.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LogoPatternEditor
            patterns={rules.logoPatterns}
            onChange={(patterns) => updateRules({ logoPatterns: patterns })}
          />
        </CardContent>
      </Card>

      {/* 關鍵字 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('keywords.title')}</CardTitle>
          <CardDescription>
            {t('keywords.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <KeywordTagInput
            keywords={rules.keywords}
            onChange={(keywords) => updateRules({ keywords })}
            placeholder={t('keywords.placeholder')}
          />
        </CardContent>
      </Card>

      {/* 版面特徵 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('layoutHints.title')}</CardTitle>
          <CardDescription>
            {t('layoutHints.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={rules.layoutHints}
            onChange={(e) => updateRules({ layoutHints: e.target.value })}
            placeholder={t('layoutHints.placeholder')}
            rows={4}
          />
          <p className="text-xs text-muted-foreground mt-2">
            {t('layoutHints.maxLength')}
          </p>
        </CardContent>
      </Card>

      {/* 優先級 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('priority.title')}</CardTitle>
          <CardDescription>
            {t('priority.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>{t('priority.label', { value: rules.priority })}</Label>
            <span className="text-sm text-muted-foreground">
              {getPriorityLabel(rules.priority)}
            </span>
          </div>
          <Slider
            value={[rules.priority]}
            onValueChange={([value]) => updateRules({ priority: value })}
            min={0}
            max={100}
            step={1}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t('priority.lowValue')}</span>
            <span>{t('priority.mediumValue')}</span>
            <span>{t('priority.highValue')}</span>
          </div>
        </CardContent>
      </Card>

      {/* 操作按鈕 */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={!isDirty || isSubmitting}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          {t('actions.reset')}
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          <Save className="mr-2 h-4 w-4" />
          {isSubmitting ? t('actions.saving') : t('actions.save')}
        </Button>
      </div>
    </div>
  );
}
