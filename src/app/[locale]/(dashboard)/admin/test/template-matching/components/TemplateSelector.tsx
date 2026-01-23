/**
 * @fileoverview 模版選擇組件
 * @description
 *   允許用戶選擇數據模版
 *
 * @module src/app/[locale]/(dashboard)/admin/test/template-matching/components
 * @since Epic 19 - Story 19.8
 * @lastModified 2026-01-23
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Check, FileSpreadsheet, Search, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
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
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { StepComponentProps, SelectedTemplate } from '../types';
import type { DataTemplateField } from '@/types/data-template';

interface DataTemplateListItem {
  id: string;
  name: string;
  description: string | null;
  fields: DataTemplateField[];
  isActive: boolean;
}

/**
 * 獲取模版列表
 */
async function fetchTemplates(): Promise<DataTemplateListItem[]> {
  const response = await fetch('/api/v1/data-templates?isActive=true&limit=50');
  if (!response.ok) {
    throw new Error('Failed to fetch templates');
  }
  const data = await response.json();
  return data.data?.templates || [];
}

/**
 * 模版選擇組件
 */
export function TemplateSelector({
  testState,
  onUpdate,
  onRecordResult,
}: StepComponentProps) {
  const t = useTranslations('templateMatchingTest.selectTemplate');
  const tToast = useTranslations('templateMatchingTest.toast');

  const [searchQuery, setSearchQuery] = React.useState('');

  // 獲取模版列表
  const {
    data: templates,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['data-templates', 'active'],
    queryFn: fetchTemplates,
  });

  // 過濾模版
  const filteredTemplates = React.useMemo(() => {
    if (!templates) return [];
    if (!searchQuery) return templates;
    const query = searchQuery.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query)
    );
  }, [templates, searchQuery]);

  // 處理選擇模版
  const handleSelectTemplate = (template: DataTemplateListItem) => {
    const selectedTemplate: SelectedTemplate = {
      id: template.id,
      name: template.name,
      fields: template.fields,
    };

    onUpdate({
      selectedTemplate,
      resolvedMappings: null, // 重置映射
    });

    toast.success(tToast('templateSelected', { name: template.name }));

    // 記錄步驟結果
    const requiredFields = template.fields.filter((f) => f.isRequired);
    onRecordResult({
      status: 'passed',
      message: `Selected template: ${template.name}`,
      details: {
        templateId: template.id,
        templateName: template.name,
        fieldCount: template.fields.length,
        requiredFieldCount: requiredFields.length,
      },
      timestamp: new Date().toISOString(),
    });
  };

  // 計算必填欄位數
  const getRequiredFieldCount = (fields: DataTemplateField[]): number => {
    return fields.filter((f) => f.isRequired).length;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-sm text-destructive">Failed to load templates</p>
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

      {/* 搜尋 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* 模版列表 */}
      {filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center h-32">
            <p className="text-sm text-muted-foreground">{t('noTemplates')}</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[300px]">
          <div className="space-y-3">
            {filteredTemplates.map((template) => {
              const isSelected =
                testState.selectedTemplate?.id === template.id;
              const requiredCount = getRequiredFieldCount(template.fields);

              return (
                <Card
                  key={template.id}
                  className={cn(
                    'cursor-pointer transition-colors hover:border-primary',
                    isSelected && 'border-primary bg-primary/5'
                  )}
                  onClick={() => handleSelectTemplate(template)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <FileSpreadsheet className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {template.name}
                            {isSelected && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          {template.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {template.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {t('fieldCount', { count: template.fields.length })}
                        </Badge>
                        {requiredCount > 0 && (
                          <Badge variant="secondary">
                            {t('requiredFields', { count: requiredCount })}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* 選中模版的欄位預覽 */}
      {testState.selectedTemplate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('preview.title')} - {testState.selectedTemplate.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('preview.name')}</TableHead>
                    <TableHead>{t('preview.label')}</TableHead>
                    <TableHead>{t('preview.type')}</TableHead>
                    <TableHead className="text-center">
                      {t('preview.required')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {testState.selectedTemplate.fields
                    .sort((a, b) => a.order - b.order)
                    .map((field) => (
                      <TableRow key={field.name}>
                        <TableCell className="font-mono text-xs">
                          {field.name}
                        </TableCell>
                        <TableCell>{field.label}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{field.dataType}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {field.isRequired ? (
                            <Check className="h-4 w-4 text-green-600 mx-auto" />
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
