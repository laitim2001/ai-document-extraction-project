'use client';

/**
 * @fileoverview 規則編輯對話框組件
 * @description
 *   提供映射規則的新增和編輯功能：
 *   - 來源欄位選擇（支援多選）
 *   - 目標欄位選擇（單選）
 *   - 轉換類型選擇
 *   - 轉換參數配置
 *   - 表單驗證
 *
 * @module src/components/features/mapping-config/RuleEditor
 * @since Epic 13 - Story 13.3
 * @lastModified 2026-01-19
 *
 * @features
 *   - 新增/編輯模式
 *   - 完整表單驗證
 *   - 動態轉換參數
 *   - 即時預覽
 *   - 國際化支援
 *
 * @dependencies
 *   - @/components/ui/* - UI 組件
 *   - @/types/field-mapping - 類型定義
 *   - ./SourceFieldSelector - 來源欄位選擇器
 *   - ./TargetFieldSelector - 目標欄位選擇器
 *   - ./TransformConfigPanel - 轉換參數面板
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Save, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import type {
  VisualMappingRule,
  SourceFieldDefinition,
  TargetFieldDefinition,
  TransformType,
  TransformParams,
} from '@/types/field-mapping';
import { SourceFieldSelector } from './SourceFieldSelector';
import { TargetFieldSelector } from './TargetFieldSelector';
import { TransformConfigPanel } from './TransformConfigPanel';

// ============================================================
// Types
// ============================================================

/**
 * 規則編輯器儲存數據（表單輸出）
 */
export interface RuleEditorSaveData {
  sourceFields: string[];
  targetField: string;
  transformType: TransformType;
  transformParams: TransformParams;
  isActive: boolean;
}

/**
 * RuleEditor 組件屬性
 */
export interface RuleEditorProps {
  /** 是否顯示對話框 */
  open: boolean;
  /** 關閉對話框回調 */
  onOpenChange: (open: boolean) => void;
  /** 編輯模式：新增或編輯 */
  mode: 'create' | 'edit';
  /** 編輯時的初始規則數據 */
  initialRule?: Partial<VisualMappingRule>;
  /** 可用的來源欄位列表 */
  sourceFields: SourceFieldDefinition[];
  /** 可用的目標欄位列表 */
  targetFields: TargetFieldDefinition[];
  /** 儲存回調（返回表單數據，不含 id/configId/priority/timestamps） */
  onSave: (data: RuleEditorSaveData) => void;
  /** 取消回調 */
  onCancel?: () => void;
  /** 是否正在儲存 */
  isSaving?: boolean;
}

/**
 * 表單狀態
 */
interface FormState {
  sourceFields: string[];
  targetField: string | null;
  transformType: TransformType;
  transformParams: TransformParams;
  isActive: boolean;
}

/**
 * 驗證錯誤
 */
interface ValidationErrors {
  sourceFields?: string;
  targetField?: string;
  transformParams?: string;
}

// ============================================================
// Constants
// ============================================================

/**
 * 轉換類型選項（翻譯 key 和是否支援多來源）
 */
const TRANSFORM_TYPE_OPTIONS: Array<{
  value: TransformType;
  allowMultiSource: boolean;
}> = [
  { value: 'DIRECT', allowMultiSource: false },
  { value: 'CONCAT', allowMultiSource: true },
  { value: 'SPLIT', allowMultiSource: false },
  { value: 'LOOKUP', allowMultiSource: false },
  { value: 'CUSTOM', allowMultiSource: true },
];

/**
 * 初始表單狀態
 */
const INITIAL_FORM_STATE: FormState = {
  sourceFields: [],
  targetField: null,
  transformType: 'DIRECT',
  transformParams: {},
  isActive: true,
};

// ============================================================
// Helper Functions
// ============================================================

/**
 * 驗證表單（國際化版本）
 */
function validateForm(
  state: FormState,
  transformTypeConfig: (typeof TRANSFORM_TYPE_OPTIONS)[number],
  t: ReturnType<typeof useTranslations<'documentPreview'>>
): ValidationErrors {
  const errors: ValidationErrors = {};

  // 驗證來源欄位
  if (state.sourceFields.length === 0) {
    errors.sourceFields = t('ruleEditor.validation.sourceFieldsRequired');
  } else if (!transformTypeConfig.allowMultiSource && state.sourceFields.length > 1) {
    errors.sourceFields = t('ruleEditor.validation.sourceFieldsSingleOnly', {
      type: t(`ruleEditor.transformTypes.${state.transformType}.label`),
    });
  }

  // 驗證目標欄位
  if (!state.targetField) {
    errors.targetField = t('ruleEditor.validation.targetFieldRequired');
  }

  // 驗證轉換參數
  if (state.transformType === 'SPLIT' && !state.transformParams.delimiter) {
    errors.transformParams = t('ruleEditor.validation.delimiterRequired');
  }
  if (state.transformType === 'LOOKUP' && !state.transformParams.lookupTableId) {
    errors.transformParams = t('ruleEditor.validation.lookupTableRequired');
  }
  if (state.transformType === 'CUSTOM' && !state.transformParams.customFormula?.trim()) {
    errors.transformParams = t('ruleEditor.validation.formulaRequired');
  }

  return errors;
}

// ============================================================
// Component
// ============================================================

/**
 * 規則編輯對話框
 *
 * @description
 *   提供映射規則的完整編輯功能，包含來源欄位選擇、
 *   目標欄位選擇、轉換類型和參數配置。
 *
 * @example
 * ```tsx
 * <RuleEditor
 *   open={isEditorOpen}
 *   onOpenChange={setIsEditorOpen}
 *   mode="create"
 *   sourceFields={extractedFields}
 *   targetFields={systemFields}
 *   onSave={handleSaveRule}
 * />
 * ```
 */
export function RuleEditor({
  open,
  onOpenChange,
  mode,
  initialRule,
  sourceFields,
  targetFields,
  onSave,
  onCancel,
  isSaving = false,
}: RuleEditorProps) {
  // --- i18n ---
  const t = useTranslations('documentPreview');

  // --- State ---
  const [formState, setFormState] = React.useState<FormState>(INITIAL_FORM_STATE);
  const [errors, setErrors] = React.useState<ValidationErrors>({});
  const [touched, setTouched] = React.useState<Set<string>>(new Set());

  // --- Derived State ---
  const transformTypeConfig = React.useMemo(
    () =>
      TRANSFORM_TYPE_OPTIONS.find((opt) => opt.value === formState.transformType) ??
      TRANSFORM_TYPE_OPTIONS[0],
    [formState.transformType]
  );

  const hasErrors = Object.keys(errors).length > 0;

  // --- Initialize form when opening ---
  React.useEffect(() => {
    if (open) {
      if (mode === 'edit' && initialRule) {
        setFormState({
          sourceFields: initialRule.sourceFields ?? [],
          targetField: initialRule.targetField ?? null,
          transformType: initialRule.transformType ?? 'DIRECT',
          transformParams: initialRule.transformParams ?? {},
          isActive: initialRule.isActive ?? true,
        });
      } else {
        setFormState(INITIAL_FORM_STATE);
      }
      setErrors({});
      setTouched(new Set());
    }
  }, [open, mode, initialRule]);

  // --- Validate on change ---
  React.useEffect(() => {
    if (touched.size > 0) {
      const newErrors = validateForm(formState, transformTypeConfig, t);
      setErrors(newErrors);
    }
  }, [formState, transformTypeConfig, touched, t]);

  // --- Handlers ---
  const handleSourceFieldsChange = React.useCallback((fields: string[]) => {
    setFormState((prev) => ({ ...prev, sourceFields: fields }));
    setTouched((prev) => new Set(prev).add('sourceFields'));
  }, []);

  const handleTargetFieldChange = React.useCallback((field: string | null) => {
    setFormState((prev) => ({ ...prev, targetField: field }));
    setTouched((prev) => new Set(prev).add('targetField'));
  }, []);

  const handleTransformTypeChange = React.useCallback((type: TransformType) => {
    setFormState((prev) => ({
      ...prev,
      transformType: type,
      // 切換類型時重置參數
      transformParams: {},
      // 如果新類型不支援多選，保留第一個來源欄位
      sourceFields:
        !TRANSFORM_TYPE_OPTIONS.find((opt) => opt.value === type)?.allowMultiSource &&
        prev.sourceFields.length > 1
          ? [prev.sourceFields[0]]
          : prev.sourceFields,
    }));
    setTouched((prev) => new Set(prev).add('transformType'));
  }, []);

  const handleTransformParamsChange = React.useCallback((params: TransformParams) => {
    setFormState((prev) => ({ ...prev, transformParams: params }));
    setTouched((prev) => new Set(prev).add('transformParams'));
  }, []);

  const handleSave = React.useCallback(() => {
    // 標記所有欄位為已觸碰
    setTouched(new Set(['sourceFields', 'targetField', 'transformParams']));

    // 驗證
    const validationErrors = validateForm(formState, transformTypeConfig, t);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    // 儲存
    onSave({
      sourceFields: formState.sourceFields,
      targetField: formState.targetField!,
      transformType: formState.transformType,
      transformParams: formState.transformParams,
      isActive: formState.isActive,
    });
  }, [formState, transformTypeConfig, onSave]);

  const handleCancel = React.useCallback(() => {
    onCancel?.();
    onOpenChange(false);
  }, [onCancel, onOpenChange]);

  // --- Render ---
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? t('ruleEditor.title.create') : t('ruleEditor.title.edit')}
          </DialogTitle>
          <DialogDescription>
            {t('ruleEditor.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 錯誤提示 */}
          {hasErrors && touched.size > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('ruleEditor.validation.title')}</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside text-sm">
                  {errors.sourceFields && <li>{errors.sourceFields}</li>}
                  {errors.targetField && <li>{errors.targetField}</li>}
                  {errors.transformParams && <li>{errors.transformParams}</li>}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* 來源欄位 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {t('ruleEditor.sourceFields.label')}
              <span className="text-destructive">{t('ruleEditor.sourceFields.required')}</span>
              {transformTypeConfig.allowMultiSource && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {t('ruleEditor.sourceFields.multipleHint')}
                </span>
              )}
            </Label>
            <SourceFieldSelector
              availableFields={sourceFields}
              selectedFields={formState.sourceFields}
              onChange={handleSourceFieldsChange}
              multiple={transformTypeConfig.allowMultiSource}
              disabled={isSaving}
            />
            {errors.sourceFields && touched.has('sourceFields') && (
              <p className="text-sm text-destructive">{errors.sourceFields}</p>
            )}
          </div>

          {/* 目標欄位 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {t('ruleEditor.targetField.label')}
              <span className="text-destructive">{t('ruleEditor.targetField.required')}</span>
            </Label>
            <TargetFieldSelector
              availableFields={targetFields}
              selectedField={formState.targetField}
              onChange={handleTargetFieldChange}
              disabled={isSaving}
            />
            {errors.targetField && touched.has('targetField') && (
              <p className="text-sm text-destructive">{errors.targetField}</p>
            )}
          </div>

          <Separator />

          {/* 轉換類型 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('ruleEditor.transformType.label')}</Label>
            <Select
              value={formState.transformType}
              onValueChange={(value) => handleTransformTypeChange(value as TransformType)}
              disabled={isSaving}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('ruleEditor.transformType.placeholder')} />
              </SelectTrigger>
              <SelectContent>
                {TRANSFORM_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex flex-col">
                      <span>{t(`ruleEditor.transformTypes.${opt.value}.label`)}</span>
                      <span className="text-xs text-muted-foreground">
                        {t(`ruleEditor.transformTypes.${opt.value}.description`)}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 轉換參數 */}
          <TransformConfigPanel
            transformType={formState.transformType}
            params={formState.transformParams}
            onChange={handleTransformParamsChange}
            disabled={isSaving}
          />
          {errors.transformParams && touched.has('transformParams') && (
            <p className="text-sm text-destructive">{errors.transformParams}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
            <X className="mr-2 h-4 w-4" />
            {t('ruleEditor.actions.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? t('ruleEditor.actions.saving') : t('ruleEditor.actions.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
