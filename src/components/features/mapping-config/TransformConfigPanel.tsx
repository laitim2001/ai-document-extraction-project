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
 * 轉換類型說明
 */
const TRANSFORM_DESCRIPTIONS: Record<TransformType, string> = {
  DIRECT: '直接映射：將來源欄位值直接對應到目標欄位，不進行任何轉換。',
  CONCAT: '串接：將多個來源欄位的值依序串接，可指定分隔符。',
  SPLIT: '分割：將來源欄位值按分隔符拆分，選取指定索引的部分。',
  LOOKUP: '查找：根據來源欄位值在查找表中尋找對應的目標值。',
  CUSTOM: '自訂：使用自訂公式進行複雜的值轉換。',
};

/**
 * 空值處理選項
 */
const NULL_HANDLING_OPTIONS = [
  { value: 'skip', label: '跳過空值', description: '忽略空值，不加入串接結果' },
  { value: 'empty', label: '保留為空', description: '空值以空字串加入' },
  { value: 'default', label: '使用預設值', description: '空值替換為預設值' },
] as const;

/**
 * 常用分隔符
 */
const COMMON_DELIMITERS = [
  { value: ' ', label: '空格' },
  { value: ', ', label: '逗號+空格' },
  { value: '-', label: '連字符 (-)' },
  { value: '/', label: '斜線 (/)' },
  { value: '_', label: '底線 (_)' },
  { value: '|', label: '豎線 (|)' },
] as const;

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
function DirectConfig() {
  return (
    <Alert>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        直接映射不需要額外配置，來源欄位值將直接對應到目標欄位。
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
}: {
  params: TransformParams;
  onChange: (params: TransformParams) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* 分隔符 */}
      <div className="space-y-2">
        <FieldLabel
          label="分隔符"
          tooltip="串接多個欄位值時使用的分隔符號"
        />
        <div className="flex gap-2">
          <Select
            value={params.delimiter ?? ' '}
            onValueChange={(value) => onChange({ ...params, delimiter: value })}
            disabled={disabled}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="選擇分隔符" />
            </SelectTrigger>
            <SelectContent>
              {COMMON_DELIMITERS.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="或自訂分隔符"
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
          label="空值處理"
          tooltip="當來源欄位值為空時的處理方式"
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
            <SelectValue placeholder="選擇處理方式" />
          </SelectTrigger>
          <SelectContent>
            {NULL_HANDLING_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <div className="flex flex-col">
                  <span>{opt.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {opt.description}
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
            label="預設值"
            tooltip="空值時使用的替代值"
            required
          />
          <Input
            placeholder="輸入預設值"
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
}: {
  params: TransformParams;
  onChange: (params: TransformParams) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* 分隔符 */}
      <div className="space-y-2">
        <FieldLabel
          label="分隔符"
          tooltip="用於拆分來源欄位值的分隔符號"
          required
        />
        <div className="flex gap-2">
          <Select
            value={params.delimiter ?? ''}
            onValueChange={(value) => onChange({ ...params, delimiter: value })}
            disabled={disabled}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="選擇分隔符" />
            </SelectTrigger>
            <SelectContent>
              {COMMON_DELIMITERS.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="或自訂分隔符"
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
          label="取用索引"
          tooltip="拆分後取用第幾個部分（從 0 開始）"
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
          label="保留全部"
          tooltip="勾選後將保留所有拆分結果（以陣列形式）"
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
}: {
  params: TransformParams;
  onChange: (params: TransformParams) => void;
  disabled?: boolean;
}) {
  // TODO: 從 API 獲取可用的查找表列表
  const lookupTables: LookupTableOption[] = [
    { id: 'currency', name: '貨幣代碼轉換表' },
    { id: 'country', name: '國家代碼轉換表' },
    { id: 'unit', name: '單位轉換表' },
  ];

  return (
    <div className="space-y-4">
      {/* 查找表 */}
      <div className="space-y-2">
        <FieldLabel
          label="查找表"
          tooltip="選擇用於值轉換的查找表"
          required
        />
        <Select
          value={params.lookupTableId ?? ''}
          onValueChange={(value) => onChange({ ...params, lookupTableId: value })}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="選擇查找表" />
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
          label="預設值"
          tooltip="當查找表中找不到對應值時使用的預設值"
        />
        <Input
          placeholder="輸入預設值（可選）"
          value={params.defaultValue ?? ''}
          onChange={(e) => onChange({ ...params, defaultValue: e.target.value })}
          disabled={disabled}
        />
      </div>

      {/* 區分大小寫 */}
      <div className="flex items-center justify-between">
        <FieldLabel
          label="區分大小寫"
          tooltip="查找時是否區分英文字母大小寫"
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
}: {
  params: TransformParams;
  onChange: (params: TransformParams) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* 公式輸入 */}
      <div className="space-y-2">
        <FieldLabel
          label="自訂公式"
          tooltip="使用 JavaScript 表達式進行值轉換。可使用 $value 取得來源值，$fields 取得所有欄位。"
          required
        />
        <Textarea
          placeholder={`範例：
// 取來源值前 10 字元
$value.substring(0, 10)

// 組合多個欄位
$fields['firstName'] + ' ' + $fields['lastName']

// 條件轉換
$value > 1000 ? 'high' : 'low'`}
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
          <strong>可用變數：</strong>
          <ul className="mt-1 list-disc list-inside">
            <li><code>$value</code> - 來源欄位值</li>
            <li><code>$fields</code> - 所有欄位的鍵值對</li>
            <li><code>$index</code> - 當前行索引</li>
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
  // --- Render Config Panel Based on Type ---
  const renderConfigPanel = () => {
    switch (transformType) {
      case 'DIRECT':
        return <DirectConfig />;
      case 'CONCAT':
        return <ConcatConfig params={params} onChange={onChange} disabled={disabled} />;
      case 'SPLIT':
        return <SplitConfig params={params} onChange={onChange} disabled={disabled} />;
      case 'LOOKUP':
        return <LookupConfig params={params} onChange={onChange} disabled={disabled} />;
      case 'CUSTOM':
        return <CustomConfig params={params} onChange={onChange} disabled={disabled} />;
      default:
        return null;
    }
  };

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">轉換參數配置</CardTitle>
        <CardDescription className="text-sm">
          {TRANSFORM_DESCRIPTIONS[transformType]}
        </CardDescription>
      </CardHeader>
      <CardContent>{renderConfigPanel()}</CardContent>
    </Card>
  );
}
