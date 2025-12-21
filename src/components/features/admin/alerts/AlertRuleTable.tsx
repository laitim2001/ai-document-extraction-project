'use client';

/**
 * @fileoverview 警報規則表格組件
 * @description
 *   顯示警報規則列表，支援排序、篩選和操作。
 *
 * @module src/components/features/admin/alerts/AlertRuleTable
 * @since Epic 12 - Story 12-3 (錯誤警報設定)
 */

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { AlertRuleResponse } from '@/types/alerts';

// ============================================================
// Helper Functions
// ============================================================

function getConditionTypeText(type: string): string {
  const texts: Record<string, string> = {
    SERVICE_DOWN: '服務中斷',
    ERROR_RATE: '錯誤率',
    RESPONSE_TIME: '響應時間',
    QUEUE_BACKLOG: '佇列積壓',
    STORAGE_LOW: '儲存空間不足',
    CPU_HIGH: 'CPU 過高',
    MEMORY_HIGH: '記憶體過高',
    CUSTOM_METRIC: '自訂指標',
  };
  return texts[type] || type;
}

function getSeverityText(severity: string): string {
  const texts: Record<string, string> = {
    INFO: '資訊',
    WARNING: '警告',
    ERROR: '錯誤',
    CRITICAL: '嚴重',
    EMERGENCY: '緊急',
  };
  return texts[severity] || severity;
}

function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    INFO: 'bg-blue-100 text-blue-800',
    WARNING: 'bg-yellow-100 text-yellow-800',
    ERROR: 'bg-orange-100 text-orange-800',
    CRITICAL: 'bg-red-100 text-red-800',
    EMERGENCY: 'bg-purple-100 text-purple-800',
  };
  return colors[severity] || 'bg-gray-100 text-gray-800';
}

function getOperatorSymbol(operator: string): string {
  const symbols: Record<string, string> = {
    GREATER_THAN: '>',
    GREATER_THAN_EQ: '≥',
    LESS_THAN: '<',
    LESS_THAN_EQ: '≤',
    EQUALS: '=',
    NOT_EQUALS: '≠',
  };
  return symbols[operator] || operator;
}

// ============================================================
// Types
// ============================================================

interface AlertRuleTableProps {
  /** 規則列表 */
  rules: AlertRuleResponse[];
  /** 是否載入中 */
  isLoading?: boolean;
  /** 切換規則狀態 */
  onToggle: (id: string) => void;
  /** 編輯規則 */
  onEdit: (rule: AlertRuleResponse) => void;
  /** 刪除規則 */
  onDelete: (id: string) => void;
}

// ============================================================
// Component
// ============================================================

/**
 * 警報規則表格組件
 */
export function AlertRuleTable({
  rules,
  isLoading,
  onToggle,
  onEdit,
  onDelete,
}: AlertRuleTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <p>尚未設定任何警報規則</p>
        <p className="text-sm">點擊上方按鈕創建新規則</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>規則名稱</TableHead>
            <TableHead>條件類型</TableHead>
            <TableHead>閾值</TableHead>
            <TableHead>嚴重程度</TableHead>
            <TableHead>通知頻道</TableHead>
            <TableHead>狀態</TableHead>
            <TableHead className="w-[70px]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.map((rule) => (
            <TableRow key={rule.id}>
              <TableCell>
                <div>
                  <p className="font-medium">{rule.name}</p>
                  {rule.description && (
                    <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                      {rule.description}
                    </p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm">
                  {getConditionTypeText(rule.conditionType)}
                </span>
              </TableCell>
              <TableCell>
                <code className="text-sm bg-muted px-1 py-0.5 rounded">
                  {rule.metric} {getOperatorSymbol(rule.operator)} {rule.threshold}
                </code>
              </TableCell>
              <TableCell>
                <Badge className={getSeverityColor(rule.severity)}>
                  {getSeverityText(rule.severity)}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {Array.isArray(rule.channels) && (rule.channels as string[]).map((channel) => (
                    <Badge key={channel} variant="outline" className="text-xs">
                      {channel}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                <Switch
                  checked={rule.isActive}
                  onCheckedChange={() => onToggle(rule.id)}
                />
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(rule)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      編輯
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDelete(rule.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      刪除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

