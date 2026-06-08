# Epic 22: Enterprise Security & Governance

> **Epic ID**: 22
> **Created**: 2026-04-28
> **Status**: Planned
> **Estimated Effort**: 5 Stories, 約 3-4 週

---

## Epic Summary

本 Epic 是 **Phase 2 安全與治理盤點報告**（`docs/08-security-and-governance/current-state-assessment.md`）後針對 22 項 HIGH 風險未達 L2 的修復專屬 Epic。盤點發現本項目目前**未達企業級安全與治理水平**，22 個 Epic / 157+ Stories 都已完成，但應用層安全、CI/CD 守門、檔案上傳防護、帳號鎖定、單元測試框架等項目仍是嚴重短板。

本 Epic 聚焦於 5 個高影響面的修復工作，將 IAM、AppSec、SDLC 三個領域的核心 HIGH 風險項目提升至 L2 以上，達到 production go-live 的最低門檻。

### 與 Phase 3 修復路線圖對齊

| 領域 | 對應風險項 | Wave | 預估投入 |
|------|------------|------|----------|
| IAM-07a/b/c | 帳號鎖定機制三項齊發 | Wave 2 | Story 22-1（5-7 天）|
| AppSec-05 | 檔案上傳安全完整實作 | Wave 3 | Story 22-2（10-14 天）|
| AppSec-12 | LLM Prompt Injection 防護 | Wave 2 | Story 22-3（5-7 天）|
| SDLC-01/04/06/08 | CI/CD Pipeline 安全閘門 | Wave 1-2 | Story 22-4（3-5 天）|
| SDLC-10 | 安全測試框架（Jest/Vitest）| Wave 2 | Story 22-5（5-7 天）|

---

## Business Value

| 價值項目 | 說明 |
|----------|------|
| **Production Blocker 移除** | Phase 2 盤點列出的 5 項致命 production blocker 中，本 Epic 解決其中 4 項（檔案上傳、帳號鎖定、Prompt Injection、CI/CD）|
| **企業就緒度提升** | 完成後 HIGH 未達 L2 從 22 項降至 ≤ 6 項，成熟度從 L1.0 提升至 L2.0+ |
| **合規基礎** | 滿足 ISO 27001 / NIST CSF / OWASP Top 10 多項要求（A01/A03/A05/A07/A08/A10）|
| **暴力破解防護** | 帳號鎖定機制配合 Wave 1 的 Rate Limiting 推廣，封堵密碼登入端點的暴力破解風險 |
| **核心業務保護** | 檔案上傳安全直接保護 Freight Invoice PDF 上傳這個年處理量 450,000-500,000 張的核心入口 |
| **AI 業務防護** | Prompt Injection 防護保護年處理 450K+ 張發票中每張都會送進 GPT 的處理鏈 |
| **回歸保護** | 單元測試框架建立後可保護未來改動不破壞既有安全邏輯 |

---

## Design Decisions

| 決策項目 | 決定 | 理由 |
|----------|------|------|
| **Story 22-1 範圍** | IAM-07a/b/c 三項齊發 | 矩陣 v1.2 警告：07a 不得單獨實作，否則整體評為 L0（半成品反模式）|
| **Story 22-2 兼容性策略** | Dual-mode 漸進啟用（observe 1-2 週後 enforce）| 矩陣 v1.2 §3.3 明列 5 項必測，避免影響核心業務 |
| **Story 22-2 病毒掃描方案** | ClamAV self-hosted（首選）+ Azure Defender for Storage（備選）| 取決於 Azure Container Apps 部署架構，需用戶決策 |
| **Story 22-3 LLM 防護方式** | OpenAI Structured Outputs + Prompt Variable Escape | 既有 GPT-5.2 SDK 原生支援，最低侵入性 |
| **Story 22-4 CI/CD 平台** | GitHub Actions（與 Wave 1 quick win 一致）| 符合既有 `.github/agents/` 已存在的目錄結構 |
| **Story 22-5 測試框架** | Vitest（首選）+ Jest（兼容備選）| Vitest 與 Vite/Next.js 整合更佳，但專案規範文件提及 Jest，需用戶決策 |
| **修復順序** | 22-4 → 22-5 → 22-3 → 22-1 → 22-2 | CI 守門 + 測試框架先行，提供後續改動的回歸保護 |
| **不在範圍內** | API Auth 覆蓋率提升至 95%（IAM-01）、Session Revocation（IAM-04）、Rate Limit 廣泛推廣（AppSec-09）| 留給 CHANGE-057~070 系列獨立處理；本 Epic 聚焦 5 個 cohesive 主題 |

---

## Stories

| Story | 名稱 | 範圍 | 點數 | 依賴 | 對應風險 | Wave |
|-------|------|------|------|------|----------|------|
| 22-1 | 帳號鎖定機制完整實作 | DB Schema + 失敗計數 + 自動衰減 + admin 解鎖 UI + 用戶自助 + 審計 | 8 | - | IAM-07a/b/c | Wave 2 |
| 22-2 | 檔案上傳安全 | Magic number + 隔離區 + 病毒掃描 + UUID 重命名 + 兼容性測試 | 13 | 22-5 | AppSec-05 | Wave 3 |
| 22-3 | LLM Prompt Injection 防護 | Variable escape + Structured Outputs + Pattern monitoring | 5 | 22-5 | AppSec-12 | Wave 2 |
| 22-4 | CI/CD Pipeline 安全閘門 | Dependabot + Gitleaks + npm audit + Trivy + branch protection | 5 | - | SDLC-01/04/06/08 | Wave 1-2 |
| 22-5 | 安全測試框架 | Vitest 安裝 + auth/permission/Zod 安全測試 + CI 整合 | 8 | 22-4 | SDLC-10 | Wave 2 |

**總計**: 39 點，估計 3-4 週（含 review 與整合測試時間）

---

## Stories 索引

- [Story 22-1: 帳號鎖定機制完整實作](./22-1-account-lockout-complete.md)
- [Story 22-2: 檔案上傳安全](./22-2-file-upload-security.md)
- [Story 22-3: LLM Prompt Injection 防護](./22-3-llm-prompt-injection-defense.md)（待建立）
- [Story 22-4: CI/CD Pipeline 安全閘門](./22-4-cicd-security-pipeline.md)（待建立）
- [Story 22-5: 安全測試框架](./22-5-security-testing-framework.md)（待建立）

對應 Tech Specs：
- [Tech Spec — Story 22-1](../../tech-specs/epic-22-enterprise-security/tech-spec-story-22-1.md)
- [Tech Spec — Story 22-2](../../tech-specs/epic-22-enterprise-security/tech-spec-story-22-2.md)

---

## 與其他 Phase 3 規劃文件的關係

Phase 3 修復路線圖預計建立 CHANGE-057 ~ CHANGE-070、FIX-055 / FIX-056 等多份規劃文件。Epic 22 與這些文件分工如下：

```
┌──────────────────────────────────────────────────────────────┐
│                    Phase 3 修復路線圖                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  本 Epic（5 個 cohesive Stories，需要架構級實作）             │
│  ├── Story 22-1: 帳號鎖定（DB schema + 多 endpoint + UI）     │
│  ├── Story 22-2: 檔案上傳（基礎建設 + 業務變更 + E2E）        │
│  ├── Story 22-3: Prompt Injection（多服務交叉修改）           │
│  ├── Story 22-4: CI/CD Pipeline（GitHub config + workflows） │
│  └── Story 22-5: 測試框架（基礎建設 + 多模組測試）             │
│                                                              │
│  CHANGE-XXX（單一範圍變更，1-3 天可獨立完成）                  │
│  ├── CHANGE-057: API Auth Middleware HOF（IAM-03）           │
│  ├── CHANGE-058: API Auth 覆蓋率補足 130 routes（IAM-01）    │
│  ├── CHANGE-059: Rate Limit 推廣至認證端點（AppSec-09）      │
│  ├── CHANGE-060: HTTP Security Headers（DP-02 + AppSec-08）  │
│  ├── CHANGE-061: Session Revocation（IAM-04）                │
│  ├── CHANGE-062: Audit Log Middleware 全面採用（Obs-01）     │
│  ├── CHANGE-063: SSRF 白名單（AppSec-10）                    │
│  ├── CHANGE-064: RFC 7807 Helper 統一（AppSec-11）           │
│  ├── CHANGE-065: JSON.parse safeJsonParse Helper（AppSec-06）│
│  ├── CHANGE-066: 5 條安全告警（Obs-05-lite）                 │
│  ├── CHANGE-067: Risk Register（Gov-12）                     │
│  ├── CHANGE-068: Technical Debt 文檔（Gov-04）               │
│  ├── CHANGE-069: PII Inventory 文檔（DP-01-lite）            │
│  └── CHANGE-070: Admin Step-up Auth（IAM-08）                │
│                                                              │
│  FIX-XXX（既有 bug 修復）                                     │
│  ├── FIX-055: alert.service.ts:593 PII 殘留（DP-05-lite）    │
│  └── FIX-056: X-Dev-Bypass-Auth 加固（IAM-06b）              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**分工原則**：
- **Epic 22**：需要跨多個 service / API / UI / DB schema 同步變更的「架構級」工作
- **CHANGE-XXX**：單一範圍可在 1-3 天內獨立完成的「點狀」變更
- **FIX-XXX**：既有代碼明確的 bug 修復

**執行順序建議**：
1. **Wave 1**（本週）：先做 Quick Wins — FIX-055, FIX-056, CHANGE-060, CHANGE-067, CHANGE-068
2. **Wave 1-2 過渡**：Story 22-4（CI/CD）+ Story 22-5（測試框架）— 為後續所有改動建立守門
3. **Wave 2**（本月）：Story 22-1（帳號鎖定）+ Story 22-3（Prompt Injection）+ CHANGE-057~062
4. **Wave 3**（本季）：Story 22-2（檔案上傳）+ CHANGE-063~066, CHANGE-070

---

## File Structure

```
docs/04-implementation/
├── stories/epic-22-enterprise-security/
│   ├── epic-22-overview.md                       # 本文
│   ├── 22-1-account-lockout-complete.md          # ✅ 本次建立
│   ├── 22-2-file-upload-security.md              # ✅ 本次建立
│   ├── 22-3-llm-prompt-injection-defense.md      # 待建立
│   ├── 22-4-cicd-security-pipeline.md            # 待建立
│   └── 22-5-security-testing-framework.md        # 待建立
└── tech-specs/epic-22-enterprise-security/
    ├── tech-spec-story-22-1.md                   # ✅ 本次建立
    ├── tech-spec-story-22-2.md                   # ✅ 本次建立
    ├── tech-spec-story-22-3.md                   # 待建立
    ├── tech-spec-story-22-4.md                   # 待建立
    └── tech-spec-story-22-5.md                   # 待建立
```

---

## Acceptance Criteria Summary

### Epic 驗證

- [ ] **Story 22-1**：帳號鎖定機制三項（07a/07b/07c）齊發，無半成品反模式
- [ ] **Story 22-2**：檔案上傳安全 5 項必測項目全部通過
- [ ] **Story 22-3**：LLM Prompt Injection 防護層上線，業務功能無回歸
- [ ] **Story 22-4**：CI/CD Pipeline 4 道閘門全部 enforced，HIGH/CRITICAL 漏洞 PR 自動阻擋
- [ ] **Story 22-5**：Vitest 測試框架建立，安全核心邏輯（auth/permission/Zod）覆蓋率 ≥ 80%
- [ ] **整體**：HIGH 風險未達 L2 的項目從 22 降至 ≤ 6（降幅 ≥ 70%）
- [ ] **整體**：所有 Stories 通過 `npm run type-check`、`npm run lint`、`npm run test`、`npm run i18n:check`

---

## Dependencies

- **Epic 1**：用戶認證（Story 22-1 修改 NextAuth 流程）
- **Epic 2**：發票上傳（Story 22-2 修改 `/api/documents/upload`）
- **Epic 12**：系統管理（Story 22-1 admin 解鎖 UI 加在 admin/users 頁）
- **Epic 14**：Prompt 配置（Story 22-3 修改 prompt 組裝邏輯）
- **Epic 15**：統一處理器（Story 22-2 修改 file-type-detection.step.ts）
- **Epic 17**：i18n 支援（Story 22-1 + 22-2 新增 auth/upload 相關翻譯）
- **CHANGE-055**：Azure 部署計畫（Story 22-2 病毒掃描方案需與 Azure 環境對齊）

---

## Risks & Mitigations

| 風險 | 影響 | 緩解措施 |
|------|------|----------|
| **檔案上傳兼容性回歸** | 🔴 HIGH — 影響核心業務 | Story 22-2 採 dual-mode 漸進啟用；建立 5,000+ 既有 PDF 的 magic number whitelist；提供 admin manual override fallback |
| **帳號鎖定鎖定合法用戶** | 🟡 MED — 影響日常使用 | Story 22-1 自動 30 分鐘衰減 + admin 即時解鎖 UI + 用戶自助 email 解鎖三管齊下，確保不需打給 IT |
| **Prompt Injection 防護過嚴** | 🟡 MED — 影響少數邊界 case | Story 22-3 先 report-only 1 週監控 false positive，再 enforce |
| **CI/CD 阻擋緊急修復** | 🟡 MED — 影響 hotfix | Story 22-4 提供 emergency bypass label + audit log 機制 |
| **病毒掃描延遲影響 UX** | 🟡 MED — UX | Story 22-2 設計 ≤ 3 秒 SLA；超時降級為「異步掃描 + 待審核狀態」 |
| **單元測試學習曲線** | 🟢 LOW — 開發效率 | Story 22-5 提供 5+ 範例 + 測試 helper 庫 |

---

## Out of Scope

本 Epic **明確不包含**以下項目（由 CHANGE-XXX / FIX-XXX 系列獨立處理）：

- ❌ API Auth 覆蓋率從 60.7% 提升至 95%（CHANGE-058）
- ❌ Rate Limit 大規模推廣到 324 個未保護路由（CHANGE-059）
- ❌ Session Revocation / Refresh Token（CHANGE-061）
- ❌ Azure Key Vault 整合（與 CHANGE-055 Azure 部署同步）
- ❌ HTTP Security Headers（CHANGE-060 — 30 分鐘 quick win）
- ❌ 既有 alert.service.ts:593 PII 殘留（FIX-055）
- ❌ X-Dev-Bypass-Auth 加固（FIX-056）

---

## 版本資訊

- **建立日期**: 2026-04-28
- **版本**: 1.0.0
- **建立來源**: Phase 2 盤點 → Phase 3 修復路線圖
- **依據文件**:
  - `docs/08-security-and-governance/current-state-assessment.md`
  - `docs/08-security-and-governance/phase2-iam-dp-assessment.md`
  - `docs/08-security-and-governance/phase2-appsec-obs-assessment.md`
  - `docs/08-security-and-governance/enterprise-security-governance-matrix.md` v1.2
