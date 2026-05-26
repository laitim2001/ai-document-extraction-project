# 完整技術棧清單

> **本文件為 CLAUDE.md §技術棧 的完整展開**。CLAUDE.md 只列核心摘要，本文件含版本、套件、配置詳情。
> **最後更新**：2026-05-26 | **基於**：`docs/06-codebase-analyze/` 2026-04-09 掃瞄結果

---

## 核心框架

| 類別 | 技術 | 版本 | 備註 |
|------|------|------|------|
| 前端框架 | Next.js | 15.0.0 | App Router only |
| 語言 | TypeScript | 5.0 | strict mode |
| UI 庫 | React | 18.3 | Server Components by default |
| 樣式 | Tailwind CSS | 3.4 | + shadcn/ui (Radix UI 20+ primitives) |
| 資料庫 | PostgreSQL | 15 | Docker port 5433 |
| ORM | Prisma | 7.2 | 122 models, 113 enums |

---

## 狀態 / 表單 / 驗證

| 類別 | 技術 | 版本 | 用途 |
|------|------|------|------|
| UI 狀態管理 | Zustand | 5.x | 側邊欄、對話框等 UI 交互狀態 |
| 伺服器狀態 | React Query | 5.x | API 數據獲取、快取、同步 |
| 表單 | React Hook Form | 7.x | 表單處理 |
| 驗證 | Zod | 4.x | API 輸入驗證、type-safe schema |
| 國際化 | next-intl | 4.7 | 3 語言 × 34 命名空間 = 102 JSON |
| 快取 | @upstash/redis | — | Rate limit；未配置時 fallback in-memory（FIX-052） |
| 拖放 | @dnd-kit | — | sortable UI |

---

## 外部服務

| 類別 | 服務 | 用途 |
|------|------|------|
| OCR | Azure Document Intelligence | 文件文字提取 |
| AI / LLM | Azure OpenAI GPT-5.2 | 智能分類（Tier 3） |
| AI SDK | OpenAI SDK | API client |
| 認證（企業） | Azure AD (Entra ID) SSO | 企業用戶 |
| 認證（本地） | 自建本地帳號 | 開發 + 後台用戶 |
| 工作流 | n8n | 文件流程自動化 |
| 文件來源 | SharePoint / Outlook / Azure Blob | 多管道輸入 |
| Office 365 | Microsoft Graph Client | SharePoint / Outlook API |

---

## 文件處理

| 類型 | 套件 | 用途 |
|------|------|------|
| PDF（顯示） | pdfjs-dist、react-pdf | 前端 PDF 預覽 |
| PDF（解析） | pdf-parse | 後端文字提取 |
| PDF（轉圖） | pdf-to-img | 預覽圖生成 |
| PDF（產生） | pdfkit | 報表 PDF 輸出 |
| Excel | ExcelJS | 匯出功能 |
| Email | Nodemailer | 通知系統 |

---

## 開發工具

| 類別 | 工具 | 用途 |
|------|------|------|
| 容器化 | Docker Compose | PostgreSQL + pgAdmin + Azurite + Python services |
| 代碼品質 | ESLint + Prettier | Linter + Formatter |
| E2E 測試 | Playwright | 1.57 |
| 套件管理 | npm | — |

---

## Docker 服務端口

| 服務 | 端口 | 說明 |
|------|------|------|
| PostgreSQL | 5433 | 資料庫（注意非 5432） |
| pgAdmin | 5050 | 資料庫管理 UI |
| Azurite (Blob) | 10010 | Azure Blob Storage 模擬 |
| Azurite (Queue) | 10011 | Azure Queue Storage 模擬 |
| Azurite (Table) | 10012 | Azure Table Storage 模擬 |
| Python Extraction Service | 8000 | OCR API |
| Python Mapping Service | 8001 | 三層映射 API |
| Next.js 開發伺服器 | 3200 / 3300 推薦 | 3000 常被佔用 |

---

## 代碼規模概覽

> **數據來源**：`docs/06-codebase-analyze/` 全面掃瞄結果（2026-04-09）
> **完整 80 份分析索引**：`docs/06-codebase-analyze/00-analysis-index.md`

| 指標 | 數量 | 說明 |
|------|------|------|
| React 組件 | **371** | `src/components/` 下所有 `.tsx`（~98K LOC） |
| 業務服務 | **200** | `src/services/` 下所有 `.ts`（~100K LOC，13 個子目錄） |
| API 路由文件 | **331** | 每個 route.ts 處理多個 HTTP 方法，約 **400+ 端點**（414 HTTP methods） |
| HTTP Methods 細分 | — | GET 201 / POST 141 / PATCH 33 / DELETE 31 / PUT 8 |
| 自定義 Hooks | **104** | `src/hooks/`（~28K LOC） |
| Types | **93** | `src/types/`（~38K LOC） |
| Prisma Models | **122** | 4,354 行 schema |
| Prisma Enums | **113** | 列舉類型 |
| i18n JSON 文件 | **102** | 3 語言 × 34 命名空間 |
| Python 服務 | 12 | `python-services/`（~2.7K LOC） |
| src/ 總行數 | ~136,000 | 1,363 個 src/ 文件 |

---

## API Domain 組織（Top 10 by size）

| Domain | 文件數 | 範圍 |
|--------|--------|------|
| `/admin/*` | 106 | Alerts, Backups, Config, Health, Integrations, Logs, Users 等 |
| `/v1/*` | 77 | Versioned APIs: Batches, Formats, Field Mapping, Prompt Configs 等 |
| `/rules/*` | 20 | 映射規則管理 |
| `/documents/*` | 19 | 文件 CRUD + 處理 |
| `/reports/*` | 12 | 報表產生 + 下載 |
| `/companies/*` | 12 | 公司管理（從 Forwarders refactor） |
| `/auth/*` | 7 | NextAuth + 本地認證 |
| `/audit/*` | 7 | 審計報表 |
| `/workflows/*` | 5 | n8n 工作流管理 |
| 其他 | 46 | Reviews, Dashboard, Cost, Cities, Analytics 等 |

---

## 服務層分類

**200 個服務文件，13 個子目錄**：

| 分類 | 文件數 |
|------|--------|
| 核心處理 | 12 |
| AI / OCR | 11 |
| 映射規則 | 12 |
| 公司管理 | 6 |
| 報表統計 | 7 |
| 審計追蹤 | 5 |
| 外部整合 | 15 |
| 系統管理 | 11 |
| 用戶權限 | 5 |
| 其他 | 116 |

---

## 響應格式標準

### Success Response

```typescript
{
  success: true,
  data: T,
  meta?: { pagination?: { ... } }
}
```

### Error Response（RFC 7807）

```typescript
{
  type: string,        // 錯誤類型 URI
  title: string,       // 簡短描述
  status: number,      // HTTP status code
  detail: string,      // 詳細說明
  instance?: string,   // 觸發此錯誤的具體 URI
  errors?: { ... }     // field-level validation errors
}
```

⚠️ **已知差異**：部分舊 API 使用 nested `{ error: { ... } }` 格式 — 新 API 必須採 **top-level**。詳見 `known-discrepancies.md`。

---

## 特殊 API 類型

- **SSE (Streaming)**：2 endpoints
  - `/admin/logs/stream`
  - `/admin/historical-data/batches/[id]/progress`
- **Webhooks**：n8n integrations（webhook configs、test、history）
- **File Upload**：7+ endpoints
  - `/documents/upload`
  - `/companies/[id]`
  - `/historical-data/upload` 等

---

## Python 服務

| 服務 | 端口 | 功能 | LOC |
|------|------|------|-----|
| Extraction Service | 8000 | Azure Document Intelligence OCR | ~1,100 |
| Mapping Service | 8001 | 3-tier mapping + Forwarder ID | ~770 |

**架構**：2-tier backend（Python OCR/Mapping + Node.js 業務邏輯）
**資料流**：Upload → OCR → Mapping → Processing → PostgreSQL → Export

---

## 變更歷史

- **2026-05-26**：初版（從 CLAUDE.md v3.4.1 §技術棧 + §代碼規模 整合遷移，因 v4.0 精簡 CLAUDE.md 而抽出）

---

*本文件由 CLAUDE.md v4.0.0 升級時建立，請隨技術棧變更同步更新*
