# Story 0.3: 即時公司 Profile 建立（Just-in-Time）

**Status:** pending

---

## Story

**As a** 系統,
**I want** 在遇到未知公司時自動建立初始 Profile,
**So that** 不會因為缺少公司資料而中斷處理流程。

---

## Acceptance Criteria

### AC1: 自動公司識別

**Given** AI 處理完成並提取出公司名稱
**When** 系統檢查公司是否存在
**Then** 使用模糊匹配檢查現有公司
**And** 如果匹配度 > 90%，關聯到現有公司
**And** 如果匹配度 ≤ 90%，標記為新公司

### AC2: 自動建立公司 Profile

**Given** 識別到新公司
**When** 系統自動建立 Profile
**Then** 建立包含以下資訊：
  - 名稱：從發票提取
  - 類型：`UNKNOWN`
  - 狀態：`PENDING`
  - 來源：`AUTO_CREATED`
  - 首次出現文件 ID

### AC3: 公司審核列表

**Given** 存在自動建立的公司 Profile
**When** 管理員訪問公司審核頁面
**Then** 顯示所有 `PENDING` 狀態的公司
**And** 顯示每個公司的出現次數和相關文件
**And** 顯示可能的重複公司建議

### AC4: 公司類型分類

**Given** 管理員審核公司 Profile
**When** 選擇公司類型
**Then** 可選類型包括：
  - `FORWARDER`：貨運代理商
  - `EXPORTER`：出口商
  - `CARRIER`：承運人
  - `CUSTOMS_BROKER`：報關行
  - `OTHER`：其他
**And** 狀態變更為 `ACTIVE`

### AC5: 公司合併功能

**Given** 發現重複公司（同公司不同名稱）
**When** 選擇合併
**Then** 可以選擇主公司
**And** 副公司的名稱變體記錄到主公司
**And** 副公司的關聯文件轉移到主公司
**And** 副公司標記為 `MERGED`

---

## Tasks / Subtasks

- [ ] **Task 1: Company 模型重構** (AC: #1-5)
  - [ ] 1.1 創建 Company 模型（取代/增強 Forwarder）
  - [ ] 1.2 新增 CompanyType enum
  - [ ] 1.3 新增 CompanyStatus enum
  - [ ] 1.4 新增 CompanySource enum
  - [ ] 1.5 Prisma Migration
  - [ ] 1.6 數據遷移腳本（Forwarder → Company）

- [ ] **Task 2: 公司匹配服務** (AC: #1)
  - [ ] 2.1 創建 `src/services/company-matcher.service.ts`
  - [ ] 2.2 實現模糊匹配算法（Levenshtein 距離）
  - [ ] 2.3 考慮常見縮寫（Ltd., Inc., Corp.）
  - [ ] 2.4 匹配結果快取

- [ ] **Task 3: 自動建立服務** (AC: #2)
  - [ ] 3.1 創建 `src/services/company-auto-create.service.ts`
  - [ ] 3.2 從提取結果中識別公司名稱
  - [ ] 3.3 調用匹配服務
  - [ ] 3.4 建立新公司 Profile

- [ ] **Task 4: 公司審核頁面** (AC: #3)
  - [ ] 4.1 創建 `src/app/(dashboard)/admin/companies/review/page.tsx`
  - [ ] 4.2 顯示待審核公司列表
  - [ ] 4.3 顯示出現次數和相關文件
  - [ ] 4.4 顯示重複建議

- [ ] **Task 5: 公司類型分類 UI** (AC: #4)
  - [ ] 5.1 創建 `CompanyTypeSelector.tsx`
  - [ ] 5.2 類型選擇下拉選單
  - [ ] 5.3 批量類型分配

- [ ] **Task 6: 公司合併功能** (AC: #5)
  - [ ] 6.1 創建 `CompanyMergeDialog.tsx`
  - [ ] 6.2 主/副公司選擇
  - [ ] 6.3 合併預覽
  - [ ] 6.4 合併執行 API
  - [ ] 6.5 名稱變體記錄

- [ ] **Task 7: API 端點** (AC: #3-5)
  - [ ] 7.1 GET `/api/admin/companies/pending` - 待審核列表
  - [ ] 7.2 PATCH `/api/admin/companies/[id]` - 更新類型/狀態
  - [ ] 7.3 POST `/api/admin/companies/merge` - 合併公司

- [ ] **Task 8: 驗證與測試** (AC: #1-5)
  - [ ] 8.1 TypeScript 類型檢查通過
  - [ ] 8.2 ESLint 檢查通過
  - [ ] 8.3 模糊匹配準確性測試
  - [ ] 8.4 合併功能測試

---

## Dev Notes

### 依賴項

- **Story 0.2**: 智能處理路由（提供提取結果）
- **REFACTOR-001**: Forwarder → Company 重構（如果先執行）

### 數據模型

```prisma
// Company 模型（取代或增強 Forwarder）
model Company {
  id            String        @id @default(uuid())
  name          String        // 主要名稱
  code          String?       @unique // 系統代碼（可選）
  displayName   String        @map("display_name")
  type          CompanyType   @default(UNKNOWN)
  status        CompanyStatus @default(PENDING)
  source        CompanySource @default(MANUAL)

  // 名稱變體（用於匹配）
  nameVariants  String[]      @map("name_variants")

  // 合併相關
  mergedIntoId  String?       @map("merged_into_id")
  mergedInto    Company?      @relation("CompanyMerge", fields: [mergedIntoId], references: [id])
  mergedFrom    Company[]     @relation("CompanyMerge")

  // 首次出現
  firstSeenDocumentId String? @map("first_seen_document_id")

  // 元數據
  logoUrl       String?       @map("logo_url")
  contactEmail  String?       @map("contact_email")
  description   String?

  // 時間戳
  createdAt     DateTime      @default(now()) @map("created_at")
  updatedAt     DateTime      @updatedAt @map("updated_at")
  createdBy     String        @map("created_by")

  // 關聯
  creator       User          @relation(fields: [createdBy], references: [id])
  documents     Document[]
  mappingRules  MappingRule[]

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
  AUTO_CREATED    // 自動建立
  IMPORTED        // 批量匯入
}
```

### 模糊匹配算法

```typescript
// src/services/company-matcher.service.ts

import { levenshteinDistance } from '@/lib/utils/string';

export interface MatchResult {
  companyId: string;
  companyName: string;
  matchScore: number; // 0-1，1 為完全匹配
  matchType: 'EXACT' | 'FUZZY' | 'VARIANT' | 'NONE';
}

export async function findMatchingCompany(
  name: string
): Promise<MatchResult | null> {
  const normalizedName = normalizeName(name);

  // 1. 精確匹配（正規化後）
  const exactMatch = await prisma.company.findFirst({
    where: {
      OR: [
        { name: normalizedName },
        { nameVariants: { has: normalizedName } },
      ],
    },
  });

  if (exactMatch) {
    return {
      companyId: exactMatch.id,
      companyName: exactMatch.name,
      matchScore: 1,
      matchType: 'EXACT',
    };
  }

  // 2. 模糊匹配
  const allCompanies = await prisma.company.findMany({
    where: { status: { not: 'MERGED' } },
    select: { id: true, name: true, nameVariants: true },
  });

  let bestMatch: MatchResult | null = null;

  for (const company of allCompanies) {
    const allNames = [company.name, ...company.nameVariants];
    for (const candidateName of allNames) {
      const score = calculateSimilarity(normalizedName, normalizeName(candidateName));
      if (score > 0.9 && (!bestMatch || score > bestMatch.matchScore)) {
        bestMatch = {
          companyId: company.id,
          companyName: company.name,
          matchScore: score,
          matchType: 'FUZZY',
        };
      }
    }
  }

  return bestMatch;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/(ltd\.?|inc\.?|corp\.?|co\.?|limited|incorporated|corporation|company)/gi, '')
    .trim();
}

function calculateSimilarity(a: string, b: string): number {
  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  return 1 - distance / maxLength;
}
```

### API 設計

```typescript
// GET /api/admin/companies/pending
interface PendingCompaniesResponse {
  success: true;
  data: {
    companies: {
      id: string;
      name: string;
      type: CompanyType;
      status: CompanyStatus;
      source: CompanySource;
      documentCount: number;
      firstSeenAt: string;
      possibleDuplicates: {
        id: string;
        name: string;
        matchScore: number;
      }[];
    }[];
    pagination: Pagination;
  };
}

// PATCH /api/admin/companies/[id]
interface UpdateCompanyRequest {
  type?: CompanyType;
  status?: CompanyStatus;
  displayName?: string;
  description?: string;
}

// POST /api/admin/companies/merge
interface MergeCompaniesRequest {
  primaryId: string;      // 保留的主公司
  secondaryIds: string[]; // 要合併的副公司
}
```

### References

- [Source: docs/03-epics/sections/epic-0-historical-data-initialization.md#story-03]
- [Note: 此 Story 與 REFACTOR-001 密切相關]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 0.3 |
| Story Key | 0-3-just-in-time-company-profile |
| Epic | Epic 0: 歷史數據初始化 |
| Dependencies | Story 0.2 |

---

*Story created: 2025-12-22*
*Status: pending*
