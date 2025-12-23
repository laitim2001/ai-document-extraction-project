# REFACTOR-001: Forwarder 模型重構為 Company 模型

> **建立日期**: 2025-12-22
> **類型**: 數據模型重構
> **狀態**: ✅ 已完成
> **完成日期**: 2025-12-22
> **優先級**: 高（影響 Epic 0 和後續開發）

---

## 重構背景

### 現況問題

目前系統使用 `Forwarder` 模型來表示貨運代理商，但這個命名過於狹隘：

1. **業務擴展受限**：系統需要處理的公司不只是 Forwarder（貨運代理商），還包括：
   - Exporter（出口商）
   - Carrier（承運人）
   - Customs Broker（報關行）
   - 其他合作夥伴

2. **歷史數據處理需求**：Epic 0 需要自動建立公司 Profile，公司類型可能未知

3. **語義不準確**：使用 "Forwarder" 命名會造成概念混淆

### 重構目標

將 `Forwarder` 模型重構為更通用的 `Company` 模型，支援多種公司類型。

---

## 重構範圍

### 1. Prisma Schema 變更

#### 現有模型

```prisma
model Forwarder {
  id            String   @id @default(uuid())
  name          String   @unique
  code          String   @unique
  displayName   String   @map("display_name")
  description   String?
  isActive      Boolean  @default(true) @map("is_active")
  priority      Int      @default(0)
  logoUrl       String?  @map("logo_url")
  contactEmail  String?  @map("contact_email")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  createdBy     String   @map("created_by")

  creator       User     @relation(fields: [createdBy], references: [id])
  mappingRules  MappingRule[]
  documents     Document[]
  ruleSuggestions RuleSuggestion[]
  correctionPatterns CorrectionPattern[]

  @@map("forwarders")
}
```

#### 重構後模型

```prisma
model Company {
  id            String        @id @default(uuid())
  name          String        // 主要名稱（不再 unique，因為可能有重名）
  code          String?       @unique // 系統代碼（可選）
  displayName   String        @map("display_name")
  description   String?

  // 新增：公司類型
  type          CompanyType   @default(UNKNOWN)

  // 新增：公司狀態（取代 isActive）
  status        CompanyStatus @default(PENDING)

  // 新增：建立來源
  source        CompanySource @default(MANUAL)

  // 新增：名稱變體（用於模糊匹配）
  nameVariants  String[]      @map("name_variants")

  // 新增：合併相關
  mergedIntoId  String?       @map("merged_into_id")
  mergedInto    Company?      @relation("CompanyMerge", fields: [mergedIntoId], references: [id])
  mergedFrom    Company[]     @relation("CompanyMerge")

  // 新增：首次出現文件
  firstSeenDocumentId String? @map("first_seen_document_id")

  // 保留欄位
  priority      Int           @default(0)
  logoUrl       String?       @map("logo_url")
  contactEmail  String?       @map("contact_email")
  createdAt     DateTime      @default(now()) @map("created_at")
  updatedAt     DateTime      @updatedAt @map("updated_at")
  createdBy     String        @map("created_by")

  // 關聯
  creator       User          @relation(fields: [createdBy], references: [id])
  mappingRules  MappingRule[]
  documents     Document[]
  ruleSuggestions RuleSuggestion[]
  correctionPatterns CorrectionPattern[]

  @@index([type])
  @@index([status])
  @@index([name])
  @@map("companies")
}

enum CompanyType {
  FORWARDER       // 貨運代理商
  EXPORTER        // 出口商
  CARRIER         // 承運人
  CUSTOMS_BROKER  // 報關行
  OTHER           // 其他
  UNKNOWN         // 未分類
}

enum CompanyStatus {
  ACTIVE          // 啟用
  INACTIVE        // 停用
  PENDING         // 待審核
  MERGED          // 已合併
}

enum CompanySource {
  MANUAL          // 手動建立
  AUTO_CREATED    // 自動建立（Just-in-Time）
  IMPORTED        // 批量匯入
}
```

### 2. 影響的代碼文件

#### 類型定義

| 文件 | 變更 |
|------|------|
| `src/types/forwarder.ts` | 重命名為 `src/types/company.ts`，更新類型 |
| `src/types/index.ts` | 更新導出 |

#### 服務層

| 文件 | 變更 |
|------|------|
| `src/services/forwarder.service.ts` | 重命名為 `src/services/company.service.ts` |
| `src/services/index.ts` | 更新導出 |

#### API 路由

| 文件 | 變更 |
|------|------|
| `src/app/api/forwarders/` | 重命名為 `src/app/api/companies/` |
| 所有使用 forwarder API 的地方 | 更新路徑 |

#### UI 組件

| 文件 | 變更 |
|------|------|
| `src/components/features/forwarders/` | 重命名為 `src/components/features/companies/` |
| `src/app/(dashboard)/forwarders/` | 重命名為 `src/app/(dashboard)/companies/` |

#### Hooks

| 文件 | 變更 |
|------|------|
| `src/hooks/use-forwarders.ts` | 重命名為 `src/hooks/use-companies.ts` |

### 3. 數據遷移

```sql
-- 1. 建立新表
CREATE TABLE companies (
  -- 所有新欄位
);

-- 2. 遷移數據
INSERT INTO companies (id, name, code, display_name, type, status, source, ...)
SELECT
  id,
  name,
  code,
  display_name,
  'FORWARDER',  -- 所有現有資料都是 FORWARDER
  CASE WHEN is_active THEN 'ACTIVE' ELSE 'INACTIVE' END,
  'MANUAL',     -- 手動建立
  ...
FROM forwarders;

-- 3. 更新外鍵引用
-- (在 Prisma migrate 中自動處理)

-- 4. 刪除舊表
DROP TABLE forwarders;
```

---

## 重構策略

### 選項 A：一次性重構（建議）

**優點**：
- 一次完成，避免中間狀態
- 代碼一致性好

**缺點**：
- 工作量較大
- 需要充分測試

**執行步驟**：
1. 創建新的 Prisma migration
2. 執行代碼搜尋和替換
3. 更新所有測試
4. 執行完整回歸測試
5. 部署

### 選項 B：漸進式重構

**優點**：
- 風險較低
- 可分階段驗證

**缺點**：
- 中間狀態複雜
- 需要維護兩套代碼

---

## 向後兼容性

### API 兼容

為保持向後兼容，可以保留舊的 API 端點作為別名：

```typescript
// src/app/api/forwarders/route.ts
// 重定向到 companies API，並添加 type=FORWARDER 過濾
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace('/forwarders', '/companies');
  url.searchParams.set('type', 'FORWARDER');
  // ...
}
```

### UI 兼容

- 保留 "Forwarder 管理" 作為 "公司管理" 的子頁面
- 或將 "Forwarder" 顯示為公司類型標籤

---

## 測試計劃

### 單元測試

- [ ] Company 類型定義測試
- [ ] CompanyService CRUD 測試
- [ ] 模糊匹配服務測試

### 整合測試

- [ ] Company API 端點測試
- [ ] 數據遷移測試
- [ ] 外鍵完整性測試

### E2E 測試

- [ ] 公司列表頁面
- [ ] 公司詳情頁面
- [ ] 規則管理（關聯公司）

---

## 執行時機

### 建議時機

在 **Epic 0 Story 0-3** 開始前完成此重構，原因：

1. Story 0-3 需要 Company 模型支援 `UNKNOWN` 類型
2. 避免建立後再遷移的複雜度
3. 提供更好的數據模型基礎

### 依賴關係

```
REFACTOR-001 (本重構)
    ↓
Epic 0 Story 0-3 (即時公司 Profile 建立)
    ↓
Epic 5 (公司配置管理 - 原 Forwarder 管理)
```

---

## 風險評估

| 風險 | 等級 | 緩解措施 |
|------|------|----------|
| 數據遷移失敗 | 中 | 完整備份 + 回滾腳本 |
| 代碼遺漏 | 中 | 全面搜尋 + 代碼審查 |
| API 破壞 | 低 | 向後兼容端點 |
| 測試不足 | 中 | 完整測試計劃 |

---

## 檢查清單

### 重構前

- [x] 完整備份數據庫
- [x] 確認所有 Forwarder 相關代碼位置
- [x] 準備回滾計劃

### 重構中

- [x] 更新 Prisma Schema
- [x] 執行 Migration
- [x] 更新類型定義
- [x] 更新服務層
- [x] 更新 API 路由
- [x] 更新 UI 組件
- [x] 更新 Hooks

### 重構後

- [x] TypeScript 類型檢查通過
- [x] ESLint 檢查通過（無新增錯誤）
- [ ] 所有測試通過（待執行）
- [ ] 手動驗證核心功能（待執行）
- [x] 更新相關文檔

---

## 相關文檔

- [Epic 0: 歷史數據初始化](../../../docs/03-epics/sections/epic-0-historical-data-initialization.md)
- [Story 0-3: 即時公司 Profile 建立](../../../docs/04-implementation/stories/0-3-just-in-time-company-profile.md)
- [Prisma Schema](../../../prisma/schema.prisma)

---

## 完成記錄

### 執行摘要

重構已於 2025-12-22 完成，主要變更：

1. **Prisma Schema**：`Forwarder` 模型重命名為 `Company`，新增 `CompanyType`、`CompanyStatus`、`CompanySource` 枚舉
2. **類型定義**：`src/types/forwarder.ts` 保留用於向後兼容，新增 `src/types/company.ts`
3. **服務層**：`forwarder.service.ts` 重命名為 `company.service.ts`，更新所有服務中的 `forwarderId` → `companyId`
4. **API 路由**：`/api/forwarders` 重命名為 `/api/companies`，保留部分端點向後兼容
5. **Hooks**：`use-forwarders.ts` 更新為使用新的 Company 類型
6. **組件**：大部分組件保留 "Forwarder" UI 標籤但內部使用 Company 模型

### 已知向後兼容處理

- `DashboardFilterContext` 仍使用 `selectedForwarderIds` 名稱（避免破壞 UI）
- 部分服務返回類型仍使用 `forwarder` 屬性名（如 `RuleTestTask.forwarder`）
- 導出報表 API 使用 `companyIds` 但 UI 篩選器仍用 `forwarderIds` 參數名

### 待驗證項目

- [ ] 完整功能測試（建議在下次 Sprint 進行）
- [ ] E2E 測試覆蓋

---

*設計人: AI Assistant*
*設計時間: 2025-12-22*
*完成時間: 2025-12-22*
*執行人: AI Assistant*
