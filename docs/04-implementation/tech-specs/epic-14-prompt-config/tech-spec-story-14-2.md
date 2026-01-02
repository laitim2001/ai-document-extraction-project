# Tech Spec: Story 14.2 - Prompt 配置管理介面

## 概覽

| 項目 | 內容 |
|------|------|
| **Story ID** | 14.2 |
| **Story 名稱** | Prompt 配置管理介面 |
| **Epic** | Epic 14 - Prompt 配置與動態生成 |
| **優先級** | High |
| **估計點數** | 8 |
| **依賴** | Story 14.1 (Prompt 配置 API) |

---

## 目標

提供可視化的 Prompt 配置管理介面，讓管理員可以輕鬆編輯、預覽和測試不同的 Prompt 配置。

---

## Acceptance Criteria 對應

| AC | 描述 | 實現方式 |
|----|------|----------|
| AC1 | 配置列表按 promptType 分組 | PromptConfigList 組件 + 分組邏輯 |
| AC2 | Markdown 語法高亮 | Monaco Editor / CodeMirror |
| AC3 | 變數插入功能 | VariableInserter 組件 |
| AC4 | 即時預覽最終 Prompt | PromptPreview 組件 |
| AC5 | 上傳測試文件執行 | PromptTester 組件 |

---

## 實現指南

### Phase 1: 類型定義

**檔案**: `src/types/prompt-config-ui.ts`

```typescript
/**
 * @fileoverview Prompt 配置 UI 類型定義
 * @module src/types/prompt-config-ui
 * @since Epic 14 - Story 14.2
 */

import type { PromptConfig, PromptType, PromptScope } from './prompt-config';

// ============================================================================
// UI 狀態類型
// ============================================================================

export interface PromptConfigGrouped {
  [key: string]: PromptConfig[]; // key = PromptType
}

export interface PromptEditorState {
  systemPrompt: string;
  userPromptTemplate: string;
  variables: VariableValue[];
  isDirty: boolean;
  isValid: boolean;
  validationErrors: string[];
}

export interface VariableValue {
  name: string;
  value: string;
  source: 'static' | 'dynamic' | 'context';
}

// ============================================================================
// 預覽相關
// ============================================================================

export interface PromptPreviewResult {
  systemPrompt: string;
  userPrompt: string;
  resolvedVariables: Record<string, string>;
}

export interface PromptTestRequest {
  configId: string;
  testFile: File;
  overrideSystemPrompt?: string;
  overrideUserPromptTemplate?: string;
  customVariables?: Record<string, string>;
}

export interface PromptTestResult {
  success: boolean;
  extractedData?: Record<string, unknown>;
  rawResponse?: string;
  executionTimeMs: number;
  tokensUsed?: {
    prompt: number;
    completion: number;
  };
  error?: string;
}

// ============================================================================
// 變數相關
// ============================================================================

export interface AvailableVariable {
  name: string;
  displayName: string;
  description: string;
  category: 'static' | 'dynamic' | 'context';
  example?: string;
}

export const SYSTEM_VARIABLES: AvailableVariable[] = [
  // 靜態變數
  {
    name: 'companyName',
    displayName: '公司名稱',
    description: '文件發行公司的名稱',
    category: 'static',
    example: 'DHL Express',
  },
  {
    name: 'documentFormatName',
    displayName: '文件格式名稱',
    description: '文件格式的名稱',
    category: 'static',
    example: 'DHL Express Invoice',
  },
  // 動態變數
  {
    name: 'knownTerms',
    displayName: '已知術語列表',
    description: '該公司/格式已識別的術語',
    category: 'dynamic',
    example: 'Fuel Surcharge, AWB Fee, Handling Fee',
  },
  {
    name: 'recentExtractions',
    displayName: '近期提取樣本',
    description: '最近處理的相似文件提取結果',
    category: 'dynamic',
  },
  // 上下文變數
  {
    name: 'currentDate',
    displayName: '當前日期',
    description: '處理時的日期',
    category: 'context',
    example: '2026-01-02',
  },
  {
    name: 'pageCount',
    displayName: '頁數',
    description: '文件總頁數',
    category: 'context',
    example: '3',
  },
];
```

---

### Phase 2: 配置列表頁面

**檔案**: `src/app/(dashboard)/admin/prompt-configs/page.tsx`

```typescript
/**
 * @fileoverview Prompt 配置管理頁面
 * @module src/app/(dashboard)/admin/prompt-configs
 * @since Epic 14 - Story 14.2
 */

'use client';

import * as React from 'react';
import { PromptConfigList } from '@/components/features/prompt-config/PromptConfigList';
import { PromptConfigFilters } from '@/components/features/prompt-config/PromptConfigFilters';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { usePromptConfigs } from '@/hooks/use-prompt-configs';

export default function PromptConfigsPage() {
  const router = useRouter();
  const [filters, setFilters] = React.useState({});
  const { data, isLoading, error } = usePromptConfigs(filters);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Prompt 配置管理</h1>
          <p className="text-muted-foreground">
            管理不同 Company 和 DocumentFormat 的 GPT Prompt 配置
          </p>
        </div>
        <Button onClick={() => router.push('/admin/prompt-configs/new')}>
          <Plus className="h-4 w-4 mr-2" />
          新增配置
        </Button>
      </div>

      {/* 篩選器 */}
      <PromptConfigFilters filters={filters} onFiltersChange={setFilters} />

      {/* 配置列表 */}
      <PromptConfigList
        configs={data?.data ?? []}
        isLoading={isLoading}
        error={error}
        onEdit={(id) => router.push(`/admin/prompt-configs/${id}`)}
      />
    </div>
  );
}
```

---

### Phase 3: 配置列表組件

**檔案**: `src/components/features/prompt-config/PromptConfigList.tsx`

```typescript
/**
 * @fileoverview Prompt 配置列表組件（按類型分組）
 * @module src/components/features/prompt-config/PromptConfigList
 * @since Epic 14 - Story 14.2
 */

'use client';

import * as React from 'react';
import type { PromptConfig, PromptType } from '@/types/prompt-config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText,
  Building2,
  Globe,
  Layers,
  Edit,
  MoreVertical,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface PromptConfigListProps {
  configs: PromptConfig[];
  isLoading: boolean;
  error: Error | null;
  onEdit: (id: string) => void;
}

const PROMPT_TYPE_LABELS: Record<PromptType, string> = {
  ISSUER_IDENTIFICATION: '發行者識別',
  TERM_CLASSIFICATION: '術語分類',
  FIELD_EXTRACTION: '欄位提取',
  VALIDATION: '結果驗證',
};

const PROMPT_TYPE_ICONS: Record<PromptType, React.ReactNode> = {
  ISSUER_IDENTIFICATION: <Building2 className="h-5 w-5" />,
  TERM_CLASSIFICATION: <FileText className="h-5 w-5" />,
  FIELD_EXTRACTION: <Layers className="h-5 w-5" />,
  VALIDATION: <FileText className="h-5 w-5" />,
};

const SCOPE_COLORS = {
  GLOBAL: 'bg-blue-100 text-blue-800',
  COMPANY: 'bg-green-100 text-green-800',
  FORMAT: 'bg-purple-100 text-purple-800',
};

export function PromptConfigList({
  configs,
  isLoading,
  error,
  onEdit,
}: PromptConfigListProps) {
  // 按 promptType 分組
  const groupedConfigs = React.useMemo(() => {
    const groups: Record<string, PromptConfig[]> = {};
    for (const config of configs) {
      if (!groups[config.promptType]) {
        groups[config.promptType] = [];
      }
      groups[config.promptType].push(config);
    }
    return groups;
  }, [configs]);

  if (isLoading) {
    return <PromptConfigListSkeleton />;
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        載入失敗：{error.message}
      </div>
    );
  }

  if (configs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        尚無 Prompt 配置
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {Object.entries(groupedConfigs).map(([promptType, typeConfigs]) => (
        <div key={promptType}>
          {/* 類型標題 */}
          <div className="flex items-center gap-2 mb-4">
            {PROMPT_TYPE_ICONS[promptType as PromptType]}
            <h2 className="text-lg font-semibold">
              {PROMPT_TYPE_LABELS[promptType as PromptType]}
            </h2>
            <Badge variant="secondary">{typeConfigs.length}</Badge>
          </div>

          {/* 配置卡片列表 */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {typeConfigs.map((config) => (
              <Card key={config.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{config.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={SCOPE_COLORS[config.scope]}>
                          {config.scope}
                        </Badge>
                        {!config.isActive && (
                          <Badge variant="outline" className="text-muted-foreground">
                            停用
                          </Badge>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(config.id)}>
                          <Edit className="h-4 w-4 mr-2" />
                          編輯
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  {config.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {config.description}
                    </p>
                  )}
                  <div className="mt-2 text-xs text-muted-foreground">
                    {config.company && (
                      <div className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {config.company.name}
                      </div>
                    )}
                    {config.documentFormat && (
                      <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {config.documentFormat.name}
                      </div>
                    )}
                    {config.scope === 'GLOBAL' && (
                      <div className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        全局配置
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PromptConfigListSkeleton() {
  return (
    <div className="space-y-8">
      {[1, 2].map((group) => (
        <div key={group}>
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((card) => (
              <Skeleton key={card} className="h-32" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

### Phase 4: Prompt 編輯器組件

**檔案**: `src/components/features/prompt-config/PromptEditor.tsx`

```typescript
/**
 * @fileoverview Prompt 編輯器組件（支援變數插入和預覽）
 * @module src/components/features/prompt-config/PromptEditor
 * @since Epic 14 - Story 14.2
 */

'use client';

import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Variable, Eye, Code } from 'lucide-react';
import { SYSTEM_VARIABLES, type AvailableVariable } from '@/types/prompt-config-ui';

interface PromptEditorProps {
  systemPrompt: string;
  userPromptTemplate: string;
  onSystemPromptChange: (value: string) => void;
  onUserPromptTemplateChange: (value: string) => void;
  previewContext?: Record<string, string>;
}

export function PromptEditor({
  systemPrompt,
  userPromptTemplate,
  onSystemPromptChange,
  onUserPromptTemplateChange,
  previewContext = {},
}: PromptEditorProps) {
  const [activeTab, setActiveTab] = React.useState<'system' | 'user'>('system');
  const [showPreview, setShowPreview] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // 插入變數到游標位置
  const insertVariable = React.useCallback(
    (variableName: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = activeTab === 'system' ? systemPrompt : userPromptTemplate;
      const variableText = `{{${variableName}}}`;

      const newText = text.slice(0, start) + variableText + text.slice(end);

      if (activeTab === 'system') {
        onSystemPromptChange(newText);
      } else {
        onUserPromptTemplateChange(newText);
      }

      // 恢復游標位置
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(
          start + variableText.length,
          start + variableText.length
        );
      }, 0);
    },
    [activeTab, systemPrompt, userPromptTemplate, onSystemPromptChange, onUserPromptTemplateChange]
  );

  // 預覽替換變數後的內容
  const previewContent = React.useMemo(() => {
    const content = activeTab === 'system' ? systemPrompt : userPromptTemplate;
    let result = content;

    // 替換所有變數
    const variablePattern = /\{\{(\w+)\}\}/g;
    result = result.replace(variablePattern, (match, varName) => {
      if (previewContext[varName]) {
        return previewContext[varName];
      }
      const systemVar = SYSTEM_VARIABLES.find((v) => v.name === varName);
      return systemVar?.example ?? match;
    });

    return result;
  }, [activeTab, systemPrompt, userPromptTemplate, previewContext]);

  return (
    <div className="space-y-4">
      {/* 編輯器標籤頁 */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'system' | 'user')}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="system">System Prompt</TabsTrigger>
            <TabsTrigger value="user">User Prompt Template</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            {/* 變數插入器 */}
            <VariableInserter onInsert={insertVariable} />

            {/* 預覽切換 */}
            <Button
              variant={showPreview ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? <Code className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
              {showPreview ? '原始碼' : '預覽'}
            </Button>
          </div>
        </div>

        <TabsContent value="system" className="mt-4">
          <Label htmlFor="systemPrompt">System Prompt</Label>
          <p className="text-sm text-muted-foreground mb-2">
            定義 AI 的角色和行為準則
          </p>
          {showPreview ? (
            <PromptPreviewPane content={previewContent} />
          ) : (
            <Textarea
              ref={textareaRef}
              id="systemPrompt"
              value={systemPrompt}
              onChange={(e) => onSystemPromptChange(e.target.value)}
              className="min-h-[300px] font-mono text-sm"
              placeholder="You are an AI assistant specialized in..."
            />
          )}
        </TabsContent>

        <TabsContent value="user" className="mt-4">
          <Label htmlFor="userPromptTemplate">User Prompt Template</Label>
          <p className="text-sm text-muted-foreground mb-2">
            用戶提示模板，支援變數如 {'{{companyName}}'}, {'{{knownTerms}}'}
          </p>
          {showPreview ? (
            <PromptPreviewPane content={previewContent} />
          ) : (
            <Textarea
              ref={textareaRef}
              id="userPromptTemplate"
              value={userPromptTemplate}
              onChange={(e) => onUserPromptTemplateChange(e.target.value)}
              className="min-h-[400px] font-mono text-sm"
              placeholder="Please analyze the following invoice from {{companyName}}..."
            />
          )}
        </TabsContent>
      </Tabs>

      {/* 字數統計 */}
      <div className="flex justify-end text-xs text-muted-foreground">
        <span>
          System: {systemPrompt.length} 字 | User: {userPromptTemplate.length} 字
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// 變數插入器
// ============================================================================

interface VariableInserterProps {
  onInsert: (variableName: string) => void;
}

function VariableInserter({ onInsert }: VariableInserterProps) {
  const groupedVariables = React.useMemo(() => {
    const groups: Record<string, AvailableVariable[]> = {
      static: [],
      dynamic: [],
      context: [],
    };
    for (const v of SYSTEM_VARIABLES) {
      groups[v.category].push(v);
    }
    return groups;
  }, []);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Variable className="h-4 w-4 mr-1" />
          插入變數
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <ScrollArea className="h-[300px]">
          <div className="space-y-4">
            {/* 靜態變數 */}
            <VariableGroup
              title="靜態變數"
              description="配置時定義的固定值"
              variables={groupedVariables.static}
              onInsert={onInsert}
            />

            {/* 動態變數 */}
            <VariableGroup
              title="動態變數"
              description="運行時從資料庫計算"
              variables={groupedVariables.dynamic}
              onInsert={onInsert}
            />

            {/* 上下文變數 */}
            <VariableGroup
              title="上下文變數"
              description="處理流程中的上下文資訊"
              variables={groupedVariables.context}
              onInsert={onInsert}
            />
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function VariableGroup({
  title,
  description,
  variables,
  onInsert,
}: {
  title: string;
  description: string;
  variables: AvailableVariable[];
  onInsert: (name: string) => void;
}) {
  if (variables.length === 0) return null;

  return (
    <div>
      <h4 className="font-medium text-sm">{title}</h4>
      <p className="text-xs text-muted-foreground mb-2">{description}</p>
      <div className="space-y-1">
        {variables.map((v) => (
          <button
            key={v.name}
            className="w-full text-left p-2 rounded hover:bg-muted text-sm"
            onClick={() => onInsert(v.name)}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs">{`{{${v.name}}}`}</span>
              <Badge variant="outline" className="text-xs">
                {v.displayName}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{v.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 預覽面板
// ============================================================================

function PromptPreviewPane({ content }: { content: string }) {
  return (
    <div className="border rounded-md p-4 bg-muted/50 min-h-[300px]">
      <pre className="whitespace-pre-wrap text-sm font-mono">{content}</pre>
    </div>
  );
}
```

---

### Phase 5: Prompt 測試器組件

**檔案**: `src/components/features/prompt-config/PromptTester.tsx`

```typescript
/**
 * @fileoverview Prompt 測試器組件
 * @module src/components/features/prompt-config/PromptTester
 * @since Epic 14 - Story 14.2
 */

'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, Play, CheckCircle, XCircle } from 'lucide-react';
import type { PromptTestResult } from '@/types/prompt-config-ui';

interface PromptTesterProps {
  configId: string;
  onTest: (file: File) => Promise<PromptTestResult>;
}

export function PromptTester({ configId, onTest }: PromptTesterProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<PromptTestResult | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setResult(null); // 清除之前的結果
    }
  };

  const handleTest = async () => {
    if (!file) return;

    setIsLoading(true);
    try {
      const testResult = await onTest(file);
      setResult(testResult);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs: 0,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">測試 Prompt</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 文件上傳 */}
        <div>
          <Label htmlFor="testFile">上傳測試文件</Label>
          <div className="flex items-center gap-2 mt-2">
            <Input
              id="testFile"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={handleFileChange}
              className="flex-1"
            />
            <Button
              onClick={handleTest}
              disabled={!file || isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              執行測試
            </Button>
          </div>
          {file && (
            <p className="text-sm text-muted-foreground mt-1">
              已選擇: {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        {/* 測試結果 */}
        {result && (
          <div className="border rounded-md p-4 space-y-3">
            <div className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <span className="font-medium">
                {result.success ? '測試成功' : '測試失敗'}
              </span>
              <span className="text-sm text-muted-foreground">
                ({result.executionTimeMs.toFixed(0)}ms)
              </span>
            </div>

            {result.error && (
              <div className="p-3 bg-red-50 text-red-700 rounded text-sm">
                {result.error}
              </div>
            )}

            {result.extractedData && (
              <div>
                <h4 className="font-medium text-sm mb-2">提取結果：</h4>
                <pre className="p-3 bg-muted rounded text-xs overflow-auto max-h-[300px]">
                  {JSON.stringify(result.extractedData, null, 2)}
                </pre>
              </div>
            )}

            {result.tokensUsed && (
              <div className="text-sm text-muted-foreground">
                Token 使用量: Prompt {result.tokensUsed.prompt} + Completion{' '}
                {result.tokensUsed.completion} ={' '}
                {result.tokensUsed.prompt + result.tokensUsed.completion}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

---

### Phase 6: React Query Hooks

**檔案**: `src/hooks/use-prompt-configs.ts`

```typescript
/**
 * @fileoverview Prompt 配置 React Query Hooks
 * @module src/hooks/use-prompt-configs
 * @since Epic 14 - Story 14.2
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  PromptConfig,
  PromptConfigFilters,
  CreatePromptConfigRequest,
  UpdatePromptConfigRequest,
} from '@/types/prompt-config';
import type { PromptTestResult } from '@/types/prompt-config-ui';

const QUERY_KEY = 'prompt-configs';

// ============================================================================
// 查詢 Hooks
// ============================================================================

export function usePromptConfigs(filters: PromptConfigFilters = {}) {
  return useQuery({
    queryKey: [QUERY_KEY, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) params.set(key, String(value));
      });

      const res = await fetch(`/api/v1/prompt-configs?${params}`);
      if (!res.ok) throw new Error('Failed to fetch prompt configs');
      return res.json();
    },
  });
}

export function usePromptConfig(id: string) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/prompt-configs/${id}`);
      if (!res.ok) throw new Error('Failed to fetch prompt config');
      return res.json();
    },
    enabled: !!id,
  });
}

// ============================================================================
// 變更 Hooks
// ============================================================================

export function useCreatePromptConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePromptConfigRequest) => {
      const res = await fetch('/api/v1/prompt-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Failed to create prompt config');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useUpdatePromptConfig(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdatePromptConfigRequest) => {
      const res = await fetch(`/api/v1/prompt-configs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Failed to update prompt config');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

// ============================================================================
// 測試 Hook
// ============================================================================

export function useTestPromptConfig(configId: string) {
  return useMutation({
    mutationFn: async (file: File): Promise<PromptTestResult> => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('configId', configId);

      const res = await fetch('/api/v1/prompt-configs/test', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Test failed');
      }

      return res.json();
    },
  });
}
```

---

## 項目結構

```
src/
├── app/
│   └── (dashboard)/
│       └── admin/
│           └── prompt-configs/
│               ├── page.tsx              # 列表頁
│               ├── new/
│               │   └── page.tsx          # 新增頁
│               └── [id]/
│                   └── page.tsx          # 編輯頁
├── components/
│   └── features/
│       └── prompt-config/
│           ├── index.ts                  # 模組導出
│           ├── PromptConfigList.tsx      # 配置列表
│           ├── PromptConfigFilters.tsx   # 篩選器
│           ├── PromptEditor.tsx          # Prompt 編輯器
│           ├── PromptTester.tsx          # 測試器
│           └── PromptConfigForm.tsx      # 配置表單
├── hooks/
│   └── use-prompt-configs.ts             # React Query Hooks
└── types/
    └── prompt-config-ui.ts               # UI 類型定義
```

---

## 驗證清單

### 功能驗證
- [ ] 配置列表正確分組顯示
- [ ] 變數插入功能正常
- [ ] 預覽功能正確替換變數
- [ ] 測試功能上傳和執行正常
- [ ] 表單驗證正確

### UI/UX 驗證
- [ ] 響應式佈局正確
- [ ] 載入狀態顯示
- [ ] 錯誤狀態處理
- [ ] 鍵盤導航支援

---

## 依賴關係

### 內部依賴
- Story 14.1: Prompt 配置 API

### 外部依賴
- `@tanstack/react-query`: 資料查詢
- `lucide-react`: 圖標
- shadcn/ui 組件

---

*Tech Spec 建立日期: 2026-01-02*
*版本: 1.0.0*
