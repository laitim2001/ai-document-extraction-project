/**
 * @fileoverview Prompt 模板插入按鈕組件
 * @description
 *   為 Stage 1-3 的 Prompt Type 提供「插入模板」按鈕。
 *   點擊後打開預覽對話框，用戶可以選擇版本和插入模式。
 *
 *   觸發條件：僅當 promptType 為 Stage 1-3 時顯示
 *
 * @module src/components/features/prompt-config/PromptTemplateInserter
 * @since CHANGE-027 - Prompt Template Insertion
 * @lastModified 2026-02-04
 *
 * @features
 *   - 根據 promptType 判斷是否顯示按鈕
 *   - 打開模板預覽對話框
 *   - 支援覆蓋/追加模式
 *
 * @dependencies
 *   - @/constants/stage-prompt-templates
 *   - ./TemplatePreviewDialog
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import {
  hasDefaultTemplate,
  getDefaultTemplate,
  type InsertMode,
  type PromptTemplate,
} from '@/constants/stage-prompt-templates';
import { TemplatePreviewDialog } from './TemplatePreviewDialog';

// ============================================================================
// Types
// ============================================================================

interface PromptTemplateInserterProps {
  /** 當前選擇的 Prompt Type */
  promptType: string;
  /** System Prompt 插入回調 */
  onInsertSystemPrompt: (content: string, mode: InsertMode) => void;
  /** User Prompt 插入回調 */
  onInsertUserPrompt: (content: string, mode: InsertMode) => void;
  /** 當前 System Prompt 內容（用於判斷是否有現有內容） */
  currentSystemPrompt?: string;
  /** 當前 User Prompt 內容 */
  currentUserPrompt?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Prompt 模板插入按鈕
 * @description 僅在 Stage 1-3 type 時顯示
 */
export function PromptTemplateInserter({
  promptType,
  onInsertSystemPrompt,
  onInsertUserPrompt,
  currentSystemPrompt = '',
  currentUserPrompt = '',
}: PromptTemplateInserterProps) {
  const t = useTranslations('promptConfig.templateInserter');
  const [dialogOpen, setDialogOpen] = React.useState(false);

  // 檢查是否有預設模板
  const hasTemplate = hasDefaultTemplate(promptType);
  const template = React.useMemo(() => {
    return hasTemplate ? getDefaultTemplate(promptType) : null;
  }, [promptType, hasTemplate]);

  // 判斷是否有現有內容
  const hasExistingContent = React.useMemo(() => {
    return currentSystemPrompt.trim().length > 0 || currentUserPrompt.trim().length > 0;
  }, [currentSystemPrompt, currentUserPrompt]);

  // 處理確認插入
  const handleConfirm = React.useCallback(
    (systemPrompt: string, userPrompt: string, mode: InsertMode) => {
      onInsertSystemPrompt(systemPrompt, mode);
      onInsertUserPrompt(userPrompt, mode);
    },
    [onInsertSystemPrompt, onInsertUserPrompt]
  );

  // 如果沒有模板，不渲染任何內容
  if (!hasTemplate || !template) {
    return null;
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setDialogOpen(true)}
      >
        <FileText className="h-4 w-4 mr-1" />
        {t('button')}
      </Button>

      <TemplatePreviewDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        template={template}
        onConfirm={handleConfirm}
        hasExistingContent={hasExistingContent}
      />
    </>
  );
}
