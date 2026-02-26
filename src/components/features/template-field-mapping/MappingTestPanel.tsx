'use client';

/**
 * @fileoverview 映射測試面板組件
 * @module src/components/features/template-field-mapping
 * @since Epic 19 - Story 19.4
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Play, RefreshCcw, AlertCircle, CheckCircle2, Copy, Check } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

import type {
  TemplateFieldMappingRuleInput,
  LookupTransformParams,
} from '@/types/template-field-mapping';

interface MappingTestPanelProps {
  rules: Partial<TemplateFieldMappingRuleInput>[];
  className?: string;
}

interface TestResult {
  success: boolean;
  output: Record<string, unknown>;
  errors: Array<{ field: string; error: string }>;
}

/**
 * 執行簡單的客戶端預覽（僅支援 DIRECT 和 LOOKUP）
 * FORMULA 類型需要調用後端 API 進行安全計算
 */
function previewMappings(
  input: Record<string, unknown>,
  rules: Partial<TemplateFieldMappingRuleInput>[]
): TestResult {
  const output: Record<string, unknown> = {};
  const errors: Array<{ field: string; error: string }> = [];

  for (const rule of rules) {
    if (!rule.sourceField || !rule.targetField) continue;

    const sourceValue = input[rule.sourceField];

    switch (rule.transformType) {
      case 'DIRECT':
        output[rule.targetField] = sourceValue;
        break;

      case 'LOOKUP': {
        const params = rule.transformParams as LookupTransformParams | undefined;
        if (!params?.lookupTable) {
          errors.push({ field: rule.targetField, error: 'Empty lookup table' });
          break;
        }
        const key = String(sourceValue ?? '');
        output[rule.targetField] = params.lookupTable[key] ?? params.defaultValue ?? null;
        break;
      }

      case 'FORMULA':
        // FORMULA 需要後端計算，這裡只做提示
        output[rule.targetField] = '[FORMULA - requires backend calculation]';
        break;

      case 'CONCAT': {
        const params = rule.transformParams as { fields: string[]; separator?: string } | undefined;
        if (!params?.fields?.length) {
          errors.push({ field: rule.targetField, error: 'No fields to concat' });
          break;
        }
        output[rule.targetField] = params.fields
          .map((f) => String(input[f] ?? ''))
          .join(params.separator ?? '');
        break;
      }

      case 'SPLIT': {
        const params = rule.transformParams as { separator: string; index: number } | undefined;
        if (!params?.separator) {
          errors.push({ field: rule.targetField, error: 'No separator' });
          break;
        }
        const parts = String(sourceValue ?? '').split(params.separator);
        output[rule.targetField] = parts[params.index] ?? null;
        break;
      }

      default:
        output[rule.targetField] = sourceValue;
    }
  }

  return { success: errors.length === 0, output, errors };
}

export function MappingTestPanel({ rules, className }: MappingTestPanelProps) {
  const t = useTranslations('templateFieldMapping');
  const [isOpen, setIsOpen] = React.useState(false);
  const [inputJson, setInputJson] = React.useState('');
  const [result, setResult] = React.useState<TestResult | null>(null);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const generateSample = React.useCallback(() => {
    const sample: Record<string, unknown> = {};
    for (const rule of rules) {
      if (rule.sourceField && !sample[rule.sourceField]) {
        const fieldName = rule.sourceField;
        if (fieldName.includes('amount') || fieldName.includes('fee') || fieldName.includes('freight')) {
          sample[fieldName] = 100;
        } else if (fieldName.includes('date')) {
          sample[fieldName] = new Date().toISOString().split('T')[0];
        } else {
          sample[fieldName] = `sample_${fieldName}`;
        }
      }
    }
    setInputJson(JSON.stringify(sample, null, 2));
    setParseError(null);
    setResult(null);
  }, [rules]);

  const handleTest = React.useCallback(() => {
    setParseError(null);
    if (!inputJson.trim()) {
      setParseError(t('test.emptyInput'));
      return;
    }
    try {
      const input = JSON.parse(inputJson);
      if (typeof input !== 'object' || input === null) {
        setParseError(t('test.invalidJson'));
        return;
      }
      setResult(previewMappings(input, rules));
    } catch (err) {
      setParseError(err instanceof Error ? err.message : t('test.parseError'));
    }
  }, [inputJson, rules, t]);

  const handleCopy = React.useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(result.output, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore
    }
  }, [result]);

  const handleReset = React.useCallback(() => {
    setInputJson('');
    setResult(null);
    setParseError(null);
  }, []);

  if (rules.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={cn('border-dashed', className)}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">{t('test.title')}</CardTitle>
              <Badge variant="outline">{isOpen ? t('test.collapse') : t('test.expand')}</Badge>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">{t('test.inputLabel')}</Label>
                <Button type="button" variant="ghost" size="sm" onClick={generateSample}>
                  {t('test.generateSample')}
                </Button>
              </div>
              <Textarea
                value={inputJson}
                onChange={(e) => {
                  setInputJson(e.target.value);
                  setParseError(null);
                }}
                placeholder={t('test.inputPlaceholder')}
                className="font-mono text-sm min-h-[150px]"
              />
              {parseError && (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{parseError}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button type="button" onClick={handleTest} disabled={!inputJson.trim()}>
                <Play className="h-4 w-4 mr-2" />
                {t('test.runTest')}
              </Button>
              <Button type="button" variant="outline" onClick={handleReset}>
                <RefreshCcw className="h-4 w-4 mr-2" />
                {t('test.reset')}
              </Button>
            </div>

            {result && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">{t('test.outputLabel')}</Label>
                    {result.success ? (
                      <Badge variant="outline" className="text-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {t('test.success')}
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {t('test.hasErrors', { count: result.errors.length })}
                      </Badge>
                    )}
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={handleCopy}>
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        {t('test.copied')}
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-1" />
                        {t('test.copy')}
                      </>
                    )}
                  </Button>
                </div>
                <div className="rounded-md bg-muted p-4">
                  <pre className="text-sm font-mono whitespace-pre-wrap overflow-auto max-h-[200px]">
                    {JSON.stringify(result.output, null, 2)}
                  </pre>
                </div>
                {result.errors.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-destructive">{t('test.errorDetails')}</Label>
                    {result.errors.map((err, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-destructive">
                        <span className="font-medium">{err.field}:</span>
                        <span>{err.error}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
