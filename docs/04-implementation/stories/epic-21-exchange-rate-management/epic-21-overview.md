# Epic 21: Exchange Rate Management

> **Epic ID**: 21
> **Created**: 2026-02-04
> **Status**: Planned
> **Estimated Effort**: 8 Stories, 7-8 天

---

## Epic Summary

建立匯率管理功能，支援不同貨幣對的匯率記錄、自動反向匯率計算、以及貨幣轉換服務。

---

## Business Value

| 價值項目 | 說明 |
|----------|------|
| **業務需求** | 處理跨境物流發票需要不同貨幣間的匯率換算 |
| **效率提升** | 自動化匯率查詢和轉換，減少人工計算錯誤 |
| **靈活性** | 支援按年份管理匯率，可選自動建立反向匯率 |
| **整合準備** | 為後續文件處理中的幣別轉換功能打下基礎 |

---

## Design Decisions

| 決策項目 | 決定 | 說明 |
|----------|------|------|
| 精度設計 | Decimal(18,8) | 確保匯率計算的高精度 |
| 雙向匯率 | 兩者皆可 | 建立時可選自動建立反向記錄，查詢時自動計算 1/rate |
| 唯一約束 | fromCurrency + toCurrency + effectiveYear | 同一年份同一貨幣對只能有一筆記錄 |
| 反向追蹤 | inverseOfId 欄位 | 追蹤自動產生的反向記錄來源 |

---

## Database Schema

```prisma
enum ExchangeRateSource {
  MANUAL          // 手動輸入
  IMPORTED        // 批次匯入
  AUTO_INVERSE    // 自動產生的反向記錄
}

model ExchangeRate {
  id              String              @id @default(cuid())
  fromCurrency    String              @db.VarChar(3)  // ISO 4217
  toCurrency      String              @db.VarChar(3)  // ISO 4217
  rate            Decimal             @db.Decimal(18, 8)
  effectiveYear   Int
  effectiveFrom   DateTime?
  effectiveTo     DateTime?
  isActive        Boolean             @default(true)
  source          ExchangeRateSource  @default(MANUAL)
  inverseOfId     String?             @map("inverse_of_id")
  description     String?
  createdById     String?
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  inverseOf       ExchangeRate?       @relation("InverseRate", fields: [inverseOfId], references: [id])
  inverseRates    ExchangeRate[]      @relation("InverseRate")

  @@unique([fromCurrency, toCurrency, effectiveYear])
  @@index([fromCurrency, toCurrency])
  @@index([effectiveYear])
  @@index([isActive])
  @@map("exchange_rates")
}
```

---

## API Endpoints

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/v1/exchange-rates` | 列表查詢（分頁、篩選） |
| POST | `/api/v1/exchange-rates` | 建立記錄（含反向匯率選項） |
| GET | `/api/v1/exchange-rates/:id` | 單一查詢 |
| PATCH | `/api/v1/exchange-rates/:id` | 更新記錄 |
| DELETE | `/api/v1/exchange-rates/:id` | 刪除記錄 |
| POST | `/api/v1/exchange-rates/:id/toggle` | 切換啟用狀態 |
| POST | `/api/v1/exchange-rates/convert` | 貨幣轉換計算 |
| POST | `/api/v1/exchange-rates/batch` | 批次查詢匯率 |
| GET | `/api/v1/exchange-rates/export` | 批次導出 |
| POST | `/api/v1/exchange-rates/import` | 批次導入 |

---

## Convert API Fallback Logic

```
1. 直接查詢：HKD → USD（找到則返回）
2. 反向計算：USD → HKD 存在，計算 1/rate
3. 交叉匯率：HKD → USD → EUR（通過 USD 中轉）
4. 找不到：返回錯誤
```

---

## Stories

| Story | 名稱 | 範圍 | 點數 | 依賴 |
|-------|------|------|------|------|
| 21-1 | 資料庫模型與遷移 | Schema、遷移 | 2 | - |
| 21-2 | 核心服務層 | Service（含轉換邏輯） | 4 | 21-1 |
| 21-3 | CRUD API 端點 | list, create, update, delete, toggle | 3 | 21-2 |
| 21-4 | 轉換計算 API | convert, batch 端點 | 3 | 21-2 |
| 21-5 | Import/Export API | import, export 端點 | 2 | 21-3 |
| 21-6 | 管理頁面 - 列表與篩選 | 列表頁、篩選器、按年份分組 | 4 | 21-3 |
| 21-7 | 管理頁面 - 表單 | 新增/編輯表單、貨幣選擇器、反向匯率選項 | 4 | 21-6 |
| 21-8 | 管理頁面 - 計算器與 Import | 即時計算預覽、導入對話框 | 4 | 21-5, 21-7 |

---

## UI Pages

```
/admin/exchange-rates/              # 列表頁（按年份分組）
/admin/exchange-rates/new           # 新增頁
/admin/exchange-rates/[id]          # 編輯頁
```

---

## File Structure

```
prisma/schema.prisma                          # +ExchangeRate model

src/services/
└── exchange-rate.service.ts                  # 新增

src/app/api/v1/exchange-rates/
├── route.ts                                  # GET list, POST create
├── [id]/
│   ├── route.ts                              # GET, PATCH, DELETE
│   └── toggle/route.ts                       # POST toggle
├── convert/route.ts                          # POST convert
├── batch/route.ts                            # POST batch
├── import/route.ts                           # POST import
└── export/route.ts                           # GET export

src/app/[locale]/(dashboard)/admin/exchange-rates/
├── page.tsx                                  # 列表頁
├── new/page.tsx                              # 新增頁
└── [id]/page.tsx                             # 編輯頁

src/components/features/exchange-rate/
├── ExchangeRateList.tsx
├── ExchangeRateFilters.tsx
├── ExchangeRateForm.tsx
├── CurrencySelect.tsx
└── ExchangeRateCalculator.tsx

messages/{en,zh-TW,zh-CN}/
└── exchangeRate.json                         # 新增
```

---

## Acceptance Criteria Summary

### Epic 驗證
- [ ] 可以 CRUD 匯率記錄
- [ ] 可以選擇自動建立反向匯率
- [ ] Convert API 可正確轉換金額
- [ ] 沒有直接記錄時可自動計算反向
- [ ] 可以批次導入/導出 JSON
- [ ] 支援按年份篩選和分組顯示
- [ ] 即時計算預覽功能正常

---

## Dependencies

- **Epic 1**: 用戶認證（CRUD 操作需要認證）
- **Epic 17**: i18n 支援（UI 多語言）

---

## Risks & Mitigations

| 風險 | 影響 | 緩解措施 |
|------|------|----------|
| 浮點數精度 | 匯率計算誤差 | 使用 Decimal(18,8) + decimal.js 庫 |
| 反向匯率循環 | 數據一致性 | inverseOfId 追蹤 + 建立時檢查 |
| 交叉匯率效能 | 查詢變慢 | 限制中轉貨幣為 USD |
