/**
 * @fileoverview 映射規則預覽組件
 * @description
 *   顯示解析後的映射規則，支援查看來源
 *
 * @module src/app/[locale]/(dashboard)/admin/test/template-matching/components
 * @since Epic 19 - Story 19.8
 * @lastModified 2026-01-23
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, AlertCircle, Loader2, Globe, Building2, FileType } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import type { StepComponentProps, ResolvedMappingInfo } from '../types';
import type { TemplateFieldMappingRule } from '@/types/template-field-mapping';

interface ResolveMappingResponse {
  success: boolean;
  data: {
    dataTemplateId: string;
    resolvedFrom: Array<{
      id: string;
      scope: 'GLOBAL' | 'COMPANY' | 'FORMAT';
      name: string;
    }>;
    mappings: TemplateFieldMappingRule[];
  };
}

/**
 * 獲取解析後的映射規則
 * @description 如果 API 失敗或沒有映射規則，返回空結果而不是拋出錯誤
 */
async function fetchResolvedMapping(
  dataTemplateId: string
): Promise<ResolvedMappingInfo> {
  try {
    const response = await fetch(`/api/v1/template-field-mappings/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dataTemplateId }),
    });

    if (!response.ok) {
      // API 錯誤時返回空結果（測試頁面可以繼續）
      console.warn(
        `[MappingPreview] API returned ${response.status}, using empty mappings`
      );
      return { sources: [], mappings: [] };
    }

    const data: ResolveMappingResponse = await response.json();
    return {
      sources: data.data.resolvedFrom || [],
      mappings: data.data.mappings || [],
    };
  } catch (error) {
    console.error('[MappingPreview] Failed to fetch mappings:', error);
    return { sources: [], mappings: [] };
  }
}

/**
 * 範圍圖標
 */
const ScopeIcon = ({ scope }: { scope: 'GLOBAL' | 'COMPANY' | 'FORMAT' }) => {
  switch (scope) {
    case 'GLOBAL':
      return <Globe className="h-4 w-4" />;
    case 'COMPANY':
      return <Building2 className="h-4 w-4" />;
    case 'FORMAT':
      return <FileType className="h-4 w-4" />;
    default:
      return null;
  }
};

/**
 * 映射規則預覽組件
 */
export function MappingPreview({
  testState,
  onUpdate,
  onRecordResult,
}: StepComponentProps) {
  const t = useTranslations('templateMatchingTest.reviewMapping');

  const templateId = testState.selectedTemplate?.id;

  // 獲取映射規則
  const {
    data: resolvedMapping,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['resolved-mapping', templateId],
    queryFn: () => fetchResolvedMapping(templateId!),
    enabled: !!templateId,
  });

  // 當映射規則載入成功時更新狀態
  React.useEffect(() => {
    if (resolvedMapping && !testState.resolvedMappings) {
      onUpdate({ resolvedMappings: resolvedMapping });

      // 記錄步驟結果
      onRecordResult({
        status: resolvedMapping.mappings.length > 0 ? 'passed' : 'warning',
        message: resolvedMapping.mappings.length > 0
          ? `Resolved ${resolvedMapping.mappings.length} mapping rules`
          : 'No mapping rules found',
        details: {
          ruleCount: resolvedMapping.mappings.length,
          sources: resolvedMapping.sources.map((s) => s.scope),
        },
        timestamp: new Date().toISOString(),
      });
    }
  }, [resolvedMapping, testState.resolvedMappings, onUpdate, onRecordResult]);

  if (!templateId) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <p className="text-sm text-muted-foreground">
            Please select a template first
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">
            {t('loading')}
          </span>
        </div>
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-sm text-destructive">
              Failed to load mapping rules
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const mapping = resolvedMapping || testState.resolvedMappings;

  if (!mapping || mapping.mappings.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{t('noMapping')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t('title')}</h3>
        <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
      </div>

      {/* 映射來源 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('sources.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {mapping.sources.map((source) => (
              <Badge
                key={source.id}
                variant="outline"
                className="flex items-center gap-1.5"
              >
                <ScopeIcon scope={source.scope} />
                <span>{t(`sources.${source.scope}`)}</span>
                <span className="text-muted-foreground">- {source.name}</span>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 映射規則列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t('rules.title')} ({t('rules.count', { count: mapping.mappings.length })})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">{t('rules.order')}</TableHead>
                  <TableHead>{t('rules.sourceField')}</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>{t('rules.targetField')}</TableHead>
                  <TableHead>{t('rules.transformType')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mapping.mappings
                  .sort((a, b) => a.order - b.order)
                  .map((rule, index) => (
                    <TableRow key={rule.id || index}>
                      <TableCell className="text-muted-foreground text-sm">
                        {rule.order + 1}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {rule.sourceField}
                      </TableCell>
                      <TableCell>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {rule.targetField}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {t(`transformTypes.${rule.transformType}`)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
