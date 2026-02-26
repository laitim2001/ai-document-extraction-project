'use client';

/**
 * @fileoverview 映射規則列表組件（支援拖動排序）
 * @description
 *   使用 @dnd-kit 實現可拖動排序的規則列表：
 *   - 顯示所有映射規則
 *   - 支援拖動排序（更新優先級）
 *   - 提供新增規則入口
 *   - 空狀態處理
 *
 * @module src/components/features/mapping-config/MappingRuleList
 * @since Epic 13 - Story 13.3
 * @lastModified 2026-01-02
 *
 * @features
 *   - @dnd-kit 拖動排序整合
 *   - 規則列表渲染
 *   - 空狀態顯示
 *   - 新增規則按鈕
 *
 * @dependencies
 *   - @dnd-kit/core - 拖動核心
 *   - @dnd-kit/sortable - 排序功能
 *   - @/types/field-mapping - 類型定義
 */

import * as React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { useTranslations } from 'next-intl';
import { Plus, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SortableRuleItem } from './SortableRuleItem';
import type { VisualMappingRule } from '@/types/field-mapping';
import { cn } from '@/lib/utils';

// ============================================================
// Types
// ============================================================

/**
 * MappingRuleList 組件屬性
 */
export interface MappingRuleListProps {
  /** 映射規則列表 */
  rules: VisualMappingRule[];
  /** 規則順序變更回調（拖動排序後） */
  onReorder: (rules: VisualMappingRule[]) => void;
  /** 編輯規則回調 */
  onEdit: (rule: VisualMappingRule) => void;
  /** 刪除規則回調 */
  onDelete: (ruleId: string) => void;
  /** 切換規則啟用狀態回調 */
  onToggleActive: (ruleId: string, isActive: boolean) => void;
  /** 新增規則回調 */
  onAdd: () => void;
  /** 是否禁用操作（載入中） */
  disabled?: boolean;
  /** 自訂類名 */
  className?: string;
}

// ============================================================
// Component
// ============================================================

/**
 * 映射規則列表（支援拖動排序）
 *
 * @description
 *   使用 @dnd-kit 實現規則列表的拖動排序功能。
 *   自動更新規則的優先級（priority）屬性。
 *
 * @example
 * ```tsx
 * <MappingRuleList
 *   rules={mappingRules}
 *   onReorder={handleReorder}
 *   onEdit={handleEdit}
 *   onDelete={handleDelete}
 *   onToggleActive={handleToggle}
 *   onAdd={handleAdd}
 * />
 * ```
 */
export function MappingRuleList({
  rules,
  onReorder,
  onEdit,
  onDelete,
  onToggleActive,
  onAdd,
  disabled = false,
  className,
}: MappingRuleListProps) {
  const t = useTranslations('documentPreview.mappingRuleList');

  // --- Sensors Setup ---
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // --- Handlers ---
  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = rules.findIndex((rule) => rule.id === active.id);
        const newIndex = rules.findIndex((rule) => rule.id === over.id);

        const reorderedRules = arrayMove(rules, oldIndex, newIndex);

        // 更新優先級
        const updatedRules = reorderedRules.map((rule, index) => ({
          ...rule,
          priority: index + 1,
        }));

        onReorder(updatedRules);
      }
    },
    [rules, onReorder]
  );

  // --- Render Empty State ---
  if (rules.length === 0) {
    return (
      <div className={cn('flex flex-col items-center py-12', className)}>
        <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="mb-2 text-lg font-medium">{t('empty.title')}</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          {t('empty.description')}
        </p>
        <Button onClick={onAdd} disabled={disabled}>
          <Plus className="mr-2 h-4 w-4" />
          {t('empty.addRule')}
        </Button>
      </div>
    );
  }

  // --- Render List ---
  return (
    <div className={cn('space-y-4', className)}>
      {/* 標題和新增按鈕 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">{t('title')}</h3>
          <p className="text-xs text-muted-foreground">
            {t('dragHint')}
          </p>
        </div>
        <Button size="sm" onClick={onAdd} disabled={disabled}>
          <Plus className="mr-2 h-4 w-4" />
          {t('addRule')}
        </Button>
      </div>

      {/* 可排序列表 */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis]}
      >
        <SortableContext
          items={rules.map((rule) => rule.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {rules.map((rule) => (
              <SortableRuleItem
                key={rule.id}
                rule={rule}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggleActive={onToggleActive}
                disabled={disabled}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* 規則計數 */}
      <div className="text-right text-xs text-muted-foreground">
        {t('rulesCount', { count: rules.length })}
        {rules.filter((r) => !r.isActive).length > 0 && (
          <span className="ml-1">
            {t('disabledCount', { count: rules.filter((r) => !r.isActive).length })}
          </span>
        )}
      </div>
    </div>
  );
}
