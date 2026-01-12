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
 * @lastModified 2026-01-12
 */

import * as React from 'react';
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
        throw new Error(errorData.error?.detail || '保存失敗');
      }

      toast({
        title: '保存成功',
        description: '識別規則已更新',
      });
      setIsDirty(false);
      onSuccess();
    } catch (error) {
      toast({
        title: '保存失敗',
        description: error instanceof Error ? error.message : '請稍後再試',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [rules, formatId, toast, onSuccess]);

  // --- Helpers ---

  const getPriorityLabel = (priority: number): string => {
    if (priority >= 70) return '高';
    if (priority >= 30) return '中';
    return '低';
  };

  // --- Render ---

  return (
    <div className="space-y-6">
      {/* Logo 特徵 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logo 特徵</CardTitle>
          <CardDescription>
            定義文件中 Logo 的位置和特徵，用於識別此格式
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
          <CardTitle className="text-base">關鍵字</CardTitle>
          <CardDescription>
            文件中包含這些關鍵字時，更可能被識別為此格式
          </CardDescription>
        </CardHeader>
        <CardContent>
          <KeywordTagInput
            keywords={rules.keywords}
            onChange={(keywords) => updateRules({ keywords })}
            placeholder="輸入關鍵字後按 Enter（例如：Ocean Freight、B/L No）"
          />
        </CardContent>
      </Card>

      {/* 版面特徵 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">版面特徵</CardTitle>
          <CardDescription>
            描述此格式的版面佈局特徵，供 AI 識別參考
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={rules.layoutHints}
            onChange={(e) => updateRules({ layoutHints: e.target.value })}
            placeholder="描述此格式的版面特徵，例如：表格式發票，左側有公司 Logo，右上角有發票編號，下方有明細表格..."
            rows={4}
          />
          <p className="text-xs text-muted-foreground mt-2">
            最多 1000 字元
          </p>
        </CardContent>
      </Card>

      {/* 優先級 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">識別優先級</CardTitle>
          <CardDescription>
            當多個格式匹配時，優先級越高的格式會被優先選用
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>優先級: {rules.priority}</Label>
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
            <span>低 (0)</span>
            <span>中 (50)</span>
            <span>高 (100)</span>
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
          重設
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          <Save className="mr-2 h-4 w-4" />
          {isSubmitting ? '保存中...' : '保存規則'}
        </Button>
      </div>
    </div>
  );
}
