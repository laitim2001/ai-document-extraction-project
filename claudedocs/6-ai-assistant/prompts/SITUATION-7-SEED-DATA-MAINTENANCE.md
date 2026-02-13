# 🌱 情況7: Seed 數據維護 - 新增、更新、驗證種子資料

> **使用時機**: 需要新增/更新種子資料，或部署到新環境時
> **目標**: 確保 seed 數據完整、幂等、符合架構規範
> **適用場景**: 新模型需要預設資料、匯率年度更新、新環境部署、Schema 遷移後

---

## 📋 Prompt 模板 (給開發人員)

```markdown
我需要維護 Seed 數據。

操作類型: [新增 Seed 模組 / 更新現有 Seed / 新環境部署驗證 / 匯率年度更新]
相關模型: [模型名稱，如 ExchangeRate, AlertRule 等]

請幫我:

1. 檢查現有 Seed 架構
   - 查看 `prisma/seed-data/` 的模組結構
   - 確認 `prisma/seed.ts` 的執行順序和依賴關係
   - 確認是否已有相關 Seed 模組

2. 執行 Seed 操作
   - 如果是新增: 建立 seed-data 模組 → 整合到 seed.ts → 更新 Summary
   - 如果是更新: 修改對應的 seed-data 模組
   - 如果是驗證: 執行 seed 並檢查幂等性

3. 驗證結果
   - TypeScript 類型檢查通過
   - Seed 執行無錯誤
   - 重複執行不產生重複資料（幂等性）

請用中文完成所有步驟。
```

---

## 🏗️ Seed 架構概覽

### 目錄結構

```
prisma/
├── seed.ts                          # 主入口（執行順序控制、Summary 統計）
├── seed-data/                       # Seed 數據模組（每模型一個檔案）
│   ├── forwarders.ts                # Company/Forwarder 資料
│   ├── mapping-rules.ts             # 映射規則（Universal + Company-Specific）
│   ├── config-seeds.ts              # SystemConfig 系統配置
│   ├── prompt-configs.ts            # PromptConfig Prompt 配置（5 個 GLOBAL）
│   ├── field-mapping-configs.ts     # FieldMappingConfig 欄位映射（1 GLOBAL + 12 rules）
│   ├── alert-rules.ts               # AlertRule 系統告警（4 個）
│   └── exchange-rates.ts            # ExchangeRate 匯率（8 對 x 2 = 16 筆）
└── seed/
    └── exported-data.json           # 匯出的資料（可選，用於環境遷移）
```

### 執行順序（有 FK 依賴）

```
1. Roles           ← 無依賴
2. Regions          ← 無依賴
3. Cities           ← 依賴 Region
4. System User      ← 依賴 Role (System Admin)
5. Dev User         ← 依賴 Role
6. Admin User       ← 依賴 Role（使用 hashPassword）
7. Companies        ← 依賴 System User (creator FK)
8. Mapping Rules    ← 依賴 Company
9. System Configs   ← 無依賴
10. Data Templates  ← 無依賴（使用固定 ID）
11. Template Field Mappings ← 依賴 DataTemplate
12. Company Default Templates ← 依賴 Company + DataTemplate
13. Prompt Configs  ← 無依賴
14. Field Mapping Configs ← 無依賴（含子表 FieldMappingRule）
15. Alert Rules     ← 依賴 System User (createdBy FK)
16. Exchange Rates  ← 無依賴
17. Pipeline Config ← 無依賴
18. Exported Data Restore ← 依賴 Company（可選）
```

---

## 🤖 AI 執行步驟

### 場景 A: 新增 Seed 模組

#### Step 1: 建立 Seed 數據檔案 (5 分鐘)

在 `prisma/seed-data/` 建立新模組，遵循以下模式：

```typescript
/**
 * @fileoverview [模型名稱] Seed 數據
 * @module prisma/seed-data/[模型名稱]
 * @since CHANGE-XXX
 * @lastModified YYYY-MM-DD
 */

// 1. 定義 Seed 介面
export interface [Model]Seed {
  // 列出所有必要欄位
}

// 2. 匯出 Seed 常數
export const [MODEL]_SEEDS: [Model]Seed[] = [
  // 資料...
]
```

**命名規範**:
- 檔案名: `kebab-case.ts`（如 `exchange-rates.ts`）
- 介面名: `[Model]Seed`（如 `ExchangeRateSeed`）
- 常數名: `[MODEL]_SEEDS`（如 `EXCHANGE_RATE_SEEDS`）

#### Step 2: 整合到 seed.ts (5 分鐘)

```typescript
// 1. 在 seed.ts 頂部加入 import
import { [MODEL]_SEEDS } from './seed-data/[model-name]'

// 2. 在適當位置（考慮 FK 依賴順序）加入 seed 區塊
// 使用 findFirst + create/update 模式（見下方幂等性模式）

// 3. 更新 Summary 統計區塊
const [model]Count = await prisma.[model].count()
console.log(`  Total [models]: ${[model]Count}`)
```

#### Step 3: 驗證 (3 分鐘)

```bash
# TypeScript 類型檢查
npx tsc --noEmit --project tsconfig.seed.json

# 執行 seed
npx prisma db seed

# 重複執行驗證幂等性
npx prisma db seed
```

---

### 場景 B: 匯率年度更新

每年需更新 `prisma/seed-data/exchange-rates.ts` 中的匯率：

```bash
# 1. 修改 exchange-rates.ts 中的匯率值和 effectiveYear
# 2. 執行 seed — 新年度的匯率會被建立，舊年度保留
npx prisma db seed
```

**注意**: ExchangeRate 使用 `findFirst` 按 `fromCurrency + toCurrency + effectiveYear` 查詢，不同年度的匯率不會互相覆蓋。

---

### 場景 C: 新環境部署

```bash
# 1. 確認 .env 中的 DATABASE_URL 正確
# 2. 執行遷移
npx prisma migrate deploy

# 3. 執行 seed
npx prisma db seed

# 4. 驗證（應看到所有 "Created" 訊息）
# 5. 立即修改 Admin 預設密碼！
#    預設: admin@ai-document-extraction.com / ChangeMe@2026!
```

---

## 🔧 幂等性模式參考

### 模式 1: upsert（有唯一約束）

適用於有 `@unique` 欄位的模型（如 Role.name, Region.code, Company.code）：

```typescript
await prisma.role.upsert({
  where: { name: role.name },
  update: { description: role.description },
  create: { name: role.name, description: role.description },
})
```

### 模式 2: findFirst + create/update（無唯一約束或複合查詢）

適用於需要多欄位定位的模型（如 PromptConfig, FieldMappingConfig, ExchangeRate）：

```typescript
const existing = await prisma.promptConfig.findFirst({
  where: {
    promptType: seed.promptType,
    scope: seed.scope,
    companyId: null,
  },
})

if (existing) {
  await prisma.promptConfig.update({
    where: { id: existing.id },
    data: { name: seed.name },  // 只更新元資料
  })
} else {
  await prisma.promptConfig.create({ data: { ... } })
}
```

### 模式 3: findFirst + skip（不覆蓋使用者資料）

適用於匯率等使用者可能已手動調整的資料：

```typescript
const existing = await prisma.exchangeRate.findFirst({
  where: { fromCurrency, toCurrency, effectiveYear },
})

if (existing) {
  // 跳過，不覆蓋使用者可能已修改的值
  skippedCount++
} else {
  await prisma.exchangeRate.create({ data: { ... } })
}
```

### 模式 4: 父子表建立（含子記錄）

適用於有子表的模型（如 FieldMappingConfig + FieldMappingRule）：

```typescript
const config = await prisma.fieldMappingConfig.create({
  data: { scope: 'GLOBAL', name: '...', ... },
})

// 建立子記錄
for (const rule of seedConfig.rules) {
  await prisma.fieldMappingRule.create({
    data: { configId: config.id, ...rule },
  })
}
```

---

## ⚠️ 注意事項

### 密碼 Hash
Admin 帳號使用 `src/lib/password.ts` 的 `hashPassword()`（bcrypt 12 rounds）。
**絕對不要**在 seed-data 中存儲明文密碼或 hash 值，必須在 seed.ts 中即時生成。

### FK 依賴
新增模組前，確認其 FK 依賴的資料是否已在前面的步驟中建立。
例如 `AlertRule` 需要 `createdById` → 必須排在 System User 之後。

### Update 策略
Seed 重複執行時的 update 策略需謹慎：
- **元資料**（name, description）：可安全更新
- **使用者可修改的值**（rate, threshold）：建議跳過，避免覆蓋使用者調整
- **Prompt 內容**（systemPrompt, userPromptTemplate）：跳過更新，使用者可能已自訂

### exported-data.json
`prisma/seed/exported-data.json` 用於從舊環境遷移資料。新環境部署時通常不需要此檔案。
如需遷移舊環境資料，請先在舊環境執行資料匯出腳本。

---

## 📊 當前 Seed 統計

| 模組 | 記錄數 | 說明 |
|------|--------|------|
| Roles | 6 | System Admin, Super User, Data Processor 等 |
| Regions | 4 | GLOBAL, APAC, EMEA, AMER |
| Cities | 10 | TPE, HKG, SGP, TYO, SHA, SYD, LON, FRA, NYC, LAX |
| Users | 3 | System + Dev + Admin |
| Companies | 15 | DHL, FedEx, UPS, Maersk 等 |
| Mapping Rules | ~70+ | Universal (Tier 1) + Company-Specific (Tier 2) |
| System Configs | 20+ | 系統參數 |
| Data Templates | 3 | ERP 標準匯入、費用報表、物流追蹤 |
| Prompt Configs | 5 | 5 種 GLOBAL scope prompt |
| Field Mapping Configs | 1 | GLOBAL + 12 mapping rules |
| Alert Rules | 4 | 系統告警規則 |
| Exchange Rates | 16 | 8 對貨幣 (正向 + 反向) |
| Pipeline Config | 1 | GLOBAL 預設管線配置 |

---

*文件建立日期: 2026-02-13*
*最後更新: 2026-02-13*
