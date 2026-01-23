/**
 * @fileoverview 結果查看組件
 * @description
 *   顯示匹配結果表格，支援錯誤高亮和行編輯
 *
 * @module src/app/[locale]/(dashboard)/admin/test/template-matching/components
 * @since Epic 19 - Story 19.8
 * @lastModified 2026-01-23
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, XCircle, AlertCircle, Eye, Edit2, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { StepComponentProps, RowResult } from '../types';

/**
 * 結果查看組件
 */
export function ResultViewer({
  testState,
  onUpdate,
  onRecordResult,
}: StepComponentProps) {
  const t = useTranslations('templateMatchingTest.viewResults');

  const [showOnlyErrors, setShowOnlyErrors] = React.useState(false);
  const [selectedRow, setSelectedRow] = React.useState<RowResult | null>(null);
  const [editedValues, setEditedValues] = React.useState<Record<string, unknown>>({});

  const matchResult = testState.matchResult;

  // 記錄步驟結果
  React.useEffect(() => {
    if (matchResult && !testState.stepResults['view-results']) {
      onRecordResult({
        status: matchResult.invalidRows > 0 || matchResult.errorRows > 0 ? 'warning' : 'passed',
        message: `Reviewed ${matchResult.totalRows} rows`,
        details: {
          validRows: matchResult.validRows,
          invalidRows: matchResult.invalidRows,
          errorRows: matchResult.errorRows,
        },
        timestamp: new Date().toISOString(),
      });
    }
  }, [matchResult, testState.stepResults, onRecordResult]);

  if (!matchResult) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <p className="text-sm text-muted-foreground">
            No match result available
          </p>
        </CardContent>
      </Card>
    );
  }

  // 過濾結果
  const filteredResults = showOnlyErrors
    ? matchResult.results.filter((r) => r.status !== 'VALID')
    : matchResult.results;

  // 狀態圖標
  const StatusIcon = ({ status }: { status: RowResult['status'] }) => {
    switch (status) {
      case 'VALID':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'INVALID':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'ERROR':
        return <XCircle className="h-4 w-4 text-destructive" />;
    }
  };

  // 狀態 Badge
  const StatusBadge = ({ status }: { status: RowResult['status'] }) => {
    const variants: Record<RowResult['status'], 'default' | 'secondary' | 'destructive'> = {
      VALID: 'default',
      INVALID: 'secondary',
      ERROR: 'destructive',
    };
    return (
      <Badge variant={variants[status]} className="flex items-center gap-1 w-fit">
        <StatusIcon status={status} />
        {t(`rowStatus.${status}`)}
      </Badge>
    );
  };

  // 開啟行編輯
  const handleEditRow = (row: RowResult) => {
    setSelectedRow(row);
    setEditedValues(row.fieldValues || {});
  };

  // 保存編輯
  const handleSaveEdit = () => {
    if (!selectedRow) return;

    // 更新結果（實際應用中應該調用 API）
    const updatedResults = matchResult.results.map((r) => {
      if (r.documentId === selectedRow.documentId) {
        // 重新驗證（簡單檢查）
        const errors: Record<string, string> = {};
        for (const [key, value] of Object.entries(editedValues)) {
          if (value === null || value === undefined || value === '') {
            errors[key] = 'Value is required';
          }
        }
        const hasErrors = Object.keys(errors).length > 0;
        return {
          ...r,
          fieldValues: editedValues,
          status: hasErrors ? 'INVALID' : 'VALID' as RowResult['status'],
          errors: hasErrors ? errors : undefined,
        };
      }
      return r;
    });

    // 重新計算統計
    const validRows = updatedResults.filter((r) => r.status === 'VALID').length;
    const invalidRows = updatedResults.filter((r) => r.status === 'INVALID').length;
    const errorRows = updatedResults.filter((r) => r.status === 'ERROR').length;

    onUpdate({
      matchResult: {
        ...matchResult,
        results: updatedResults,
        validRows,
        invalidRows,
        errorRows,
      },
    });

    setSelectedRow(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t('title')}</h3>
        <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
      </div>

      {/* 摘要統計 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('summary.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">
                {matchResult.totalDocuments}
              </div>
              <div className="text-xs text-muted-foreground">
                {t('summary.totalDocuments')}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{matchResult.totalRows}</div>
              <div className="text-xs text-muted-foreground">
                {t('summary.totalRows')}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {matchResult.validRows}
              </div>
              <div className="text-xs text-muted-foreground">
                {t('summary.validRows')}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {matchResult.invalidRows}
              </div>
              <div className="text-xs text-muted-foreground">
                {t('summary.invalidRows')}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-destructive">
                {matchResult.errorRows}
              </div>
              <div className="text-xs text-muted-foreground">
                {t('summary.errorRows')}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 結果表格 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t('table.title')}</CardTitle>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="showOnlyErrors"
                checked={showOnlyErrors}
                onCheckedChange={(checked) =>
                  setShowOnlyErrors(checked as boolean)
                }
              />
              <Label
                htmlFor="showOnlyErrors"
                className="text-sm font-normal cursor-pointer flex items-center gap-1"
              >
                <Filter className="h-3 w-3" />
                {t('actions.showOnlyErrors')}
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredResults.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-sm text-muted-foreground">
                {t('table.noData')}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('table.rowKey')}</TableHead>
                    <TableHead>{t('table.status')}</TableHead>
                    <TableHead>{t('table.errors')}</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResults.map((row) => (
                    <TableRow
                      key={row.documentId}
                      className={cn(
                        row.status === 'INVALID' && 'bg-yellow-50',
                        row.status === 'ERROR' && 'bg-red-50'
                      )}
                    >
                      <TableCell className="font-mono text-sm">
                        {row.rowKey || '-'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                      <TableCell>
                        {row.errors ? (
                          <div className="text-xs text-destructive">
                            {Object.entries(row.errors)
                              .slice(0, 2)
                              .map(([field, error]) => (
                                <div key={field}>
                                  {field}: {error}
                                </div>
                              ))}
                            {Object.keys(row.errors).length > 2 && (
                              <div>
                                +{Object.keys(row.errors).length - 2} more
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedRow(row)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditRow(row)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* 行詳情/編輯對話框 */}
      <Dialog open={!!selectedRow} onOpenChange={() => setSelectedRow(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('editRow.title')}</DialogTitle>
            <DialogDescription>{t('editRow.description')}</DialogDescription>
          </DialogHeader>

          {selectedRow && (
            <div className="space-y-4">
              <div className="grid gap-4">
                {Object.entries(editedValues).map(([key, value]) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={key} className="font-mono text-xs">
                      {key}
                    </Label>
                    <Input
                      id={key}
                      value={value === null ? '' : String(value)}
                      onChange={(e) =>
                        setEditedValues((prev) => ({
                          ...prev,
                          [key]: e.target.value || null,
                        }))
                      }
                      className={cn(
                        selectedRow.errors?.[key] && 'border-destructive'
                      )}
                    />
                    {selectedRow.errors?.[key] && (
                      <p className="text-xs text-destructive">
                        {selectedRow.errors[key]}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedRow(null)}
                >
                  {t('editRow.cancel')}
                </Button>
                <Button onClick={handleSaveEdit}>{t('editRow.save')}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
