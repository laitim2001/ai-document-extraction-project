# CHANGE-036: Reference Number 匹配改為 DB Substring 模糊匹配

> **日期**: 2026-02-10
> **狀態**: ✅ 已完成
> **優先級**: High
> **類型**: Refactor / Feature Enhancement
> **影響範圍**: extraction-v3 pipeline — Reference Number Matcher 服務、PipelineConfig、Admin UI

---

## 變更背景

### 現有問題

CHANGE-032 實作的 Reference Number Matching 使用「**Regex 先拆分文件名 → DB 精確匹配**」策略，存在以下根本性問題：

1. **Regex 無法覆蓋未知格式** — 預設 7 種 pattern（SHP, HAWB, MAWB, BL, CONTAINER, BOOKING, CUSTOMS）無法匹配如 `CEX240464`、`HEX250447`、`RHEX-24-0013` 等自定義編號格式
2. **文件名不可預測** — 實際文件名如 `CEVA LOGISTICS_CEX240464_39613` 或 `CEVA_HEX250447,0448_45585`，不遵循任何標準格式
3. **壓縮格式無法處理** — `HEX250447,0448` 代表兩組號碼（HEX250447 + HEX250448），regex 無法拆解
4. **需要為每種格式建立自定義 regex** — 維護成本高，且用戶無法自行管理
5. **DEFAULT_PATTERNS 硬編碼** — 缺少 DELIVERY 和 OTHER 類型，且類型名稱非從 TypeScript 類型引入

### 目標

將匹配策略從「**文件名 → regex → DB**」改為「**DB → 文件名 substring**」，即直接用 DB 中的 reference numbers 作為子字串在文件名中搜尋匹配。

---

## 變更內容

### 1. 匹配策略反轉：DB-first Substring Matching

**現有方式（方向 A — regex 先拆分文件名）**：
```
文件名 → regex 提取候選 → DB 驗證（equals）
❌ 無法處理未知格式
```

**新方式（方向 B — DB 先 substring 匹配文件名）**：
```
DB 查詢：SELECT * FROM reference_numbers WHERE :filename ILIKE '%' || number || '%'
✅ 不需要知道文件名格式
✅ 任何格式都能處理（只要完整號碼出現在文件名中）
✅ 不需要維護 regex patterns
```

### 2. 移除 regex 機制

移除 `DEFAULT_PATTERNS` 硬編碼 regex 和相關邏輯：
- 移除 `extractFromFilename()` 私有方法
- 移除 `DEFAULT_PATTERNS` 常數
- 移除 PipelineConfig 中的 `refMatchPatterns` 設定（不再需要自定義 regex）
- 移除 PipelineConfig 中的 `refMatchFromFilename` / `refMatchFromContent` 布林開關（合併為單一的 `refMatchEnabled`）

### 3. 簡化 PipelineConfig

移除不再需要的欄位：

| 欄位 | 狀態 | 原因 |
|------|------|------|
| `refMatchPatterns` | ❌ 移除 | 不再使用 regex，無需自定義 pattern |
| `refMatchFromFilename` | ❌ 移除 | DB substring 自然支援文件名匹配 |
| `refMatchFromContent` | ❌ 移除 | 暫時不實作 content matching |
| `refMatchMaxCandidates` | 🔧 改為 `refMatchMaxResults` | 語義更準確：限制匹配結果數而非候選數 |
| `refMatchTypes` | ✅ 保留 | 仍可限制只匹配特定類型的 reference numbers |
| `refMatchEnabled` | ✅ 保留 | 功能開關 |

### 4. 新增 DB 查詢方法

在 `reference-number.service.ts` 中新增 `findMatchesInText()` 方法：

```typescript
/**
 * 從文字中搜尋匹配的 reference numbers（DB substring 匹配）
 * 使用 PostgreSQL ILIKE 在文件名中搜尋所有 active reference numbers
 */
export async function findMatchesInText(input: {
  text: string;           // 文件名或其他文字
  regionId?: string;      // 區域過濾
  types?: string[];       // 類型過濾
  yearRange?: number;     // 年份範圍（預設 ±1 年）
  maxResults?: number;    // 最大結果數（預設 10）
}): Promise<FindMatchResult[]>
```

**SQL 概念**：
```sql
SELECT id, number, type, year, region_id
FROM reference_numbers
WHERE is_active = true
  AND status = 'ACTIVE'
  AND $1 ILIKE '%' || number || '%'   -- 文件名包含此號碼
  AND (region_id = $2 OR $2 IS NULL)  -- 區域過濾
  AND (type = ANY($3) OR $3 IS NULL)  -- 類型過濾
  AND year BETWEEN $4 AND $5          -- 年份範圍
ORDER BY length(number) DESC          -- 優先匹配較長的號碼（避免短號碼誤匹配）
LIMIT $6
```

**效能保障**：
- `is_active` + `status` + `region_id` 過濾大幅縮小搜尋集
- `year` 範圍（±1 年）進一步縮小
- `ORDER BY length(number) DESC` 優先匹配較長號碼，減少假陽性
- `LIMIT` 限制結果數量
- 預估搜尋集：< 1,000 筆，匹配耗時 < 100ms

---

## 技術設計

### 修改範圍

| 文件 | 變更內容 |
|------|----------|
| `src/services/extraction-v3/stages/reference-number-matcher.service.ts` | 🔧 重寫：移除 regex 邏輯，改為呼叫 `findMatchesInText()` |
| `src/services/reference-number.service.ts` | 🔧 新增 `findMatchesInText()` 方法 |
| `src/lib/validations/pipeline-config.schema.ts` | 🔧 移除 `refMatchPatterns`、`refMatchFromFilename`、`refMatchFromContent`，重命名 `refMatchMaxCandidates` → `refMatchMaxResults` |
| `src/types/extraction-v3.types.ts` | 🔧 更新 `EffectivePipelineConfig` 介面，移除廢棄欄位 |
| `src/services/pipeline-config.service.ts` | 🔧 更新 `resolveEffectiveConfig()` 和 `DEFAULT_EFFECTIVE_CONFIG` |
| `src/components/features/pipeline-config/PipelineConfigForm.tsx` | 🔧 移除 refMatchFromFilename/refMatchFromContent toggle、refMatchPatterns 相關 UI |
| `prisma/schema.prisma` | 🔧 PipelineConfig model 移除廢棄欄位，新增 `refMatchMaxResults` |

### 不需要修改的文件

| 文件 | 原因 |
|------|------|
| `src/services/extraction-v3/extraction-v3.service.ts` | 主 pipeline 呼叫 `matcher.match()` 的介面不變 |
| `src/services/extraction-v3/utils/variable-replacer.ts` | `matchedReferenceNumbers` 變數注入不變 |
| `src/types/reference-number.ts` | Reference Number Type 定義不變 |
| `messages/*/referenceNumber.json` | Reference Number 管理頁面翻譯不受影響 |

### i18n 影響

| 語言 | 文件 | 需要更新的 Key |
|------|------|---------------|
| en | `messages/en/pipelineConfig.json` | 移除 `form.refMatchFromFilename`、`form.refMatchFromContent`、`form.refMatchPatterns`；新增/修改 `form.refMatchMaxResults` |
| zh-TW | `messages/zh-TW/pipelineConfig.json` | 同上 |
| zh-CN | `messages/zh-CN/pipelineConfig.json` | 同上 |

### 資料庫影響

```prisma
model PipelineConfig {
  // ... 現有欄位 ...

  // ❌ 移除
  // refMatchFromFilename  Boolean @default(true)
  // refMatchFromContent   Boolean @default(true)
  // refMatchPatterns      Json?

  // 🔧 重命名
  // refMatchMaxCandidates → refMatchMaxResults
  refMatchMaxResults Int @default(10)

  // ✅ 保留不變
  refMatchEnabled Boolean @default(false)
  refMatchTypes   Json?   // string[]
}
```

需要 Prisma migration：移除 3 個欄位、重命名 1 個欄位。

---

## 設計決策

1. **DB-first 而非 Regex-first** — 不需要預先知道號碼格式，只要號碼完整出現在文件名中即可匹配。解決了「如何拆分文件名」的根本問題
2. **`ORDER BY length(number) DESC`** — 優先匹配較長的號碼（如 `CEX240464` 優先於 `CEX24`），減少短號碼造成的假陽性
3. **保留 `refMatchTypes` 過濾** — 用戶仍可指定只匹配特定類型（如只匹配 SHIPMENT），避免不相關的匹配
4. **保留 `validateReferenceNumbers()` 函數** — 該函數仍被其他功能使用（如 Excel 匯入驗證），不刪除
5. **不處理壓縮格式** — `HEX250447,0448` 中的 `HEX250448` 無法被匹配到，這是可接受的。匹配到 `HEX250447` 已足夠建立文件關聯
6. **年份範圍 ±1 年** — 避免過度寬鬆的匹配，同時處理跨年文件（12 月文件 reference number 可能是下一年）

---

## 影響範圍評估

### 文件影響清單

| 文件路徑 | 類型 | 說明 |
|----------|------|------|
| `src/services/extraction-v3/stages/reference-number-matcher.service.ts` | 🔧 修改 | 核心重寫：regex → DB substring |
| `src/services/reference-number.service.ts` | 🔧 修改 | 新增 `findMatchesInText()` |
| `src/lib/validations/pipeline-config.schema.ts` | 🔧 修改 | 移除 3 欄位、重命名 1 欄位 |
| `src/types/extraction-v3.types.ts` | 🔧 修改 | 更新 `EffectivePipelineConfig` 介面 |
| `src/services/pipeline-config.service.ts` | 🔧 修改 | 更新預設配置和解析邏輯 |
| `src/components/features/pipeline-config/PipelineConfigForm.tsx` | 🔧 修改 | 簡化 UI，移除廢棄設定項 |
| `prisma/schema.prisma` | 🔧 修改 | PipelineConfig model 欄位調整 |
| `messages/en/pipelineConfig.json` | 🔧 修改 | 更新翻譯 key |
| `messages/zh-TW/pipelineConfig.json` | 🔧 修改 | 同上 |
| `messages/zh-CN/pipelineConfig.json` | 🔧 修改 | 同上 |

### 向後兼容性

- **PipelineConfig API**：移除欄位是 breaking change，但這是 internal API（僅 Admin 使用），影響範圍可控
- **Pipeline 輸出**：`ReferenceNumberMatchResult` 介面不變，下游消費者不受影響
- **Prompt 注入**：`${matchedReferenceNumbers}` 變數名稱和格式不變
- **Prisma Migration**：需要 migration 移除舊欄位，已有資料的 `refMatchPatterns` 等欄位會被丟棄（可接受）

---

## 驗收標準

| # | 驗收項目 | 驗收標準 | 優先級 |
|---|----------|----------|--------|
| 1 | DB Substring 匹配 | 文件名 `CEVA LOGISTICS_CEX240464_39613` 能匹配到 DB 中的 `CEX240464` | High |
| 2 | 不區分大小寫 | `cex240464` 和 `CEX240464` 均可匹配 | High |
| 3 | 長號碼優先 | 匹配結果按號碼長度降序排列 | Medium |
| 4 | 年份範圍過濾 | 只匹配 ±1 年內的 reference numbers | Medium |
| 5 | 區域過濾 | 指定 regionId 時只匹配該區域的 reference numbers | High |
| 6 | 類型過濾 | `refMatchTypes: ['SHIPMENT']` 時只匹配 SHIPMENT 類型 | Medium |
| 7 | 結果限制 | `refMatchMaxResults` 限制匹配結果數量 | Medium |
| 8 | Pipeline 不中斷 | 匹配失敗或無結果時 pipeline 正常繼續（非阻塞） | High |
| 9 | Prompt 注入 | 匹配結果正確注入 Stage 1/3 的 `${matchedReferenceNumbers}` | High |
| 10 | Admin UI | PipelineConfig 表單已移除廢棄設定項 | Medium |

## 測試場景

| # | 場景 | 測試步驟 | 預期結果 |
|---|------|----------|----------|
| 1 | 正常匹配 | DB 有 `CEX240464`，文件名 `CEVA_CEX240464_39613.pdf` | 匹配成功，matches = 1 |
| 2 | 多重匹配 | DB 有 `CEX240464` + `APAC2026`，文件名含兩者 | matches = 2 |
| 3 | 大小寫不敏感 | DB 有 `HEX250447`，文件名含 `hex250447` | 匹配成功 |
| 4 | 無匹配 | 文件名不含任何 DB 號碼 | matches = 0，pipeline 繼續 |
| 5 | 壓縮格式部分匹配 | DB 有 `HEX250447` + `HEX250448`，文件名 `CEVA_HEX250447,0448` | 只匹配 `HEX250447`（`HEX250448` 不在文件名中） |
| 6 | 年份過濾 | DB 有 2024 年和 2026 年的同號碼，文件在 2026 年處理 | 只匹配 2025-2027 年範圍內的記錄 |
| 7 | 功能關閉 | `refMatchEnabled = false` | 跳過匹配，pipeline 正常 |
| 8 | 效能測試 | DB 有 1000 筆 active reference numbers | 匹配耗時 < 200ms |
