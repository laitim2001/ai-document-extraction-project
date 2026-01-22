# Story 18.7: 批量文件自動匹配到模版

**Status:** draft

---

## Story

**As a** 用戶,
**I want** 批量處理完成的文件能自動匹配到指定的數據模版,
**So that** 我不需要手動逐一操作，提高處理效率。

---

## 背景說明

### 問題陳述

目前文件處理流程（11 步驟）完成後，數據只是存儲在 Document 記錄中。用戶需要額外步驟才能將這些數據填入數據模版。本 Story 實現自動化整合，讓處理完的文件可以：

1. **自動匹配**：根據預設規則自動匹配到模版
2. **手動選擇**：用戶在處理完成後選擇目標模版
3. **批量操作**：一次性將多個文件匹配到同一模版

### 整合流程

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ 文件處理完成後的整合流程                                                                 │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  文件處理流程 (11 步驟)                                                                 │
│      │                                                                                  │
│      ▼                                                                                  │
│  Document 記錄 (status: COMPLETED, mappedFields 已填充)                                 │
│      │                                                                                  │
│      ├──────────────────────────────┬────────────────────────────────┐                 │
│      │                              │                                │                 │
│      ▼                              ▼                                ▼                 │
│  ┌──────────────┐          ┌──────────────┐               ┌──────────────┐            │
│  │ 自動匹配模式  │          │ 手動選擇模式  │               │ 批量操作模式  │            │
│  │              │          │              │               │              │            │
│  │ 根據規則自動  │          │ 用戶從 UI    │               │ 用戶選擇多個  │            │
│  │ 選擇模版並   │          │ 選擇目標模版  │               │ 文件一次性   │            │
│  │ 觸發匹配     │          │ 後觸發匹配   │               │ 匹配到模版   │            │
│  └──────┬───────┘          └──────┬───────┘               └──────┬───────┘            │
│         │                         │                              │                     │
│         └─────────────────────────┼──────────────────────────────┘                     │
│                                   │                                                     │
│                                   ▼                                                     │
│                      TemplateMatchingEngineService.matchDocuments()                     │
│                                   │                                                     │
│                                   ▼                                                     │
│                      TemplateInstance (填充後的數據)                                     │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 自動匹配規則

```
自動匹配規則優先級：

1. FORMAT 級別規則
   └── DocumentFormat.defaultTemplateId
   └── 該格式的文件自動匹配到指定模版

2. COMPANY 級別規則
   └── Company.defaultTemplateId
   └── 該公司的文件自動匹配到指定模版

3. GLOBAL 級別規則
   └── SystemSetting.defaultTemplateId
   └── 所有未匹配的文件使用全局預設模版

4. 無規則
   └── 不自動匹配，等待用戶手動選擇
```

---

## Acceptance Criteria

### AC1: 自動匹配觸發

**Given** Document 處理完成 (status: COMPLETED)
**When** 有配置自動匹配規則
**Then**:
  - 自動選擇目標模版
  - 自動觸發 matchDocuments
  - 更新 Document.templateInstanceId

### AC2: 自動匹配規則配置

**Given** 自動匹配設定頁面
**When** 配置規則
**Then**:
  - 支援 FORMAT 級別設定 (DocumentFormat.defaultTemplateId)
  - 支援 COMPANY 級別設定 (Company.defaultTemplateId)
  - 支援 GLOBAL 級別設定

### AC3: 手動選擇模版

**Given** 已處理完成但未匹配的文件列表
**When** 選擇文件並點擊「匹配到模版」
**Then**:
  - 顯示模版選擇對話框
  - 選擇現有或創建新的 TemplateInstance
  - 執行匹配並顯示結果

### AC4: 批量選擇匹配

**Given** 文件列表頁面
**When** 選中多個文件並執行批量匹配
**Then**:
  - 支援最多 500 個文件
  - 顯示進度條
  - 批量完成後顯示統計（成功/失敗數量）

### AC5: 匹配結果追蹤

**Given** Document 模型
**When** 匹配完成
**Then**:
  - 更新 Document.templateInstanceId
  - 更新 Document.templateMatchedAt
  - 記錄匹配審計日誌

### AC6: 重新匹配

**Given** 已匹配的 Document
**When** 需要重新匹配
**Then**:
  - 支援移除現有匹配
  - 支援重新選擇模版
  - 警告會影響現有 TemplateInstance

### AC7: 整合到處理流程 UI

**Given** 文件處理完成頁面
**When** 顯示處理結果
**Then**:
  - 顯示自動匹配結果（如有）
  - 顯示「匹配到模版」按鈕（如未匹配）
  - 顯示匹配的 TemplateInstance 連結（如已匹配）

### AC8: 匹配狀態篩選

**Given** 文件列表篩選器
**When** 按匹配狀態篩選
**Then**:
  - 「已匹配」：templateInstanceId 不為空
  - 「未匹配」：templateInstanceId 為空
  - 「待審核」：處理完成但未匹配

---

## Tasks / Subtasks

- [ ] **Task 1: 數據模型更新** (AC: #5)
  - [ ] 1.1 更新 Document 模型新增 templateInstanceId
  - [ ] 1.2 新增 templateMatchedAt 時間戳
  - [ ] 1.3 更新 DocumentFormat 新增 defaultTemplateId
  - [ ] 1.4 更新 Company 新增 defaultTemplateId
  - [ ] 1.5 執行資料庫遷移

- [ ] **Task 2: 自動匹配服務** (AC: #1, #2)
  - [ ] 2.1 新增 `auto-template-matching.service.ts`
  - [ ] 2.2 實現 resolveDefaultTemplate 規則解析
  - [ ] 2.3 實現 autoMatch 自動匹配
  - [ ] 2.4 整合到處理流程 Step 11 後

- [ ] **Task 3: 自動匹配規則配置 UI** (AC: #2)
  - [ ] 3.1 更新 DocumentFormat 編輯頁面
  - [ ] 3.2 更新 Company 編輯頁面
  - [ ] 3.3 新增全局設定頁面

- [ ] **Task 4: 手動匹配 UI** (AC: #3, #7)
  - [ ] 4.1 新增 `MatchToTemplateDialog` 組件
  - [ ] 4.2 實現模版選擇和實例選擇
  - [ ] 4.3 整合到文件列表和詳情頁面

- [ ] **Task 5: 批量匹配功能** (AC: #4)
  - [ ] 5.1 新增 `BulkMatchDialog` 組件
  - [ ] 5.2 實現批量選擇和進度顯示
  - [ ] 5.3 實現批量 API

- [ ] **Task 6: 重新匹配功能** (AC: #6)
  - [ ] 6.1 新增 `RematchDialog` 組件
  - [ ] 6.2 實現移除匹配
  - [ ] 6.3 實現重新選擇

- [ ] **Task 7: 列表篩選** (AC: #8)
  - [ ] 7.1 更新 DocumentFilters 組件
  - [ ] 7.2 更新 API 支援匹配狀態篩選

- [ ] **Task 8: API 端點**
  - [ ] 8.1 新增 `/api/v1/documents/match` (批量匹配)
  - [ ] 8.2 新增 `/api/v1/documents/:id/match` (單一匹配)
  - [ ] 8.3 新增 `/api/v1/documents/:id/unmatch` (取消匹配)

---

## Dev Notes

### 依賴項

- **Story 18-3**: TemplateMatchingEngineService
- **Story 18-2**: TemplateInstance

### 數據模型更新

```prisma
model Document {
  // ... 現有欄位

  // 新增：模版匹配關聯
  templateInstanceId    String?   @map("template_instance_id")
  templateInstance      TemplateInstance? @relation(fields: [templateInstanceId], references: [id])
  templateMatchedAt     DateTime? @map("template_matched_at")
}

model DocumentFormat {
  // ... 現有欄位

  // 新增：預設模版
  defaultTemplateId     String?   @map("default_template_id")
  defaultTemplate       DataTemplate? @relation(fields: [defaultTemplateId], references: [id])
}

model Company {
  // ... 現有欄位

  // 新增：預設模版
  defaultTemplateId     String?   @map("default_template_id")
  defaultTemplate       DataTemplate? @relation(fields: [defaultTemplateId], references: [id])
}
```

### 新增文件

```
prisma/
└── schema.prisma                              # 更新

src/
├── services/
│   └── auto-template-matching.service.ts      # 新增
├── app/api/v1/documents/
│   ├── match/route.ts                         # 新增
│   └── [id]/
│       ├── match/route.ts                     # 新增
│       └── unmatch/route.ts                   # 新增
├── components/features/documents/
│   ├── MatchToTemplateDialog.tsx              # 新增
│   ├── BulkMatchDialog.tsx                    # 新增
│   └── RematchDialog.tsx                      # 新增
└── components/features/document-format/
    └── DefaultTemplateSelector.tsx            # 新增
```

### 自動匹配服務設計

```typescript
// src/services/auto-template-matching.service.ts

export class AutoTemplateMatchingService {
  /**
   * 解析預設模版
   */
  async resolveDefaultTemplate(
    companyId: string,
    formatId?: string,
  ): Promise<DataTemplate | null> {
    // 1. FORMAT 級別
    if (formatId) {
      const format = await prisma.documentFormat.findUnique({
        where: { id: formatId },
        include: { defaultTemplate: true },
      });
      if (format?.defaultTemplate) {
        return format.defaultTemplate;
      }
    }

    // 2. COMPANY 級別
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { defaultTemplate: true },
    });
    if (company?.defaultTemplate) {
      return company.defaultTemplate;
    }

    // 3. GLOBAL 級別
    const globalSetting = await this.getGlobalDefaultTemplate();
    if (globalSetting) {
      return globalSetting;
    }

    return null;
  }

  /**
   * 自動匹配（在處理流程完成後調用）
   */
  async autoMatch(documentId: string): Promise<MatchResult | null> {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { companyId: true, documentFormatId: true },
    });

    if (!document?.companyId) {
      return null;
    }

    // 解析預設模版
    const template = await this.resolveDefaultTemplate(
      document.companyId,
      document.documentFormatId || undefined,
    );

    if (!template) {
      return null; // 無預設模版，等待手動匹配
    }

    // 查找或創建 TemplateInstance
    const instance = await this.getOrCreateInstance(template.id);

    // 執行匹配
    const engine = new TemplateMatchingEngineService();
    return engine.matchDocuments({
      documentIds: [documentId],
      templateInstanceId: instance.id,
    });
  }

  /**
   * 批量手動匹配
   */
  async batchMatch(params: BatchMatchParams): Promise<BatchMatchResult> {
    const { documentIds, templateInstanceId, options } = params;

    const results: MatchResult[] = [];
    const batchSize = options?.batchSize || 50;

    // 分批處理
    for (let i = 0; i < documentIds.length; i += batchSize) {
      const batch = documentIds.slice(i, i + batchSize);

      const engine = new TemplateMatchingEngineService();
      const result = await engine.matchDocuments({
        documentIds: batch,
        templateInstanceId,
      });

      results.push(result);

      // 更新 Document 記錄
      await prisma.document.updateMany({
        where: { id: { in: batch } },
        data: {
          templateInstanceId,
          templateMatchedAt: new Date(),
        },
      });

      // 進度回調
      if (options?.onProgress) {
        options.onProgress({
          processed: Math.min(i + batchSize, documentIds.length),
          total: documentIds.length,
        });
      }
    }

    return {
      totalDocuments: documentIds.length,
      successCount: results.reduce((sum, r) => sum + r.validRows, 0),
      errorCount: results.reduce((sum, r) => sum + r.invalidRows, 0),
    };
  }
}
```

### 處理流程整合

```typescript
// 在 unified-processing-pipeline 的 Step 11 後添加

async function afterProcessingComplete(documentId: string) {
  // 原有的路由決策邏輯...

  // 新增：嘗試自動匹配
  const autoMatchService = new AutoTemplateMatchingService();
  const matchResult = await autoMatchService.autoMatch(documentId);

  if (matchResult) {
    console.log(`Document ${documentId} auto-matched to template instance`);
  }
}
```

---

## Implementation Notes

（開發完成後填寫）

---

## Related Files

- `prisma/schema.prisma` - 更新
- `src/services/auto-template-matching.service.ts` - 新增
- `src/app/api/v1/documents/match/` - 新增
- `src/components/features/documents/MatchToTemplateDialog.tsx` - 新增
