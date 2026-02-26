/**
 * @fileoverview 測試數據選擇組件
 * @description
 *   允許用戶選擇現有文件或使用模擬數據
 *
 * @module src/app/[locale]/(dashboard)/admin/test/template-matching/components
 * @since Epic 19 - Story 19.8
 * @lastModified 2026-01-23
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { FileText, Database, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
import { toast } from 'sonner';
import type {
  StepComponentProps,
  DataSourceType,
  MockDocument,
} from '../types';
import { MOCK_DOCUMENTS } from '../types';

/**
 * 測試數據選擇組件
 */
export function TestDataSelector({
  testState,
  onUpdate,
  onRecordResult,
}: StepComponentProps) {
  const t = useTranslations('templateMatchingTest.selectData');
  const tToast = useTranslations('templateMatchingTest.toast');

  const [includeErrors, setIncludeErrors] = React.useState(true);

  // 處理數據來源變更
  const handleSourceChange = (value: string) => {
    onUpdate({
      dataSource: value as DataSourceType,
      selectedDocuments: [],
      mockData: null,
    });
  };

  // 生成模擬數據
  const handleGenerateMockData = () => {
    const mockData = includeErrors
      ? MOCK_DOCUMENTS
      : MOCK_DOCUMENTS.filter((d) => !d.name.includes('Error'));

    onUpdate({ mockData });
    toast.success(tToast('mockDataGenerated'));

    // 記錄步驟結果
    onRecordResult({
      status: 'passed',
      message: `Generated ${mockData.length} mock documents`,
      details: {
        count: mockData.length,
        includeErrors,
      },
      timestamp: new Date().toISOString(),
    });
  };

  // 獲取當前選中的數據預覽
  const getPreviewData = (): MockDocument[] | null => {
    if (testState.dataSource === 'mock' && testState.mockData) {
      return testState.mockData;
    }
    return null;
  };

  const previewData = getPreviewData();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t('title')}</h3>
        <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
      </div>

      {/* 數據來源選擇 */}
      <RadioGroup
        value={testState.dataSource}
        onValueChange={handleSourceChange}
        className="grid grid-cols-2 gap-4"
      >
        <div>
          <RadioGroupItem
            value="mock"
            id="mock"
            className="peer sr-only"
          />
          <Label
            htmlFor="mock"
            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
          >
            <Database className="mb-3 h-6 w-6" />
            <span className="text-sm font-medium">
              {t('sourceType.mockData')}
            </span>
          </Label>
        </div>

        <div>
          <RadioGroupItem
            value="documents"
            id="documents"
            className="peer sr-only"
          />
          <Label
            htmlFor="documents"
            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
          >
            <FileText className="mb-3 h-6 w-6" />
            <span className="text-sm font-medium">
              {t('sourceType.documents')}
            </span>
          </Label>
        </div>
      </RadioGroup>

      {/* 模擬數據選項 */}
      {testState.dataSource === 'mock' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('mockData.title')}</CardTitle>
            <CardDescription>{t('mockData.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeErrors"
                checked={includeErrors}
                onCheckedChange={(checked) =>
                  setIncludeErrors(checked as boolean)
                }
              />
              <Label
                htmlFor="includeErrors"
                className="text-sm font-normal cursor-pointer"
              >
                {t('mockData.includeErrors')}
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('mockData.includeErrorsHelp')}
            </p>

            <Button onClick={handleGenerateMockData}>
              <Plus className="h-4 w-4 mr-2" />
              {t('mockData.generate')}
            </Button>

            {testState.mockData && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <Check className="h-4 w-4" />
                {t('mockData.generated', { count: testState.mockData.length })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 文件選擇（簡化版，實際應從 API 載入） */}
      {testState.dataSource === 'documents' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('documents.title')}
            </CardTitle>
            <CardDescription>{t('documents.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t('documents.noDocuments')}
            </p>
          </CardContent>
        </Card>
      )}

      {/* 數據預覽 */}
      {previewData && previewData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('preview.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {previewData.map((doc) => (
                <div
                  key={doc.id}
                  className="border rounded-md p-4 mb-3 last:mb-0"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-sm">{doc.name}</span>
                    {doc.name.includes('Error') && (
                      <Badge variant="destructive">Error Case</Badge>
                    )}
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[150px]">
                          {t('preview.fields')}
                        </TableHead>
                        <TableHead>{t('preview.value')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(doc.mappedFields).map(([key, value]) => (
                        <TableRow key={key}>
                          <TableCell className="font-mono text-xs">
                            {key}
                          </TableCell>
                          <TableCell className="text-sm">
                            {value === null ? (
                              <span className="text-muted-foreground italic">
                                null
                              </span>
                            ) : (
                              String(value)
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
