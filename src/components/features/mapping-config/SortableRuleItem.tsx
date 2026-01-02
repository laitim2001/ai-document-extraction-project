'use client';

/**
 * @fileoverview 可拖動排序的映射規則項目組件
 * @description
 *   使用 @dnd-kit 實現可拖動排序的規則項目：
 *   - 顯示規則基本資訊（來源欄位、目標欄位、轉換類型）
 *   - 支援拖動手柄進行排序
 *   - 提供編輯、刪除、啟用/停用操作
 *
 * @module src/components/features/mapping-config/SortableRuleItem
 * @since Epic 13 - Story 13.3
 * @lastModified 2026-01-02
 *
 * @features
 *   - @dnd-kit 拖動排序整合
 *   - 規則狀態視覺化（啟用/停用）
 *   - 轉換類型標籤
 *   - 操作按鈕（編輯、刪除、切換狀態）
 *
 * @dependencies
 *   - @dnd-kit/sortable - 拖動排序
 *   - @/components/ui/* - UI 組件
 *   - @/types/field-mapping - 類型定義
 */

import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  type VisualMappingRule,
  type TransformType,
  TRANSFORM_TYPE_OPTIONS,
} from '@/types/field-mapping';
import { cn } from '@/lib/utils';

// ============================================================
// Types
// ============================================================

/**
 * SortableRuleItem 組件屬性
 */
export interface SortableRuleItemProps {
  /** 映射規則資料 */
  rule: VisualMappingRule;
  /** 編輯回調 */
  onEdit: (rule: VisualMappingRule) => void;
  /** 刪除回調 */
  onDelete: (ruleId: string) => void;
  /** 切換啟用狀態回調 */
  onToggleActive: (ruleId: string, isActive: boolean) => void;
  /** 是否禁用操作 */
  disabled?: boolean;
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 獲取轉換類型的顯示標籤
 */
function getTransformTypeLabel(type: TransformType): string {
  const option = TRANSFORM_TYPE_OPTIONS.find((opt) => opt.value === type);
  return option?.label ?? type;
}

/**
 * 獲取轉換類型的徽章顏色
 */
function getTransformTypeBadgeVariant(
  type: TransformType
): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (type) {
    case 'DIRECT':
      return 'default';
    case 'CONCAT':
      return 'secondary';
    case 'SPLIT':
      return 'outline';
    case 'LOOKUP':
      return 'secondary';
    case 'CUSTOM':
      return 'destructive';
    default:
      return 'default';
  }
}

/**
 * 格式化來源欄位顯示
 */
function formatSourceFields(fields: string[]): string {
  if (fields.length === 0) return '(無來源欄位)';
  if (fields.length === 1) return fields[0];
  if (fields.length <= 3) return fields.join(' + ');
  return `${fields.slice(0, 2).join(' + ')} +${fields.length - 2}`;
}

// ============================================================
// Component
// ============================================================

/**
 * 可拖動排序的映射規則項目
 *
 * @description
 *   使用 @dnd-kit 實現規則項目的拖動排序功能。
 *   顯示規則的來源欄位、目標欄位、轉換類型，
 *   並提供編輯、刪除、切換狀態等操作。
 *
 * @example
 * ```tsx
 * <SortableRuleItem
 *   rule={mappingRule}
 *   onEdit={handleEdit}
 *   onDelete={handleDelete}
 *   onToggleActive={handleToggle}
 * />
 * ```
 */
export function SortableRuleItem({
  rule,
  onEdit,
  onDelete,
  onToggleActive,
  disabled = false,
}: SortableRuleItemProps) {
  // --- Sortable Setup ---
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rule.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : undefined,
  };

  // --- Handlers ---
  const handleEdit = React.useCallback(() => {
    if (!disabled) onEdit(rule);
  }, [disabled, onEdit, rule]);

  const handleDelete = React.useCallback(() => {
    if (!disabled) onDelete(rule.id);
  }, [disabled, onDelete, rule.id]);

  const handleToggleActive = React.useCallback(() => {
    if (!disabled) onToggleActive(rule.id, !rule.isActive);
  }, [disabled, onToggleActive, rule.id, rule.isActive]);

  // --- Render ---
  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative transition-shadow',
        isDragging && 'shadow-lg',
        !rule.isActive && 'opacity-60'
      )}
    >
      <CardContent className="flex items-center gap-3 p-3">
        {/* 拖動手柄 */}
        <button
          type="button"
          className={cn(
            'cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted',
            'focus:outline-none focus:ring-2 focus:ring-ring',
            isDragging && 'cursor-grabbing',
            disabled && 'cursor-not-allowed opacity-50'
          )}
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* 規則資訊 */}
        <div className="flex flex-1 flex-col gap-1">
          {/* 主要映射資訊 */}
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">
              {formatSourceFields(rule.sourceFields)}
            </span>
            <span className="text-muted-foreground">→</span>
            <span className="font-medium">{rule.targetField}</span>
          </div>

          {/* 轉換類型和描述 */}
          <div className="flex items-center gap-2">
            <Badge variant={getTransformTypeBadgeVariant(rule.transformType)}>
              {getTransformTypeLabel(rule.transformType)}
            </Badge>
            {rule.description && (
              <span className="text-xs text-muted-foreground">
                {rule.description}
              </span>
            )}
          </div>
        </div>

        {/* 操作按鈕 */}
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <TooltipProvider>
            {/* 切換啟用狀態 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleActive}
                  disabled={disabled}
                  className="h-8 w-8"
                >
                  {rule.isActive ? (
                    <ToggleRight className="h-4 w-4 text-green-600" />
                  ) : (
                    <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {rule.isActive ? '停用規則' : '啟用規則'}
              </TooltipContent>
            </Tooltip>

            {/* 編輯 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleEdit}
                  disabled={disabled}
                  className="h-8 w-8"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>編輯規則</TooltipContent>
            </Tooltip>

            {/* 刪除 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDelete}
                  disabled={disabled}
                  className="h-8 w-8 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>刪除規則</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* 優先級指示 */}
        <div className="w-8 text-center text-xs text-muted-foreground">
          #{rule.priority}
        </div>
      </CardContent>
    </Card>
  );
}
