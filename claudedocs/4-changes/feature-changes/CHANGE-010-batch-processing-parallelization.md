# CHANGE-010: 批次處理並行化優化

## 變更摘要

| 項目 | 內容 |
|------|------|
| 變更編號 | CHANGE-010 |
| 變更日期 | 2026-01-16 |
| 完成日期 | - |
| 變更類型 | 效能優化 |
| 影響範圍 | 批次處理服務、Python OCR 服務 |
| 狀態 | ⏳ 待實施 |

---

## 變更原因

- 現有批次處理採用**順序處理**，100 個檔案需要約 120 秒
- 希望透過**控制並發**提升處理效率，同時避免 API 速率限制
- 預期將處理時間從 240 小時降至 48 小時（年度）

---

## 變更內容

### 實施方案：B + C 組合

將現有的順序文件處理改為並行處理，提升批次處理效率。

**預期效果：**
- 處理時間：240 小時 → 48 小時（提升 80%）
- 成本增加：<10%（$450 → $495/月）

---

### 方案 B：客戶端並發控制（p-queue）

**什麼是 p-queue？**
- npm 套件，控制同時執行的任務數量
- 確保最多 5 個文件同時處理，避免資源耗盡

**需要修改的文件：**
```
src/services/batch-processor.service.ts  (~30 行修改)
```

**修改內容：**
```typescript
// 安裝套件
npm install p-queue

// 修改 processBatch() 方法
import PQueue from 'p-queue';

const queue = new PQueue({
  concurrency: 5,        // 同時處理 5 個文件
  interval: 1000,        // 每秒
  intervalCap: 10,       // 最多 10 個請求
});

// 原本的順序處理
for (const file of files) {
  await processFile(file);  // 一個一個處理
}

// 改為並行處理
await Promise.all(
  files.map(file => queue.add(() => processFile(file)))
);
```

---

### 方案 C：Python 伺服器端並發

**什麼是 Uvicorn Workers？**
- Uvicorn 是 Python 的 Web 伺服器
- Workers = 同時運行的 Python 進程數
- 更多進程 = 可同時處理更多請求

**需要修改的文件：**
```
python-services/extraction/main.py  (1 行修改)
```

**修改內容：**
```python
# 原本（單進程）
uvicorn.run("main:app", host="0.0.0.0", port=8000)

# 改為（4 個進程）
uvicorn.run("main:app", host="0.0.0.0", port=8000, workers=4)
```

---

## 影響分析

### 需要修改的文件清單

| 文件 | 修改量 | 難度 |
|------|-------|------|
| `src/services/batch-processor.service.ts` | ~30 行 | ⭐⭐ |
| `python-services/extraction/main.py` | 1 行 | ⭐ |
| `package.json` | 添加 p-queue 依賴 | ⭐ |

### 風險與緩解

| 風險 | 可能性 | 緩解措施 |
|------|--------|---------|
| Azure API 429 錯誤 | 低 | p-queue 已限制為 5 並發 |
| 記憶體溢出 | 低 | 限制並發數 ≤ 5 |
| 資料庫連接耗盡 | 低 | 並發數遠低於連接池大小 |

---

## 實施步驟

### Step 1：安裝 p-queue 套件
```bash
npm install p-queue
```

### Step 2：修改 batch-processor.service.ts
1. 導入 p-queue
2. 建立並發隊列
3. 將 for-loop 改為 Promise.all + queue.add

### Step 3：修改 Python 伺服器配置
1. 在 main.py 添加 `workers=4` 參數

### Step 4：測試驗證
1. 執行批次處理測試
2. 監控記憶體使用
3. 確認無 429 錯誤

---

## 驗證方式

1. **單元測試**：模擬 10 個文件的批次處理
2. **監控**：檢查 `process.memoryUsage()` 確認記憶體穩定
3. **日誌**：確認處理速度提升約 3-4 倍

---

## 預期成果

| 指標 | 修改前 | 修改後 |
|------|--------|--------|
| 10 文件處理時間 | ~100 秒 | ~25 秒 |
| 同時處理數 | 1 | 5 |
| 記憶體使用 | ~500MB | ~500MB（不變） |
| 月成本 | $450 | ~$495 |

---

## 回滾方案

如果出現問題，可以快速回滾：
1. 將 `concurrency` 改為 1（恢復順序處理）
2. 將 `workers` 改為 1（恢復單進程）

---

## 未來改進：中途停止機制（本次不實施）

### 現有限制

| 能做到 | 做不到 |
|--------|--------|
| ✅ 標記待處理文件為「已跳過」 | ❌ 立即停止正在處理的文件 |
| ✅ 防止新文件開始處理 | ❌ 中斷進行中的 Azure API 調用 |

### 未來實施方案

**1. 添加 AbortController 支持**
```typescript
// batch-processor.service.ts
const batchAbortControllers = new Map<string, AbortController>()

export async function processBatch(batchId: string) {
  const controller = new AbortController()
  batchAbortControllers.set(batchId, controller)

  try {
    // 傳遞 signal 給 API 調用
    await processFile(file, { signal: controller.signal })
  } finally {
    batchAbortControllers.delete(batchId)
  }
}

export function cancelBatch(batchId: string) {
  const controller = batchAbortControllers.get(batchId)
  if (controller) {
    controller.abort() // 中止所有進行中的請求
  }
}
```

**2. 處理 AbortError**
```typescript
try {
  await processPdfWithAzureDI(filePath, { signal })
} catch (error) {
  if (error.name === 'AbortError') {
    // 標記為 CANCELLED，而不是 FAILED
    await updateFileStatus(fileId, 'CANCELLED')
  }
}
```

**3. 需要修改的文件**
- `src/services/batch-processor.service.ts` - 添加 AbortController
- `src/app/api/admin/historical-data/batches/[batchId]/cancel/route.ts` - 調用 abort()
- `python-services/extraction/` - 支持請求取消

### 預估工作量
- 開發時間：1-2 天
- 測試時間：0.5 天
- 風險：低（不影響現有功能）

---

## 相關文件

| 檔案 | 操作 |
|------|------|
| `src/services/batch-processor.service.ts` | 修改 - 添加 p-queue 並發控制 |
| `python-services/extraction/main.py` | 修改 - 添加 workers 參數 |
| `package.json` | 修改 - 添加 p-queue 依賴 |

---

*變更記錄建立日期: 2026-01-16*
