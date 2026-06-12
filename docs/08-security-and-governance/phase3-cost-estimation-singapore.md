# Phase 3 安全治理修復 — 月成本估算（Azure Singapore Region）

> **建立日期**: 2026-04-28
> **區域**: Southeast Asia (Singapore)
> **基準**: Azure 公開定價（USD），實際以 Microsoft 報價為準
> **參考**: 既有 `docs/07-deployment/02-azure-deployment/azure-deployment-plan.md` 月成本章節

---

## 🎯 執行摘要

Phase 3（22 項 HIGH 風險修復）為**現有 Azure 部署計劃增加月度成本約 $220-310 USD**。

| 階段 | 月成本（USD）| 註 |
|------|-------------|----|
| **CHANGE-055 標準方案**（既有規劃，未含 Phase 3）| **$1,400 - $2,270** | 含 AI 服務 $975 |
| **+ Phase 3 安全治理增量** | **+$220 - $310** | 本文件估算 |
| **= Phase 3 後總月成本** | **$1,620 - $2,580** | 增幅 ~12% |

**重要**：Phase 3 的 22 項風險修復中，**80% 為零成本**（應用層代碼改動 / 文檔 / 開源工具）；僅以下 3 項產生 Azure 月費。

---

## 💰 Phase 3 增量成本明細

### 1. Python Microservices 部署到 Azure Container Apps（CHANGE-069）

**用戶決策（B7）**: 維持 Python 微服務架構，透過 Bicep 部署到 ACA

**服務範圍**:
- `python-services/extraction/`（Azure Document Intelligence OCR 包裝層）
- `python-services/mapping/`（三層映射 + Forwarder 識別）

**Azure Container Apps Consumption Plan 定價（Singapore）**:

| 計費項 | 單價 | 免費額度（每訂閱/月）|
|--------|------|-------------------|
| vCPU-second | ~$0.000024 | 180,000 vCPU-s |
| GiB-second | ~$0.000003 | 360,000 GiB-s |
| Requests | ~$0.40/M | 2,000,000 requests |

**用量假設**（per service）:
- 配置：0.5 vCPU + 1 GiB
- 工作時段執行：~10 小時/天 × 22 工作日 = 220 hr/月
- 非工作時段 scale-to-0（cold start ~5-15 秒延遲）

**單一 Python service 月成本估算**:

| 計費項 | 計算 | 成本 |
|--------|------|------|
| vCPU-s | 0.5 × 220 hr × 3,600 s = 396,000 vCPU-s ÷ 扣 180,000 free = 216,000 × $0.000024 | $5.18 |
| GiB-s | 1 × 220 hr × 3,600 s = 792,000 GiB-s ÷ 扣 360,000 free = 432,000 × $0.000003 | $1.30 |
| Requests | 假設 100K req/月 × $0.40/M | $0.04 |
| **單服務小計** | — | **~$6.50/月** |

**2 個服務合計**:
- 共享同一訂閱免費額度：實際**第二個服務無 free tier 抵扣**
- Service 1（OCR）: ~$6.50
- Service 2（Mapping）: ~$15.00（無 free tier）
- 加上**3 個環境**（dev / staging / prod）：實際 prod 估算 ~$25/月，總計 ~$30-50/月
- 若流量上升或 always-on 1 replica：可達 $50-100/月

**📊 估算範圍**: **$30-100/月**（取決於流量與 always-on 策略）

---

### 2. Azure Defender for Storage（Story 22-2 病毒掃描）

**用戶決策（B4）**: 公司已使用 Azure Defender，取代 ClamAV self-hosted 方案

**Azure Defender for Storage 定價（全球統一）**:

| 計費項 | 單價 |
|--------|------|
| 每 storage account（< 73M 月交易）| **$10 USD/月** |
| 超量（> 73M 月交易）| +$0.1492/M extra transactions |
| Malware scanning（依 GB 計費）| 額外費用，可設月度上限 |

**本專案 Storage Account 數量**:
- prod blob storage: 1 個
- staging blob storage: 1 個（CHANGE-070 新增）
- dev: Azurite 模擬，**不需 Defender**

**月成本估算**:
- 2 個 Defender 啟用 storage account × $10 = **$20/月**
- Malware scanning（假設每月 5,000 個檔案 × 平均 2MB = 10GB）：
  - $0.16/GB × 10 GB = **$1.60/月**
- **小計**: **~$22/月**

**📊 估算範圍**: **$20-30/月**

---

### 3. Staging 環境（CHANGE-070）

**用戶決策（B8）**: Staging 成本 ~$150/月同意

**Staging 環境組成**（為 prod 約 60-70% 縮減版）:

| 服務 | Staging 配置 | 月成本（Singapore 估算）|
|------|------------|----------------------|
| Azure Container Apps（Web app）| 0.5 vCPU + 1 GiB，scale-to-0 | $20-30 |
| Azure Container Apps（Python × 2）| 0.5 vCPU + 1 GiB each | $30-50 |
| Azure Container Registry | 與 prod 共享或獨立 Standard | $0（共享）/ $20（獨立）|
| Azure PostgreSQL Flexible Server | Burstable B1ms (1 vCore, 2GiB) | $12-25 |
| Azure Blob Storage | LRS, ~50 GB | $1-3 |
| Azure Key Vault | Standard, ~100K ops/月 | $1 |
| Azure Defender for Storage | 1 個 storage account | $10 |
| Log Analytics（最小）| 5 GB/月 | $5-10 |
| **小計** | — | **~$80-150/月** |

**📊 估算範圍**: **$80-150/月**（取決於 ACR/Log 是否共享）

---

### 4. 其他 Phase 3 項目（零成本）

以下 Phase 3 項目對 Azure 月費**零增量**：

| 項目 | 工具 / 機制 | 為何零成本 |
|------|-----------|-----------|
| Story 22-1 帳號鎖定 | PostgreSQL 表 + 應用邏輯 | 純應用層 |
| Story 22-3 LLM Prompt Injection 防護 | 應用層 detector + Zod | 純應用層 |
| Story 22-4 CI/CD Pipeline | gitleaks / Dependabot / Trivy / Semgrep CE / npm audit | GitHub Actions 對 private repo 含 2,000 min/月免費；超量 $0.008/min |
| Story 22-5 單元測試框架 | Vitest（開源）| 開源工具 |
| CHANGE-057 API Auth 覆蓋率 | 應用層 middleware | 純代碼修改 |
| CHANGE-058 Session 強化 | 既有 Redis（FIX-052）| 已部署 |
| CHANGE-059 Step-Up Auth | 既有 NextAuth | 純代碼 |
| CHANGE-060 HTTP Headers + CSP | next.config.ts | 純配置 |
| CHANGE-061 withAuth HOF | 應用層重構 | 純代碼 |
| CHANGE-062 Zod 驗證 | 開源套件 | 既有依賴 |
| CHANGE-063 Rate Limit 推廣 | 既有 Upstash Redis（FIX-052）| 已部署 |
| CHANGE-064 SSRF 白名單 | 應用層 | 純代碼 |
| CHANGE-065 Email 安全告警 | 既有 Nodemailer | 已整合 |
| CHANGE-066 Audit Log 中間件 | 既有 PostgreSQL 表 | 純應用層 |
| CHANGE-067 治理基線文檔 | Markdown 文檔 | 純文檔 |
| CHANGE-068 Circuit Breaker (opossum) | 開源套件 | 應用層 |
| FIX-055 PII 修復 | 純代碼修改 | $0 |
| FIX-056 Dev Bypass 加固 | 純代碼修改 | $0 |

> **GitHub Actions 提醒**: 若本專案 GitHub repo 為 private，免費 tier 為 2,000 minute/月。Phase 3 全部 CI workflow 預估每月用量 ~500-1,000 分鐘，**仍在免費範圍內**。若流量增加可能需 GitHub Team plan ($4/user/月)。

---

## 📊 Phase 3 增量月成本總表

| 項目 | 對應規劃 | 月成本（USD）| 是否可省略？ |
|------|---------|-------------|-----------|
| Python Services Bicep 部署 | CHANGE-069 | $30-100 | ❌ 業務必須（OCR/Mapping 核心）|
| Azure Defender for Storage（2 storage account）| Story 22-2 | $20-30 | ⚠️ 可換 ClamAV 自建（增 1-2 週工時）|
| Staging 環境完整一套 | CHANGE-070 | $80-150 | ⚠️ 可延後到 Pilot 後 |
| GitHub Actions 加用（Trivy 建置時間）| Story 22-4 | $0-20 | ✅ 通常免費 |
| **Phase 3 增量小計** | — | **$130-300/月** | — |
| **保守估算（含緩衝）** | — | **+$220-310/月** | — |

---

## 🧮 三方案月總成本（含 Phase 3）

| 方案 | 既有 CHANGE-055 月費 | + Phase 3 增量 | **新總月費** |
|------|---------------------|---------------|------------|
| 保守（無 HA / 縮減資源）| $1,100-1,730 | +$220-310 | **$1,320-2,040** |
| 標準（推薦）| $1,400-2,270 | +$220-310 | **$1,620-2,580** |
| 企業（HA + 完整安全）| $2,000-3,400 | +$220-310 | **$2,220-3,710** |

> **註**: AI 服務月成本 $975 起（37.5K 張 Document Intelligence + GPT-5.2 分類）為**業務量驅動**，與 Phase 3 安全修復無直接關係，但已含在所有方案中。

---

## 💡 成本優化建議

### 立即可行的零成本優化

1. **Python Services Scale-to-0**（CHANGE-069 已預設）
   - 非工作時段 minReplicas=0，可省 50-70% Compute 成本
   - 取捨：cold start 5-15 秒延遲（OCR/Mapping 非即時）

2. **Staging 與 Prod 共享 ACR**（節省 $20/月）
   - 同一 Subscription 下兩環境共用 Standard tier ACR
   - 取捨：image tag 命名需嚴格規範（如 `prod-*` / `staging-*`）

3. **GitHub Actions 在 main branch 才 build container image**
   - PR 階段只跑 lint/type-check/test/SAST/SCA
   - 只有 merge 後才 build + Trivy scan + push to ACR
   - 節省 GitHub Actions 分鐘數

### 可延後的擴展

1. **Staging 環境延後到 Pilot 後 1-2 個月** — 省 $80-150/月初期
2. **Azure Defender 先只啟用 prod storage** — 省 $10/月
3. **Log Analytics 保留期 30 天起步** — 後續按需延長

---

## ⚠️ 重要假設與風險

### 假設

1. **Singapore region pricing** 採 Azure 全球公開定價，**未包含 Microsoft 企業折扣或 EA 合約折扣**（實際可能便宜 5-15%）
2. **匯率採 USD**，公司可能需考慮匯率波動
3. **AI 服務用量**假設業務量為 37.5K 張/月，實際業務增長會線性提升
4. Container Apps Consumption Plan 計費 **per-second**，假設 working hours 22 天/月

### 風險

| 風險 | 影響 | 緩解 |
|------|------|------|
| 業務流量超出免費 tier 一倍 | Container Apps 成本可能翻倍 | 監控用量、設預算告警 |
| Defender Malware Scanning 大量檔案 | 按 GB 計費可能爆量 | 設月度上限（Azure 內建支援）|
| AI 服務 token 消耗超預期 | OpenAI 月費 +$200-500 | 設配額 + 智能降級到 GPT mini |
| Singapore region 為 prod，跨區成本 | 若 dev/staging 在不同區域，egress 費用 | 全部部署在同一 region |

---

## 📌 用戶決策對照表

本估算已反映用戶於 2026-04-28 的決策：

| 決策 | 內容 | 對成本影響 |
|------|------|----------|
| ✅ B4 | Azure Defender for Storage（取代 ClamAV）| +$20-30/月（vs ClamAV 0 月費但 1-2 週工時）|
| ✅ B5 | 檔案大小上限 15MB（vs 50MB）| 無直接影響（Defender 仍按 GB scanning 計費）|
| ✅ B7 | Python Services 維持 + Bicep 部署 | +$30-100/月 |
| ✅ B8 | Staging 環境 ~$150/月 | +$80-150/月 |
| ✅ B9 | HSTS 不 preload | 無成本影響（純配置）|

> 所有 ✅ 決策已採納至本估算。Phase 3 增量小計 **$130-300/月**，加保守緩衝為 **$220-310/月**。

---

## 🔗 相關文件

- [`phase3-master-plan.md`](./phase3-master-plan.md) — Phase 3 主計劃
- [`current-state-assessment.md`](./current-state-assessment.md) — Phase 2 現狀盤點
- `docs/07-deployment/02-azure-deployment/azure-deployment-plan.md` — 既有 Azure 部署計劃（CHANGE-055）
- 預計建立：`docs/07-deployment/02-azure-deployment/infrastructure/cost-estimate.md`（Infra Admin 用 Azure Calculator 實際試算）

---

## 📝 後續行動

1. **Infra Admin 用 Azure Pricing Calculator 實際試算**，產出 `cost-estimate.md` 驗證本估算
2. **設定 Azure 預算告警**（建議 monthly budget = 估算 × 1.2 緩衝）
3. **每季 review 用量**，調整 Container Apps SKU 與 scale 策略

---

## 📚 來源

- [Azure Container Apps Pricing](https://azure.microsoft.com/en-us/pricing/details/container-apps/)
- [Azure Database for PostgreSQL Flexible Server Pricing](https://azure.microsoft.com/en-us/pricing/details/postgresql/flexible-server/)
- [Azure Container Registry Pricing](https://azure.microsoft.com/en-us/pricing/details/container-registry/)
- [Azure Blob Storage Pricing](https://azure.microsoft.com/en-us/pricing/details/storage/blobs/)
- [Microsoft Defender for Cloud Pricing](https://azure.microsoft.com/en-us/pricing/details/defender-for-cloud/)
- [Azure Key Vault Pricing](https://azure.microsoft.com/en-us/pricing/details/key-vault/)

---

*建立日期: 2026-04-28*
*版本: 1.0.0*
*下次更新: Infra Admin 用 Azure Calculator 實際試算後*
