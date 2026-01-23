/**
 * @fileoverview Prompt 測試器組件
 * @description
 *   允許用戶上傳測試文件並執行 Prompt 配置測試。
 *   顯示測試結果、執行時間和 Token 使用量。
 *
 * @module src/components/features/prompt-config/PromptTester
 * @since Epic 14 - Story 14.2
 * @lastModified 2026-01-02
 *
 * @features
 *   - 文件上傳（PDF、PNG、JPG、JPEG）
 *   - 執行測試並顯示結果
 *   - Token 使用量統計
 *   - 錯誤狀態處理
 *
 * @dependencies
 *   - @/types/prompt-config-ui - UI 類型定義
 *   - @/components/ui/* - shadcn/ui 組件
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, Play, CheckCircle, XCircle, FileText } from 'lucide-react';
import type { PromptTestResult } from '@/types/prompt-config-ui';

// ============================================================================
// 類型定義
// ============================================================================

interface PromptTesterProps {
  /** 配置 ID */
  configId: string;
  /** 測試執行回調 */
  onTest: (file: File) => Promise<PromptTestResult>;
  /** 是否禁用（如配置未儲存） */
  disabled?: boolean;
}

// ============================================================================
// 主組件
// ============================================================================

export function PromptTester({ configId: _configId, onTest, disabled = false }: PromptTesterProps) {
  const t = useTranslations('promptConfig.tester');
  const [file, setFile] = React.useState<File | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<PromptTestResult | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // 處理文件選擇
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setResult(null); // 清除之前的結果
    }
  };

  // 處理拖放
  const handleDrop = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && isValidFileType(droppedFile)) {
      setFile(droppedFile);
      setResult(null);
    }
  }, []);

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // 執行測試
  const handleTest = async () => {
    if (!file) return;

    setIsLoading(true);
    try {
      const testResult = await onTest(file);
      setResult(testResult);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : '未知錯誤',
        executionTimeMs: 0,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 文件上傳區域 */}
        <div>
          <Label htmlFor="testFile">{t('uploadLabel')}</Label>
          <div
            className="mt-2 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
          >
            <Input
              ref={fileInputRef}
              id="testFile"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={handleFileChange}
              className="hidden"
            />
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {t('dropzone')}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('supportedFormats')}
            </p>
          </div>

          {/* 已選擇的文件 */}
          {file && (
            <div className="mt-3 flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium truncate max-w-[200px]">
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>
              </div>
              <Button
                onClick={handleTest}
                disabled={disabled || isLoading}
                size="sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('testing')}
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    {t('runTest')}
                  </>
                )}
              </Button>
            </div>
          )}

          {disabled && (
            <p className="text-sm text-muted-foreground mt-2">
              {t('saveFirst')}
            </p>
          )}
        </div>

        {/* 測試結果 */}
        {result && <TestResultDisplay result={result} t={t} />}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// 測試結果顯示組件
// ============================================================================

interface TestResultDisplayProps {
  result: PromptTestResult;
  t: ReturnType<typeof useTranslations>;
}

function TestResultDisplay({ result, t }: TestResultDisplayProps) {
  return (
    <div className="border rounded-md p-4 space-y-3">
      {/* 狀態標題 */}
      <div className="flex items-center gap-2">
        {result.success ? (
          <CheckCircle className="h-5 w-5 text-green-500" />
        ) : (
          <XCircle className="h-5 w-5 text-red-500" />
        )}
        <span className="font-medium">
          {result.success ? t('success') : t('failed')}
        </span>
        <span className="text-sm text-muted-foreground">
          ({result.executionTimeMs.toFixed(0)}ms)
        </span>
      </div>

      {/* 錯誤訊息 */}
      {result.error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded text-sm">
          {result.error}
        </div>
      )}

      {/* 提取結果 */}
      {result.extractedData && (
        <div>
          <h4 className="font-medium text-sm mb-2">{t('extractedResult')}</h4>
          <pre className="p-3 bg-muted rounded text-xs overflow-auto max-h-[300px]">
            {JSON.stringify(result.extractedData, null, 2)}
          </pre>
        </div>
      )}

      {/* 原始回應 */}
      {result.rawResponse && (
        <div>
          <h4 className="font-medium text-sm mb-2">{t('rawResponse')}</h4>
          <pre className="p-3 bg-muted rounded text-xs overflow-auto max-h-[200px] whitespace-pre-wrap">
            {result.rawResponse}
          </pre>
        </div>
      )}

      {/* Token 使用量 */}
      {result.tokensUsed && (
        <div className="text-sm text-muted-foreground pt-2 border-t">
          <span className="font-medium">{t('tokenUsage')}</span>
          <span className="ml-2">
            {t('tokenPrompt')} {result.tokensUsed.prompt.toLocaleString()} +
            {t('tokenCompletion')} {result.tokensUsed.completion.toLocaleString()} =
            <span className="font-medium ml-1">
              {(result.tokensUsed.prompt + result.tokensUsed.completion).toLocaleString()}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 工具函數
// ============================================================================

function isValidFileType(file: File): boolean {
  const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
  return validTypes.includes(file.type);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
