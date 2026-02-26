# Story 14-2: Prompt 配置管理介面

## Story 資訊

| 項目 | 內容 |
|------|------|
| **Story ID** | 14-2 |
| **Epic** | Epic 14 - Prompt 配置與動態生成 |
| **標題** | Prompt 配置管理介面 |
| **估點** | 5 點 |
| **優先級** | High |
| **狀態** | Backlog |

---

## User Story

**As a** 系統管理員
**I want to** 透過直觀的介面管理 Prompt 配置
**So that** 我可以輕鬆創建、編輯和測試不同層級的 Prompt 配置

---

## 驗收標準 (Acceptance Criteria)

### AC1: 配置列表
- [ ] 顯示所有 Prompt 配置的列表視圖
- [ ] 支援按類型、層級、公司篩選
- [ ] 顯示配置的啟用狀態和優先級
- [ ] 支援快速啟用/停用配置

### AC2: 配置編輯器
- [ ] 提供 Prompt 內容編輯器（支援語法高亮）
- [ ] 支援變數插入功能（從預設變數列表選擇）
- [ ] 即時預覽變數替換後的結果
- [ ] 支援儲存草稿功能

### AC3: 配置測試
- [ ] 提供測試面板輸入模擬數據
- [ ] 顯示合併後的最終 Prompt
- [ ] 顯示配置繼承鏈
- [ ] 支援快速複製測試結果

### AC4: 層級管理
- [ ] 清楚顯示配置的層級關係
- [ ] 支援從父層級複製配置
- [ ] 視覺化顯示配置覆蓋情況

---

## 技術設計

### 1. React Query Hooks

```typescript
// src/hooks/use-prompt-configs.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PromptConfig, PromptType } from '@prisma/client';

interface PromptConfigFilters {
  type?: PromptType;
  companyId?: string | null;
  documentFormatId?: string | null;
  isActive?: boolean;
}

export function usePromptConfigs(filters: PromptConfigFilters = {}) {
  return useQuery({
    queryKey: ['promptConfigs', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.type) params.set('type', filters.type);
      if (filters.companyId) params.set('companyId', filters.companyId);
      if (filters.documentFormatId) params.set('documentFormatId', filters.documentFormatId);
      if (filters.isActive !== undefined) params.set('isActive', String(filters.isActive));

      const response = await fetch(`/api/v1/admin/prompt-configs?${params}`);
      if (!response.ok) throw new Error('Failed to fetch prompt configs');
      return response.json();
    },
  });
}

export function usePromptConfig(id: string) {
  return useQuery({
    queryKey: ['promptConfig', id],
    queryFn: async () => {
      const response = await fetch(`/api/v1/admin/prompt-configs/${id}`);
      if (!response.ok) throw new Error('Failed to fetch prompt config');
      return response.json();
    },
    enabled: !!id,
  });
}

export function useCreatePromptConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<PromptConfig>) => {
      const response = await fetch('/api/v1/admin/prompt-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create prompt config');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promptConfigs'] });
    },
  });
}

export function useUpdatePromptConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PromptConfig> }) => {
      const response = await fetch(`/api/v1/admin/prompt-configs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update prompt config');
      return response.json();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['promptConfigs'] });
      queryClient.invalidateQueries({ queryKey: ['promptConfig', id] });
    },
  });
}

export function useDeletePromptConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/v1/admin/prompt-configs/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete prompt config');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promptConfigs'] });
    },
  });
}

export function useTestPromptConfig() {
  return useMutation({
    mutationFn: async (data: {
      type: PromptType;
      companyId?: string;
      documentFormatId?: string;
      testData?: Record<string, unknown>;
    }) => {
      const response = await fetch('/api/v1/admin/prompt-configs/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to test prompt config');
      return response.json();
    },
  });
}
```

### 2. UI 組件

#### 2.1 配置列表組件

```typescript
// src/components/features/prompt-config/PromptConfigList.tsx

'use client';

import * as React from 'react';
import { usePromptConfigs, useUpdatePromptConfig } from '@/hooks/use-prompt-configs';
import { PromptType } from '@prisma/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, TestTube } from 'lucide-react';

interface PromptConfigListProps {
  filters?: {
    type?: PromptType;
    companyId?: string;
  };
  onEdit?: (id: string) => void;
  onTest?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const TYPE_LABELS: Record<PromptType, string> = {
  ISSUER_IDENTIFICATION: '發行者識別',
  TERM_CLASSIFICATION: '術語分類',
  FIELD_EXTRACTION: '欄位提取',
  VALIDATION: '驗證',
};

const SCOPE_LABELS = {
  GLOBAL: '全域',
  COMPANY: '公司',
  FORMAT: '格式',
  SPECIFIC: '特定',
};

export function PromptConfigList({
  filters,
  onEdit,
  onTest,
  onDelete,
}: PromptConfigListProps) {
  const { data, isLoading } = usePromptConfigs(filters);
  const updateMutation = useUpdatePromptConfig();

  const handleToggleActive = async (id: string, isActive: boolean) => {
    await updateMutation.mutateAsync({ id, data: { isActive } });
  };

  const getScope = (config: any) => {
    if (config.companyId && config.documentFormatId) return 'SPECIFIC';
    if (config.companyId) return 'COMPANY';
    if (config.documentFormatId) return 'FORMAT';
    return 'GLOBAL';
  };

  if (isLoading) {
    return <div className="p-4">載入中...</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>名稱</TableHead>
          <TableHead>類型</TableHead>
          <TableHead>層級</TableHead>
          <TableHead>優先級</TableHead>
          <TableHead>狀態</TableHead>
          <TableHead>操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data?.data?.map((config: any) => (
          <TableRow key={config.id}>
            <TableCell className="font-medium">{config.name}</TableCell>
            <TableCell>
              <Badge variant="outline">{TYPE_LABELS[config.type as PromptType]}</Badge>
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{SCOPE_LABELS[getScope(config)]}</Badge>
            </TableCell>
            <TableCell>{config.priority}</TableCell>
            <TableCell>
              <Switch
                checked={config.isActive}
                onCheckedChange={(checked) => handleToggleActive(config.id, checked)}
              />
            </TableCell>
            <TableCell>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => onEdit?.(config.id)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onTest?.(config.id)}>
                  <TestTube className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onDelete?.(config.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

#### 2.2 Prompt 編輯器組件

```typescript
// src/components/features/prompt-config/PromptEditor.tsx

'use client';

import * as React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  variables?: string[];
  previewContext?: Record<string, string>;
  label?: string;
  maxLength?: number;
  placeholder?: string;
  error?: string;
}

const DEFAULT_VARIABLES = [
  { name: 'companyName', description: '公司名稱' },
  { name: 'documentType', description: '文件類型' },
  { name: 'knownTerms', description: '已知術語列表' },
  { name: 'processingDate', description: '處理日期' },
  { name: 'fileName', description: '檔案名稱' },
];

export function PromptEditor({
  value,
  onChange,
  variables = DEFAULT_VARIABLES.map(v => v.name),
  previewContext = {},
  label,
  maxLength = 10000,
  placeholder,
  error,
}: PromptEditorProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // 插入變數到游標位置
  const insertVariable = (varName: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue =
      value.substring(0, start) +
      `{{${varName}}}` +
      value.substring(end);

    onChange(newValue);

    // 恢復游標位置
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + varName.length + 4, start + varName.length + 4);
    }, 0);
  };

  // 預覽變數替換結果
  const getPreview = () => {
    let preview = value;
    for (const [key, val] of Object.entries(previewContext)) {
      preview = preview.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
    }
    return preview;
  };

  return (
    <div className="space-y-4">
      {label && <label className="text-sm font-medium">{label}</label>}

      <Tabs defaultValue="edit">
        <TabsList>
          <TabsTrigger value="edit">編輯</TabsTrigger>
          <TabsTrigger value="preview">預覽</TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="space-y-4">
          {/* 變數快速插入 */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground">插入變數：</span>
            {DEFAULT_VARIABLES.map((v) => (
              <Button
                key={v.name}
                size="sm"
                variant="outline"
                onClick={() => insertVariable(v.name)}
                title={v.description}
              >
                {`{{${v.name}}}`}
              </Button>
            ))}
          </div>

          {/* 編輯區 */}
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="min-h-[300px] font-mono"
            maxLength={maxLength}
          />

          {/* 字數統計 */}
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{error && <span className="text-destructive">{error}</span>}</span>
            <span>{value.length} / {maxLength}</span>
          </div>
        </TabsContent>

        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">預覽結果</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded">
                {getPreview()}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

#### 2.3 配置測試面板

```typescript
// src/components/features/prompt-config/PromptTester.tsx

'use client';

import * as React from 'react';
import { useTestPromptConfig } from '@/hooks/use-prompt-configs';
import { PromptType } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Copy, Check } from 'lucide-react';

interface PromptTesterProps {
  defaultType?: PromptType;
  defaultCompanyId?: string;
  defaultFormatId?: string;
}

export function PromptTester({
  defaultType = 'ISSUER_IDENTIFICATION',
  defaultCompanyId,
  defaultFormatId,
}: PromptTesterProps) {
  const [type, setType] = React.useState<PromptType>(defaultType);
  const [companyId, setCompanyId] = React.useState(defaultCompanyId || '');
  const [formatId, setFormatId] = React.useState(defaultFormatId || '');
  const [testData, setTestData] = React.useState<Record<string, string>>({
    companyName: 'DHL Express',
    documentType: 'Invoice',
    knownTerms: 'Freight, Customs, Handling',
  });
  const [copied, setCopied] = React.useState(false);

  const testMutation = useTestPromptConfig();

  const handleTest = async () => {
    await testMutation.mutateAsync({
      type,
      companyId: companyId || undefined,
      documentFormatId: formatId || undefined,
      testData,
    });
  };

  const handleCopy = async () => {
    if (testMutation.data) {
      await navigator.clipboard.writeText(
        JSON.stringify(testMutation.data, null, 2)
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* 測試參數 */}
      <Card>
        <CardHeader>
          <CardTitle>測試參數</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Prompt 類型</Label>
              <Select value={type} onValueChange={(v) => setType(v as PromptType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ISSUER_IDENTIFICATION">發行者識別</SelectItem>
                  <SelectItem value="TERM_CLASSIFICATION">術語分類</SelectItem>
                  <SelectItem value="FIELD_EXTRACTION">欄位提取</SelectItem>
                  <SelectItem value="VALIDATION">驗證</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>公司 ID（選填）</Label>
              <Input
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                placeholder="輸入公司 ID"
              />
            </div>

            <div className="space-y-2">
              <Label>格式 ID（選填）</Label>
              <Input
                value={formatId}
                onChange={(e) => setFormatId(e.target.value)}
                placeholder="輸入格式 ID"
              />
            </div>
          </div>

          {/* 測試數據 */}
          <div className="space-y-2">
            <Label>測試變數</Label>
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(testData).map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{key}</Label>
                  <Input
                    value={value}
                    onChange={(e) =>
                      setTestData((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <Button onClick={handleTest} disabled={testMutation.isPending}>
            {testMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            執行測試
          </Button>
        </CardContent>
      </Card>

      {/* 測試結果 */}
      {testMutation.data && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>測試結果</CardTitle>
            <Button size="sm" variant="ghost" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 配置鏈 */}
            <div>
              <Label className="text-sm">配置繼承鏈</Label>
              <div className="flex gap-2 mt-2">
                {testMutation.data.metadata?.configChain?.map(
                  (config: any, index: number) => (
                    <React.Fragment key={config.id}>
                      <span className="px-2 py-1 bg-muted rounded text-sm">
                        {config.name} ({config.scope})
                      </span>
                      {index < testMutation.data.metadata.configChain.length - 1 && (
                        <span className="text-muted-foreground">→</span>
                      )}
                    </React.Fragment>
                  )
                )}
              </div>
            </div>

            {/* System Prompt */}
            <div>
              <Label className="text-sm">System Prompt</Label>
              <pre className="mt-2 p-4 bg-muted rounded text-sm whitespace-pre-wrap">
                {testMutation.data.systemPrompt}
              </pre>
            </div>

            {/* User Prompt */}
            <div>
              <Label className="text-sm">User Prompt</Label>
              <pre className="mt-2 p-4 bg-muted rounded text-sm whitespace-pre-wrap">
                {testMutation.data.userPrompt}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

#### 2.4 配置頁面

```typescript
// src/app/(dashboard)/admin/prompt-configs/page.tsx

'use client';

import * as React from 'react';
import { PromptConfigList } from '@/components/features/prompt-config/PromptConfigList';
import { PromptTester } from '@/components/features/prompt-config/PromptTester';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus } from 'lucide-react';

export default function PromptConfigsPage() {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Prompt 配置管理</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          新增配置
        </Button>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">配置列表</TabsTrigger>
          <TabsTrigger value="test">測試工具</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          <PromptConfigList
            onEdit={(id) => setSelectedId(id)}
            onTest={(id) => setSelectedId(id)}
          />
        </TabsContent>

        <TabsContent value="test" className="mt-4">
          <PromptTester />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

## 依賴關係

### 前置依賴
- **Story 14-1**: Prompt 配置模型與 API（提供後端 API）

### 後續 Story
- **Story 14-3**: Prompt 解析與合併服務（使用本介面測試配置）

---

## 實施計劃

### 開發順序

1. **Phase 1: React Query Hooks** (1.5 小時)
   - 實現所有 CRUD hooks
   - 實現測試 hook

2. **Phase 2: 配置列表** (1.5 小時)
   - PromptConfigList 組件
   - 篩選和排序功能

3. **Phase 3: 編輯器** (2 小時)
   - PromptEditor 組件
   - 變數插入功能
   - 預覽功能

4. **Phase 4: 測試面板** (1.5 小時)
   - PromptTester 組件
   - 結果顯示

5. **Phase 5: 整合頁面** (1.5 小時)
   - 管理頁面
   - 路由配置

---

## 變更日誌

| 版本 | 日期 | 變更內容 |
|------|------|----------|
| 1.0.0 | 2026-01-02 | 初始版本 |

---

*Story created: 2026-01-02*
*Epic: 14 - Prompt 配置與動態生成*
