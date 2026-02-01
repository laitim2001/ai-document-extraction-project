'use client';

/**
 * @fileoverview AI 詳情選項卡組件
 * @description
 *   顯示 GPT 提取的詳細資訊：
 *   - V3: 單一 Prompt/Response
 *   - V3.1: 三階段獨立 AI 詳情 (Stage 1/2/3)
 *   - Token 使用統計
 *
 * @module src/components/features/invoice/detail/AiDetailsTab
 * @since CHANGE-023 - AI Details Tab
 * @lastModified 2026-02-01
 *
 * @features
 *   - Token 使用統計卡片
 *   - V3: 單一 Prompt/Response 展示
 *   - V3.1: 三階段 AI 詳情展示（Stage 1, 2, 3）
 *   - 可複製功能
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/components/ui - shadcn/ui 組件
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Bot, Copy, Check, FileText, Zap, Cpu, Image, Building2, FileType, ClipboardList } from 'lucide-react';

// ============================================================
// Types
// ============================================================

/** V3 單一 AI 詳情 */
interface AiDetailsV3 {
  version?: 'v3';
  prompt: string | null;
  response: string | null;
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  model: string | null;
  imageDetailMode: string | null;
}

/** Stage AI 詳情（V3.1 每階段） */
interface StageAiDetails {
  stage: 'STAGE_1' | 'STAGE_2' | 'STAGE_3';
  model: string;
  prompt: string;
  response: string;
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  imageDetailMode?: 'auto' | 'low' | 'high';
  durationMs: number;
}

/** V3.1 三階段 AI 詳情 */
interface AiDetailsV3_1 {
  version: 'v3.1';
  stages: {
    stage1: StageAiDetails | null;
    stage2: StageAiDetails | null;
    stage3: StageAiDetails | null;
  };
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  model: string | null;
}

interface AiDetailsTabProps {
  aiDetails: AiDetailsV3 | AiDetailsV3_1 | null | undefined;
}

// ============================================================
// Helpers
// ============================================================

/** 檢測 AI 詳情版本 */
function isV3_1(aiDetails: AiDetailsV3 | AiDetailsV3_1 | null | undefined): aiDetails is AiDetailsV3_1 {
  return aiDetails?.version === 'v3.1';
}

// ============================================================
// Stage Card Sub-component (for V3.1)
// ============================================================

interface StageCardProps {
  stage: StageAiDetails | null;
  stageNumber: 1 | 2 | 3;
  stageLabel: string;
  stageDescription: string;
  icon: React.ReactNode;
  t: ReturnType<typeof useTranslations>;
}

function StageCard({ stage, stageNumber, stageLabel, stageDescription, icon, t }: StageCardProps) {
  const [copiedField, setCopiedField] = React.useState<'prompt' | 'response' | null>(null);

  const handleCopy = React.useCallback(async (text: string, field: 'prompt' | 'response') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, []);

  const formatJson = React.useCallback((jsonString: string | null): string => {
    if (!jsonString) return '';
    try {
      const parsed = JSON.parse(jsonString);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return jsonString;
    }
  }, []);

  if (!stage) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle className="text-base">{stageLabel}</CardTitle>
          </div>
          <CardDescription>{stageDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('stages.skipped')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle className="text-base">{stageLabel}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {stage.model}
            </Badge>
            {stage.imageDetailMode && (
              <Badge variant="outline" className="text-xs">
                <Image className="h-3 w-3 mr-1" />
                {stage.imageDetailMode}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {stage.durationMs}ms
            </Badge>
          </div>
        </div>
        <CardDescription>{stageDescription}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Token 使用 */}
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">{t('tokens.input')}: <strong>{stage.tokenUsage.input.toLocaleString()}</strong></span>
          <span className="text-muted-foreground">{t('tokens.output')}: <strong>{stage.tokenUsage.output.toLocaleString()}</strong></span>
          <span className="text-muted-foreground">{t('tokens.total')}: <strong className="text-primary">{stage.tokenUsage.total.toLocaleString()}</strong></span>
        </div>

        {/* Prompt 和 Response */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="prompt">
            <AccordionTrigger className="text-sm">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {t('prompt.title')}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 z-10"
                  onClick={() => handleCopy(stage.prompt, 'prompt')}
                >
                  {copiedField === 'prompt' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <ScrollArea className="h-[200px] w-full rounded-md border">
                  <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-words">
                    {stage.prompt}
                  </pre>
                </ScrollArea>
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="response">
            <AccordionTrigger className="text-sm">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4" />
                {t('response.title')}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 z-10"
                  onClick={() => handleCopy(stage.response, 'response')}
                >
                  {copiedField === 'response' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <ScrollArea className="h-[200px] w-full rounded-md border">
                  <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-words">
                    {formatJson(stage.response)}
                  </pre>
                </ScrollArea>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Component
// ============================================================

/**
 * AI 詳情選項卡組件
 *
 * @description 顯示 GPT 提取的 Prompt、Response 和 Token 使用情況
 * @supports V3 (單一 AI 詳情) 和 V3.1 (三階段 AI 詳情)
 */
export function AiDetailsTab({ aiDetails }: AiDetailsTabProps) {
  const t = useTranslations('invoices.detail.ai');
  const [copiedField, setCopiedField] = React.useState<'prompt' | 'response' | null>(null);

  // 複製到剪貼板
  const handleCopy = React.useCallback(async (text: string, field: 'prompt' | 'response') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, []);

  // 格式化 JSON
  const formatJson = React.useCallback((jsonString: string | null): string => {
    if (!jsonString) return '';
    try {
      const parsed = JSON.parse(jsonString);
      return JSON.stringify(parsed, null, 2);
    } catch {
      // 如果不是有效的 JSON，返回原始字符串
      return jsonString;
    }
  }, []);

  // 空狀態檢查
  const isEmpty = React.useMemo(() => {
    if (!aiDetails) return true;
    if (isV3_1(aiDetails)) {
      // V3.1: 檢查是否所有階段都為空
      const { stages, tokenUsage } = aiDetails;
      return !stages.stage1 && !stages.stage2 && !stages.stage3 && tokenUsage.total === 0;
    } else {
      // V3: 檢查單一詳情
      const v3 = aiDetails as AiDetailsV3;
      return !v3.prompt && !v3.response && v3.tokenUsage.total === 0;
    }
  }, [aiDetails]);

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Bot className="h-16 w-16 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground">
          {t('empty.noData')}
        </h3>
        <p className="text-sm text-muted-foreground/70 mt-1">
          {t('empty.description')}
        </p>
      </div>
    );
  }

  // V3.1: 三階段 AI 詳情
  if (isV3_1(aiDetails)) {
    const { stages, tokenUsage, model } = aiDetails;

    return (
      <div className="space-y-6">
        {/* 版本標籤和總體統計 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">V3.1</Badge>
            <span className="text-sm text-muted-foreground">{t('stages.title')}</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">{t('tokens.total')}: <strong className="text-primary">{tokenUsage.total.toLocaleString()}</strong></span>
            {model && <Badge variant="secondary">{model}</Badge>}
          </div>
        </div>

        {/* 總體 Token 統計卡片 */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('tokens.input')}</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tokenUsage.input.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('tokens.output')}</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tokenUsage.output.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('tokens.total')}</CardTitle>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{tokenUsage.total.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        {/* 三階段詳情 */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">{t('stages.stageDetails')}</h4>

          {/* Stage 1: 公司識別 */}
          <StageCard
            stage={stages.stage1}
            stageNumber={1}
            stageLabel={t('stages.stage1.title')}
            stageDescription={t('stages.stage1.description')}
            icon={<Building2 className="h-5 w-5 text-blue-500" />}
            t={t}
          />

          {/* Stage 2: 格式識別 */}
          <StageCard
            stage={stages.stage2}
            stageNumber={2}
            stageLabel={t('stages.stage2.title')}
            stageDescription={t('stages.stage2.description')}
            icon={<FileType className="h-5 w-5 text-purple-500" />}
            t={t}
          />

          {/* Stage 3: 欄位提取 */}
          <StageCard
            stage={stages.stage3}
            stageNumber={3}
            stageLabel={t('stages.stage3.title')}
            stageDescription={t('stages.stage3.description')}
            icon={<ClipboardList className="h-5 w-5 text-green-500" />}
            t={t}
          />
        </div>
      </div>
    );
  }

  // V3: 單一 AI 詳情（原有邏輯）
  const v3Details = aiDetails as AiDetailsV3;

  return (
    <div className="space-y-6">
      {/* 版本標籤 */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">V3</Badge>
        <span className="text-sm text-muted-foreground">{t('singleStage')}</span>
      </div>

      {/* Token 使用統計 */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* 輸入 Token */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('tokens.input')}
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {v3Details.tokenUsage.input.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        {/* 輸出 Token */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('tokens.output')}
            </CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {v3Details.tokenUsage.output.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        {/* 總 Token */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('tokens.total')}
            </CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {v3Details.tokenUsage.total.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        {/* 模型資訊 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('tokens.model')}
            </CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium truncate">
              {v3Details.model || '-'}
            </div>
            {v3Details.imageDetailMode && (
              <div className="flex items-center gap-1 mt-1">
                <Image className="h-3 w-3 text-muted-foreground" />
                <Badge variant="secondary" className="text-xs">
                  {v3Details.imageDetailMode}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Prompt 和 Response 展示 */}
      <Tabs defaultValue="prompt" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="prompt" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t('prompt.title')}
          </TabsTrigger>
          <TabsTrigger value="response" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            {t('response.title')}
          </TabsTrigger>
        </TabsList>

        {/* Prompt 內容 */}
        <TabsContent value="prompt" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-base">{t('prompt.title')}</CardTitle>
                <CardDescription>{t('prompt.description')}</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => v3Details.prompt && handleCopy(v3Details.prompt, 'prompt')}
                disabled={!v3Details.prompt}
              >
                {copiedField === 'prompt' ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    {t('prompt.copied')}
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    {t('prompt.copy')}
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] w-full rounded-md border">
                <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-words">
                  {v3Details.prompt || t('empty.noData')}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Response 內容 */}
        <TabsContent value="response" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-base">{t('response.title')}</CardTitle>
                <CardDescription>{t('response.description')}</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => v3Details.response && handleCopy(v3Details.response, 'response')}
                disabled={!v3Details.response}
              >
                {copiedField === 'response' ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    {t('response.copied')}
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    {t('response.copy')}
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] w-full rounded-md border">
                <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-words">
                  {formatJson(v3Details.response) || t('empty.noData')}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
