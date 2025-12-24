/**
 * @fileoverview Rule Creation Panel for Term Analysis
 * @description
 *   Specialized rule creation panel for Story 0-5:
 *   - Creates Universal (Tier 1) or Company-Specific (Tier 2) rules
 *   - Pre-fills data from AI classification suggestions
 *   - Focuses on StandardChargeCategory mapping
 *   - Supports batch rule creation
 *
 * @module src/components/features/rules/RuleCreationPanel
 * @since Epic 0 - Story 0.5
 * @lastModified 2025-12-24
 *
 * @dependencies
 *   - react-hook-form - Form state management
 *   - @hookform/resolvers/zod - Zod validation
 *   - @/hooks/useForwarderList - Forwarder list hook
 */

'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Globe, Building2, Loader2, Save, Info } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useForwarderList } from '@/hooks/useForwarderList';
import type { StandardChargeCategory } from '@prisma/client';

// ============================================================================
// Types & Constants
// ============================================================================

/**
 * Standard charge category labels (Chinese)
 */
const CATEGORY_OPTIONS: { value: StandardChargeCategory; label: string }[] = [
  { value: 'OCEAN_FREIGHT', label: '海運費' },
  { value: 'AIR_FREIGHT', label: '空運費' },
  { value: 'HANDLING_FEE', label: '處理費' },
  { value: 'CUSTOMS_CLEARANCE', label: '清關費' },
  { value: 'DOCUMENTATION_FEE', label: '文件費' },
  { value: 'TERMINAL_HANDLING', label: '碼頭處理費' },
  { value: 'INLAND_TRANSPORT', label: '內陸運輸' },
  { value: 'INSURANCE', label: '保險費' },
  { value: 'STORAGE', label: '倉儲費' },
  { value: 'FUEL_SURCHARGE', label: '燃油附加費' },
  { value: 'SECURITY_FEE', label: '安檢費' },
  { value: 'OTHER', label: '其他' },
];

/**
 * Rule scope options
 */
type RuleScope = 'universal' | 'company';

/**
 * Form validation schema
 */
const formSchema = z.object({
  scope: z.enum(['universal', 'company']),
  companyId: z.string().optional(),
  sourcePattern: z.string().min(1, '請輸入來源術語'),
  targetCategory: z.string().min(1, '請選擇目標類別'),
  confidence: z.number().min(0).max(100),
  priority: z.number().min(0).max(100),
  notes: z.string().optional(),
}).refine(
  (data) => data.scope === 'universal' || (data.scope === 'company' && data.companyId),
  {
    message: '公司專屬規則必須選擇公司',
    path: ['companyId'],
  }
);

type FormValues = z.infer<typeof formSchema>;

/**
 * Props for RuleCreationPanel
 */
interface RuleCreationPanelProps {
  /** Pre-filled source term */
  term?: string;
  /** AI suggested category */
  suggestedCategory?: StandardChargeCategory;
  /** AI confidence score (0-100) */
  suggestedConfidence?: number;
  /** Term frequency for context */
  frequency?: number;
  /** Callback when rule is created */
  onSuccess?: (ruleId: string) => void;
  /** Callback when panel is cancelled */
  onCancel?: () => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Rule Creation Panel
 *
 * @description
 *   Specialized panel for creating mapping rules from term analysis.
 *   Supports both Universal (Tier 1) and Company-Specific (Tier 2) rules.
 */
export function RuleCreationPanel({
  term = '',
  suggestedCategory,
  suggestedConfidence = 80,
  frequency,
  onSuccess,
  onCancel,
}: RuleCreationPanelProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // --- Queries ---
  const { data: companies, isLoading: companiesLoading } = useForwarderList();

  // --- Form ---
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      scope: 'universal',
      companyId: '',
      sourcePattern: term,
      targetCategory: suggestedCategory || '',
      confidence: suggestedConfidence,
      priority: 50,
      notes: '',
    },
  });

  const selectedScope = form.watch('scope');

  // --- Handlers ---

  const handleSubmit = async (values: FormValues) => {
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // For Universal rules, forwarderId is null
          forwarderId: values.scope === 'universal' ? null : values.companyId,
          sourcePattern: values.sourcePattern,
          targetCategory: values.targetCategory,
          confidence: values.confidence / 100, // Convert to 0-1 scale
          priority: values.priority,
          notes: values.notes,
          isActive: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || '建立規則失敗');
      }

      const result = await response.json();

      toast({
        title: '規則已建立',
        description: `成功建立${values.scope === 'universal' ? '通用' : '公司專屬'}規則`,
      });

      onSuccess?.(result.data.id);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '建立失敗',
        description: error instanceof Error ? error.message : '未知錯誤',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Render ---

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          建立映射規則
          {term && (
            <Badge variant="secondary" className="font-mono">
              {term}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          將收費術語映射到標準費用類別
          {frequency !== undefined && (
            <span className="ml-2 text-muted-foreground">
              (出現 {frequency.toLocaleString()} 次)
            </span>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Rule Scope Selection */}
            <FormField
              control={form.control}
              name="scope"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>規則範圍</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="grid grid-cols-2 gap-4"
                    >
                      <div>
                        <RadioGroupItem
                          value="universal"
                          id="scope-universal"
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor="scope-universal"
                          className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                        >
                          <Globe className="mb-3 h-6 w-6" />
                          <span className="font-medium">通用規則 (Tier 1)</span>
                          <span className="text-xs text-muted-foreground mt-1">
                            適用所有公司
                          </span>
                        </Label>
                      </div>
                      <div>
                        <RadioGroupItem
                          value="company"
                          id="scope-company"
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor="scope-company"
                          className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                        >
                          <Building2 className="mb-3 h-6 w-6" />
                          <span className="font-medium">公司專屬 (Tier 2)</span>
                          <span className="text-xs text-muted-foreground mt-1">
                            覆蓋通用規則
                          </span>
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Company Selection (for Tier 2) */}
            {selectedScope === 'company' && (
              <FormField
                control={form.control}
                name="companyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>選擇公司</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={companiesLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="選擇公司..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {companies?.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name} ({company.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      此規則僅對選擇的公司生效，會覆蓋通用規則
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <Separator />

            {/* Source Pattern */}
            <FormField
              control={form.control}
              name="sourcePattern"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>來源術語</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="例如: OCEAN FREIGHT, OFR, 海運費"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    輸入發票上出現的收費項目名稱
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Target Category */}
            <FormField
              control={form.control}
              name="targetCategory"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>目標類別</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="選擇標準費用類別..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {suggestedCategory && field.value === suggestedCategory && (
                    <Alert className="mt-2">
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        此分類由 AI 建議（信心度 {suggestedConfidence}%）
                      </AlertDescription>
                    </Alert>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Confidence & Priority */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="confidence"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>信心度 (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      ≥90% 自動通過，70-89% 快速審核
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>優先級</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      數字越大優先級越高
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>備註（選填）</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="關於此規則的補充說明..."
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Action Buttons */}
            <div className="flex justify-end gap-4 pt-4">
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isSubmitting}
                >
                  取消
                </Button>
              )}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    建立中...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    建立規則
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
