# 安全與治理（Security & Governance）

> 本目錄用於系統性審查本項目是否達到**企業級**安全與治理水平，產出評估報告與修復路線圖。

---

## 📋 文件索引

### 📐 階段性報告
| 文件 | 用途 | 狀態 |
|------|------|------|
| [`enterprise-security-governance-matrix.md`](./enterprise-security-governance-matrix.md) | **Phase 1**: 企業級基準評估矩陣（v1.2，7 大領域 × 74 檢查項） | ✅ 完成 |
| [`current-state-assessment.md`](./current-state-assessment.md) | **Phase 2 總評**: 現狀盤點總報告（22 項 HIGH 未達 L2，🔴 NOT READY）| ✅ 完成 |
| [`phase2-iam-dp-assessment.md`](./phase2-iam-dp-assessment.md) | Phase 2 子報告: IAM + DP（801 行） | ✅ 完成 |
| [`phase2-appsec-obs-assessment.md`](./phase2-appsec-obs-assessment.md) | Phase 2 子報告: AppSec + Obs（615 行）| ✅ 完成 |
| [`phase2-resi-gov-assessment.md`](./phase2-resi-gov-assessment.md) | Phase 2 子報告: Resi + Gov（562 行） | ✅ 完成 |
| [`phase2-sdlc-assessment.md`](./phase2-sdlc-assessment.md) | Phase 2 子報告: SDLC + Azure 部署層（965 行）| ✅ 完成 |
| [`phase3-master-plan.md`](./phase3-master-plan.md) | **Phase 3 主計劃**: 4 Wave 修復路線圖 + 27 份規劃文件索引 + B1-B9 決策（已全部確認）| ✅ 完成 |
| [`phase3-cost-estimation-singapore.md`](./phase3-cost-estimation-singapore.md) | **Phase 3 月成本估算**（Azure Singapore Region）+$220-310/月 | ✅ 完成 |

### 📝 Phase 3 規劃文件（27 份，總計 ~12,000 行）

| 類型 | 數量 | 路徑 |
|------|------|------|
| Epic 22 Overview | 1 | `docs/04-implementation/stories/epic-22-enterprise-security/epic-22-overview.md` |
| Stories（22-1 ~ 22-5） | 5 | `docs/04-implementation/stories/epic-22-enterprise-security/` |
| Tech Specs（22-1 ~ 22-5） | 5 | `docs/04-implementation/tech-specs/epic-22-enterprise-security/` |
| CHANGE-057 ~ 070 | 14 | `claudedocs/4-changes/feature-changes/` |
| FIX-055, 056 | 2 | `claudedocs/4-changes/bug-fixes/` |

---

## 🎯 三階段審查進度

```
Phase 1: 定義企業級基準 ✅ 完成（2026-04-28）
   └─→ enterprise-security-governance-matrix.md（v1.2，74 檢查項）
       │
       ▼
Phase 2: 現狀盤點 ✅ 完成（2026-04-28）
   ├─ 4 個並行 Agent 證據導向評分
   ├─ 整體成熟度 L1.0 / 22 項 HIGH 未達 L2
   └─→ current-state-assessment.md + 4 份子報告
       │
       ▼
Phase 3: 規劃文件與路線圖 ✅ 完成（2026-04-28）
   ├─ 5 並行 Agent 產出 27 份規劃
   ├─ 4 Wave 執行路線圖
   └─→ phase3-master-plan.md
       │
       ▼
執行階段: Wave 0 → Wave 1 → Wave 2 → Wave 3 → Wave 4
   └─→ 預期 22 → 0 HIGH 未達 L2，達 🟢 READY for Production
```

### 📊 整體進展

| Phase | 結果 | 工時投入 | 產出 |
|-------|------|---------|------|
| Phase 1 | 評估矩陣 v1.2 | ~1 天 | 1 份矩陣（483 行） |
| Phase 2 | 現狀盤點 | ~1 天 | 5 份報告（3,250 行） |
| Phase 3 | 規劃文件 + 路線圖 | ~1 天 | 28 份文件（~12,000 行） |
| **執行 Wave 0-4** | 待開始 | ~295h | 22 → 0 HIGH 未達 L2 |

---

## 📊 評估維度（7 大領域）

| 領域 | 縮寫 | 主要關注 |
|------|------|----------|
| 身份與存取管理 | **IAM** | Auth 覆蓋率、RBAC、Session、MFA |
| 資料保護 | **DP** | PII、加密、Secret 管理、資料保留 |
| 應用安全 | **AppSec** | 輸入驗證、OWASP Top 10、相依套件 |
| 可觀測性與監控 | **Obs** | Audit log、Security event、告警 |
| 韌性與災備 | **Resi** | Rate limit、DDoS、備份、IR |
| 治理與合規 | **Gov** | 變更管理、技術債、第三方風險 |
| SDLC 安全 | **SDLC** | Secret scan、SAST/DAST、CI 守門 |

---

## 🔗 相關資料來源

- **既有審計**: `docs/06-codebase-analyze/05-security-quality/security-audit.md`
- **既有品質報告**: `docs/06-codebase-analyze/05-security-quality/code-quality.md`
- **MEMORY 審計記錄**: 2026-03-02 安全評分 6.7/10
- **近期修復**: FIX-050（PII）、FIX-051（SQL Injection）、FIX-052（Rate Limit）、FIX-053（Smart Routing）
- **部署規劃**: CHANGE-055（Azure 部署計劃）、CHANGE-056（Prisma migration baseline）

## 🎯 範疇關鍵決策（v1.2）

| 領域 | 範疇決策 | 關鍵原則 |
|------|---------|---------|
| IAM | SSO 強制 + 本地 admin 例外 + 鎖定流程必須完整 | 對內系統、避免半成品 |
| DP | 基本版（員工 PII 為主，無業務 PII） | 6 Must-Have、4 N/A |
| AppSec | 全 12 項，三波次實作 | Wave 3 影響核心功能必測 |
| Obs | 零成本 | 禁用 App Insights / Sentinel |
| Resi | 零成本 | 禁用 WAF / Front Door，用 ACA 內建韌性 |
| Gov | Gov-06/07 對內系統降級 | — |
| SDLC | 免費工具 + Azure 部署層強化 | gitleaks / Trivy / Dependabot / Semgrep CE<br>容器掃描升 HIGH、新增 5 個 ACA 部署安全項 |

## 🚀 部署環境基準

| 服務 | 用途 |
|------|------|
| **Azure Container Apps (ACA)** | Web app + Python OCR/Mapping 微服務 host |
| **Azure Container Registry (ACR)** | Docker image 倉庫，Trivy 掃描整合 |
| **Azure Blob Storage** | 文件儲存（取代開發環境的 Azurite） |
| **Azure Database for PostgreSQL** | Flexible Server，內建 PITR 備份 |
| **Azure AD (Entra ID)** | SSO 認證 |
| **Azure Key Vault** | Secret 管理，ACA secret references 整合 |

---

## 🏷️ 評分標準（Maturity Levels）

各檢查項使用 5 級成熟度模型評分：

| Level | 名稱 | 描述 |
|-------|------|------|
| **L0** | Absent | 未實作 / 未知 |
| **L1** | Initial | 初步實作但不完整、不一致 |
| **L2** | Managed | 已實作且文檔化，但有覆蓋率缺口 |
| **L3** | Defined | 全面覆蓋且符合標準，定期審查 |
| **L4** | Optimized | 自動化、可量測、持續改進 |

**企業級基準**: 所有 HIGH 風險項目應達 **L3+**，MEDIUM 項目應達 **L2+**。

---

## 🚦 快速導覽：我該從哪裡開始？

| 你的角色 / 目的 | 建議閱讀順序 |
|----------------|------------|
| **想了解整體狀況**（高階主管 / PM）| `current-state-assessment.md` → `phase3-master-plan.md` |
| **準備執行修復**（開發者）| `phase3-master-plan.md`（Wave 0-3 路線圖）→ 對應 Story / CHANGE / FIX 文件 |
| **想了解某項風險細節**（架構師）| `phase2-*-assessment.md`（4 份子報告）|
| **驗證評分標準**（審計）| `enterprise-security-governance-matrix.md`（v1.2）|
| **執行 Wave 0 立即清除致命風險**（1 小時）| FIX-056 → Story 22-4 Phase 1 → CHANGE-060 → FIX-055 |

---

*建立日期: 2026-04-28*
*最後更新: 2026-04-28（Phase 3 完成）*
*整體進展: Phase 1 ✅ → Phase 2 ✅ → Phase 3 ✅ → 待執行 Wave 0-4*
