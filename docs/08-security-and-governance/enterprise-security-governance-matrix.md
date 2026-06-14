# 企業級安全與治理評估矩陣

> **目的**: 定義本項目達到**企業級**水平所需的完整檢查項清單，作為後續現狀盤點與差距分析的基準。
> **參考標準**: OWASP ASVS L2、NIST CSF v2.0、SOC2 Type II、ISO 27001、CIS Controls v8
> **評分模型**: L0 (Absent) → L1 (Initial) → L2 (Managed) → L3 (Defined) → L4 (Optimized)
>
> **版本**: v1.2（2026-04-28）— 7 大領域全部完成範疇調整
>
> **部署環境基準**（v1.2 新增）：
> - **Host**: Azure Container Apps (ACA)
> - **Container Registry**: Azure Container Registry (ACR)
> - **Storage**: Azure Blob Storage（取代開發環境的 Azurite）
> - **Database**: Azure Database for PostgreSQL（Flexible Server）
> - **Identity**: Azure AD (Entra ID) SSO
> - **Secret**: Azure Key Vault
>
> 上述部署環境決策影響 Resi / SDLC 兩領域的實作方式（容器掃描、Health probe、環境隔離等）。

---

## 📑 目錄

1. [IAM — 身份與存取管理](#1-iam--身份與存取管理)
2. [DP — 資料保護（基本版）](#2-dp--資料保護基本版)
3. [AppSec — 應用安全](#3-appsec--應用安全)
4. [Obs — 可觀測性與監控（零成本版）](#4-obs--可觀測性與監控零成本版)
5. [Resi — 韌性與災備](#5-resi--韌性與災備)
6. [Gov — 治理與合規](#6-gov--治理與合規)
7. [SDLC — 開發生命週期安全](#7-sdlc--開發生命週期安全)
8. [評分匯總範本](#評分匯總範本)
9. [v1.1 決策變更記錄](#v11-決策變更記錄)

---

## 1. IAM — 身份與存取管理

> 控管「誰可以做什麼」，是企業級系統的第一道防線。
> **範疇調整 v1.1**: 因本項目為對內系統 + Azure AD SSO，MFA 已由 AAD Conditional Access 控管；帳號鎖定必須含完整解鎖流程。

| ID | 檢查項 | 企業級基準 (L3+) | 風險等級 | 備註 |
|----|--------|-----------------|----------|------|
| **IAM-01** | API 路由認證覆蓋率 | ≥ 95%（公開 API 須白名單明列） | 🔴 HIGH | OWASP A01 |
| **IAM-02** | RBAC 角色細粒度 | 至少 5 種角色 + 細粒度 permission | 🔴 HIGH | NIST AC-2 |
| **IAM-03** | Permission 檢查一致性 | 所有 API 使用統一 middleware/decorator | 🟡 MED | — |
| **IAM-04** | Session 管理 | JWT/Session 有效期 ≤ 24h、refresh token、logout 失效機制 | 🔴 HIGH | OWASP A07 |
| **IAM-05** | 密碼政策 | 最小長度 12、複雜度、bcrypt cost ≥ 12、密碼歷史 | 🟡 MED | NIST IA-5 |
| **IAM-06** | ~~MFA~~ → **SSO 強制** | **SSO 必須是首選認證方式** | 🟡 MED | ✅ AAD 已整合 |
| **IAM-06b** | 本地 admin 帳號管控 | 若仍開放本地 admin → 必須強制 MFA<br>建議：**直接停用本地 admin 登入** | 🔴 HIGH | 🆕 v1.1 新增 |
| **IAM-07a** | 帳號鎖定 — 觸發機制 | N 次失敗（建議 5 次）後鎖定 | 🟡 MED | 🆕 v1.1 拆分 |
| **IAM-07b** | 帳號鎖定 — **解鎖流程**（必須配套） | 必須三選一以上：<br>• 自動時間衰減解鎖（15-30 分鐘）<br>• 管理員手動解鎖 UI<br>• 用戶自助解鎖（email / SSO 重置） | 🔴 HIGH | 🆕 v1.1 新增<br>**⚠️ 與 07a 必須同時實作** |
| **IAM-07c** | 帳號鎖定 — 審計日誌 | 鎖定/解鎖事件均記錄（誰、何時、為何） | 🟡 MED | 🆕 v1.1 拆分 |
| **IAM-08** | 特權帳號管理 | Admin 操作有額外驗證、定期審查、最小權限原則 | 🔴 HIGH | SOC2 CC6.3 |
| **IAM-09** | 服務帳號 / API Key | 機器對機器認證有獨立憑證、可輪替 | 🟡 MED | — |
| **IAM-10** | 跨租戶隔離 | RLS (Row Level Security) 或 query filter 強制執行 | 🔴 HIGH | — |

> **⚠️ 半成品反模式警告**：IAM-07a 不得單獨實作。若實作鎖定但無解鎖流程，IAM-07 整體評為 **L0（比沒做還危險）**，因為會導致用戶必須打給 IT 才能解鎖，影響業務。

**目前已知狀態**:
- ✅ Azure AD SSO 已整合
- ⚠️ Auth 覆蓋率 60-73%（200/331 routes，**不足 95%**）
- ⚠️ `/companies/*` 0%、`/cost/*` 0% 完全未保護
- ❓ 本地 admin 帳號是否仍開放未確認 → Phase 2 需查證

---

## 2. DP — 資料保護（基本版）

> **範疇調整 v1.1**: 業務資料無 PII（B2B Freight Invoice，無個人個資），但仍有**員工 PII**（用戶帳號、操作者 email）。
> 本項目採「基本版」範疇 — 6 項 Must-Have，4 項 N/A 或延後。

### 2.1 基本版必須項（Must-Have，6 項）

| ID | 檢查項 | 企業級基準 (L3+) | 風險等級 | 備註 |
|----|--------|-----------------|----------|------|
| **DP-01-lite** | **員工 PII 識別**（簡化版） | 標註 `User.email`、`AuditLog.userId` 等員工 PII 欄位 | 🟡 MED | 🆕 v1.1 簡化 |
| **DP-02** | 資料加密（傳輸） | HTTPS 強制、TLS 1.2+、HSTS | 🔴 HIGH | OWASP A02<br>**無條件必須** |
| **DP-03** | 資料加密（靜態） | 資料庫加密（Azure TDE 內建免費） | 🔴 HIGH | NIST SC-28 |
| **DP-04** | Secret 管理 | 所有 secret 在 Key Vault / 環境變數，禁止硬編碼 | 🔴 HIGH | OWASP A05<br>**保護 OpenAI key、DB pwd** |
| **DP-05-lite** | **Log 中員工 email 遮罩** | 所有 logger 不得輸出明文 email | 🔴 HIGH | ✅ FIX-050 已部分修復 |
| **DP-09** | 備份加密 + 異地備份 | 備份檔案加密、定期還原測試 | 🔴 HIGH | NIST CP-9<br>**業務連續性需求** |

### 2.2 N/A 或延後項（4 項）

| ID | 檢查項 | 狀態 | 原因 |
|----|--------|------|------|
| **DP-06** | 資料保留政策 | 🟡 延後 | 業務資料可長期保留；員工資料隨 AAD 生命週期管理 |
| **DP-07** | GDPR Right to Erasure | ⚪ N/A | 對內系統，員工離職由 HR + AAD 流程處理 |
| **DP-08** | GDPR 資料匯出（Portability） | ⚪ N/A | 對內系統，無此義務 |
| **DP-10** | 跨境資料傳輸 | 🟡 延後 | 若所有資料都在同一 Azure 區域，可暫不處理 |

**目前已知狀態**:
- ✅ FIX-050 修復 PII 洩漏（auth.config.ts）
- ⚠️ console.log 仍有 279 處待逐步清理（Phase 2 需審查是否含員工 email）
- ❓ Azure TDE / 備份加密狀態需 Phase 2 確認

---

## 3. AppSec — 應用安全

> **範疇調整 v1.1**: 全部 12 項都納入，但**明確標記對既有功能的影響**，並按「實作波次」分組。
> 影響核心功能（特別是文件上傳）的項目，**實作前必須完整測試**。

### 3.1 Wave 1 — 零功能影響（5 項，先做）

| ID | 檢查項 | 企業級基準 (L3+) | 風險等級 | 對功能影響 |
|----|--------|-----------------|----------|-----------|
| **AppSec-01** | 輸入驗證（Zod） | 所有 POST/PATCH/PUT API ≥ 95% 有 Zod schema | 🔴 HIGH | 🟢 **零影響**（只攔截非法輸入） |
| **AppSec-02** | SQL Injection 防護 | 禁止 `$executeRawUnsafe`，全部使用參數化查詢 | 🔴 HIGH | 🟢 **零影響**（FIX-051 已示範） |
| **AppSec-03** | XSS 防護（含 CSP） | React 自動轉義、`dangerouslySetInnerHTML` 審查、CSP 啟用 | 🔴 HIGH | 🟢 **零影響**<br>⚠️ CSP 需先用 `Report-Only` 模式觀察 1-2 週後才強制 |
| **AppSec-08** | Security Headers | HSTS、X-Frame-Options、X-Content-Type-Options、CSP | 🟡 MED | 🟢 **零影響**（純 HTTP header） |
| **AppSec-11** | RFC 7807 錯誤格式統一 | 所有 API 統一錯誤格式 | 🟢 LOW | 🟡 **前端錯誤處理器需小調整** |

### 3.2 Wave 2 — 低度影響（4 項，配套處理）

| ID | 檢查項 | 企業級基準 (L3+) | 風險等級 | 對功能影響 |
|----|--------|-----------------|----------|-----------|
| **AppSec-04** | CSRF 防護 | NextAuth CSRF token、SameSite cookie | 🟡 MED | 🟡 **n8n webhook 需 exempt** |
| **AppSec-06** | 反序列化安全 | JSON.parse 包裝錯誤處理、禁用危險反序列化 | 🟡 MED | 🟢 幾乎無影響 |
| **AppSec-07** | 相依套件漏洞掃描 | npm audit / Dependabot / Snyk 啟用，HIGH/CRITICAL 零容忍 | 🔴 HIGH | 🟡 **可能阻擋 build**<br>採漸進式：先 advisory，2 週後升級為 block |
| **AppSec-12** | LLM Prompt Injection 防護 | 用戶輸入隔離、系統 prompt 保護、輸出驗證 | 🔴 HIGH | 🟡 **可能影響少數 GPT 邊界 case**<br>需實測既有 extraction 流程 |

### 3.3 Wave 3 — 中高度影響（3 項，謹慎設計 + 完整測試）

> **⚠️ 實作前必讀**：以下三項涉及核心業務功能，實作前**必須建立完整 E2E 測試集**，包含正常路徑與邊界 case。

| ID | 檢查項 | 企業級基準 (L3+) | 風險等級 | 對功能影響（**必須測試項**） |
|----|--------|-----------------|----------|---------------------------|
| **AppSec-05** | **檔案上傳安全** | MIME 驗證、大小限制、病毒掃描、隔離儲存 | 🔴 HIGH | 🔴 **影響核心功能：Freight Invoice PDF 上傳**<br>**必測項目**：<br>1. 各種 PDF 格式（純文字、掃描件、加密、混合）<br>2. 部分掃描件 MIME type 異常的兼容性<br>3. 病毒掃描延遲對使用者體驗影響（建議 ≤3 秒）<br>4. 大小限制與業務最大檔案的相容性<br>5. 批量上傳（100+ 檔案）的兼容性<br>**緩解**：提供 fallback 機制，異常檔案可由管理員審核後通過 |
| **AppSec-09** | **全域 Rate Limiting** | 全域 + 端點級 rate limit、防濫用 | 🔴 HIGH | 🔴 **影響批量場景**<br>**必測項目**：<br>1. 用戶批量上傳 100 張發票（一次性場景）<br>2. n8n workflow 自動化定期呼叫<br>3. 報表批量生成<br>4. SharePoint / Outlook 文件來源同步<br>**緩解**：<br>• 為「批量場景」設計獨立 limit 配額<br>• 服務帳號免限制白名單<br>• 提供管理員臨時提升配額機制 |
| **AppSec-10** | **SSRF 防護** | 外部 URL 白名單、禁止內網存取 | 🟡 MED | 🔴 **若有 webhook / URL 抓取功能會中斷**<br>**必測項目**：<br>1. n8n integration 所有 webhook URL<br>2. SharePoint 文件來源所有 URL pattern<br>3. Outlook integration 所有 endpoint<br>4. Microsoft Graph API 呼叫<br>5. Azure Blob Storage URL（特別注意 Azurite dev 環境）<br>**緩解**：<br>• 實作前先列出「應用主動發起的所有外部 URL 呼叫」清單<br>• 採白名單模式（hostname / domain）<br>• 內網 URL 例外處理（Azurite localhost、內網 PostgreSQL） |

### 3.4 實作順序建議

```
Wave 1 (1-2 週)  → Wave 2 (2-3 週) → Wave 3 (3-4 週 + 完整 E2E 測試)
零影響先做      配套小調整         必須完整測試與緩解設計
```

**目前已知狀態**:
- ⚠️ Zod 驗證覆蓋率 60-65%（不足 95%）
- ✅ FIX-051 修復 SQL Injection（cityCodes 白名單）
- ✅ FIX-052 修復 Rate Limit（Redis + fallback）— Wave 3 AppSec-09 可基於此擴展
- ⚠️ LLM Prompt Injection 未審查
- ❓ 檔案上傳目前 MIME / 大小限制狀態需 Phase 2 確認

---

## 4. Obs — 可觀測性與監控（零成本版）

> **範疇調整 v1.1**: 用戶決策不接受任何 Azure 服務費用，本領域採「**零成本最小可行**」範疇。
> **核心原則**: 所有觀測能力必須能用 PostgreSQL + 應用內建機制達成，禁止引入需付費的雲端服務。

### 4.1 零成本必須項（4 項）

| ID | 檢查項 | 企業級基準 (L3+) | 風險等級 | 實作方式（零成本） |
|----|--------|-----------------|----------|-------------------|
| **Obs-01** | Audit Log 覆蓋率 | 所有敏感操作（CRUD on PII、權限變更、Login）100% 記錄 | 🔴 HIGH | ✅ 用 PostgreSQL 表（已存在 `/api/audit/*`），擴大覆蓋率 |
| **Obs-03** | Security Event Log | 失敗 login、權限拒絕、異常 API 呼叫獨立記錄 | 🔴 HIGH | ✅ 複用 Audit log 表，加 `eventType=SECURITY` 標籤 |
| **Obs-05-lite** | 告警機制（基礎版） | 高風險事件即時告警 | 🔴 HIGH | ✅ 只做 **email 通知**（複用 Nodemailer）<br>禁用 Slack / PagerDuty / Sentinel |
| **Obs-11** | Health Check 端點 | `/health` 端點、liveness/readiness probe | 🟢 LOW | 🆕 v1.1 從 Resi 移過來<br>純 Next.js route，零成本 |

### 4.2 延後項（不在現階段範圍）

| ID | 檢查項 | 狀態 | 原因 |
|----|--------|------|------|
| **Obs-02** | Audit Log 不可竄改 | 🟡 延後 | 需要 Azure Append Blob（雖低成本但不為零） |
| **Obs-04** | 集中式 Log（Application Insights） | ⛔ **不採用** | **產生 Azure 攝取費用，違反零成本原則** |
| **Obs-06** | APM 應用效能監控 | ⛔ **不採用** | 包含在 Obs-04 內，同樣產生費用 |
| **Obs-07** | Trace ID 端到端 | 🟡 延後 | 可零成本實作（自建 traceId middleware），但價值依賴 Obs-04 才能查詢 |
| **Obs-08** | Log 保留期延長 | 🟡 延後 | 取決於 PostgreSQL 儲存成本（理論零成本，但需設計 archive 策略） |
| **Obs-09** | 異常偵測（Sentinel） | ⛔ **不採用** | **產生 Sentinel 訂閱費用** |
| **Obs-10** | Dashboard | 🟡 延後 | 可用 pgAdmin 自建查詢，但完整 dashboard 需開發工時 |

### 4.3 零成本可觀測性實作建議

```
Phase 1 — 立即實作（4 項）：
├── 擴大現有 Audit Log 表覆蓋率（Obs-01）
├── 新增 SECURITY eventType 分類（Obs-03）
├── 整合 Nodemailer 做關鍵事件告警（Obs-05-lite）
│   └── 5 條關鍵告警：
│       1. Auth failure spike（5 分鐘內 > 50 次）
│       2. API error rate > 5%
│       3. DB connection failure
│       4. Disk usage > 85%
│       5. 關鍵 service 健康檢查失敗
└── 建立 /api/health 端點（Obs-11）

Phase 2 — 後續可零成本擴展（可選）：
├── traceId middleware（Obs-07，純應用層實作）
└── Audit log archive 機制（Obs-08，定期匯出到 Blob 冷存）
```

### 4.4 對既有功能的影響

| 風險點 | 影響 | 緩解 |
|--------|------|------|
| Audit log 寫入增加 DB 負載 | +5-10ms/req | 用獨立表 + 適當 index + async write（不阻塞主流程） |
| Email 告警誤報導致疲勞 | 開發初期可能誤報 | 先設「report-only」一週，調優閾值後才啟用 |
| Health check 端點被濫用 | 極小 | 可加 rate limit |

**目前已知狀態**:
- ✅ Audit log 機制存在（`/api/audit/*` 7 個 endpoint）
- ✅ Nodemailer 已整合（通知系統可複用）
- ⚠️ 覆蓋率與 SECURITY 分類未驗證
- ❓ Health check 端點是否存在需 Phase 2 確認

---

## 5. Resi — 韌性與災備（零成本版）

> **範疇調整 v1.2**: 同 Obs 領域採「**零成本**」範疇，禁用所有需付費的 Azure 韌性服務。
> **核心原則**: 善用 Container Apps 內建韌性能力 + Azure PostgreSQL 內建備份（Azure 訂閱已包含），不額外引入付費 WAF/CDN。
> **注意**: Obs-11（Health Check）已移到 Obs 領域。

### 5.1 零成本必須項（7 項）

| ID | 檢查項 | 企業級基準 (L3+) | 風險等級 | 實作方式（零成本） |
|----|--------|-----------------|----------|-------------------|
| **Resi-01** | Rate Limiting（多實例） | Redis 集中式 rate limit | 🔴 HIGH | ✅ FIX-052 已修復<br>Container Apps 多實例 → Upstash Redis 已涵蓋 |
| **Resi-03** | 服務隔離 | 微服務獨立 fault domain | 🟡 MED | ✅ Container Apps 多 app 隔離<br>Python OCR / Node.js / DB 各自獨立 |
| **Resi-04** | Circuit Breaker | 外部依賴（Azure OCR、OpenAI）斷路器保護 | 🟡 MED | 應用層實作（opossum / 自建），零成本 |
| **Resi-05** | Retry / Timeout | 所有外部呼叫有 retry + timeout 策略 | 🟡 MED | 應用層實作，零成本 |
| **Resi-06** | 資料庫備份 | 每日全備 + 每小時增備、3-2-1 原則 | 🔴 HIGH | ✅ Azure PostgreSQL Flexible Server 內建<br>**已包含在訂閱費內**（PITR 7-35 天） |
| **Resi-08** | RTO / RPO 文檔化 | 業務需求對齊 RTO ≤ 4h、RPO ≤ 1h | 🟡 MED | 純文檔工作，零成本 |
| **Resi-09** | Incident Response Plan | 文檔化 IR 流程、聯絡名單、演練 | 🔴 HIGH | 純文檔工作，零成本 |

### 5.2 延後或低成本擴展項（3 項）

| ID | 檢查項 | 狀態 | 原因 / 替代方案 |
|----|--------|------|-----------------|
| **Resi-02** | DDoS 防護（Azure Front Door / WAF） | ⛔ **不採用** | **產生 Front Door / WAF 費用**<br>替代：Container Apps 內建有基礎 DDoS 保護（L3/L4），對內系統已足夠 |
| **Resi-07** | 還原測試 | 🟡 延後 | 還原本身免費，但需要時間執行；建議**每半年手動跑一次**（用 Azure PostgreSQL PITR），記錄 RTO 實測值 |
| **Resi-10** | 災難演練 | 🟡 延後 | 每年至少一次 DR 演練；初期可用「Tabletop Exercise」（桌上推演）替代實際演練，零成本 |

### 5.3 Container Apps 韌性最佳實踐（零成本配置）

```
Azure Container Apps 內建能力（無額外費用）：
├── Auto-scaling（KEDA）— 根據 HTTP / CPU / queue 自動擴縮
├── Health Probes（liveness / readiness / startup）— 對應 Obs-11
├── Revision Management — 藍綠部署、自動 rollback
├── Built-in Load Balancer — 多實例請求分發
├── Internal Network Isolation — 內部服務不對外暴露
└── Managed Identity — 免密碼存取 ACR / Key Vault / Blob
```

**目前已知狀態**:
- ✅ FIX-052 修復多實例 rate limit（Upstash Redis）
- ⚠️ Container Apps 部署規劃中（CHANGE-055 / CHANGE-056）
- ❓ Resi-04 (Circuit Breaker)、Resi-05 (Retry/Timeout) 在現有外部呼叫的覆蓋率未確認
- ❓ DR plan、IR plan 未確認

---

## 6. Gov — 治理與合規

> 流程化、可審計、可問責。

| ID | 檢查項 | 企業級基準 (L3+) | 風險等級 | 參考 |
|----|--------|-----------------|----------|------|
| **Gov-01** | 變更管理流程 | 所有 prod 變更走 PR + Review + Approval | 🔴 HIGH | SOC2 CC8.1 |
| **Gov-02** | Code Review 強制 | main 分支保護、至少 1 reviewer、CI 必須通過 | 🔴 HIGH | — |
| **Gov-03** | 職責分離 (SoD) | 開發者 ≠ 部署者 ≠ 審計者 | 🟡 MED | SOC2 CC1.3 |
| **Gov-04** | 技術債追蹤 | 文檔化技術債、定期回顧、優先級排序 | 🟡 MED | — |
| **Gov-05** | 第三方風險評估 | Azure / OpenAI / n8n 等供應商風險評估 | 🟡 MED | SOC2 CC9.2 |
| **Gov-06** | DPA / 合約 | 處理 PII 的 SaaS 簽署 Data Processing Agreement | 🟡 MED | 🔄 v1.1 降級<br>本項目無業務 PII，僅員工 PII 由 AAD 處理 |
| **Gov-07** | 隱私政策 | 用戶知情同意、文檔化資料用途 | 🟡 MED | 🔄 v1.1 降級<br>對內系統，可簡化 |
| **Gov-08** | 安全責任人 | 指定 Security Officer / DPO | 🟡 MED | — |
| **Gov-09** | 員工資安培訓 | 每年至少一次 security awareness training | 🟡 MED | SOC2 CC1.4 |
| **Gov-10** | Access Review | 每季審查所有 admin 帳號權限 | 🔴 HIGH | SOC2 CC6.3 |
| **Gov-11** | 文檔治理 | 安全相關文檔有版本、審查週期、所有權 | 🟢 LOW | — |
| **Gov-12** | 風險登記簿 | Risk Register 文檔化所有已知風險 | 🟡 MED | NIST RA-3 |

**目前已知狀態**:
- ✅ Conventional Commits + PR 流程
- ⚠️ 職責分離、Access Review、Risk Register 未確認

---

## 7. SDLC — 開發生命週期安全（免費工具版）

> **範疇調整 v1.2**: 採「**只用免費工具**」範疇，禁用 Snyk、SonarQube Cloud、SCA SaaS 等付費服務。
> **替代方案**: gitleaks（免費）、Dependabot（GitHub 內建免費）、npm audit（內建）、Trivy（開源）、Semgrep CE（開源）。
> **部署環境影響**: 採用 Azure Container Apps + ACR，**容器掃描成為 HIGH 風險項**（升級）。

### 7.1 必須項（採用免費工具，9 項）

| ID | 檢查項 | 企業級基準 (L3+) | 風險等級 | 免費工具實作 |
|----|--------|-----------------|----------|-------------|
| **SDLC-01** | Secret Scanning | Pre-commit hook + CI 掃描 | 🔴 HIGH | ✅ **gitleaks**（開源）<br>• Pre-commit: husky + gitleaks<br>• CI: gitleaks/gitleaks-action（GitHub Action 免費） |
| **SDLC-02** | SAST（靜態掃描） | CI 整合 SAST 工具 | 🟡 MED | ✅ **Semgrep CE**（開源）<br>• 規則庫：semgrep --config=auto<br>• GitHub Action: returntocorp/semgrep-action（免費） |
| **SDLC-04** | SCA（相依套件掃描） | npm audit + Dependabot | 🔴 HIGH | ✅ **npm audit + Dependabot security updates + CI 把關**<br>• ⚠️ 2026-06-12（CHANGE-081）：`.github/dependabot.yml` **版本更新已停用**，保留 security updates<br>• CI: npm audit --audit-level=high（持續把關）<br>⛔ Snyk 不採用（付費） |
| **SDLC-06** | **容器掃描**（升級為 HIGH） | Docker image 掃描 | 🔴 **HIGH**<br>🆕 v1.2 升級 | ✅ **Trivy**（開源，aquasecurity/trivy）<br>• ACR Tasks 整合<br>• GitHub Action: aquasecurity/trivy-action（免費）<br>• 必須在 push 到 ACR 前掃描<br>⛔ Snyk Container 不採用（付費） |
| **SDLC-08** | CI/CD 守門 | 安全測試失敗則 block deploy | 🔴 HIGH | GitHub Actions branch protection<br>• gitleaks / Trivy / npm audit 失敗 → block merge<br>• 必須 type-check + lint 通過 |
| **SDLC-09** | **環境隔離**（Container Apps 強化） | dev / staging / prod 完全隔離 | 🔴 HIGH | 🔄 v1.2 強化<br>• 三套獨立 ACA Environment（dev / staging / prod）<br>• 各自獨立 ACR repository / Key Vault / PostgreSQL<br>• Managed Identity 限制 prod 資源僅 prod ACA 可存取<br>• Network: prod ACA 用 internal-only ingress |
| **SDLC-10** | 安全測試（單元） | 安全相關邏輯有測試（auth、permission、validation） | 🟡 MED | Jest / Vitest（既有）<br>覆蓋 auth middleware、Zod schema、permission check |
| **SDLC-11** | 滲透測試 | 每年至少一次第三方滲透測試 | 🟡 MED | 🟡 **建議**：對內系統可由內部 IT/security 團隊執行<br>替代：用 OWASP ZAP（開源 DAST）對 staging 自動掃描 |
| **SDLC-12** | Threat Modeling | 重大功能設計階段做威脅建模 | 🟢 LOW | 用 STRIDE 框架 + Markdown 文檔，零工具成本 |

### 7.2 延後或低優先項（3 項）

| ID | 檢查項 | 狀態 | 原因 |
|----|--------|------|------|
| **SDLC-03** | DAST（動態掃描） | 🟡 延後 | OWASP ZAP 雖免費，但需要 staging 環境穩定後才有意義；可併入 SDLC-11 |
| **SDLC-05** | SBOM 生成 | 🟡 延後 | 用 Syft（開源）可零成本實作，但對內系統 SBOM 價值較低，後期再做 |
| **SDLC-07** | 程式碼簽章 | 🟡 延後 | GPG 簽章（免費）但需要團隊建立金鑰流程；ACR Image 簽章用 Notation（開源） |

### 7.3 Azure 部署環境專屬安全項（🆕 v1.2 新增）

> 因採用 Azure Container Apps + ACR + Blob Storage，新增以下部署層安全檢查項：

| ID | 檢查項 | 企業級基準 (L3+) | 風險等級 | 實作方式 |
|----|--------|-----------------|----------|----------|
| **SDLC-13** | **ACR 安全配置** | Image 簽章、僅允許簽名 image 部署 | 🟡 MED | ACR Premium 含 Content Trust（**檢查費用**）<br>替代：用 Trivy 掃描通過才允許 push |
| **SDLC-14** | **ACA Managed Identity** | 所有 ACA 服務用 Managed Identity 存取資源 | 🔴 HIGH | ✅ **完全免費**，禁止用 connection string<br>• ACR pull: System-assigned MI<br>• Key Vault: System-assigned MI<br>• Blob Storage: System-assigned MI<br>• PostgreSQL: AAD authentication |
| **SDLC-15** | **Key Vault 整合** | 所有 secret 從 Key Vault 注入 ACA | 🔴 HIGH | ACA secret references → Key Vault<br>禁止 secret 寫在 ACA env vars |
| **SDLC-16** | **Blob Storage 安全** | Private endpoint、SAS token 限制、無公開存取 | 🔴 HIGH | • 關閉 anonymous blob access<br>• SAS token 短期 + IP 限制<br>• 容器 default access level: Private<br>• User Delegation SAS（用 AAD 而非 storage key） |
| **SDLC-17** | **Container Apps 網路隔離** | 內部服務 internal-only ingress | 🔴 HIGH | • Web app: external ingress + custom domain + HTTPS<br>• Python OCR / Mapping: **internal-only ingress**<br>• n8n: internal-only or VNet integration |

### 7.4 部署層安全配置範例（零成本路徑）

```
GitHub Actions CI/CD Pipeline（免費）:
1. PR 觸發
   ├── gitleaks (Secret scan)
   ├── npm audit --audit-level=high
   ├── Semgrep CE (SAST)
   ├── ESLint + TypeScript check
   ├── Jest tests（含 SDLC-10 安全測試）
   └── 全部通過 → 允許 merge

2. Merge to main 觸發
   ├── Build Docker image
   ├── Trivy scan (HIGH/CRITICAL → fail)
   ├── Push to ACR (Managed Identity)
   ├── Deploy to ACA staging
   ├── Health check 通過
   └── 手動 approval → Deploy prod

部署層保護（Azure 內建免費）:
├── ACA Managed Identity 存取所有資源
├── Key Vault 注入 secret
├── Blob Storage Private + User Delegation SAS
├── PostgreSQL AAD authentication
└── Internal services 不對外暴露
```

**目前已知狀態**:
- ⚠️ Secret scanning、SAST、SCA、Pen test 全部未確認
- ✅ Conventional Commits + PR review 流程存在
- 🔄 部署規劃中（CHANGE-055 Azure 部署計劃 / CHANGE-056 Prisma migration baseline）
- ❓ ACR、Key Vault、Managed Identity 配置狀態待 Phase 2 確認

---

## 評分匯總範本

> Phase 2 現狀盤點時填寫此表。

### 領域成熟度總覽（v1.2 調整後）

| 領域 | 檢查項數 | 範疇調整 | L0 | L1 | L2 | L3 | L4 | 平均分 | 企業就緒？ |
|------|----------|---------|----|----|----|----|----|--------|-----------|
| IAM 身份存取 | 13（拆分後） | 含 IAM-06b、07a/b/c | ? | ? | ? | ? | ? | ?/4 | ⚠️ / ✅ |
| DP 資料保護（基本版） | 6 Must + 4 N/A | 員工 PII 為主 | ? | ? | ? | ? | ? | ?/4 | ⚠️ / ✅ |
| AppSec 應用安全 | 12 | 三波次實作 | ? | ? | ? | ? | ? | ?/4 | ⚠️ / ✅ |
| Obs 可觀測性（零成本） | 4 必須 + 7 延後 | 禁用付費服務 | ? | ? | ? | ? | ? | ?/4 | ⚠️ / ✅ |
| Resi 韌性災備（零成本） | 7 必須 + 3 延後 | 禁用 WAF/Front Door | ? | ? | ? | ? | ? | ?/4 | ⚠️ / ✅ |
| Gov 治理合規 | 12 | Gov-06/07 降級 | ? | ? | ? | ? | ? | ?/4 | ⚠️ / ✅ |
| SDLC 開發安全（免費版+ Azure 部署） | 9 必須 + 3 延後 + 5 部署層 = 17 | 免費工具 + ACA 安全 | ? | ? | ? | ? | ? | ?/4 | ⚠️ / ✅ |
| **總計** | **本項目範疇 ~71** | — | — | — | — | — | — | **?/4** | — |

### 風險矩陣（Phase 3 產出）

```
          │ 影響度 LOW │ MED        │ HIGH       │
──────────┼───────────┼────────────┼────────────┤
機率 HIGH │ 觀察      │ 計劃修復   │ 立即修復   │
機率 MED  │ 接受      │ 計劃修復   │ 計劃修復   │
機率 LOW  │ 接受      │ 接受      │ 計劃修復   │
```

### 企業就緒度判定

- **🔴 NOT READY**: HIGH 風險項 ≥ 1 個低於 L2
- **🟡 PARTIALLY READY**: HIGH 全部 L2+，MEDIUM 部分低於 L2
- **🟢 READY**: HIGH ≥ L3，MEDIUM ≥ L2，LOW 無重大缺口

---

## v1.1 決策變更記錄

> 2026-04-28 與用戶確認後的範疇調整。

### IAM 領域
| 變更 | 內容 |
|------|------|
| **IAM-06 重新定義** | 從「MFA 強制」改為「SSO 強制」<br>原因：對內系統 + AAD SSO 已等同企業級 MFA，AAD Conditional Access 已控管 |
| **IAM-06b 新增** | 本地 admin 帳號管控 — 若仍開放必須強制 MFA<br>建議直接停用本地 admin |
| **IAM-07 拆分** | 拆為 07a (鎖定觸發) + 07b (解鎖流程) + 07c (審計)<br>原因：避免「只做鎖定不做解鎖」的半成品反模式<br>**07b 必須與 07a 同時實作**，否則整體評為 L0 |

### DP 領域
| 變更 | 內容 |
|------|------|
| **採用基本版範疇** | 業務資料無 PII，僅員工 PII<br>6 Must-Have（DP-01-lite, 02, 03, 04, 05-lite, 09）<br>4 項標 N/A 或延後（DP-06, 07, 08, 10） |
| **DP-01 簡化** | 改為「員工 PII 識別」，只需標註 User.email、AuditLog.userId |
| **DP-05 簡化** | 改為「Log 中員工 email 遮罩」，FIX-050 已部分修復 |

### AppSec 領域
| 變更 | 內容 |
|------|------|
| **全部 12 項保留** | 用戶接受全部納入，但需明確標記功能影響 |
| **新增 Wave 分組** | Wave 1（零影響 5 項）/ Wave 2（低影響 4 項）/ Wave 3（中高影響 3 項） |
| **Wave 3 新增「必測項目」** | AppSec-05、09、10 列出每項必須測試的具體場景<br>原因：影響核心文件上傳功能，實作前必須完整測試 |

### Obs 領域
| 變更 | 內容 |
|------|------|
| **採用零成本範疇** | 用戶決策：現階段不接受任何 Azure 服務費用 |
| **必須項從 10 縮減為 4** | Obs-01, 03, 05-lite, 11（Health Check 從 Resi 移過來） |
| **Obs-04, 06, 09 標記不採用** | Application Insights / APM / Sentinel 全部產生費用 |
| **告警僅限 email** | Obs-05-lite — 用既有 Nodemailer，不引入 Slack / PagerDuty |

### Gov 領域
| 變更 | 內容 |
|------|------|
| **Gov-06 降級** | DPA / 合約從 HIGH → MED<br>原因：本項目無業務 PII，僅員工 PII 由 AAD 處理 |
| **Gov-07 降級** | 隱私政策從 HIGH → MED<br>原因：對內系統可簡化，無外部用戶 |

---

## v1.2 決策變更記錄

> 2026-04-28 與用戶確認後，完成 Resi/Gov/SDLC 三領域 + 部署環境基準。

### 部署環境基準（新增）
| 變更 | 內容 |
|------|------|
| **明確化部署架構** | Azure Container Apps + ACR + Blob Storage + Azure PostgreSQL + AAD + Key Vault<br>影響 Resi / SDLC 兩領域實作方式 |

### Resi 領域
| 變更 | 內容 |
|------|------|
| **採用零成本範疇** | 用戶決策：同 Obs 領域，禁用付費韌性服務 |
| **必須項從 10 縮減為 7** | Resi-01, 03, 04, 05, 06, 08, 09 |
| **Resi-02 不採用** | DDoS 防護（Azure Front Door / WAF）產生費用<br>替代：Container Apps 內建 L3/L4 DDoS 已足夠對內系統 |
| **Resi-06 確認免費** | Azure PostgreSQL Flexible Server 內建 PITR 已包含在訂閱費內 |
| **Resi-07/10 延後** | 還原測試半年一次（手動）、災難演練可用 Tabletop Exercise 替代 |
| **新增 ACA 韌性最佳實踐** | 利用 Container Apps 內建免費能力（auto-scaling、health probe、藍綠部署） |

### SDLC 領域
| 變更 | 內容 |
|------|------|
| **採用「免費工具版」範疇** | 用戶決策：禁用 Snyk、SonarQube Cloud 等付費 SaaS<br>採用：gitleaks、Dependabot、npm audit、Trivy、Semgrep CE |
| **SDLC-06 升級** | 容器掃描從 MED → HIGH<br>原因：採用 Container Apps + ACR，容器鏡像安全成為關鍵 |
| **SDLC-09 強化** | 環境隔離詳述 ACA 三環境配置（dev/staging/prod 各自獨立 Environment、ACR、Key Vault、PostgreSQL）|
| **新增 5 個部署層安全項** | SDLC-13 (ACR 安全)、14 (Managed Identity)、15 (Key Vault)、16 (Blob Storage)、17 (網路隔離) |
| **SDLC-03/05/07 延後** | DAST、SBOM、程式碼簽章皆可零成本但優先級較低 |

---

## 📌 Phase 1 完成標準（v1.2 — Phase 1 已完成）

Review 此矩陣時請確認：

- [x] 7 大領域是否覆蓋本項目所有風險面 — **已確認**
- [x] IAM 範疇調整 — **v1.1 確認**
- [x] DP 基本版範疇 — **v1.1 確認**
- [x] AppSec 影響標記 — **v1.1 確認**
- [x] Obs 零成本範疇 — **v1.1 確認**
- [x] Resi 零成本範疇 — **v1.2 確認**
- [x] Gov 範疇（v1.1 已調整 06/07） — **v1.2 確認沿用**
- [x] SDLC 免費工具版 + Azure 部署層 — **v1.2 確認**
- [x] 部署環境基準明確化（ACA + ACR + Blob + PostgreSQL + AAD + Key Vault） — **v1.2 新增**

✅ **Phase 1 評估矩陣已完成，可進入 Phase 2: 現狀盤點**

---

*建立日期: 2026-04-28*
*版本: 1.2.0（Resi/Gov/SDLC + Azure 部署環境基準）*
*下一步: 進入 Phase 2 — 現狀盤點*
