# CHANGE-055: Azure Production Deployment Foundation

## 變更摘要

| 項目 | 內容 |
|------|------|
| **變更編號** | CHANGE-055 |
| **建立日期** | 2026-04-22 |
| **相關模組** | Deployment / DevOps / Infrastructure |
| **影響範圍** | Azure 資源、容器化、CI/CD、Schema migration、Seed 策略、Key Vault、Observability、Security |
| **優先級** | High（生產部署阻塞） |
| **狀態** | 📋 規劃中（規劃文件已建立；實施待架構評審） |
| **類型** | Infrastructure / Major Initiative |
| **依賴** | CHANGE-054（本地部署可靠性已完成）、FIX-054（SYSTEM_USER_ID 可覆蓋機制已完成） |
| **主規劃文件** | `docs/06-deployment/02-azure-deployment/azure-deployment-plan.md` |

---

## 問題描述

### 背景
FIX-054 + CHANGE-054（2026-04-22）完成了本地開發環境的部署可靠性，但專案至今**完全沒有 Azure 生產部署規劃**。

### 盤點發現（2026-04-22 session）
| 類別 | 狀態 |
|------|------|
| `Dockerfile`（production image） | ❌ 不存在 |
| `.github/workflows/`（CI/CD） | ❌ 不存在 |
| `azure-pipelines.yml`（Azure DevOps） | ❌ 不存在 |
| `.bicep` / Terraform（IaC） | ❌ 不存在 |
| App Service / Container Apps 配置 | ❌ 不存在 |
| Azure 部署 guide | ❌ 只有本地 guide |
| `package.json` 的 `deploy` / `build:prod` script | ❌ 不存在 |

### 既有 Azure **整合代碼**（非部署資產）
- `src/services/azure-di.service.ts`（Document Intelligence）
- `src/lib/azure-blob.ts`（Blob Storage）
- `@azure/identity`、`@azure/storage-blob`、`@azure/ai-form-recognizer`、`@microsoft/microsoft-graph-client` 套件

### 部分 Azure-ready 的既有成果
| 項目 | 可重用？ |
|------|---------|
| FIX-054 `SYSTEM_USER_ID` env 可覆蓋 | ✅ Azure 直接設環境變數即可 |
| `.env.example` 必要 env 分級 | ✅ 可映射到 App Service Settings / Key Vault |
| `verify-environment.ts` 自檢 | 🟡 部分可用（env/DB 檢查 OK；Docker 檢查在 Azure 無意義） |
| `init-new-environment.*` 一鍵腳本 | ❌ 完全本地化（假設 docker-compose、pg_isready） |
| `project-initialization-guide.md` | ❌ 只提本地環境 |

---

## 🔴 Critical 風險

### 風險 1：Schema Migration 策略缺失
- 本地使用 `prisma db push --accept-data-loss` 同步 schema
- 在 production 是 **極度危險**（可能清空欄位資料）
- Prisma Schema 有 122 models，但 migrations 只有 10 個（歷史落差）
- **必須先設計正式的 `prisma migrate` 流程**或風險評估，才能部署到 prod

### 風險 2：Seed 策略未定
- 目前 seed 會建立 `dev-user-1`（Development User） — **不應在 prod 存在**
- `exported-data.json`（169 KB，已入 git）包含測試用資料 — **是否要進 prod？**
- 需區分「系統必要 seed」（roles / regions / system-user）vs「測試資料」

### 風險 3：Secret Management
- `ENCRYPTION_KEY` 一旦設定不可變更，prod 必須有明確的 Key Vault 策略
- `AUTH_SECRET` / `JWT_SECRET` / `SESSION_SECRET` 需要輪替計劃
- Azure Managed Identity vs Connection String 決策

### 風險 4：架構選型未決
- App Service vs Container Apps vs AKS 對本專案的適配度
- PostgreSQL Flexible Server vs Hyperscale Citus（若未來資料量大）
- Key Vault 整合方式（直接引用 vs Managed Identity + SDK）

---

## 變更方案（高層分階段）

### Phase 1: 規劃與架構決策（本 CHANGE-055 範圍）
**目標**：產出完整規劃文件，獲得架構共識，無實際部署

| 子項 | 產出 |
|------|------|
| 1.1 | `azure-deployment-plan.md`（主規劃，9 大類決策） |
| 1.2 | 資源選型決策記錄（App Service vs Container Apps，IaC 工具等） |
| 1.3 | Schema migration 策略設計（兩種方案 trade-off） |
| 1.4 | Seed 策略設計（production-seed.ts 規格） |
| 1.5 | Key Vault 整合架構圖 |
| 1.6 | CI/CD pipeline 架構圖 |
| 1.7 | Effort / 時程估算 |
| 1.8 | 與 DevOps / 安全團隊架構評審 |

### Phase 2: 基礎建設（後續 CHANGE-056+）
**目標**：建立可手動部署到 Azure 的最小可行環境

| 子項 | 追蹤編號 |
|------|---------|
| 2.1 Dockerfile + multi-stage build | 待定 CHANGE |
| 2.2 Azure 資源建立（Bicep 或手動） | 待定 CHANGE |
| 2.3 Key Vault 整合代碼 | 待定 CHANGE |
| 2.4 `verify-environment.ts --production` 模式 | 待定 CHANGE |
| 2.5 `production-seed.ts` 腳本 | 待定 CHANGE |
| 2.6 Schema migration 正式化 | 待定 CHANGE |

### Phase 3: CI/CD 自動化（後續 CHANGE）
| 子項 | 追蹤編號 |
|------|---------|
| 3.1 GitHub Actions workflow（build → push ACR → deploy） | 待定 CHANGE |
| 3.2 PR preview environment（可選） | 待定 CHANGE |
| 3.3 Migration hook（deploy 前自動跑） | 待定 CHANGE |

### Phase 4: 運維與安全（後續 CHANGE）
| 子項 | 追蹤編號 |
|------|---------|
| 4.1 Application Insights 整合 | 待定 CHANGE |
| 4.2 Alert rules（Azure Monitor ↔ 既有 AlertRule 模型） | 待定 CHANGE |
| 4.3 VNet / Private Endpoint | 待定 CHANGE |
| 4.4 Secret rotation 策略 | 待定 CHANGE |

---

## 本 CHANGE-055 明確範圍

| 範圍 | 納入？ |
|------|--------|
| 建立主規劃文件 `azure-deployment-plan.md` | ✅ 納入 |
| 9 大類技術決策對比（Container Apps vs App Service 等） | ✅ 納入 |
| Schema migration 策略文件 | ✅ 納入（設計層次，不實施） |
| Seed 策略設計 | ✅ 納入（設計層次，不實施） |
| Effort 估算 | ✅ 納入 |
| 子文件結構規劃（infrastructure/, pipeline/ 等） | ✅ 納入（placeholder） |
| **實際建立 Dockerfile** | ❌ 不納入（Phase 2） |
| **實際寫 IaC 代碼** | ❌ 不納入（Phase 2） |
| **設置 Azure 資源** | ❌ 不納入 |
| **寫 CI/CD workflow** | ❌ 不納入（Phase 3） |
| **首次部署執行** | ❌ 不納入 |

---

## 產出文件

| 文件 | 類型 | 行數預估 |
|------|------|---------|
| `docs/06-deployment/02-azure-deployment/azure-deployment-plan.md` | 主規劃 | ~400 行 |
| `docs/06-deployment/02-azure-deployment/README.md` | 已存在，更新連結 | +10 行 |
| 本文件（CHANGE-055） | 追蹤 | ~200 行 |

---

## 預期效果

| 面向 | 本 CHANGE 完成後 |
|------|-----------------|
| Azure 部署可行性 | 有完整規劃可進入 Phase 2 實作 |
| 架構決策記錄 | 所有選型決策有書面依據（可追溯、可審查） |
| Schema migration 風險 | 有明確策略文件，不再是模糊風險 |
| Seed 策略 | 明確區分 prod vs dev seed |
| 團隊對齊 | DevOps / 安全 / 開發團隊有共同參考 |

---

## 驗證方式

- [ ] `azure-deployment-plan.md` 涵蓋 9 大類完整規劃
- [ ] 所有架構決策有選項對比（不是單一方案）
- [ ] Schema migration 策略有明確路徑（A / B 方案 + 選擇理由）
- [ ] Seed 策略區分 production-seed vs dev-seed
- [ ] Effort 估算到 Phase 層級（非精確到工時）
- [ ] 02-azure-deployment/README.md 連結到新計劃
- [ ] CHANGE-055 文件狀態更新為「✅ 規劃完成」（實施由後續 CHANGE 接手）

---

## 關聯文件

- **主規劃**：`docs/06-deployment/02-azure-deployment/azure-deployment-plan.md`
- **Azure 部署目錄 README**：`docs/06-deployment/02-azure-deployment/README.md`
- **本地部署對照**：`docs/06-deployment/01-local-deployment/`
- **依賴**：CHANGE-054（本地部署可靠性）、FIX-054（SYSTEM_USER_ID）
- **討論 session**：`claudedocs/8-conversation-log/daily/20260422.md` §Azure 部署議題

---

## 風險提示

- **架構評審時程不確定**：DevOps / 安全團隊的可用時間會影響 Phase 1 完成日
- **決策可能回溯**：PoC 實施時可能發現選型有問題，需調整規劃
- **Effort 估算有偏差**：IaC / CI/CD / Observability 都是大項，精確估算需架構確定後
- **既有代碼潛在改動**：某些 env 變數或服務（如 Rate limit 的 Upstash Redis）在 prod 才真正啟用，可能顯露 bug

---

*文件建立日期: 2026-04-22*
*最後更新: 2026-04-22（初稿，待架構評審）*
