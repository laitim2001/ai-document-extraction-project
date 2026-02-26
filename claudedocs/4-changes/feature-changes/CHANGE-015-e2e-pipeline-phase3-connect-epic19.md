# CHANGE-015: 端到端管線整合 Phase 3 — 連接 Epic 19 自動匹配

> **建立日期**: 2026-01-27
> **完成日期**: 2026-01-27
> **狀態**: ✅ 已完成
> **優先級**: High
> **類型**: Integration
> **影響範圍**: Epic 2 (上傳) + Epic 15 (統一處理) + Epic 19 (模版匹配)
> **前置條件**: CHANGE-014 Phase 2 已完成
> **總體計劃**: `claudedocs/1-planning/e2e-pipeline-integration-plan.md`

---

## 1. 變更概述

Phase 3 負責將 Phase 2 建立的處理端點與 Epic 19 的 autoMatch 連接，
並修改上傳流程使其自動觸發統一處理管線。

### Phase 3 包含 2 項工作

| # | 工作項 | 缺口 | 類型 | 複雜度 |
|---|--------|------|------|--------|
| 1 | 處理完成後觸發 autoMatch | G7 | Integration | 低 |
| 2 | 上傳流程改用統一處理管線 | G1 (完善) | Integration | 低 |

### 目標資料流

```
上傳文件 (Upload API)
  │
  ├─ 文件存入 Azure Blob → Document.status = UPLOADED
  │
  └─ Fire-and-Forget: 呼叫 POST /api/documents/{id}/process
      │
      ├─ downloadBlob → processFile → persistResult  (Phase 2 已完成)
      │
      └─ 🆕 autoMatch(documentId)  ← Phase 3 工作項 1
          │
          ├─ resolveDefaultTemplate (FORMAT → COMPANY → GLOBAL)
          ├─ getOrCreateInstance (建立或取得模版實例)
          └─ matchDocuments (執行模版匹配)
              └─ Document.templateInstanceId → 已設定
```

---

## 2. 詳細設計

### 2.1 工作項 1：處理完成後觸發 autoMatch (G7)

**修改文件**: `src/app/api/documents/[id]/process/route.ts`

**修改位置**: 在步驟 8（persistResult）之後、步驟 9（回傳）之前

**新增邏輯**:

```typescript
// 8. 持久化結果 (已有)
const persistResult = await persistProcessingResult({ ... });

// 8.5 🆕 觸發自動匹配（Fire-and-Forget）
if (result.success && result.companyId) {
  autoTemplateMatchingService.autoMatch(documentId)
    .then((matchResult) => {
      if (matchResult.success) {
        console.log(`[Process] Auto-match success for ${documentId}: instance=${matchResult.templateInstanceId}`);
      } else {
        console.log(`[Process] Auto-match skipped for ${documentId}: ${matchResult.error}`);
      }
    })
    .catch((err) => {
      console.error(`[Process] Auto-match error for ${documentId}:`, err);
    });
}

// 9. 回傳摘要 (已有)
```

**設計決策**:
- **Fire-and-Forget**: autoMatch 不阻塞 API 回應，讓使用者更快收到處理結果
- **條件觸發**: 只有 `result.success && result.companyId` 時才觸發
  - 沒有 companyId 時 autoMatch 必定失敗（需要 companyId 解析預設模版）
  - 處理失敗時不觸發匹配

**autoMatch 前置條件（Phase 1 已滿足）**:
- ✅ Company.defaultTemplateId 已設置（DHL + Maersk）
- ✅ TemplateFieldMapping seed 數據已建立
- ✅ Document.companyId 由 persistProcessingResult 寫入

---

### 2.2 工作項 2：上傳流程改用統一處理管線

**修改文件**: `src/app/api/documents/upload/route.ts`

**現有代碼（約第 320-328 行）**:

```typescript
// 7. 自動觸發 OCR 提取（Fire-and-Forget）
if (autoExtract && uploaded.length > 0) {
  Promise.allSettled(
    uploaded.map((doc) => extractDocument(doc.id))
  ).catch((error) => {
    console.error('Auto-extract trigger error:', error)
  })
}
```

**修改為**:

```typescript
// 7. 自動觸發統一處理管線（Fire-and-Forget）
if (autoExtract && uploaded.length > 0) {
  const processUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/documents`;
  Promise.allSettled(
    uploaded.map((doc) =>
      fetch(`${processUrl}/${doc.id}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // 傳遞 session cookie 進行認證
          cookie: request.headers.get('cookie') || '',
        },
      })
    )
  ).catch((error) => {
    console.error('Auto-process trigger error:', error)
  })
}
```

**替代方案：直接呼叫服務層**

如果不想走 HTTP 路徑（避免網路開銷），可以直接在同一進程中呼叫：

```typescript
// 替代方案：直接呼叫服務
if (autoExtract && uploaded.length > 0) {
  Promise.allSettled(
    uploaded.map(async (doc) => {
      const fileBuffer = await downloadBlob(doc.blobName);
      const processor = getUnifiedDocumentProcessor();
      const result = await processor.processFile({
        fileId: doc.id,
        fileName: doc.fileName,
        fileBuffer,
        mimeType: doc.fileType,
        userId: session.user.id,
      });
      await persistProcessingResult({
        documentId: doc.id,
        result,
        userId: session.user.id,
      });

      // 自動匹配
      if (result.success && result.companyId) {
        await autoTemplateMatchingService.autoMatch(doc.id);
      }
    })
  ).catch((error) => {
    console.error('Auto-process trigger error:', error);
  });
}
```

**建議**: 採用**替代方案（直接呼叫服務層）**，避免 HTTP 自呼叫的 cookie 傳遞和認證問題。

---

## 3. 影響範圍

### 直接影響

| 區域 | 影響 | 風險 |
|------|------|------|
| process route | 新增 autoMatch fire-and-forget | 低（不影響主流程回傳） |
| upload route | 替換 extractDocument → 統一處理 | 中（改變上傳後行為） |

### 不影響

- 統一處理器本身（不修改）
- Template Matching Engine（不修改）
- 結果持久化服務（不修改）
- 前端 UI（不修改）

### 向後相容

- 如果 `ENABLE_UNIFIED_PROCESSOR=false`，upload route 仍可 fallback 回 `extractDocument()`
- autoMatch 失敗不影響文件處理結果
- autoMatch 已有冪等性保護（已匹配的文件會跳過）

---

## 4. 文件清單

| 操作 | 文件路徑 | 說明 |
|------|----------|------|
| **修改** | `src/app/api/documents/[id]/process/route.ts` | 新增 autoMatch 觸發 |
| **修改** | `src/app/api/documents/upload/route.ts` | 替換 extractDocument → 統一處理 |

---

## 5. 驗收標準

- [ ] `POST /api/documents/{id}/process` 處理成功後自動觸發 autoMatch
- [ ] autoMatch 成功時 Document.templateInstanceId 已設置
- [ ] autoMatch 失敗不影響 process 端點的 200 回傳
- [ ] 上傳文件後自動觸發統一處理管線（非 Legacy extractDocument）
- [ ] 上傳 → 處理 → 匹配 完整流程可在 UI 驗證
- [ ] TypeScript 類型檢查通過
- [ ] ESLint 檢查通過

---

## 6. 後續 Phase

| Phase | 內容 | 依賴 |
|-------|------|------|
| Phase 4 | 端到端測試驗證 | Phase 3 |

詳見: `claudedocs/1-planning/e2e-pipeline-integration-plan.md`
