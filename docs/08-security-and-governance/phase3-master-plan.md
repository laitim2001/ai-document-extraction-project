# Phase 3 Master Plan — 修復路線圖與規劃文件索引

> **建立日期**: 2026-04-28
> **規劃範圍**: 22 項 HIGH 風險未達 L2 → 27 份規劃文件
> **執行模式**: 4 Wave 漸進式部署
> **預期最終狀態**: 🟢 READY for Production（HIGH 未達 L2 = 0）

---

## 🎯 執行摘要

Phase 2 盤點發現 **22 項 HIGH 風險未達 L2**，本 Phase 3 已完成完整規劃：

- **Epic 22 — Enterprise Security & Governance**: 5 Stories + 5 Tech Specs（架構級實作）
- **CHANGE-057 ~ CHANGE-070**: 14 份功能變更（既有功能強化）
- **FIX-055 ~ FIX-056**: 2 份 Bug 修復（含 TOP 1 致命風險）
- **規劃文件總計**: 27 份 / ~12,000 行

---

## 📚 規劃文件索引

### 🆕 Epic 22 — Stories（5 份，架構級）

> 路徑: `docs/04-implementation/stories/epic-22-enterprise-security/`

| Story | 文件 | 對應風險 | 行數 |
|-------|------|---------|------|
| Overview | [epic-22-overview.md](../04-implementation/stories/epic-22-enterprise-security/epic-22-overview.md) | — | 220 |
| 22-1 | [22-1-account-lockout-complete.md](../04-implementation/stories/epic-22-enterprise-security/22-1-account-lockout-complete.md) | IAM-07a/b/c | 355 |
| 22-2 | [22-2-file-upload-security.md](../04-implementation/stories/epic-22-enterprise-security/22-2-file-upload-security.md) | AppSec-05 ⚠️ 致命 | 467 |
| 22-3 | [22-3-llm-prompt-injection-protection.md](../04-implementation/stories/epic-22-enterprise-security/22-3-llm-prompt-injection-protection.md) | AppSec-12 | 205 |
| 22-4 | [22-4-cicd-security-pipeline.md](../04-implementation/stories/epic-22-enterprise-security/22-4-cicd-security-pipeline.md) | SDLC-01/02/04/06/08 + Gov-02 | 334 |
| 22-5 | [22-5-unit-testing-framework.md](../04-implementation/stories/epic-22-enterprise-security/22-5-unit-testing-framework.md) | SDLC-10 | 344 |

### 🔧 Epic 22 — Tech Specs（5 份）

> 路徑: `docs/04-implementation/tech-specs/epic-22-enterprise-security/`

| Tech Spec | 行數 |
|-----------|------|
| [tech-spec-story-22-1.md](../04-implementation/tech-specs/epic-22-enterprise-security/tech-spec-story-22-1.md) | 892 |
| [tech-spec-story-22-2.md](../04-implementation/tech-specs/epic-22-enterprise-security/tech-spec-story-22-2.md) | 861 |
| [tech-spec-story-22-3.md](../04-implementation/tech-specs/epic-22-enterprise-security/tech-spec-story-22-3.md) | 547 |
| [tech-spec-story-22-4.md](../04-implementation/tech-specs/epic-22-enterprise-security/tech-spec-story-22-4.md) | 670 |
| [tech-spec-story-22-5.md](../04-implementation/tech-specs/epic-22-enterprise-security/tech-spec-story-22-5.md) | 696 |

### 📝 CHANGE-057 ~ 070（14 份既有功能變更）

> 路徑: `claudedocs/4-changes/feature-changes/`

| 編號 | 標題 | 對應風險 | 優先級 | 行數 |
|------|------|---------|--------|------|
| CHANGE-057 | API Auth 覆蓋率提升至 95% | IAM-01 | HIGH | 294 |
| CHANGE-058 | Session 管理強化 | IAM-04 | HIGH | 385 |
| CHANGE-059 | 特權帳號 Step-Up Authentication | IAM-08 | HIGH | 433 |
| CHANGE-060 | HTTP Security Headers + CSP | DP-02 + AppSec-03 + AppSec-08 | HIGH ⚡Quick Win | 414 |
| CHANGE-061 | Permission 檢查統一 withAuth HOF | IAM-03 + AppSec-11 | MEDIUM | 463 |
| CHANGE-062 | Zod 驗證覆蓋率提升至 95% | AppSec-01 | HIGH | 394 |
| CHANGE-063 | Rate Limit 推廣至全認證/敏感端點 | AppSec-09 | HIGH | 491 |
| CHANGE-064 | SSRF 防護白名單 | AppSec-10 | HIGH | 306 |
| CHANGE-065 | Email 安全告警 5 條 | Obs-05-lite | HIGH | 380 |
| CHANGE-066 | Audit Log 中間件全面採用 | Obs-01 | HIGH | 341 |
| CHANGE-067 | 治理基線文檔（Risk/Tech Debt/Access Review）| Gov-04/08/10/12 | MEDIUM ⚡Quick Win | 436 |
| CHANGE-068 | Resi 韌性（Circuit Breaker + Retry + IR Plan）| Resi-04/05/09 | HIGH | 460 |
| CHANGE-069 | ACA / ACR Bicep 安全強化 | SDLC-13 + SDLC-17 | HIGH | 412 |
| CHANGE-070 | 三環境隔離（補 staging）| SDLC-09 | MEDIUM | 394 |

### 🐛 FIX-055 ~ 056（2 份 Bug 修復）

> 路徑: `claudedocs/4-changes/bug-fixes/`

| 編號 | 標題 | 對應風險 | 優先級 | 行數 |
|------|------|---------|--------|------|
| FIX-055 | 殘留 PII 修復（alert.service.ts + alert-notification.service.ts）| DP-05-lite | HIGH ⚡Quick Win | 409 |
| FIX-056 | X-Dev-Bypass-Auth Header 加固 | IAM-06b | 🔴 **CRITICAL TOP 1** | 500 |

---

## 🛣️ 4 Wave 執行路線圖

### 🚨 Wave 0: 立即執行（今天，1 小時）

**目標**: 清除 TOP 1 致命風險與最快 Quick Wins

| 順序 | 行動 | 文件 | 預期效果 |
|------|------|------|---------|
| 1 | **加固 X-Dev-Bypass-Auth** | FIX-056 | IAM-06b: L0 → L2，**致命風險清除** |
| 2 | 啟用 GitHub Branch Protection | Story 22-4 Phase 1 | Gov-02: L0 → L2 |
| 3 | 加入 next.config security headers | CHANGE-060 Phase 1 | DP-02 + AppSec-08: L0/L1 → L2 |
| 4 | 修復殘留 PII（2 處）| FIX-055 | DP-05-lite: L2 → L3 |

**Wave 0 後**: 22 項 HIGH 未達 L2 → **18 項**

### 🟢 Wave 1: 本週（~24 小時 / ~3 工作天）

**目標**: 治理基線 + CI/CD 守門上線

| 行動 | 文件 | 工時 | 提升 |
|------|------|------|------|
| 治理基線文檔（Risk Register + Tech Debt + Access Review + Security Officer）| CHANGE-067 | 8h | Gov-04/08/10/12: → L2 |
| 完整 CI/CD Pipeline（gitleaks + Dependabot + Trivy + Semgrep + npm audit）| Story 22-4 全部 | 16h | SDLC-01/02/04/06/08: → L2 |

**Wave 1 後**: HIGH 未達 L2 → **12 項**

### 🟡 Wave 2: 本月（~120 小時 / ~3 週）

**目標**: 認證鎖定 + Session 強化 + LLM 防護 + 測試框架

| 行動 | 文件 | 工時 |
|------|------|------|
| 單元測試框架（Vitest）| Story 22-5 | 16h |
| Session 管理強化 | CHANGE-058 | 16h |
| 帳號鎖定機制（三件套）| Story 22-1 | 24h |
| LLM Prompt Injection 防護 | Story 22-3 | 16h |
| Permission 統一 withAuth HOF（Phase 1 基礎建設）| CHANGE-061 | 16h |
| Email 安全告警 5 條 | CHANGE-065 | 8h |
| Resi 韌性（Circuit Breaker + Retry + IR Plan）| CHANGE-068 | 16h |
| 特權帳號 Step-Up Auth | CHANGE-059 | 8h |

**Wave 2 後**: HIGH 未達 L2 → **5 項**

### 🔴 Wave 3: 本季（~150 小時 / ~4 週）

**目標**: 大型架構改進（檔案上傳安全 + Auth/Zod 95%）

| 行動 | 文件 | 工時 |
|------|------|------|
| **檔案上傳安全完整實作**（含 5 項必測）| Story 22-2 | 60h |
| API Auth 覆蓋率 95%（補 130 routes）| CHANGE-057 | 30h |
| Zod 驗證 95% | CHANGE-062 | 24h |
| Rate Limit 推廣全端點 | CHANGE-063 | 16h |
| SSRF 防護白名單 | CHANGE-064 | 16h |
| Audit Log 中間件全面採用 | CHANGE-066 | 12h |

**Wave 3 後**: HIGH 未達 L2 → **0 項** 🟢 **READY for Production**

### 🔵 Wave 4: Azure 部署期（與 CHANGE-055 同步）

**目標**: Azure 環境部署 + 部署層驗證

| 行動 | 文件 | 依賴 |
|------|------|------|
| ACA / ACR Bicep 安全強化 | CHANGE-069 | CHANGE-055 |
| 三環境隔離（補 staging）| CHANGE-070 | CHANGE-069 |
| 部署後 DP-03 / DP-04 / DP-09 升 L3 驗證 | — | Azure 上線 |
| Resi-07 還原測試（首次手動）| — | PostgreSQL 部署 |

**Wave 4 後**: 所有 v1.2 矩陣項目達 L2+，部署層 HIGH 全 L3+

---

## 📊 進度追蹤儀表板

### 風險消減預期曲線

```
22 項 HIGH 未達 L2
    │
    ├─ Wave 0 (1h)   → 18 項  [-18%]
    │
    ├─ Wave 1 (24h)  → 12 項  [-45%]
    │
    ├─ Wave 2 (120h) → 5 項   [-77%]
    │
    └─ Wave 3 (150h) → 0 項   [-100%] 🟢 READY
```

### 工時統計

| Wave | 累積工時 | 累積週 | 累積月 |
|------|---------|--------|--------|
| Wave 0 | 1h | < 1 | — |
| Wave 1 | 25h | ~1 | — |
| Wave 2 | 145h | ~4 | ~1 |
| Wave 3 | 295h | ~8 | ~2 |
| Wave 4 | 隨 Azure 部署 | — | ~3 |

### 修復後成熟度預期

| 領域 | Phase 2 現況 | Wave 3 後 | 提升 |
|------|-------------|-----------|------|
| IAM | L1.2 | L2.8 | +1.6 |
| DP | L1.8 | L2.5 | +0.7 |
| AppSec | L1.1 | L3.0 | +1.9 |
| Obs | L2.0 | L2.8 | +0.8 |
| Resi | L1.4 | L2.5 | +1.1 |
| Gov | L0.4 | L2.2 | +1.8 |
| SDLC | L0.5 | L2.5 | +2.0 |
| **整體** | **L1.0** | **L2.6** | **+1.6** |

---

## 🚦 用戶待決策清單（執行前必須回答）

> **關鍵性等級**: 🔴 阻塞執行 / 🟡 影響範圍 / 🟢 可採預設

### ✅ 阻塞問題已全部確認（2026-04-28）

| # | CHANGE/Story | 議題 | 用戶決策 |
|---|--------------|------|--------|
| **B1** | FIX-056 | 加固方案 | ✅ 同意 NODE_ENV !== 'production' 雙重 guard |
| **B2** | CHANGE-067 | 治理路徑 | ✅ 採 `docs/05-governance/` 新建 |
| **B3** | CHANGE-067 / 068 | Security Officer + IR 通知名單 | ✅ Chris Lai (chris.lai@rapo.com.hk)，全階段，後續團隊擴大時補充 |
| **B4** | Story 22-2 | 病毒掃描方案 | ✅ Azure Defender for Storage（公司已使用，取代 ClamAV）|
| **B5** | Story 22-2 | 檔案大小上限 | ✅ 15MB（單檔）/ 150MB（batch total）|
| **B6** | Story 22-4 | Branch Protection 是否允許 admin bypass | ✅ 允許 admin bypass + audit log 記錄（保留緊急修復彈性）|
| **B7** | CHANGE-069 | Python services Bicep 部署 | ✅ 採選項 A（維持 Python + Bicep，+$30-100/月）|
| **B8** | CHANGE-070 | Staging 環境 ~$150/月 | ✅ 同意此成本範圍 |
| **B9** | CHANGE-060 | HSTS preload | ✅ 採選項 A（啟用 HSTS 但不 preload）|

### 🟡 影響範圍（建議回答）

| # | 議題 | 預設 |
|---|------|------|
| I1 | CHANGE-058: Refresh Token vs 24h sliding JWT | sliding JWT（簡單）|
| I2 | CHANGE-059: 高風險操作 12 項清單範圍 | 採用建議清單 |
| I3 | CHANGE-059: SSO re-auth Phase 1 必做還是 Phase 2 | 延後 Phase 2 |
| I4 | CHANGE-060: CSP `strict-dynamic` 是否啟用 | 啟用 |
| I5 | CHANGE-063: 批量上傳業務 SLA（500 文件/小時） | 待業務確認 |
| I6 | CHANGE-063: 全域 IP rate limit 1000 req/min | 待業務確認 |
| I7 | CHANGE-057: `/v1/*` 對外 API 客戶清單 | 待用戶確認 |
| I8 | CHANGE-064: 動態 SSRF 白名單管理機制 | 環境變數 |
| I9 | CHANGE-068: Azure DI retry 360s 最壞情況 | 60s × 2 retry |
| I10 | Story 22-3: Vitest 與 Next.js 15 相容性是否先做 spike | 建議先 POC（半天）|
| I11 | Story 22-3 vs 22-5 順序 | 先 22-5（測試框架）|
| I12 | Story 22-4: CODEOWNERS 6 個 team 結構 | 採用 / 改個別 user |

### 🟢 可採預設（無需特別決策）

> 其餘 ~10 個技術細節可在實作時討論

---

## 📌 相關文件

| 文件 | 用途 |
|------|------|
| [`enterprise-security-governance-matrix.md`](./enterprise-security-governance-matrix.md) | Phase 1 評估矩陣 v1.2（74 檢查項基準）|
| [`current-state-assessment.md`](./current-state-assessment.md) | Phase 2 現狀盤點總評 |
| [`phase2-iam-dp-assessment.md`](./phase2-iam-dp-assessment.md) | Phase 2 子報告 |
| [`phase2-appsec-obs-assessment.md`](./phase2-appsec-obs-assessment.md) | Phase 2 子報告 |
| [`phase2-resi-gov-assessment.md`](./phase2-resi-gov-assessment.md) | Phase 2 子報告 |
| [`phase2-sdlc-assessment.md`](./phase2-sdlc-assessment.md) | Phase 2 子報告 |
| **`phase3-master-plan.md`**（本文件）| **Phase 3 修復路線圖總索引** |

---

## ✅ Phase 3 完成標準

- [x] 27 份規劃文件已建立（5 Story + 5 Tech Spec + 14 CHANGE + 2 FIX + Epic Overview）
- [x] 4 Wave 執行路線圖已定義（含工時 + 預期效果）
- [x] 用戶待決策清單已彙整（9 阻塞項 + 12 影響項）
- [x] 風險消減預期曲線已建立
- [x] 修復後成熟度預期已建立（L1.0 → L2.6）
- [x] **9 個阻塞問題（B1-B9）全部用戶確認**（2026-04-28）
- [x] **8 份規劃文件已更新反映 B1-B9 決策**（2026-04-28）
- [x] **Phase 3 月成本估算完成**（[`phase3-cost-estimation-singapore.md`](./phase3-cost-estimation-singapore.md)，+$220-310/月）

---

## 🎯 下一步行動建議

> ✅ **Phase 1 / Phase 2 / Phase 3 規劃 + 阻塞決策全部完成**（2026-04-28）
> 現在可以進入**執行階段**。

### 選項 A：立即執行 Wave 0（1 小時，清除 TOP 1 致命風險）
- 直接修 FIX-056（X-Dev-Bypass-Auth）— B1 已確認方案
- 啟用 Branch Protection（允許 admin bypass + audit log，B6）
- 加 Security Headers（含 HSTS 不 preload，B9）
- 修 PII 殘留（FIX-055）

### 選項 B：建立 Sprint 計劃，分階段執行
- 將 Wave 0-3 對應到實際 Sprint
- 安排資源與時程
- 與 CHANGE-055（Azure 部署）整合

### 選項 C：先處理 12 個影響範圍項目（I1-I12）
- 部分 CHANGE 仍有設計取捨需確認（如 CHANGE-058 Refresh Token vs sliding JWT）
- 可在 Wave 2 開始前再決定

### 選項 D：Infra Admin 用 Azure Calculator 實際試算
- 驗證 [`phase3-cost-estimation-singapore.md`](./phase3-cost-estimation-singapore.md) 估算
- 取得 Microsoft 報價作為預算基準
- 設定 Azure 月度預算告警

---

*建立日期: 2026-04-28*
*版本: 1.1.0（2026-04-28：B1-B9 阻塞決策確認 + 月成本估算）*
*Phase 1（評估矩陣）✅ → Phase 2（現狀盤點）✅ → Phase 3（規劃 + 決策 + 成本）✅*
*下一步: 執行 Wave 0（1 小時清除 TOP 1）或建立 Sprint 計劃*
