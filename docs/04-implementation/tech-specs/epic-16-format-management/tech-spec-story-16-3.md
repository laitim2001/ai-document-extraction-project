# Tech Spec: Story 16.3 - 識別規則配置

> **Version**: 1.0.0
> **Created**: 2026-01-12
> **Status**: Draft
> **Story Key**: STORY-16-3

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 16.3 |
| **Epic** | Epic 16 - 文件格式管理 |
| **Estimated Effort** | 8 Story Points |
| **Dependencies** | Story 16-2（格式詳情與編輯） |
| **Blocking** | 無 |

---

## Objective

新增可配置的格式識別規則，包括 Logo 位置/特徵、關鍵字列表、版面特徵描述、識別優先級。這些規則將用於提升文件格式識別的準確性。

---

## Acceptance Criteria Mapping

| AC ID | 驗收條件 | 實現方式 |
|-------|----------|----------|
| AC-16.3.1 | 識別規則 Tab | FormatDetailView 新增 Tab |
| AC-16.3.2 | Logo 特徵配置 | LogoPatternEditor 組件 |
| AC-16.3.3 | 關鍵字配置 | KeywordTagInput 組件 |
| AC-16.3.4 | 版面特徵配置 | Textarea 輸入 |
| AC-16.3.5 | 優先級設置 | Slider 組件 |
| AC-16.3.6 | 規則保存 | PATCH API 更新 |

---

## Implementation Guide

### Phase 1: Prisma Schema 更新 (1 point)

#### 1.1 新增欄位

```prisma
// prisma/schema.prisma

model DocumentFormat {
  // ... 現有欄位

  // 新增：識別規則
  identificationRules   Json?   @map("identification_rules")
  // 結構:
  // {
  //   logoPatterns: [{ position: "top-left", description: "DHL Logo" }],
  //   keywords: ["Ocean Freight", "B/L No", "Shipper"],
  //   layoutHints: "表格式發票，表頭包含公司資訊",
  //   priority: 100
  // }
}
```

#### 1.2 遷移命令

```bash
npx prisma migrate dev --name add_identification_rules_to_document_format
```

### Phase 2: 類型定義 (0.5 points)

#### 2.1 識別規則類型

```typescript
// src/types/document-format.ts

export type LogoPosition =
  | 'top-left'
  | 'top-right'
  | 'top-center'
  | 'bottom-left'
  | 'bottom-right'
  | 'center';

export interface LogoPattern {
  position: LogoPosition;
  description: string;
}

export interface IdentificationRules {
  logoPatterns: LogoPattern[];
  keywords: string[];
  layoutHints: string;
  priority: number;  // 0-100
}

export const LOGO_POSITION_OPTIONS: Array<{ value: LogoPosition; label: string }> = [
  { value: 'top-left', label: '左上角' },
  { value: 'top-right', label: '右上角' },
  { value: 'top-center', label: '頂部中央' },
  { value: 'bottom-left', label: '左下角' },
  { value: 'bottom-right', label: '右下角' },
  { value: 'center', label: '中央' },
];

export const DEFAULT_IDENTIFICATION_RULES: IdentificationRules = {
  logoPatterns: [],
  keywords: [],
  layoutHints: '',
  priority: 50,
};
```

### Phase 3: Zod 驗證 Schema (0.5 points)

#### 3.1 驗證 Schema

```typescript
// src/validations/document-format.ts

import { z } from 'zod';

export const logoPatternSchema = z.object({
  position: z.enum([
    'top-left',
    'top-right',
    'top-center',
    'bottom-left',
    'bottom-right',
    'center',
  ]),
  description: z.string().min(1, '請輸入描述').max(200, '描述過長'),
});

export const identificationRulesSchema = z.object({
  logoPatterns: z.array(logoPatternSchema).max(10, '最多 10 個 Logo 特徵'),
  keywords: z.array(z.string().min(1).max(100)).max(50, '最多 50 個關鍵字'),
  layoutHints: z.string().max(1000, '版面描述過長').optional().default(''),
  priority: z.number().int().min(0).max(100).default(50),
});

export type IdentificationRulesInput = z.infer<typeof identificationRulesSchema>;
```

### Phase 4: API 更新 (1 point)

#### 4.1 更新 PATCH API

```typescript
// src/app/api/v1/formats/[id]/route.ts

// 更新驗證 schema
const updateFormatSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  features: z.object({
    // ... 現有欄位
  }).optional(),
  identificationRules: identificationRulesSchema.optional(),
});
```

### Phase 5: 識別規則編輯器 (4 points)

#### 5.1 IdentificationRulesEditor

```typescript
// src/components/features/formats/IdentificationRulesEditor.tsx

/**
 * @fileoverview 識別規則編輯器
 * @module src/components/features/formats
 * @since Epic 16 - Story 16.3
 */

'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { LogoPatternEditor } from './LogoPatternEditor';
import { KeywordTagInput } from './KeywordTagInput';
import {
  identificationRulesSchema,
  type IdentificationRulesInput,
} from '@/validations/document-format';
import type { IdentificationRules } from '@/types/document-format';

export interface IdentificationRulesEditorProps {
  formatId: string;
  initialRules: IdentificationRules | null;
  onSuccess: () => void;
}

export function IdentificationRulesEditor({
  formatId,
  initialRules,
  onSuccess,
}: IdentificationRulesEditorProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [rules, setRules] = React.useState<IdentificationRulesInput>({
    logoPatterns: initialRules?.logoPatterns || [],
    keywords: initialRules?.keywords || [],
    layoutHints: initialRules?.layoutHints || '',
    priority: initialRules?.priority || 50,
  });

  const handleSubmit = async () => {
    try {
      // 驗證
      const validated = identificationRulesSchema.parse(rules);

      setIsSubmitting(true);
      const response = await fetch(`/api/v1/formats/${formatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificationRules: validated }),
      });

      if (!response.ok) {
        throw new Error('保存失敗');
      }

      toast({
        title: '保存成功',
        description: '識別規則已更新',
      });
      onSuccess();
    } catch (error) {
      toast({
        title: '保存失敗',
        description: error instanceof Error ? error.message : '請稍後再試',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Logo 特徵 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logo 特徵</CardTitle>
        </CardHeader>
        <CardContent>
          <LogoPatternEditor
            patterns={rules.logoPatterns}
            onChange={(patterns) => setRules({ ...rules, logoPatterns: patterns })}
          />
        </CardContent>
      </Card>

      {/* 關鍵字 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">關鍵字</CardTitle>
        </CardHeader>
        <CardContent>
          <KeywordTagInput
            keywords={rules.keywords}
            onChange={(keywords) => setRules({ ...rules, keywords })}
            placeholder="輸入關鍵字後按 Enter"
          />
          <p className="text-xs text-muted-foreground mt-2">
            文件中包含這些關鍵字時，更可能被識別為此格式
          </p>
        </CardContent>
      </Card>

      {/* 版面特徵 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">版面特徵</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={rules.layoutHints}
            onChange={(e) => setRules({ ...rules, layoutHints: e.target.value })}
            placeholder="描述此格式的版面特徵，例如：表格式發票，左側有公司 Logo，右上角有發票編號..."
            rows={4}
          />
        </CardContent>
      </Card>

      {/* 優先級 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">識別優先級</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>優先級: {rules.priority}</Label>
            <span className="text-sm text-muted-foreground">
              {rules.priority >= 70 ? '高' : rules.priority >= 30 ? '中' : '低'}
            </span>
          </div>
          <Slider
            value={[rules.priority]}
            onValueChange={([value]) => setRules({ ...rules, priority: value })}
            min={0}
            max={100}
            step={1}
          />
          <p className="text-xs text-muted-foreground">
            優先級越高，在多個格式匹配時越優先使用此格式
          </p>
        </CardContent>
      </Card>

      {/* 保存按鈕 */}
      <div className="flex justify-end gap-2">
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? '保存中...' : '保存規則'}
        </Button>
      </div>
    </div>
  );
}
```

#### 5.2 LogoPatternEditor

```typescript
// src/components/features/formats/LogoPatternEditor.tsx

'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, Plus } from 'lucide-react';
import { LOGO_POSITION_OPTIONS, type LogoPattern } from '@/types/document-format';

export interface LogoPatternEditorProps {
  patterns: LogoPattern[];
  onChange: (patterns: LogoPattern[]) => void;
}

export function LogoPatternEditor({ patterns, onChange }: LogoPatternEditorProps) {
  const addPattern = () => {
    onChange([...patterns, { position: 'top-left', description: '' }]);
  };

  const removePattern = (index: number) => {
    onChange(patterns.filter((_, i) => i !== index));
  };

  const updatePattern = (index: number, updates: Partial<LogoPattern>) => {
    onChange(
      patterns.map((p, i) => (i === index ? { ...p, ...updates } : p))
    );
  };

  return (
    <div className="space-y-3">
      {patterns.map((pattern, index) => (
        <div key={index} className="flex gap-2 items-start">
          <Select
            value={pattern.position}
            onValueChange={(value) =>
              updatePattern(index, { position: value as LogoPattern['position'] })
            }
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOGO_POSITION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={pattern.description}
            onChange={(e) => updatePattern(index, { description: e.target.value })}
            placeholder="Logo 描述"
            className="flex-1"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => removePattern(index)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {patterns.length < 10 && (
        <Button variant="outline" size="sm" onClick={addPattern}>
          <Plus className="h-4 w-4 mr-2" />
          新增 Logo 特徵
        </Button>
      )}
    </div>
  );
}
```

#### 5.3 KeywordTagInput

```typescript
// src/components/features/formats/KeywordTagInput.tsx

'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

export interface KeywordTagInputProps {
  keywords: string[];
  onChange: (keywords: string[]) => void;
  placeholder?: string;
}

export function KeywordTagInput({
  keywords,
  onChange,
  placeholder,
}: KeywordTagInputProps) {
  const [inputValue, setInputValue] = React.useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      if (!keywords.includes(inputValue.trim()) && keywords.length < 50) {
        onChange([...keywords, inputValue.trim()]);
      }
      setInputValue('');
    }
  };

  const removeKeyword = (keyword: string) => {
    onChange(keywords.filter((k) => k !== keyword));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {keywords.map((keyword) => (
          <Badge key={keyword} variant="secondary" className="gap-1">
            {keyword}
            <button
              onClick={() => removeKeyword(keyword)}
              className="ml-1 hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={keywords.length >= 50}
      />
    </div>
  );
}
```

### Phase 6: 整合到詳情頁 (1 point)

```typescript
// src/components/features/formats/FormatDetailView.tsx

// 新增 Tab
<TabsTrigger value="rules">識別規則</TabsTrigger>

// 新增 TabContent
<TabsContent value="rules">
  <IdentificationRulesEditor
    formatId={formatId}
    initialRules={format.identificationRules}
    onSuccess={refetch}
  />
</TabsContent>
```

---

## File Structure

```
src/
├── types/
│   └── document-format.ts         # 類型定義（更新）
├── validations/
│   └── document-format.ts         # Zod schema（新增）
├── components/features/formats/
│   ├── IdentificationRulesEditor.tsx
│   ├── IdentificationRulesView.tsx
│   ├── LogoPatternEditor.tsx
│   └── KeywordTagInput.tsx
└── app/api/v1/formats/[id]/
    └── route.ts                   # API（更新）
```

---

## Database Migration

```sql
-- 新增欄位
ALTER TABLE document_formats
ADD COLUMN identification_rules JSONB;
```

---

## Testing Checklist

- [ ] Prisma 遷移成功
- [ ] TypeScript 類型檢查通過
- [ ] ESLint 檢查通過
- [ ] Logo 特徵編輯正常
- [ ] 關鍵字輸入正常
- [ ] 優先級滑塊正常
- [ ] 保存功能正常
- [ ] API 驗證正確
