'use client';

/**
 * @fileoverview 映射配置範圍選擇器組件
 * @description
 *   提供三層映射配置範圍的選擇功能：
 *   - GLOBAL: 通用層（無需額外選擇）
 *   - COMPANY: 公司層（需選擇公司）
 *   - FORMAT: 格式層（需選擇公司和文件格式）
 *
 * @module src/components/features/mapping-config/ConfigSelector
 * @since Epic 13 - Story 13.3
 * @lastModified 2026-01-02
 *
 * @features
 *   - 配置範圍選擇（三層架構）
 *   - 公司下拉選單（當範圍為 COMPANY 或 FORMAT）
 *   - 文件格式下拉選單（當範圍為 FORMAT）
 *   - 響應式表單佈局
 *
 * @dependencies
 *   - @/components/ui/select - 下拉選單組件
 *   - @/hooks/use-companies - 公司選項 Hook
 *   - @/hooks/use-document-formats - 文件格式選項 Hook
 *   - @/types/field-mapping - 類型定義
 */

import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useCompanyOptions } from '@/hooks/use-companies';
import { useDocumentFormatOptions } from '@/hooks/use-document-formats';
import { CONFIG_SCOPE_OPTIONS, type ConfigScope } from '@/types/field-mapping';
import { cn } from '@/lib/utils';

// ============================================================
// Types
// ============================================================

/**
 * ConfigSelector 組件屬性
 */
export interface ConfigSelectorProps {
  /** 當前選擇的範圍 */
  scope: ConfigScope;
  /** 選擇的公司 ID（當範圍為 COMPANY 或 FORMAT） */
  companyId: string | null;
  /** 選擇的文件格式 ID（當範圍為 FORMAT） */
  documentFormatId: string | null;
  /** 範圍變更回調 */
  onScopeChange: (scope: ConfigScope) => void;
  /** 公司變更回調 */
  onCompanyChange: (companyId: string | null) => void;
  /** 文件格式變更回調 */
  onDocumentFormatChange: (formatId: string | null) => void;
  /** 是否禁用（載入中） */
  disabled?: boolean;
  /** 自訂類名 */
  className?: string;
}

// ============================================================
// Component
// ============================================================

/**
 * 映射配置範圍選擇器
 *
 * @description
 *   根據三層映射架構提供配置範圍選擇：
 *   - 通用層 (GLOBAL): 適用於所有公司的預設規則
 *   - 公司層 (COMPANY): 特定公司的覆蓋規則
 *   - 格式層 (FORMAT): 特定文件格式的精確規則
 *
 * @example
 * ```tsx
 * <ConfigSelector
 *   scope="COMPANY"
 *   companyId={selectedCompanyId}
 *   documentFormatId={null}
 *   onScopeChange={handleScopeChange}
 *   onCompanyChange={handleCompanyChange}
 *   onDocumentFormatChange={handleFormatChange}
 * />
 * ```
 */
export function ConfigSelector({
  scope,
  companyId,
  documentFormatId,
  onScopeChange,
  onCompanyChange,
  onDocumentFormatChange,
  disabled = false,
  className,
}: ConfigSelectorProps) {
  // --- Data Fetching ---
  const { data: companiesData, isLoading: isLoadingCompanies } = useCompanyOptions();
  const { formats, isLoading: isLoadingFormats } = useDocumentFormatOptions({
    companyId: companyId || undefined,
    enabled: scope === 'FORMAT' && !!companyId,
  });

  // --- Derived State ---
  const companies = companiesData?.data ?? [];
  const showCompanySelect = scope === 'COMPANY' || scope === 'FORMAT';
  const showFormatSelect = scope === 'FORMAT';

  // --- Handlers ---
  const handleScopeChange = React.useCallback(
    (value: string) => {
      const newScope = value as ConfigScope;
      onScopeChange(newScope);

      // 清除不適用的選擇
      if (newScope === 'GLOBAL') {
        onCompanyChange(null);
        onDocumentFormatChange(null);
      } else if (newScope === 'COMPANY') {
        onDocumentFormatChange(null);
      }
    },
    [onScopeChange, onCompanyChange, onDocumentFormatChange]
  );

  const handleCompanyChange = React.useCallback(
    (value: string) => {
      onCompanyChange(value || null);
      // 公司變更時清除格式選擇
      if (scope === 'FORMAT') {
        onDocumentFormatChange(null);
      }
    },
    [onCompanyChange, onDocumentFormatChange, scope]
  );

  const handleFormatChange = React.useCallback(
    (value: string) => {
      onDocumentFormatChange(value || null);
    },
    [onDocumentFormatChange]
  );

  // --- Render ---
  return (
    <div className={cn('space-y-4', className)}>
      {/* 配置範圍選擇 */}
      <div className="space-y-2">
        <Label htmlFor="config-scope">配置範圍</Label>
        <Select
          value={scope}
          onValueChange={handleScopeChange}
          disabled={disabled}
        >
          <SelectTrigger id="config-scope" className="w-full">
            <SelectValue placeholder="選擇配置範圍" />
          </SelectTrigger>
          <SelectContent>
            {CONFIG_SCOPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex flex-col">
                  <span>{option.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {option.description}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 公司選擇（當範圍為 COMPANY 或 FORMAT） */}
      {showCompanySelect && (
        <div className="space-y-2">
          <Label htmlFor="config-company">公司</Label>
          {isLoadingCompanies ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select
              value={companyId || ''}
              onValueChange={handleCompanyChange}
              disabled={disabled}
            >
              <SelectTrigger id="config-company" className="w-full">
                <SelectValue placeholder="選擇公司" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* 文件格式選擇（當範圍為 FORMAT） */}
      {showFormatSelect && (
        <div className="space-y-2">
          <Label htmlFor="config-format">文件格式</Label>
          {!companyId ? (
            <p className="text-sm text-muted-foreground">請先選擇公司</p>
          ) : isLoadingFormats ? (
            <Skeleton className="h-10 w-full" />
          ) : formats.length === 0 ? (
            <p className="text-sm text-muted-foreground">該公司沒有文件格式</p>
          ) : (
            <Select
              value={documentFormatId || ''}
              onValueChange={handleFormatChange}
              disabled={disabled || !companyId}
            >
              <SelectTrigger id="config-format" className="w-full">
                <SelectValue placeholder="選擇文件格式" />
              </SelectTrigger>
              <SelectContent>
                {formats.map((format) => (
                  <SelectItem key={format.id} value={format.id}>
                    <div className="flex flex-col">
                      <span>
                        {format.name ||
                          `${format.documentType}${format.documentSubtype ? ` - ${format.documentSubtype}` : ''}`}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format.fileCount} 個文件
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* 配置說明 */}
      <div className="rounded-md bg-muted p-3 text-sm">
        <p className="font-medium">映射優先級說明</p>
        <ul className="mt-1 list-inside list-disc text-muted-foreground">
          <li>
            <strong>格式層</strong>：最高優先級，針對特定文件格式
          </li>
          <li>
            <strong>公司層</strong>：覆蓋通用規則，針對特定公司
          </li>
          <li>
            <strong>通用層</strong>：預設規則，適用於所有公司
          </li>
        </ul>
      </div>
    </div>
  );
}
