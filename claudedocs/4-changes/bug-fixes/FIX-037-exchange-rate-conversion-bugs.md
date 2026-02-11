# FIX-037: Exchange Rate 轉換功能多項 Bug 修復

> **建立日期**: 2026-02-11
> **發現方式**: 代碼審查（Agent 調查）
> **影響範圍**: extraction-v3 pipeline — Exchange Rate 轉換階段
> **優先級**: P1
> **狀態**: 待實作

---

## 問題描述

Exchange Rate 轉換功能（CHANGE-032）在代碼架構上設計完整，但實際運行中存在 5 個 Bug，涵蓋年份傳遞、結果持久化、日期範圍查詢、配置合併策略與 N+1 查詢效能問題。

### BUG-1：`convert()` 不傳入文件年份（嚴重度：高）

| 項目 | 說明 |
|------|------|
| **現狀** | `ExchangeRateConverterService.convertStandardFields()` 在 L175 呼叫 `convert(sourceCurrency, targetCurrency, amount)` 時僅傳入 3 個參數，未傳入 `year` |
| **預期行為** | 應從文件的 `invoiceDate` 提取年份，傳入 `convert()` 的第 4 參數 `year`，確保查詢對應年份的匯率 |
| **實際行為** | `convert()` 在 L682 使用 `year ?? new Date().getFullYear()` 作為 fallback，始終使用當前年份（2026）。處理 2025 年發票時會查詢 2026 年匯率，導致找不到記錄或使用錯誤匯率 |

### BUG-2：轉換結果未持久化（嚴重度：高）

| 項目 | 說明 |
|------|------|
| **現狀** | `extraction-v3.service.ts` 在 L653 將 `exchangeRateConversion` 放入 pipeline 返回值，但 `processing-result-persistence.service.ts` 的 `persistV3_1ProcessingResult()` 完全不處理此欄位 |
| **預期行為** | 匯率轉換結果應被持久化到 `ExtractionResult` 記錄中，供後續查詢和顯示使用 |
| **實際行為** | 轉換結果僅存在於 pipeline 返回值中，處理完成後資料遺失，無法在文件詳情頁面查看轉換結果 |

### BUG-3：`effectiveFrom/To` 未參與查詢（嚴重度：中）

| 項目 | 說明 |
|------|------|
| **現狀** | `findDirectRate()`（L130-146）查詢條件僅包含 `fromCurrency`、`toCurrency`、`effectiveYear`、`isActive` |
| **預期行為** | 當 `effectiveFrom` 和 `effectiveTo` 有值時，應驗證文件日期是否落在此範圍內，以支援同一年份內的多期匯率 |
| **實際行為** | 完全忽略 `effectiveFrom` 和 `effectiveTo` 欄位，若同一年份有多筆匯率（如上半年/下半年），`findFirst` 可能返回錯誤的記錄 |

### BUG-4：配置合併全量覆蓋（嚴重度：中）

| 項目 | 說明 |
|------|------|
| **現狀** | `resolveEffectiveConfig()`（L309-328）使用 for loop 迭代 `[globalConfig, regionConfig, companyConfig]`，每層配置的所有 boolean 欄位直接覆蓋上一層 |
| **預期行為** | REGION 層的 `false` 值應表示「未設定」，不應覆蓋 GLOBAL 層的 `true`。只有明確設定的值才應覆蓋 |
| **實際行為** | Prisma schema 中 `fxConversionEnabled` 預設為 `false`，因此 REGION config 即使從未設定此欄位，其 `false` 值也會覆蓋 GLOBAL 的 `true`，導致 GLOBAL 啟用的功能在 REGION 層被意外關閉 |

### BUG-5：N+1 查詢問題（嚴重度：低）

| 項目 | 說明 |
|------|------|
| **現狀** | `convertStandardFields()`、`convertLineItems()`、`convertExtraCharges()` 每個金額欄位都獨立呼叫 `convert()`，每次 `convert()` 內部最多觸發 3 次 DB 查詢（direct + inverse + cross） |
| **預期行為** | 同一次轉換請求中，所有金額使用相同的 sourceCurrency → targetCurrency 匯率，應只查詢一次 DB |
| **實際行為** | 50 個 lineItems = 至少 50 次 `findDirectRate()` DB 查詢，造成不必要的效能開銷 |

---

## 根本原因分析

### BUG-1：年份未傳遞

**位置**: `src/services/extraction-v3/stages/exchange-rate-converter.service.ts` L175、L213、L256

```typescript
// L175 - convertStandardFields 中呼叫 convert()
const result = await convert(sourceCurrency, targetCurrency, amount);
// 缺少第 4 參數 year

// L213 - convertLineItems 中同樣問題
const result = await convert(sourceCurrency, targetCurrency, item.amount);

// L256 - convertExtraCharges 中同樣問題
const result = await convert(chargeCurrency, targetCurrency, charge.amount);
```

**根本原因**: `convert()` 函數簽名為 `convert(from, to, amount, year?)` 其中 `year` 為可選參數。`ExchangeRateConverterService` 的所有 3 個轉換方法都未傳入年份。而年份資訊可從 `stage3Result.standardFields.invoiceDate.value` 提取。

**上游呼叫鏈**: `extraction-v3.service.ts` L467 呼叫 `converter.convert({ stage3Result, config })` 時已提供 `stage3Result`，但 `ExchangeRateConverterService.convert()` 方法未從中提取 `invoiceDate` 的年份。

### BUG-2：轉換結果未持久化

**位置**: `src/services/processing-result-persistence.service.ts` L448-629（`persistV3_1ProcessingResult` 函數）

**根本原因**: `persistV3_1ProcessingResult()` 的輸入類型是 `ExtractionV3_1Output`（L390），但該函數內部未讀取或存儲 `referenceNumberMatch` 和 `exchangeRateConversion` 欄位。

此外，`ExtractionResult` Prisma model（schema.prisma L554-605）中也沒有對應的欄位來存儲匯率轉換結果。需要新增 migration 和 schema 欄位。

**資料流斷裂點**:
```
extraction-v3.service.ts L653: exchangeRateConversion: fxConversionResult  (有值)
    ↓
processing-result-persistence.service.ts: persistV3_1ProcessingResult()   (未讀取)
    ↓
ExtractionResult DB model: 無對應欄位                                    (無法存儲)
```

### BUG-3：effectiveFrom/To 未參與查詢

**位置**: `src/services/exchange-rate.service.ts` L130-146

```typescript
async function findDirectRate(from, to, year) {
  const item = await prisma.exchangeRate.findFirst({
    where: {
      fromCurrency: from,
      toCurrency: to,
      effectiveYear: year,    // 只用年份
      isActive: true,         // 只看是否啟用
      // 缺少 effectiveFrom/effectiveTo 條件
    },
    select: { id: true, rate: true },
  });
}
```

**根本原因**: `findDirectRate()` 函數簽名只接收 `year: number`，未接收具體日期。Prisma schema 中 `effectiveFrom` 和 `effectiveTo` 是 `DateTime?` 型別，設計上支援精確日期範圍，但查詢邏輯完全未使用。

### BUG-4：配置合併全量覆蓋

**位置**: `src/services/pipeline-config.service.ts` L309-328

```typescript
for (const config of configs) {
  // 每個 config 的所有 boolean 欄位直接覆蓋
  resolved.refMatchEnabled = config.refMatchEnabled;       // false 覆蓋 true
  resolved.fxConversionEnabled = config.fxConversionEnabled; // false 覆蓋 true
  resolved.fxConvertLineItems = config.fxConvertLineItems;   // false 覆蓋 true
  // ...
}
```

**根本原因**: Prisma schema 中 boolean 欄位定義為 `@default(false)`，這表示新建的 REGION config 即使管理員從未觸碰 FX 相關設定，`fxConversionEnabled` 也會是 `false`。合併邏輯無法區分「明確設為 false」和「從未設定（使用預設值 false）」。

### BUG-5：N+1 查詢問題

**位置**: `src/services/extraction-v3/stages/exchange-rate-converter.service.ts` L167-193、L208-231、L247-274

**根本原因**: 三個 `convert*` 方法各自在 for loop 內呼叫 `convert()`，而 `convert()` 每次都獨立查詢資料庫。同一份發票的所有金額欄位使用相同的 sourceCurrency → targetCurrency 組合，完全可以只查詢一次匯率。

---

## 修復方案

### BUG-1: 年份未傳遞

**修改文件**: `src/services/extraction-v3/stages/exchange-rate-converter.service.ts`

**方案**: 在 `ExchangeRateConverterService.convert()` 方法中，從 `stage3Result.standardFields.invoiceDate` 提取年份，傳遞給所有 `convert()` 呼叫。

```typescript
// 在 convert() 方法中（約 L74-76 之後），提取年份
const invoiceDateValue = stage3Result.standardFields.invoiceDate?.value?.toString();
const invoiceYear = invoiceDateValue
  ? new Date(invoiceDateValue).getFullYear()
  : undefined; // undefined 會讓 convert() 使用 new Date().getFullYear() 作為 fallback

// 修改 convertStandardFields 簽名，增加 year 參數
private async convertStandardFields(
  stage3Result: Stage3ExtractionResult,
  sourceCurrency: string,
  targetCurrency: string,
  precision: number,
  fallbackBehavior: string,
  conversions: FxConversionItem[],
  warnings: string[],
  year?: number  // 新增
): Promise<void> {
  // ...
  // L175 修改為
  const result = await convert(sourceCurrency, targetCurrency, amount, year);
}

// convertLineItems 和 convertExtraCharges 同理
```

**影響**: `convertStandardFields()`、`convertLineItems()`、`convertExtraCharges()` 三個方法的呼叫點和簽名都需要更新。

### BUG-2: 轉換結果未持久化

**修改方案分兩部分**:

#### 2a. Prisma Schema 新增欄位

**修改文件**: `prisma/schema.prisma`（ExtractionResult model）

在 `ExtractionResult` model 中新增以下欄位（約 L591 之後）:

```prisma
  // CHANGE-032: Pipeline 擴展結果
  refMatchResult       Json?            @map("ref_match_result")
  fxConversionResult   Json?            @map("fx_conversion_result")
```

需要執行 migration：
```bash
npx prisma migrate dev --name add_ref_match_and_fx_conversion_fields
```

#### 2b. 持久化服務新增存儲邏輯

**修改文件**: `src/services/processing-result-persistence.service.ts`

在 `persistV3_1ProcessingResult()` 中，需要：

1. 更新 `PersistV3_1ResultInput` 型別，加入 `referenceNumberMatch` 和 `exchangeRateConversion` 欄位（或改用 `ExtractionV3Output` 類型）
2. 在 `prisma.extractionResult.upsert()` 的 `create` 和 `update` 區塊中加入：

```typescript
// create 和 update 區塊都加入
refMatchResult: result.referenceNumberMatch as unknown as Prisma.InputJsonValue ?? null,
fxConversionResult: result.exchangeRateConversion as unknown as Prisma.InputJsonValue ?? null,
```

**注意**: `ExtractionV3_1Output` 類型目前沒有 `referenceNumberMatch` 和 `exchangeRateConversion` 欄位，但 `ExtractionV3Output` 有（L645-647）。需確認 pipeline 呼叫持久化服務時使用的是哪個類型，可能需要更新 `ExtractionV3_1Output` 介面。

### BUG-3: effectiveFrom/To 未參與查詢

**修改文件**: `src/services/exchange-rate.service.ts`

**方案**: 修改 `findDirectRate()` 函數，增加可選的 `date` 參數。當有具體日期時，加入 `effectiveFrom`/`effectiveTo` 範圍條件。

```typescript
async function findDirectRate(
  from: string,
  to: string,
  year: number,
  date?: Date  // 新增可選的具體日期
): Promise<{ id: string; rate: number } | null> {
  const where: Prisma.ExchangeRateWhereInput = {
    fromCurrency: from,
    toCurrency: to,
    effectiveYear: year,
    isActive: true,
  };

  // 如果提供了具體日期，加入日期範圍篩選
  if (date) {
    where.OR = [
      // 情況 1: effectiveFrom 和 effectiveTo 都有值，日期在範圍內
      {
        effectiveFrom: { lte: date },
        effectiveTo: { gte: date },
      },
      // 情況 2: 只有 effectiveFrom，日期在其之後
      {
        effectiveFrom: { lte: date },
        effectiveTo: null,
      },
      // 情況 3: 只有 effectiveTo，日期在其之前
      {
        effectiveFrom: null,
        effectiveTo: { gte: date },
      },
      // 情況 4: 兩者都沒有，按年份匹配（現有行為）
      {
        effectiveFrom: null,
        effectiveTo: null,
      },
    ];
  }

  const item = await prisma.exchangeRate.findFirst({
    where,
    orderBy: [
      // 優先選擇有精確日期範圍的記錄
      { effectiveFrom: 'desc' },
    ],
    select: { id: true, rate: true },
  });

  if (!item) return null;
  return { id: item.id, rate: item.rate.toNumber() };
}
```

**連鎖影響**: `findRate()` 和 `convert()` 的簽名也需要增加 `date?: Date` 參數，並在呼叫鏈中傳遞。

### BUG-4: 配置合併全量覆蓋

**修改文件**: `src/services/pipeline-config.service.ts`

**方案**: 引入「顯式覆蓋」策略，透過 `PipelineConfig` 上的額外 JSON 欄位或逐欄位判斷是否為「明確設定」。

**推薦方案（不需 migration）**: 改用只覆蓋「非預設值」的邏輯。建立一個 helper 函數，只有當值與 Prisma 預設值不同時才覆蓋。

```typescript
/**
 * 合併配置欄位 - 只有明確設定的值才覆蓋
 *
 * 策略: 比較 config 的值與 Prisma schema 預設值，
 * 如果相同則視為「未設定」，不覆蓋上層配置。
 *
 * 例外: GLOBAL scope 的配置視為全部有效（不套用此邏輯）。
 */
const PRISMA_DEFAULTS = {
  refMatchEnabled: false,
  refMatchMaxResults: 10,
  fxConversionEnabled: false,
  fxConvertLineItems: true,
  fxConvertExtraCharges: true,
  fxRoundingPrecision: 2,
  fxFallbackBehavior: 'skip',
};

function mergeConfigField<T>(
  current: T,
  incoming: T,
  prismaDefault: T,
  isGlobalScope: boolean
): T {
  // GLOBAL scope 的值一律採用
  if (isGlobalScope) return incoming;
  // 非 GLOBAL scope：只有與預設值不同的才覆蓋
  if (incoming === prismaDefault) return current;
  return incoming;
}
```

然後在 L309-328 的 for loop 中，用 `mergeConfigField()` 取代直接賦值。

**替代方案（長期）**: 在 `PipelineConfig` model 加入 `overriddenFields Json?` 欄位，明確記錄管理員覆蓋了哪些欄位。這是更健壯的方案，但需要 migration 和 UI 調整。

### BUG-5: N+1 查詢問題

**修改文件**: `src/services/extraction-v3/stages/exchange-rate-converter.service.ts`

**方案**: 在 `ExchangeRateConverterService.convert()` 的頂層先查詢一次匯率，然後在各 `convert*` 方法中直接使用快取的 rate。

```typescript
// 在 ExchangeRateConverterService.convert() 中，查詢匯率一次
import { convert as fxConvert } from '@/services/exchange-rate.service';

// 先取得匯率
const rateResult = await fxConvert(sourceCurrency, targetCurrency, 1, invoiceYear);
const cachedRate = rateResult.rate;
const cachedRateId = rateResult.rateId;
const cachedPath = rateResult.path;

// 在 convertStandardFields、convertLineItems、convertExtraCharges 中
// 直接使用 cachedRate 計算，不再呼叫 convert()
conversions.push({
  field,
  originalAmount: amount,
  originalCurrency: sourceCurrency,
  convertedAmount: this.round(amount * cachedRate, precision),
  targetCurrency,
  rate: cachedRate,
  path,
});
```

**注意**: `extraCharges` 可能有自己的 `currency`（L252），如果 `chargeCurrency !== sourceCurrency` 則需要額外查詢。可以用 `Map<string, { rate: number; rateId: string }>` 快取不同貨幣對的匯率。

---

## 修改範圍

| 文件 | Bug | 修改說明 |
|------|-----|----------|
| `src/services/extraction-v3/stages/exchange-rate-converter.service.ts` | 1, 5 | 提取 invoiceDate 年份；快取匯率；修改 convert* 方法簽名 |
| `src/services/exchange-rate.service.ts` | 3 | `findDirectRate()` 加入 `date?` 參數和日期範圍查詢；`findRate()` 和 `convert()` 透傳 date |
| `src/services/pipeline-config.service.ts` | 4 | `resolveEffectiveConfig()` 改用顯式覆蓋策略 |
| `src/services/processing-result-persistence.service.ts` | 2 | `persistV3_1ProcessingResult()` 加入 refMatch/fxConversion 存儲 |
| `prisma/schema.prisma` | 2 | `ExtractionResult` model 新增 `refMatchResult`、`fxConversionResult` 欄位 |
| `src/types/extraction-v3.types.ts` | 2 | 確認 `ExtractionV3_1Output` 是否需要加入 `referenceNumberMatch`、`exchangeRateConversion` |

---

## i18n 影響

**無需新增或修改翻譯**。本次修復均為後端邏輯修正，不涉及 UI 可見文字變更。

---

## 資料庫影響

### 需要 Migration

**BUG-2** 修復需要在 `ExtractionResult` model 新增 2 個 JSON 欄位：

```prisma
refMatchResult       Json?    @map("ref_match_result")
fxConversionResult   Json?    @map("fx_conversion_result")
```

**Migration 指令**:
```bash
npx prisma migrate dev --name add_pipeline_extension_result_fields
```

**影響評估**:
- 新增的是 `Json?`（可空 JSON），對現有記錄無影響
- 不需要資料遷移，舊記錄的這兩個欄位自動為 `null`
- 不影響現有查詢和索引

---

## 測試驗證

### BUG-1 測試場景

| 場景 | 輸入 | 預期結果 |
|------|------|----------|
| 當年發票 | `invoiceDate: "2026-03-15"` | 查詢 2026 年匯率 |
| 去年發票 | `invoiceDate: "2025-11-20"` | 查詢 2025 年匯率 |
| 無日期發票 | `invoiceDate: null` | 降級使用 `new Date().getFullYear()` |
| 無效日期 | `invoiceDate: "invalid"` | 降級使用 `new Date().getFullYear()`，記錄 warning |

### BUG-2 測試場景

| 場景 | 預期結果 |
|------|----------|
| FX 啟用且轉換成功 | `ExtractionResult.fxConversionResult` 包含完整的轉換項目 |
| FX 啟用但轉換失敗 | `fxConversionResult` 包含 warnings |
| FX 未啟用 | `fxConversionResult` 為 `{ enabled: false }` 或 `null` |
| 重新處理同一文件 | `fxConversionResult` 被更新（upsert update 路徑） |

### BUG-3 測試場景

| 場景 | DB 資料 | 輸入日期 | 預期結果 |
|------|---------|----------|----------|
| 有日期範圍匹配 | `effectiveFrom: 2026-01-01, effectiveTo: 2026-06-30` | `2026-03-15` | 命中此記錄 |
| 超出日期範圍 | 同上 | `2026-08-01` | 不命中，查找其他記錄 |
| 無日期範圍 | `effectiveFrom: null, effectiveTo: null` | 任意 | 命中（fallback 行為） |
| 只有 effectiveFrom | `effectiveFrom: 2026-07-01, effectiveTo: null` | `2026-08-01` | 命中 |

### BUG-4 測試場景

| 場景 | GLOBAL | REGION | 預期結果 |
|------|--------|--------|----------|
| GLOBAL 啟用 FX，REGION 未設定 | `fxConversionEnabled: true` | `fxConversionEnabled: false`（預設值） | `true`（不被覆蓋） |
| GLOBAL 啟用 FX，REGION 明確關閉 | `fxConversionEnabled: true` | `fxConversionEnabled: false`（明確設定） | 視方案而定，推薦方案下為 `true`；替代方案下可為 `false` |
| GLOBAL 未啟用，REGION 啟用 | `fxConversionEnabled: false` | `fxConversionEnabled: true` | `true`（更具體的覆蓋） |

### BUG-5 測試場景

| 場景 | 預期結果 |
|------|----------|
| 50 個 lineItems + 2 個 standardFields + 3 個 extraCharges | DB 查詢次數應為 1 次（同一貨幣對），而非 55 次 |
| extraCharges 含不同貨幣 | DB 查詢次數為 2 次（主貨幣對 + extraCharge 貨幣對） |

---

## 風險評估

### 修改風險

| Bug | 風險等級 | 說明 |
|-----|----------|------|
| BUG-1 | 低 | 純粹增加參數傳遞，不改變現有邏輯 |
| BUG-2 | 中 | 需要 DB migration；需確認 `ExtractionV3_1Output` 型別是否包含 FX 欄位 |
| BUG-3 | 中 | 修改核心查詢邏輯，需確保向後兼容（無日期時仍使用現有行為） |
| BUG-4 | 高 | 影響所有 Pipeline Config 的合併邏輯，可能改變現有配置的生效行為 |
| BUG-5 | 低 | 純效能優化，結果不變 |

### 副作用分析

1. **BUG-1**: 若 `invoiceDate` 解析失敗，需確保 fallback 到當前年份而非報錯
2. **BUG-2**: 新增 schema 欄位後，舊版程式碼讀取 `ExtractionResult` 不受影響（JSON 欄位為 nullable）
3. **BUG-3**: `findDirectRate()` 的日期參數為可選，現有呼叫點（如 `batchGetRates()`）不傳日期時行為不變
4. **BUG-4**: **最高風險** — 修改合併策略可能導致已運行的 REGION/COMPANY 配置生效行為改變。建議：
   - 部署前列出所有現有 PipelineConfig 記錄的值
   - 驗證修改後各 scope 組合的合併結果是否符合預期
   - 若有疑慮，先用替代方案（`overriddenFields` JSON 欄位）做更精確的控制
5. **BUG-5**: 快取策略需注意 `extraCharges` 可能有不同的 `currency`，不能一律使用主貨幣對的匯率

### 建議實施順序

1. **BUG-1**（高優先、低風險）→ 先修，立即改善準確性
2. **BUG-5**（低優先、低風險）→ 與 BUG-1 一起修，因為改動同一文件
3. **BUG-3**（中優先、中風險）→ 第二步修，改善查詢精確度
4. **BUG-2**（高優先、中風險）→ 需要 migration，需與 BUG-3 的 `date` 參數一起測試
5. **BUG-4**（中優先、高風險）→ 最後修，需要充分測試現有配置不受影響

---

*文件建立日期: 2026-02-11*
*分析者: Claude Code Agent*
