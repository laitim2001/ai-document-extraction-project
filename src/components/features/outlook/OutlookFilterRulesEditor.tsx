'use client';

/**
 * @fileoverview Outlook 過濾規則編輯器
 * @description
 *   提供 Outlook 過濾規則的完整管理功能：
 *   - 規則列表顯示
 *   - 新增、編輯、刪除規則
 *   - 規則優先級排序
 *   - 白名單/黑名單模式
 *
 * @module src/components/features/outlook/OutlookFilterRulesEditor
 * @author Development Team
 * @since Epic 9 - Story 9.4 (Outlook 連線設定)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 規則 CRUD 操作
 *   - 優先級排序（上移/下移）
 *   - 規則類型選擇
 *   - 規則動作選擇（白名單/黑名單）
 */

import * as React from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Filter,
  CheckCircle,
  XCircle,
  Mail,
  AtSign,
  FileType,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import type { OutlookFilterRule, OutlookRuleType, RuleOperator } from '@prisma/client';
import type { CreateFilterRuleInput, UpdateFilterRuleInput } from '@/types/outlook-config.types';
import { RULE_TYPE_LABELS, RULE_OPERATOR_LABELS, RULE_TYPE_DEFAULT_OPERATOR } from '@/types/outlook-config.types';

// ============================================================
// Types
// ============================================================

interface OutlookFilterRulesEditorProps {
  configId: string;
  configName: string;
  rules: OutlookFilterRule[];
  isLoading?: boolean;
  onCreateRule: (input: CreateFilterRuleInput) => Promise<void>;
  onUpdateRule: (ruleId: string, input: UpdateFilterRuleInput) => Promise<void>;
  onDeleteRule: (ruleId: string) => Promise<void>;
  onReorderRules: (ruleIds: string[]) => Promise<void>;
  onClose: () => void;
}

// ============================================================
// Validation Schema
// ============================================================

const ruleFormSchema = z.object({
  name: z.string().min(1, '規則名稱不能為空').max(100, '規則名稱不能超過 100 字元'),
  ruleType: z.enum(['SENDER_EMAIL', 'SENDER_DOMAIN', 'SUBJECT_KEYWORD', 'SUBJECT_REGEX', 'ATTACHMENT_TYPE', 'ATTACHMENT_NAME']),
  operator: z.enum(['EQUALS', 'CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'REGEX']),
  ruleValue: z.string().min(1, '匹配值不能為空'),
  isWhitelist: z.boolean(),
  isActive: z.boolean(),
});

type RuleFormData = z.infer<typeof ruleFormSchema>;

// ============================================================
// Constants
// ============================================================

const RULE_TYPE_ICONS: Record<OutlookRuleType, React.ReactNode> = {
  SENDER_EMAIL: <Mail className="h-4 w-4" />,
  SENDER_DOMAIN: <AtSign className="h-4 w-4" />,
  SUBJECT_KEYWORD: <Mail className="h-4 w-4" />,
  SUBJECT_REGEX: <Mail className="h-4 w-4" />,
  ATTACHMENT_TYPE: <FileType className="h-4 w-4" />,
  ATTACHMENT_NAME: <FileType className="h-4 w-4" />,
};

// ============================================================
// Component
// ============================================================

/**
 * Outlook 過濾規則編輯器
 */
export function OutlookFilterRulesEditor({
  configId,
  configName,
  rules,
  isLoading,
  onCreateRule,
  onUpdateRule,
  onDeleteRule,
  onReorderRules,
  onClose,
}: OutlookFilterRulesEditorProps) {
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingRule, setEditingRule] = React.useState<OutlookFilterRule | null>(null);
  const [deletingRuleId, setDeletingRuleId] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isReordering, setIsReordering] = React.useState(false);

  // Suppress unused variable warning
  void configId;

  // Sort rules by priority
  const sortedRules = React.useMemo(
    () => [...rules].sort((a, b) => a.priority - b.priority),
    [rules]
  );

  const handleOpenCreate = () => {
    setEditingRule(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (rule: OutlookFilterRule) => {
    setEditingRule(rule);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingRule(null);
  };

  const handleSubmitRule = async (data: RuleFormData) => {
    setIsSubmitting(true);
    try {
      if (editingRule) {
        await onUpdateRule(editingRule.id, {
          name: data.name,
          ruleType: data.ruleType as OutlookRuleType,
          operator: data.operator as RuleOperator,
          ruleValue: data.ruleValue,
          isWhitelist: data.isWhitelist,
          isActive: data.isActive,
        });
      } else {
        await onCreateRule({
          name: data.name,
          ruleType: data.ruleType as OutlookRuleType,
          operator: data.operator as RuleOperator,
          ruleValue: data.ruleValue,
          isWhitelist: data.isWhitelist,
        });
      }
      handleCloseForm();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRule = async () => {
    if (!deletingRuleId) return;
    try {
      await onDeleteRule(deletingRuleId);
    } finally {
      setDeletingRuleId(null);
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    setIsReordering(true);
    try {
      const newOrder = [...sortedRules];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      await onReorderRules(newOrder.map((r) => r.id));
    } finally {
      setIsReordering(false);
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index === sortedRules.length - 1) return;
    setIsReordering(true);
    try {
      const newOrder = [...sortedRules];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      await onReorderRules(newOrder.map((r) => r.id));
    } finally {
      setIsReordering(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            過濾規則管理
          </DialogTitle>
          <DialogDescription>
            配置「{configName}」的郵件過濾規則。規則按優先級順序執行，第一個匹配的規則將生效。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add Rule Button */}
          <div className="flex justify-end">
            <Button onClick={handleOpenCreate}>
              <Plus className="mr-2 h-4 w-4" />
              新增規則
            </Button>
          </div>

          {/* Rules Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sortedRules.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Filter className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">尚未設定任何過濾規則</p>
                <p className="text-sm text-muted-foreground">
                  所有郵件都會被處理。點擊「新增規則」來設定過濾條件。
                </p>
              </CardContent>
            </Card>
          ) : (
            <TooltipProvider>
              <Card>
                <CardContent className="pt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px]">優先級</TableHead>
                        <TableHead>規則名稱</TableHead>
                        <TableHead>類型</TableHead>
                        <TableHead>匹配值</TableHead>
                        <TableHead>動作</TableHead>
                        <TableHead>狀態</TableHead>
                        <TableHead className="w-[120px]">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedRules.map((rule, index) => (
                        <TableRow key={rule.id}>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleMoveUp(index)}
                                disabled={index === 0 || isReordering}
                              >
                                <ArrowUp className="h-3 w-3" />
                              </Button>
                              <span className="text-muted-foreground text-sm w-4 text-center">
                                {index + 1}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleMoveDown(index)}
                                disabled={index === sortedRules.length - 1 || isReordering}
                              >
                                <ArrowDown className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{rule.name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {RULE_TYPE_ICONS[rule.ruleType]}
                              <span>{RULE_TYPE_LABELS[rule.ruleType]}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <code className="px-2 py-1 bg-muted rounded text-sm cursor-help max-w-[200px] truncate block">
                                  {RULE_OPERATOR_LABELS[rule.operator]}: {rule.ruleValue}
                                </code>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{RULE_OPERATOR_LABELS[rule.operator]}: {rule.ruleValue}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={rule.isWhitelist ? 'default' : 'destructive'}
                            >
                              {rule.isWhitelist ? (
                                <CheckCircle className="mr-1 h-3 w-3" />
                              ) : (
                                <XCircle className="mr-1 h-3 w-3" />
                              )}
                              {rule.isWhitelist ? '白名單' : '黑名單'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                              {rule.isActive ? '啟用' : '停用'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenEdit(rule)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeletingRuleId(rule.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TooltipProvider>
          )}

          {/* Info Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">規則說明</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>• <strong>白名單</strong>：符合此規則的郵件會被處理</p>
              <p>• <strong>黑名單</strong>：符合此規則的郵件會被跳過</p>
              <p>• 規則按優先級順序執行，第一個匹配的規則決定郵件的處理方式</p>
              <p>• 如果沒有任何規則匹配，郵件預設會被處理</p>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            關閉
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Rule Form Dialog */}
      <RuleFormDialog
        open={isFormOpen}
        rule={editingRule}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmitRule}
        onClose={handleCloseForm}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingRuleId} onOpenChange={() => setDeletingRuleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定要刪除此規則？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作無法復原。刪除後，此規則將不再影響郵件過濾。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRule}
              className="bg-red-600 hover:bg-red-700"
            >
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

// ============================================================
// Rule Form Dialog
// ============================================================

interface RuleFormDialogProps {
  open: boolean;
  rule: OutlookFilterRule | null;
  isSubmitting: boolean;
  onSubmit: (data: RuleFormData) => Promise<void>;
  onClose: () => void;
}

function RuleFormDialog({
  open,
  rule,
  isSubmitting,
  onSubmit,
  onClose,
}: RuleFormDialogProps) {
  const isEditing = !!rule;

  const form = useForm<RuleFormData>({
    resolver: zodResolver(ruleFormSchema) as Resolver<RuleFormData>,
    defaultValues: {
      name: '',
      ruleType: 'SENDER_EMAIL',
      operator: 'EQUALS',
      ruleValue: '',
      isWhitelist: true,
      isActive: true,
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = form;

  const currentRuleType = watch('ruleType');

  // Reset form when rule changes
  React.useEffect(() => {
    if (open) {
      if (rule) {
        reset({
          name: rule.name,
          ruleType: rule.ruleType,
          operator: rule.operator,
          ruleValue: rule.ruleValue,
          isWhitelist: rule.isWhitelist,
          isActive: rule.isActive,
        });
      } else {
        reset({
          name: '',
          ruleType: 'SENDER_EMAIL',
          operator: 'EQUALS',
          ruleValue: '',
          isWhitelist: true,
          isActive: true,
        });
      }
    }
  }, [open, rule, reset]);

  // Update operator when rule type changes (for new rules only)
  React.useEffect(() => {
    if (!isEditing && currentRuleType) {
      const defaultOperator = RULE_TYPE_DEFAULT_OPERATOR[currentRuleType as OutlookRuleType];
      if (defaultOperator) {
        setValue('operator', defaultOperator);
      }
    }
  }, [currentRuleType, isEditing, setValue]);

  const handleFormSubmit = async (data: RuleFormData) => {
    await onSubmit(data);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? '編輯過濾規則' : '新增過濾規則'}
          </DialogTitle>
          <DialogDescription>
            設定郵件過濾條件和處理方式
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">規則名稱 *</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="例：排除垃圾郵件"
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ruleType">規則類型 *</Label>
            <Select
              value={watch('ruleType')}
              onValueChange={(value) => setValue('ruleType', value as OutlookRuleType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="選擇規則類型" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(RULE_TYPE_LABELS) as OutlookRuleType[]).map((value) => (
                  <SelectItem key={value} value={value}>
                    <div className="flex items-center gap-2">
                      {RULE_TYPE_ICONS[value]}
                      <span>{RULE_TYPE_LABELS[value]}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="operator">匹配方式 *</Label>
            <Select
              value={watch('operator')}
              onValueChange={(value) => setValue('operator', value as RuleOperator)}
            >
              <SelectTrigger>
                <SelectValue placeholder="選擇匹配方式" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(RULE_OPERATOR_LABELS) as RuleOperator[]).map((value) => (
                  <SelectItem key={value} value={value}>
                    {RULE_OPERATOR_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ruleValue">匹配值 *</Label>
            <Input
              id="ruleValue"
              {...register('ruleValue')}
              placeholder="例：spam.com 或 Invoice"
            />
            <p className="text-sm text-muted-foreground">
              {currentRuleType === 'SUBJECT_REGEX'
                ? '輸入正則表達式，例如：^Invoice\\s\\d+$'
                : '輸入要匹配的值'}
            </p>
            {errors.ruleValue && (
              <p className="text-sm text-red-500">{errors.ruleValue.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="isWhitelist">規則類型 *</Label>
            <Select
              value={watch('isWhitelist') ? 'whitelist' : 'blacklist'}
              onValueChange={(value) => setValue('isWhitelist', value === 'whitelist')}
            >
              <SelectTrigger>
                <SelectValue placeholder="選擇規則類型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whitelist">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>白名單（通過）</span>
                  </div>
                </SelectItem>
                <SelectItem value="blacklist">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span>黑名單（排除）</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={watch('isActive')}
              onCheckedChange={(checked) => setValue('isActive', checked)}
            />
            <Label htmlFor="isActive">啟用此規則</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  儲存中...
                </>
              ) : isEditing ? (
                '更新規則'
              ) : (
                '建立規則'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
