/**
 * @fileoverview 測試報告生成器組件
 * @description
 *   生成完整的測試報告，支援複製和下載
 *
 * @module src/app/[locale]/(dashboard)/admin/test/template-matching/components
 * @since Epic 19 - Story 19.8
 * @lastModified 2026-01-23
 */

'use client';

import * as React from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  FileText,
  Copy,
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { formatDateTime } from '@/lib/i18n-date';
import type { Locale } from '@/i18n/config';
import type { TestState, TestStep } from '../types';

interface TestReportGeneratorProps {
  testState: TestState;
  steps: Array<{ id: TestStep; title: string }>;
}

/**
 * 測試報告生成器組件
 */
export function TestReportGenerator({
  testState,
  steps,
}: TestReportGeneratorProps) {
  const t = useTranslations('templateMatchingTest.report');
  const tToast = useTranslations('templateMatchingTest.toast');
  const locale = useLocale() as Locale;

  const [isGenerating, setIsGenerating] = React.useState(false);
  const [report, setReport] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  // 生成報告
  const generateReport = React.useCallback(() => {
    setIsGenerating(true);

    // 模擬異步生成
    setTimeout(() => {
      const now = new Date();
      const stepResults = testState.stepResults;

      // 計算統計
      const passedSteps = Object.values(stepResults).filter(
        (r) => r?.status === 'passed'
      ).length;
      const failedSteps = Object.values(stepResults).filter(
        (r) => r?.status === 'failed'
      ).length;
      const warningSteps = Object.values(stepResults).filter(
        (r) => r?.status === 'warning'
      ).length;
      const totalSteps = steps.length;
      const passRate = Math.round((passedSteps / totalSteps) * 100);

      // 生成 Markdown 報告
      const reportContent = `# 模版匹配整合測試報告

**測試時間**: ${formatDateTime(now, locale)}
**測試環境**: Integration Test

---

## 測試配置

| 項目 | 值 |
|------|-----|
| 數據來源 | ${testState.dataSource === 'mock' ? '模擬數據' : '現有文件'} |
| 測試文件數 | ${testState.mockData?.length || testState.selectedDocuments.length || 0} |
| 目標模版 | ${testState.selectedTemplate?.name || 'N/A'} |
| 映射規則數 | ${testState.resolvedMappings?.mappings.length || 0} |

---

## 測試結果

${steps
  .map((step, index) => {
    const result = stepResults[step.id];
    const statusIcon =
      result?.status === 'passed'
        ? '✅'
        : result?.status === 'failed'
        ? '❌'
        : result?.status === 'warning'
        ? '⚠️'
        : '⏳';
    const statusText =
      result?.status === 'passed'
        ? '通過'
        : result?.status === 'failed'
        ? '失敗'
        : result?.status === 'warning'
        ? '警告'
        : '未執行';

    return `### Step ${index + 1}: ${step.title} ${statusIcon}

- **狀態**: ${statusText}
${result?.message ? `- **訊息**: ${result.message}` : ''}
${result?.timestamp ? `- **時間**: ${new Date(result.timestamp).toLocaleString(locale)}` : ''}
${result?.details ? `- **詳情**: ${JSON.stringify(result.details, null, 2)}` : ''}
`;
  })
  .join('\n')}

---

## 匹配結果統計

${
  testState.matchResult
    ? `| 指標 | 值 |
|------|-----|
| 處理文件數 | ${testState.matchResult.totalDocuments} |
| 生成行數 | ${testState.matchResult.totalRows} |
| 有效行數 | ${testState.matchResult.validRows} |
| 無效行數 | ${testState.matchResult.invalidRows} |
| 錯誤行數 | ${testState.matchResult.errorRows} |`
    : '未執行匹配'
}

---

## 導出測試結果

${
  testState.exportResult
    ? `| 項目 | 值 |
|------|-----|
| 導出格式 | ${testState.exportResult.format.toUpperCase()} |
| 文件名 | ${testState.exportResult.filename} |
| 文件大小 | ${(testState.exportResult.fileSize / 1024).toFixed(1)} KB |
| 導出行數 | ${testState.exportResult.rowCount} |`
    : '未執行導出'
}

---

## 總結

| 指標 | 值 |
|------|-----|
| 通過率 | ${passRate}% |
| 通過步驟 | ${passedSteps} |
| 警告步驟 | ${warningSteps} |
| 失敗步驟 | ${failedSteps} |
| 總步驟數 | ${totalSteps} |

### 建議

${
  failedSteps > 0
    ? '- ❌ 有步驟執行失敗，請檢查錯誤訊息並修復'
    : warningSteps > 0
    ? '- ⚠️ 有步驟產生警告，建議檢查相關配置'
    : '- ✅ 所有步驟執行正常'
}
${
  testState.matchResult && testState.matchResult.invalidRows > 0
    ? `- 有 ${testState.matchResult.invalidRows} 行驗證失敗，可能需要調整映射規則或數據`
    : ''
}

---

*報告生成於 ${formatDateTime(now, locale)}*
`;

      setReport(reportContent);
      setIsGenerating(false);
      toast.success(tToast('reportGenerated'));
    }, 500);
  }, [testState, steps, locale, tToast]);

  // 複製到剪貼板
  const handleCopy = async () => {
    if (!report) return;

    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      toast.success(tToast('reportCopied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  // 下載報告
  const handleDownload = () => {
    if (!report) return;

    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-report-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(t('actions.downloadSuccess'));
  };

  // 步驟結果統計
  const stepStats = React.useMemo(() => {
    const results = Object.values(testState.stepResults);
    return {
      passed: results.filter((r) => r?.status === 'passed').length,
      failed: results.filter((r) => r?.status === 'failed').length,
      warning: results.filter((r) => r?.status === 'warning').length,
      total: steps.length,
    };
  }, [testState.stepResults, steps.length]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t('title')}
            </CardTitle>
            <CardDescription>{t('description')}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>{stepStats.passed}</span>
            </div>
            <div className="flex items-center gap-1 text-sm">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <span>{stepStats.warning}</span>
            </div>
            <div className="flex items-center gap-1 text-sm">
              <XCircle className="h-4 w-4 text-destructive" />
              <span>{stepStats.failed}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 生成按鈕 */}
        {!report && (
          <Button
            onClick={generateReport}
            disabled={isGenerating}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('generating')}
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                {t('generate')}
              </>
            )}
          </Button>
        )}

        {/* 報告預覽 */}
        {report && (
          <>
            <ScrollArea className="h-[300px] border rounded-md p-4">
              <pre className="text-xs whitespace-pre-wrap font-mono">
                {report}
              </pre>
            </ScrollArea>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleCopy}
                className="flex-1"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    {t('actions.copied')}
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    {t('actions.copy')}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleDownload}
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                {t('actions.download')}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
