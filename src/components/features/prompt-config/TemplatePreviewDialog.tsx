/**
 * @fileoverview 模板預覽對話框組件
 * @description
 *   顯示 Stage 1-3 Prompt 模板的預覽，支援：
 *   - 帶變數版 / 範例版切換
 *   - System / User Prompt 預覽
 *   - 支援的變數列表
 *   - 覆蓋 / 追加模式選擇
 *
 * @module src/components/features/prompt-config/TemplatePreviewDialog
 * @since CHANGE-027 - Prompt Template Insertion
 * @lastModified 2026-02-04
 *
 * @dependencies
 *   - @/constants/stage-prompt-templates
 *   - @/components/ui/*
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Code, FileText, Variable, Replace, Plus } from 'lucide-react';
import {
  type PromptTemplate,
  type TemplateVersion,
  type InsertMode,
  getTemplateContent,
} from '@/constants/stage-prompt-templates';

// ============================================================================
// Types
// ============================================================================

interface TemplatePreviewDialogProps {
  /** 是否開啟 */
  open: boolean;
  /** 關閉回調 */
  onClose: () => void;
  /** 模板數據 */
  template: PromptTemplate;
  /** 確認插入回調 */
  onConfirm: (
    systemPrompt: string,
    userPrompt: string,
    mode: InsertMode
  ) => void;
  /** 當前是否有內容（用於顯示追加選項） */
  hasExistingContent?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function TemplatePreviewDialog({
  open,
  onClose,
  template,
  onConfirm,
  hasExistingContent = false,
}: TemplatePreviewDialogProps) {
  const t = useTranslations('promptConfig.templateInserter');
  const [version, setVersion] = React.useState<TemplateVersion>('withVariables');
  const [insertMode, setInsertMode] = React.useState<InsertMode>('override');
  const [previewTab, setPreviewTab] = React.useState<'system' | 'user'>('system');

  // 獲取當前版本的模板內容
  const content = React.useMemo(() => {
    return getTemplateContent(template, version);
  }, [template, version]);

  // 處理確認
  const handleConfirm = () => {
    onConfirm(content.systemPrompt, content.userPrompt, insertMode);
    onClose();
  };

  // 重置狀態
  React.useEffect(() => {
    if (open) {
      setVersion('withVariables');
      setInsertMode(hasExistingContent ? 'override' : 'override');
      setPreviewTab('system');
    }
  }, [open, hasExistingContent]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-3xl !grid !grid-rows-[auto_1fr_auto] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('dialogTitle', { typeName: template.displayName })}
          </DialogTitle>
          <DialogDescription>
            {t('dialogDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto pr-4 -mr-4">
          <div className="space-y-6 pr-4">
            {/* 版本選擇 */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t('versionLabel')}</Label>
              <RadioGroup
                value={version}
                onValueChange={(v) => setVersion(v as TemplateVersion)}
                className="grid gap-3"
              >
                <div className="flex items-start space-x-3 border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="withVariables" id="withVariables" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="withVariables" className="cursor-pointer font-medium flex items-center gap-2">
                      <Code className="h-4 w-4" />
                      {t('versionWithVariables')}
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('versionWithVariablesDesc')}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="example" id="example" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="example" className="cursor-pointer font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {t('versionExample')}
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('versionExampleDesc')}
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            {/* Prompt 預覽 */}
            <div className="space-y-3">
              <Tabs value={previewTab} onValueChange={(v) => setPreviewTab(v as 'system' | 'user')}>
                <TabsList>
                  <TabsTrigger value="system">{t('systemPromptPreview')}</TabsTrigger>
                  <TabsTrigger value="user">{t('userPromptPreview')}</TabsTrigger>
                </TabsList>

                <TabsContent value="system" className="mt-3">
                  <div className="border rounded-md p-4 bg-muted/30 max-h-[250px] overflow-auto">
                    <pre className="whitespace-pre-wrap text-sm font-mono">
                      {content.systemPrompt}
                    </pre>
                  </div>
                </TabsContent>

                <TabsContent value="user" className="mt-3">
                  <div className="border rounded-md p-4 bg-muted/30 max-h-[250px] overflow-auto">
                    <pre className="whitespace-pre-wrap text-sm font-mono">
                      {content.userPrompt}
                    </pre>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* 支援的變數列表 */}
            {version === 'withVariables' && template.supportedVariables.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Variable className="h-4 w-4" />
                    {t('supportedVariables')}
                  </Label>
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[180px]">{t('variableName')}</TableHead>
                          <TableHead>{t('variableDescription')}</TableHead>
                          <TableHead className="w-[200px]">{t('variableExample')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {template.supportedVariables.map((v) => (
                          <TableRow key={v.name}>
                            <TableCell>
                              <Badge variant="secondary" className="font-mono text-xs">
                                {v.name}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{v.description}</TableCell>
                            <TableCell className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
                              {v.example.substring(0, 50)}
                              {v.example.length > 50 && '...'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* 插入模式 */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t('insertModeLabel')}</Label>
              <RadioGroup
                value={insertMode}
                onValueChange={(v) => setInsertMode(v as InsertMode)}
                className="grid gap-3"
              >
                <div className="flex items-start space-x-3 border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="override" id="override" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="override" className="cursor-pointer font-medium flex items-center gap-2">
                      <Replace className="h-4 w-4" />
                      {t('modeOverride')}
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('modeOverrideDesc')}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="append" id="append" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="append" className="cursor-pointer font-medium flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      {t('modeAppend')}
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('modeAppendDesc')}
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button onClick={handleConfirm}>
            {t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
