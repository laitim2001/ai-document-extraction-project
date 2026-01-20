/**
 * @fileoverview Prompt 編輯器組件（支援變數插入和預覽）
 * @description
 *   提供 System Prompt 和 User Prompt Template 的編輯器。
 *   支援變數插入、即時預覽和字數統計。
 *
 * @module src/components/features/prompt-config/PromptEditor
 * @since Epic 14 - Story 14.2
 * @lastModified 2026-01-02
 *
 * @features
 *   - System / User Prompt 標籤頁切換
 *   - 變數插入面板
 *   - 即時預覽（變數替換）
 *   - 字數統計
 *
 * @dependencies
 *   - @/types/prompt-config-ui - UI 類型定義
 *   - @/components/ui/* - shadcn/ui 組件
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Variable, Eye, Code } from 'lucide-react';
import {
  SYSTEM_VARIABLES,
  type AvailableVariable,
  type VariableCategory,
} from '@/types/prompt-config-ui';

// ============================================================================
// 類型定義
// ============================================================================

interface PromptEditorProps {
  /** System Prompt 內容 */
  systemPrompt: string;
  /** User Prompt Template 內容 */
  userPromptTemplate: string;
  /** System Prompt 變更回調 */
  onSystemPromptChange: (value: string) => void;
  /** User Prompt Template 變更回調 */
  onUserPromptTemplateChange: (value: string) => void;
  /** 預覽用的變數上下文 */
  previewContext?: Record<string, string>;
}

// ============================================================================
// 主組件
// ============================================================================

export function PromptEditor({
  systemPrompt,
  userPromptTemplate,
  onSystemPromptChange,
  onUserPromptTemplateChange,
  previewContext = {},
}: PromptEditorProps) {
  const t = useTranslations('promptConfig');
  const [activeTab, setActiveTab] = React.useState<'system' | 'user'>('system');
  const [showPreview, setShowPreview] = React.useState(false);
  const systemTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  const userTextareaRef = React.useRef<HTMLTextAreaElement>(null);

  // 取得當前 tab 的 textarea ref
  const currentTextareaRef = activeTab === 'system' ? systemTextareaRef : userTextareaRef;

  // 插入變數到游標位置
  const insertVariable = React.useCallback(
    (variableName: string) => {
      const textarea = currentTextareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = activeTab === 'system' ? systemPrompt : userPromptTemplate;
      const variableText = `{{${variableName}}}`;

      const newText = text.slice(0, start) + variableText + text.slice(end);

      if (activeTab === 'system') {
        onSystemPromptChange(newText);
      } else {
        onUserPromptTemplateChange(newText);
      }

      // 恢復游標位置
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(
          start + variableText.length,
          start + variableText.length
        );
      }, 0);
    },
    [activeTab, systemPrompt, userPromptTemplate, onSystemPromptChange, onUserPromptTemplateChange, currentTextareaRef]
  );

  // 預覽替換變數後的內容
  const previewContent = React.useMemo(() => {
    const content = activeTab === 'system' ? systemPrompt : userPromptTemplate;
    let result = content;

    // 替換所有變數
    const variablePattern = /\{\{(\w+)\}\}/g;
    result = result.replace(variablePattern, (match, varName) => {
      if (previewContext[varName]) {
        return previewContext[varName];
      }
      const systemVar = SYSTEM_VARIABLES.find((v) => v.name === varName);
      return systemVar?.example ?? match;
    });

    return result;
  }, [activeTab, systemPrompt, userPromptTemplate, previewContext]);

  return (
    <div className="space-y-4">
      {/* 編輯器標籤頁 */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'system' | 'user')}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <TabsList>
            <TabsTrigger value="system">System Prompt</TabsTrigger>
            <TabsTrigger value="user">User Prompt Template</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            {/* 變數插入器 */}
            <VariableInserter onInsert={insertVariable} t={t} />

            {/* 預覽切換 */}
            <Button
              variant={showPreview ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? (
                <>
                  <Code className="h-4 w-4 mr-1" />
                  {t('editor.viewSource')}
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-1" />
                  {t('editor.viewPreview')}
                </>
              )}
            </Button>
          </div>
        </div>

        <TabsContent value="system" className="mt-4">
          <Label htmlFor="systemPrompt">System Prompt</Label>
          <p className="text-sm text-muted-foreground mb-2">
            {t('editor.systemPromptDescription')}
          </p>
          {showPreview ? (
            <PromptPreviewPane content={previewContent} />
          ) : (
            <Textarea
              ref={systemTextareaRef}
              id="systemPrompt"
              value={systemPrompt}
              onChange={(e) => onSystemPromptChange(e.target.value)}
              className="min-h-[300px] font-mono text-sm"
              placeholder="You are an AI assistant specialized in..."
            />
          )}
        </TabsContent>

        <TabsContent value="user" className="mt-4">
          <Label htmlFor="userPromptTemplate">User Prompt Template</Label>
          <p className="text-sm text-muted-foreground mb-2">
            {t('editor.userPromptDescription')}
          </p>
          {showPreview ? (
            <PromptPreviewPane content={previewContent} />
          ) : (
            <Textarea
              ref={userTextareaRef}
              id="userPromptTemplate"
              value={userPromptTemplate}
              onChange={(e) => onUserPromptTemplateChange(e.target.value)}
              className="min-h-[400px] font-mono text-sm"
              placeholder="Please analyze the following invoice from {{companyName}}..."
            />
          )}
        </TabsContent>
      </Tabs>

      {/* 字數統計 */}
      <div className="flex justify-end text-xs text-muted-foreground">
        <span>
          {t('editor.charCount', { systemCount: systemPrompt.length, userCount: userPromptTemplate.length })}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// 變數插入器
// ============================================================================

interface VariableInserterProps {
  onInsert: (variableName: string) => void;
  t: ReturnType<typeof useTranslations<'promptConfig'>>;
}

function VariableInserter({ onInsert, t }: VariableInserterProps) {
  const groupedVariables = React.useMemo(() => {
    const groups: Record<VariableCategory, AvailableVariable[]> = {
      static: [],
      dynamic: [],
      context: [],
    };
    for (const v of SYSTEM_VARIABLES) {
      groups[v.category].push(v);
    }
    return groups;
  }, []);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Variable className="h-4 w-4 mr-1" />
          {t('editor.insertVariable')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <ScrollArea className="h-[300px]">
          <div className="space-y-4">
            {/* 靜態變數 */}
            <VariableGroup
              category="static"
              variables={groupedVariables.static}
              onInsert={onInsert}
              t={t}
            />

            {/* 動態變數 */}
            <VariableGroup
              category="dynamic"
              variables={groupedVariables.dynamic}
              onInsert={onInsert}
              t={t}
            />

            {/* 上下文變數 */}
            <VariableGroup
              category="context"
              variables={groupedVariables.context}
              onInsert={onInsert}
              t={t}
            />
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// 變數組
// ============================================================================

interface VariableGroupProps {
  category: VariableCategory;
  variables: AvailableVariable[];
  onInsert: (name: string) => void;
  t: ReturnType<typeof useTranslations<'promptConfig'>>;
}

function VariableGroup({ category, variables, onInsert, t }: VariableGroupProps) {
  if (variables.length === 0) return null;

  // 使用國際化的標籤和描述
  const title = t(`editor.variableCategories.${category}.label`);
  const description = t(`editor.variableCategories.${category}.description`);

  return (
    <div>
      <h4 className="font-medium text-sm">{title}</h4>
      <p className="text-xs text-muted-foreground mb-2">{description}</p>
      <div className="space-y-1">
        {variables.map((v) => (
          <button
            key={v.name}
            type="button"
            className="w-full text-left p-2 rounded hover:bg-muted text-sm transition-colors"
            onClick={() => onInsert(v.name)}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs">{`{{${v.name}}}`}</span>
              <Badge variant="outline" className="text-xs">
                {v.displayName}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{v.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 預覽面板
// ============================================================================

interface PromptPreviewPaneProps {
  content: string;
}

function PromptPreviewPane({ content }: PromptPreviewPaneProps) {
  return (
    <div className="border rounded-md p-4 bg-muted/50 min-h-[300px]">
      <pre className="whitespace-pre-wrap text-sm font-mono">{content}</pre>
    </div>
  );
}
