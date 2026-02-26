'use client';

/**
 * @fileoverview 轉換參數配置面板組件
 * @description
 *   根據不同轉換類型提供對應的參數配置介面：
 *   - DIRECT: 無需額外配置
 *   - CONCAT: 分隔符、空值處理
 *   - SPLIT: 分隔符、索引、保留全部
 *   - LOOKUP: 查找表、預設值、區分大小寫
 *   - CUSTOM: 自訂公式
 *
 * @module src/components/features/mapping-config/TransformConfigPanel
 * @since Epic 13 - Story 13.3
 * @lastModified 2026-01-02
 *
 * @features
 *   - 動態配置表單
 *   - 轉換類型專屬參數
 *   - 即時驗證
 *   - 預設值支援
 *
 * @dependencies
 *   - @/components/ui/* - UI 組件
 *   - @/types/field-mapping - 類型定義
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Info, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { TransformType, TransformParams } from '@/types/field-mapping';
import { cn } from '@/lib/utils';

// ============================================================
// Types
// ============================================================

/**
 * TransformConfigPanel 組件屬性
 */
export interface TransformConfigPanelProps {
  /** 轉換類型 */
  transformType: TransformType;
  /** 轉換參數 */
  params: TransformParams;
  /** 參數變更回調 */
  onChange: (params: TransformParams) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自訂類名 */
  className?: string;
}

/**
 * 查找表選項
 */
interface LookupTableOption {
  id: string;
  name: string;
}

// ============================================================
// Constants
// ============================================================

/**
 * 分隔符值映射（用於翻譯 key）
 */
const DELIMITER_KEYS = [
  { value: ' ', key: 'space' },
  { value: ', ', key: 'commaSpace' },
  { value: '-', key: 'hyphen' },
  { value: '/', key: 'slash' },
  { value: '_', key: 'underscore' },
  { value: '|', key: 'pipe' },
] as const;

/**
 * 空值處理選項 key
 */
const NULL_HANDLING_KEYS = ['skip', 'empty', 'default'] as const;

// ============================================================
// Sub-Components
// ============================================================

/**
 * 欄位標籤帶提示
 */
function FieldLabel({
  label,
  tooltip,
  required = false,
}: {
  label: string;
  tooltip?: string;
  required?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {tooltip && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs text-sm">{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

// ============================================================
// Config Panels for Each Transform Type
// ============================================================

/**
 * DIRECT 轉換配置（無需配置）
 */
function DirectConfig({
  t,
}: {
  t: ReturnType<typeof useTranslations<'documentPreview'>>
}) {
  return (
    <Alert>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        {t('transformConfig.directHint')}
      </AlertDescription>
    </Alert>
  );
}

/**
 * CONCAT 轉換配置
 */
function ConcatConfig({
  params,
  onChange,
  disabled,
  t,
}: {
  params: TransformParams;
  onChange: (params: TransformParams) => void;
  disabled?: boolean;
  t: ReturnType<typeof useTranslations<'documentPreview'>>
}) {
  return (
    <div className="space-y-4">
      {/* 分隔符 */}
      <div className="space-y-2">
        <FieldLabel
          label={t('transformConfig.delimiter.label')}
          tooltip={t('transformConfig.delimiter.tooltip')}
        />
        <div className="flex gap-2">
          <Select
            value={params.delimiter ?? ' '}
            onValueChange={(value) => onChange({ ...params, delimiter: value })}
            disabled={disabled}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t('transformConfig.delimiter.placeholder')} />
            </SelectTrigger>
            <SelectContent>
              {DELIMITER_KEYS.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {t(`transformConfig.delimiters.${d.key}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder={t('transformConfig.delimiter.customPlaceholder')}
            value={params.delimiter ?? ''}
            onChange={(e) => onChange({ ...params, delimiter: e.target.value })}
            disabled={disabled}
            className="flex-1"
          />
        </div>
      </div>

      {/* 空值處理 */}
      <div className="space-y-2">
        <FieldLabel
          label={t('transformConfig.nullHandling.label')}
          tooltip={t('transformConfig.nullHandling.tooltip')}
        />
        <Select
          value={params.nullHandling ?? 'skip'}
          onValueChange={(value) =>
            onChange({
              ...params,
              nullHandling: value as TransformParams['nullHandling'],
            })
          }
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('transformConfig.nullHandling.placeholder')} />
          </SelectTrigger>
          <SelectContent>
            {NULL_HANDLING_KEYS.map((key) => (
              <SelectItem key={key} value={key}>
                <div className="flex flex-col">
                  <span>{t(`transformConfig.nullHandling.${key}`)}</span>
                  <span className="text-xs text-muted-foreground">
                    {t(`transformConfig.nullHandling.${key}Desc`)}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 預設值（當選擇 default 時顯示）*/}
      {params.nullHandling === 'default' && (
        <div className="space-y-2">
          <FieldLabel
            label={t('transformConfig.defaultValue.label')}
            tooltip={t('transformConfig.defaultValue.tooltip')}
            required
          />
          <Input
            placeholder={t('transformConfig.defaultValue.placeholder')}
            value={params.defaultValue ?? ''}
            onChange={(e) => onChange({ ...params, defaultValue: e.target.value })}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}

/**
 * SPLIT 轉換配置
 */
function SplitConfig({
  params,
  onChange,
  disabled,
  t,
}: {
  params: TransformParams;
  onChange: (params: TransformParams) => void;
  disabled?: boolean;
  t: ReturnType<typeof useTranslations<'documentPreview'>>
}) {
  return (
    <div className="space-y-4">
      {/* 分隔符 */}
      <div className="space-y-2">
        <FieldLabel
          label={t('transformConfig.delimiter.label')}
          tooltip={t('transformConfig.delimiter.splitTooltip')}
          required
        />
        <div className="flex gap-2">
          <Select
            value={params.delimiter ?? ''}
            onValueChange={(value) => onChange({ ...params, delimiter: value })}
            disabled={disabled}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t('transformConfig.delimiter.placeholder')} />
            </SelectTrigger>
            <SelectContent>
              {DELIMITER_KEYS.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {t(`transformConfig.delimiters.${d.key}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder={t('transformConfig.delimiter.customPlaceholder')}
            value={params.delimiter ?? ''}
            onChange={(e) => onChange({ ...params, delimiter: e.target.value })}
            disabled={disabled}
            className="flex-1"
          />
        </div>
      </div>

      {/* 索引位置 */}
      <div className="space-y-2">
        <FieldLabel
          label={t('transformConfig.splitIndex.label')}
          tooltip={t('transformConfig.splitIndex.tooltip')}
        />
        <Input
          type="number"
          min={0}
          placeholder="0"
          value={params.splitIndex ?? 0}
          onChange={(e) =>
            onChange({ ...params, splitIndex: parseInt(e.target.value) || 0 })
          }
          disabled={disabled || params.keepAll}
          className="w-[120px]"
        />
      </div>

      {/* 保留全部 */}
      <div className="flex items-center justify-between">
        <FieldLabel
          label={t('transformConfig.keepAll.label')}
          tooltip={t('transformConfig.keepAll.tooltip')}
        />
        <Switch
          checked={params.keepAll ?? false}
          onCheckedChange={(checked) => onChange({ ...params, keepAll: checked })}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

/**
 * LOOKUP 轉換配置
 */
function LookupConfig({
  params,
  onChange,
  disabled,
  t,
}: {
  params: TransformParams;
  onChange: (params: TransformParams) => void;
  disabled?: boolean;
  t: ReturnType<typeof useTranslations<'documentPreview'>>
}) {
  // TODO: 從 API 獲取可用的查找表列表
  const lookupTables: LookupTableOption[] = [
    { id: 'currency', name: t('transformConfig.lookupTable.currency') },
    { id: 'country', name: t('transformConfig.lookupTable.country') },
    { id: 'unit', name: t('transformConfig.lookupTable.unit') },
  ];

  return (
    <div className="space-y-4">
      {/* 查找表 */}
      <div className="space-y-2">
        <FieldLabel
          label={t('transformConfig.lookupTable.label')}
          tooltip={t('transformConfig.lookupTable.tooltip')}
          required
        />
        <Select
          value={params.lookupTableId ?? ''}
          onValueChange={(value) => onChange({ ...params, lookupTableId: value })}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('transformConfig.lookupTable.placeholder')} />
          </SelectTrigger>
          <SelectContent>
            {lookupTables.map((table) => (
              <SelectItem key={table.id} value={table.id}>
                {table.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 預設值 */}
      <div className="space-y-2">
        <FieldLabel
          label={t('transformConfig.defaultValue.label')}
          tooltip={t('transformConfig.defaultValue.lookupTooltip')}
        />
        <Input
          placeholder={t('transformConfig.defaultValue.optionalPlaceholder')}
          value={params.defaultValue ?? ''}
          onChange={(e) => onChange({ ...params, defaultValue: e.target.value })}
          disabled={disabled}
        />
      </div>

      {/* 區分大小寫 */}
      <div className="flex items-center justify-between">
        <FieldLabel
          label={t('transformConfig.caseSensitive.label')}
          tooltip={t('transformConfig.caseSensitive.tooltip')}
        />
        <Switch
          checked={params.caseSensitive ?? false}
          onCheckedChange={(checked) =>
            onChange({ ...params, caseSensitive: checked })
          }
          disabled={disabled}
        />
      </div>
    </div>
  );
}

/**
 * CUSTOM 轉換配置
 */
function CustomConfig({
  params,
  onChange,
  disabled,
  t,
}: {
  params: TransformParams;
  onChange: (params: TransformParams) => void;
  disabled?: boolean;
  t: ReturnType<typeof useTranslations<'documentPreview'>>
}) {
  return (
    <div className="space-y-4">
      {/* 公式輸入 */}
      <div className="space-y-2">
        <FieldLabel
          label={t('transformConfig.customFormula.label')}
          tooltip={t('transformConfig.customFormula.tooltip')}
          required
        />
        <Textarea
          placeholder={t('transformConfig.customFormula.placeholder')}
          value={params.customFormula ?? ''}
          onChange={(e) =>
            onChange({ ...params, customFormula: e.target.value })
          }
          disabled={disabled}
          className="font-mono text-sm min-h-[120px]"
        />
      </div>

      {/* 提示 */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <strong>{t('transformConfig.customFormula.availableVariables')}</strong>
          <ul className="mt-1 list-disc list-inside">
            <li><code>{t('transformConfig.customFormula.varValue')}</code></li>
            <li><code>{t('transformConfig.customFormula.varFields')}</code></li>
            <li><code>{t('transformConfig.customFormula.varIndex')}</code></li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

/**
 * 轉換參數配置面板
 *
 * @description
 *   根據選擇的轉換類型顯示對應的配置表單。
 *   支援五種轉換類型：DIRECT、CONCAT、SPLIT、LOOKUP、CUSTOM。
 *
 * @example
 * ```tsx
 * <TransformConfigPanel
 *   transformType={rule.transformType}
 *   params={rule.transformParams}
 *   onChange={(params) => updateRule({ transformParams: params })}
 * />
 * ```
 */
export function TransformConfigPanel({
  transformType,
  params,
  onChange,
  disabled = false,
  className,
}: TransformConfigPanelProps) {
  // --- i18n ---
  const t = useTranslations('documentPreview');

  // --- Render Config Panel Based on Type ---
  const renderConfigPanel = () => {
    switch (transformType) {
      case 'DIRECT':
        return <DirectConfig t={t} />;
      case 'CONCAT':
        return <ConcatConfig params={params} onChange={onChange} disabled={disabled} t={t} />;
      case 'SPLIT':
        return <SplitConfig params={params} onChange={onChange} disabled={disabled} t={t} />;
      case 'LOOKUP':
        return <LookupConfig params={params} onChange={onChange} disabled={disabled} t={t} />;
      case 'CUSTOM':
        return <CustomConfig params={params} onChange={onChange} disabled={disabled} t={t} />;
      default:
        return null;
    }
  };

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('transformConfig.title')}</CardTitle>
        <CardDescription className="text-sm">
          {t(`transformConfig.descriptions.${transformType}`)}
        </CardDescription>
      </CardHeader>
      <CardContent>{renderConfigPanel()}</CardContent>
    </Card>
  );
}
