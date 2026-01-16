# Story 0.6: 批量處理公司識別整合

**Status:** backlog

---

## Story

**As a** 系統管理員,
**I want** 批量處理時自動識別和建立公司 Profile,
**So that** 從歷史文件中自動發現所有相關公司，無需手動建立。

---

## Acceptance Criteria

### AC1: 批量處理時自動識別公司

**Given** 批量處理正在執行
**When** 每個文件 OCR 提取完成
**Then** 系統自動：
  - 從提取結果中識別公司名稱（shipper/consignee）
  - 使用三層匹配策略尋找現有公司
  - 如找到匹配，關聯到該公司
  - 如未找到，建立待審核的新公司

### AC2: 三層公司匹配策略

**Given** 提取到公司名稱
**When** 執行公司匹配
**Then** 依序嘗試：
  1. **Exact Match**: 完全相同（忽略大小寫）
  2. **Variant Match**: 檢查已知變體名稱
  3. **Fuzzy Match**: 90% 相似度閾值（Levenshtein）
  - 如果三層都未匹配，建立新公司（狀態：PENDING）

### AC3: 批量處理結果包含公司統計

**Given** 批量處理完成
**When** 查看處理結果
**Then** 顯示：
  - 識別到的公司數量
  - 新建立的公司數量
  - 匹配到現有公司的數量
  - 每間公司處理的文件數量

### AC4: 公司識別可配置

**Given** 批量處理配置
**When** 啟動批量處理
**Then** 可以選擇：
  - 是否啟用自動公司識別（預設開啟）
  - Fuzzy 匹配閾值（預設 90%）
  - 是否自動合併相似公司

---

## Tasks / Subtasks

- [ ] **Task 1: 整合公司識別到批量處理服務** (AC: #1)
  - [ ] 1.1 修改 `src/services/batch-processor.service.ts`
  - [ ] 1.2 在 `processFile()` 後呼叫 `identifyCompaniesFromExtraction()`
  - [ ] 1.3 將識別結果關聯到 HistoricalFile
  - [ ] 1.4 錯誤處理（公司識別失敗不影響主流程）

- [ ] **Task 2: 擴展批量處理配置** (AC: #4)
  - [ ] 2.1 在 `HistoricalBatch` 模型添加配置欄位
  - [ ] 2.2 更新批量處理 API 接受配置參數
  - [ ] 2.3 更新 UI 批量上傳對話框

- [ ] **Task 3: 批量處理結果統計** (AC: #3)
  - [ ] 3.1 創建公司統計聚合查詢
  - [ ] 3.2 更新批量詳情 API 返回公司統計
  - [ ] 3.3 在批量詳情頁顯示公司統計卡片

- [ ] **Task 4: 公司-文件關聯** (AC: #1, #3)
  - [ ] 4.1 確保 HistoricalFile 可關聯到 Company
  - [ ] 4.2 建立反向查詢（Company → 其處理的文件）
  - [ ] 4.3 在公司詳情頁顯示相關文件

- [ ] **Task 5: 驗證與測試** (AC: #1-4)
  - [ ] 5.1 TypeScript 類型檢查通過
  - [ ] 5.2 ESLint 檢查通過
  - [ ] 5.3 整合測試：批量處理 + 公司識別
  - [ ] 5.4 邊緣情況測試

---

## Dev Notes

### 依賴項

- **Story 0.3**: 即時公司 Profile 建立（提供 company-auto-create 服務）
- **Story 0.4**: 批量處理進度追蹤（提供批量處理基礎架構）

### 整合位置

```typescript
// src/services/batch-processor.service.ts

import { identifyCompaniesFromExtraction } from './company-auto-create.service';

async function processFile(file: HistoricalFile): Promise<ProcessedResult> {
  // 1. 現有的 OCR 處理邏輯
  const extractionResult = await performOCR(file);

  // 2. 【新增】公司識別
  if (batchConfig.enableCompanyIdentification) {
    try {
      const companies = await identifyCompaniesFromExtraction(extractionResult);
      await associateFileWithCompanies(file.id, companies);
    } catch (error) {
      // 記錄錯誤但不中斷主流程
      console.error('Company identification failed:', error);
    }
  }

  // 3. 繼續現有流程
  return result;
}
```

### 配置結構

```typescript
interface BatchProcessingConfig {
  // 現有配置...

  // 公司識別配置
  companyIdentification: {
    enabled: boolean;          // 預設 true
    fuzzyThreshold: number;    // 預設 0.9
    autoMergeSimilar: boolean; // 預設 false
  };
}
```

### 統計結構

```typescript
interface BatchCompanyStats {
  totalCompaniesIdentified: number;
  newCompaniesCreated: number;
  existingCompaniesMatched: number;
  companyBreakdown: {
    companyId: string;
    companyName: string;
    fileCount: number;
    isNew: boolean;
  }[];
}
```

### 資料模型考量

```prisma
// HistoricalFile 需要可關聯到 Company
model HistoricalFile {
  // 現有欄位...

  // 識別到的公司（可能多個：shipper, consignee）
  identifiedCompanies Company[] @relation("FileIdentifiedCompanies")
}
```

### References

- [Source: docs/03-epics/sections/epic-0-historical-data-initialization.md]
- [Related: src/services/company-auto-create.service.ts]
- [Related: src/services/company-matcher.service.ts]

---

## Implementation Notes

*待實現*

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 0.6 |
| Story Key | 0-6-batch-company-integration |
| Epic | Epic 0: 歷史數據初始化 |
| Dependencies | Story 0.3, Story 0.4 |
| Estimated Points | 5 |

---

*Story created: 2025-12-25*
*Status: backlog*
