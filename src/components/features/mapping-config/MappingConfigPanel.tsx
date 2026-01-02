'use client';

/**
 * @fileoverview 映射配置主面板組件
 * @description
 *   整合所有映射配置相關組件的主要容器：
 *   - ConfigSelector: 配置範圍選擇
 *   - MappingRuleList: 規則列表（支援拖動排序）
 *   - RuleEditor: 規則編輯對話框
 *   - MappingPreview: 轉換預覽
 *
 * @module src/components/features/mapping-config/MappingConfigPanel
 * @since Epic 13 - Story 13.3
 * @lastModified 2026-01-02
 *
 * @features
 *   - 三層配置範圍選擇（GLOBAL/COMPANY/FORMAT）
 *   - 規則 CRUD 操作
 *   - 拖動排序規則優先級
 *   - 即時預覽轉換結果
 *   - 雙頁籤佈局（規則/預覽）
 *
 * @dependencies
 *   - ./ConfigSelector - 配置範圍選擇器
 *   - ./MappingRuleList - 規則列表
 *   - ./RuleEditor - 規則編輯器
 *   - ./MappingPreview - 預覽面板
 *   - @/types/field-mapping - 類型定義
 */

import * as React from 'react';
import { Save, RotateCcw, Settings2, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ConfigSelector } from './ConfigSelector';
import { MappingRuleList } from './MappingRuleList';
import { RuleEditor, type RuleEditorSaveData } from './RuleEditor';
import { MappingPreview, type PreviewRow } from './MappingPreview';
import type {
  ConfigScope,
  VisualMappingRule,
  VisualMappingConfig,
  SourceFieldDefinition,
  TargetFieldDefinition,
  TransformType,
  TransformParams,
} from '@/types/field-mapping';
import { cn } from '@/lib/utils';

// ============================================================
// Types
// ============================================================

/**
 * MappingConfigPanel 組件屬性
 */
export interface MappingConfigPanelProps {
  /** 初始配置數據 */
  initialConfig?: VisualMappingConfig | null;
  /** 可用的來源欄位列表 */
  sourceFields: SourceFieldDefinition[];
  /** 可用的目標欄位列表 */
  targetFields: TargetFieldDefinition[];
  /** 預覽數據 */
  previewData?: PreviewRow[];
  /** 是否正在載入配置 */
  isLoading?: boolean;
  /** 是否正在儲存 */
  isSaving?: boolean;
  /** 是否正在載入預覽 */
  isLoadingPreview?: boolean;
  /** 儲存配置回調 */
  onSave?: (config: VisualMappingConfig) => void;
  /** 配置變更回調（用於即時同步） */
  onChange?: (config: VisualMappingConfig) => void;
  /** 刷新預覽回調 */
  onRefreshPreview?: () => void;
  /** 範圍變更回調 */
  onScopeChange?: (scope: ConfigScope, companyId: string | null, formatId: string | null) => void;
  /** 自訂類名 */
  className?: string;
}

/**
 * 規則編輯器模式
 */
type EditorMode = 'create' | 'edit';

// ============================================================
// Constants
// ============================================================

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 創建空白配置
 */
function createEmptyConfig(
  scope: ConfigScope,
  companyId: string | null,
  formatId: string | null
): VisualMappingConfig {
  return {
    id: generateId(),
    scope,
    companyId,
    documentFormatId: formatId,
    name: getConfigName(scope, companyId, formatId),
    description: '',
    rules: [],
    isActive: true,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 生成配置名稱
 */
function getConfigName(
  scope: ConfigScope,
  companyId: string | null,
  formatId: string | null
): string {
  switch (scope) {
    case 'GLOBAL':
      return '全域映射配置';
    case 'COMPANY':
      return `公司映射配置 (${companyId || '未選擇'})`;
    case 'FORMAT':
      return `格式映射配置 (${formatId || '未選擇'})`;
  }
}

// ============================================================
// Component
// ============================================================

/**
 * 映射配置主面板
 *
 * @description
 *   提供完整的映射配置管理功能，包含範圍選擇、
 *   規則管理、和預覽功能。
 *
 * @example
 * ```tsx
 * <MappingConfigPanel
 *   initialConfig={config}
 *   sourceFields={extractedFields}
 *   targetFields={systemFields}
 *   previewData={previewRows}
 *   onSave={handleSaveConfig}
 *   onRefreshPreview={handleRefresh}
 * />
 * ```
 */
export function MappingConfigPanel({
  initialConfig,
  sourceFields,
  targetFields,
  previewData = [],
  isLoading = false,
  isSaving = false,
  isLoadingPreview = false,
  onSave,
  onChange,
  onRefreshPreview,
  onScopeChange,
  className,
}: MappingConfigPanelProps) {
  // --- State ---
  const [scope, setScope] = React.useState<ConfigScope>(
    initialConfig?.scope ?? 'GLOBAL'
  );
  const [companyId, setCompanyId] = React.useState<string | null>(
    initialConfig?.companyId ?? null
  );
  const [formatId, setFormatId] = React.useState<string | null>(
    initialConfig?.documentFormatId ?? null
  );
  const [config, setConfig] = React.useState<VisualMappingConfig>(() =>
    initialConfig ?? createEmptyConfig('GLOBAL', null, null)
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'rules' | 'preview'>('rules');

  // Rule Editor State
  const [isEditorOpen, setIsEditorOpen] = React.useState(false);
  const [editorMode, setEditorMode] = React.useState<EditorMode>('create');
  const [editingRule, setEditingRule] = React.useState<VisualMappingRule | null>(null);

  // Confirmation Dialog State
  const [showDiscardDialog, setShowDiscardDialog] = React.useState(false);
  const [pendingScopeChange, setPendingScopeChange] = React.useState<{
    scope: ConfigScope;
    companyId: string | null;
    formatId: string | null;
  } | null>(null);

  // --- Sync with initial config ---
  React.useEffect(() => {
    if (initialConfig) {
      setConfig(initialConfig);
      setScope(initialConfig.scope);
      setCompanyId(initialConfig.companyId ?? null);
      setFormatId(initialConfig.documentFormatId ?? null);
      setHasUnsavedChanges(false);
    }
  }, [initialConfig]);

  // --- Derived State ---
  const rules = config.rules;
  const activeRulesCount = rules.filter((r) => r.isActive).length;
  const inactiveRulesCount = rules.filter((r) => !r.isActive).length;

  // --- Handlers: Scope Changes ---
  const handleScopeChangeRequest = React.useCallback(
    (newScope: ConfigScope) => {
      const change = { scope: newScope, companyId, formatId };
      if (hasUnsavedChanges) {
        setPendingScopeChange(change);
        setShowDiscardDialog(true);
      } else {
        setScope(newScope);
        onScopeChange?.(newScope, companyId, formatId);
      }
    },
    [hasUnsavedChanges, companyId, formatId, onScopeChange]
  );

  const handleCompanyChangeRequest = React.useCallback(
    (newCompanyId: string | null) => {
      const change = { scope, companyId: newCompanyId, formatId };
      if (hasUnsavedChanges) {
        setPendingScopeChange(change);
        setShowDiscardDialog(true);
      } else {
        setCompanyId(newCompanyId);
        onScopeChange?.(scope, newCompanyId, formatId);
      }
    },
    [hasUnsavedChanges, scope, formatId, onScopeChange]
  );

  const handleFormatChangeRequest = React.useCallback(
    (newFormatId: string | null) => {
      const change = { scope, companyId, formatId: newFormatId };
      if (hasUnsavedChanges) {
        setPendingScopeChange(change);
        setShowDiscardDialog(true);
      } else {
        setFormatId(newFormatId);
        onScopeChange?.(scope, companyId, newFormatId);
      }
    },
    [hasUnsavedChanges, scope, companyId, onScopeChange]
  );

  const handleConfirmDiscard = React.useCallback(() => {
    if (pendingScopeChange) {
      setScope(pendingScopeChange.scope);
      setCompanyId(pendingScopeChange.companyId);
      setFormatId(pendingScopeChange.formatId);
      setHasUnsavedChanges(false);
      onScopeChange?.(
        pendingScopeChange.scope,
        pendingScopeChange.companyId,
        pendingScopeChange.formatId
      );
    }
    setShowDiscardDialog(false);
    setPendingScopeChange(null);
  }, [pendingScopeChange, onScopeChange]);

  const handleCancelDiscard = React.useCallback(() => {
    setShowDiscardDialog(false);
    setPendingScopeChange(null);
  }, []);

  // --- Handlers: Config Updates ---
  const updateConfig = React.useCallback(
    (updater: (prev: VisualMappingConfig) => VisualMappingConfig) => {
      setConfig((prev) => {
        const updated = updater(prev);
        updated.updatedAt = new Date().toISOString();
        onChange?.(updated);
        return updated;
      });
      setHasUnsavedChanges(true);
    },
    [onChange]
  );

  // --- Handlers: Rule CRUD ---
  const handleAddRule = React.useCallback(() => {
    setEditorMode('create');
    setEditingRule(null);
    setIsEditorOpen(true);
  }, []);

  const handleEditRule = React.useCallback((rule: VisualMappingRule) => {
    setEditorMode('edit');
    setEditingRule(rule);
    setIsEditorOpen(true);
  }, []);

  const handleDeleteRule = React.useCallback(
    (ruleId: string) => {
      updateConfig((prev) => ({
        ...prev,
        rules: prev.rules
          .filter((r) => r.id !== ruleId)
          .map((r, idx) => ({ ...r, priority: idx + 1 })),
      }));
    },
    [updateConfig]
  );

  const handleToggleRuleActive = React.useCallback(
    (ruleId: string, isActive: boolean) => {
      updateConfig((prev) => ({
        ...prev,
        rules: prev.rules.map((r) =>
          r.id === ruleId ? { ...r, isActive } : r
        ),
      }));
    },
    [updateConfig]
  );

  const handleReorderRules = React.useCallback(
    (reorderedRules: VisualMappingRule[]) => {
      updateConfig((prev) => ({
        ...prev,
        rules: reorderedRules,
      }));
    },
    [updateConfig]
  );

  const handleSaveRule = React.useCallback(
    (ruleData: RuleEditorSaveData) => {
      if (editorMode === 'create') {
        // Create new rule
        const newRule: VisualMappingRule = {
          id: generateId(),
          configId: config.id,
          sourceFields: ruleData.sourceFields,
          targetField: ruleData.targetField,
          transformType: ruleData.transformType,
          transformParams: ruleData.transformParams,
          priority: rules.length + 1,
          isActive: ruleData.isActive,
          description: undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        updateConfig((prev) => ({
          ...prev,
          rules: [...prev.rules, newRule],
        }));
      } else if (editingRule) {
        // Update existing rule (preserve existing description)
        updateConfig((prev) => ({
          ...prev,
          rules: prev.rules.map((r) =>
            r.id === editingRule.id
              ? {
                  ...r,
                  sourceFields: ruleData.sourceFields,
                  targetField: ruleData.targetField,
                  transformType: ruleData.transformType,
                  transformParams: ruleData.transformParams,
                  isActive: ruleData.isActive,
                  updatedAt: new Date().toISOString(),
                }
              : r
          ),
        }));
      }
      setIsEditorOpen(false);
      setEditingRule(null);
    },
    [editorMode, editingRule, config.id, rules.length, updateConfig]
  );

  const handleCancelEdit = React.useCallback(() => {
    setIsEditorOpen(false);
    setEditingRule(null);
  }, []);

  // --- Handlers: Save ---
  const handleSave = React.useCallback(() => {
    const updatedConfig: VisualMappingConfig = {
      ...config,
      scope,
      companyId,
      documentFormatId: formatId,
      name: getConfigName(scope, companyId, formatId),
      updatedAt: new Date().toISOString(),
    };
    onSave?.(updatedConfig);
    setHasUnsavedChanges(false);
  }, [config, scope, companyId, formatId, onSave]);

  const handleReset = React.useCallback(() => {
    if (initialConfig) {
      setConfig(initialConfig);
      setScope(initialConfig.scope);
      setCompanyId(initialConfig.companyId ?? null);
      setFormatId(initialConfig.documentFormatId ?? null);
    } else {
      setConfig(createEmptyConfig(scope, companyId, formatId));
    }
    setHasUnsavedChanges(false);
  }, [initialConfig, scope, companyId, formatId]);

  // --- Loading State ---
  if (isLoading) {
    return (
      <Card className={cn('', className)}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  // --- Render ---
  return (
    <>
      <Card className={cn('', className)}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                欄位映射配置
                {hasUnsavedChanges && (
                  <Badge variant="outline" className="text-orange-500 border-orange-500">
                    未儲存
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                設定來源欄位與目標欄位的映射規則，支援多種轉換類型。
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={!hasUnsavedChanges || isSaving}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                重設
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!hasUnsavedChanges || isSaving}
              >
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                儲存
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* 配置範圍選擇 */}
          <ConfigSelector
            scope={scope}
            companyId={companyId}
            documentFormatId={formatId}
            onScopeChange={handleScopeChangeRequest}
            onCompanyChange={handleCompanyChangeRequest}
            onDocumentFormatChange={handleFormatChangeRequest}
            disabled={isSaving}
          />

          {/* 頁籤：規則 / 預覽 */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'rules' | 'preview')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="rules" className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                映射規則
                <Badge variant="secondary" className="ml-1">
                  {rules.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                預覽結果
              </TabsTrigger>
            </TabsList>

            {/* 規則列表 */}
            <TabsContent value="rules" className="mt-4">
              <MappingRuleList
                rules={rules}
                onReorder={handleReorderRules}
                onEdit={handleEditRule}
                onDelete={handleDeleteRule}
                onToggleActive={handleToggleRuleActive}
                onAdd={handleAddRule}
                disabled={isSaving}
              />

              {/* 規則統計 */}
              {rules.length > 0 && (
                <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                  <span>
                    啟用中: <strong>{activeRulesCount}</strong>
                  </span>
                  {inactiveRulesCount > 0 && (
                    <span>
                      已停用: <strong>{inactiveRulesCount}</strong>
                    </span>
                  )}
                </div>
              )}
            </TabsContent>

            {/* 預覽結果 */}
            <TabsContent value="preview" className="mt-4">
              <MappingPreview
                rules={rules}
                sourceFields={sourceFields}
                targetFields={targetFields}
                previewData={previewData}
                isLoading={isLoadingPreview}
                onRefresh={onRefreshPreview}
                isRefreshing={isLoadingPreview}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 規則編輯對話框 */}
      <RuleEditor
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        mode={editorMode}
        initialRule={editingRule ?? undefined}
        sourceFields={sourceFields}
        targetFields={targetFields}
        onSave={handleSaveRule}
        onCancel={handleCancelEdit}
        isSaving={isSaving}
      />

      {/* 放棄變更確認對話框 */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>放棄未儲存的變更？</AlertDialogTitle>
            <AlertDialogDescription>
              您有未儲存的變更。切換配置範圍將會遺失這些變更。確定要繼續嗎？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDiscard}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDiscard}>
              放棄變更
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
