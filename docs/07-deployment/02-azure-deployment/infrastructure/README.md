# Infrastructure as Code（Optional Track）

> **狀態**：📋 階段 D 規劃中（CHANGE-055 v0.3）
> **定位**：**Optional Track** — 與 Infra Team 配合使用，非強制
> **協作模式**：Mode C 混合（基礎架構由 Infra Team / 應用層 Bicep 由 App Team 提供）
> **建立日期**：2026-04-27

本目錄存放 AI Document Extraction 應用層 Azure 資源的 IaC 模板與規格清單。

---

## 🎯 1. 為何「Optional Track」

依 CHANGE-055 v0.3 §2.5 決策：採用 Bicep，但定位為**可選軌道**。

**核心理念**：Bicep 模板**同時是規格文件 + 可選資產**。

| Infra Team 偏好 | App Team 提供 | 結果 |
|----------------|-------------|------|
| 採用我們的 Bicep | `bicep/main.bicep` | 一鍵 `az deployment group create` 部署 |
| 用自己的 pipeline | `bicep/` + `resources-inventory.md` | 將 Bicep 作為 spec 參考，自行翻譯成 Terraform / ARM |
| 完全 portal 手動 | `manual-setup/resources-checklist.md` | 用 manual checklist 對應 Bicep 的每個 module |
| 已建好部分資源 | 部分 module | 只 deploy 未建的 module |

---

## 🤝 2. Mode C 邊界（與 Infra Team 職責切分）

> 詳見：`../uat-deployment/00-overview.md` §3 Mode C

| 範疇 | 由誰負責 | 本目錄涵蓋？ |
|------|---------|-------------|
| **基礎架構**（RG / VNet / Subnets / NSG / Private DNS） | Infra Team | ❌ 不涵蓋（前提假設） |
| **共享平台**（共享 Key Vault / Log Analytics workspace） | Infra Team | 🟡 提供 Bicep 範例（可選用） |
| **應用層資源**（ACR / CAE / Container App / PG / Storage / App Insights）| **App Team** | ✅ 完整 Bicep 模板 |
| **網路設計**（Hub-Spoke / Private Endpoint / WAF）| Infra Team | ❌ 不涵蓋 |
| **成本決策**（SKU / tier） | Infra Admin（討論定案）| ✅ 提供 inventory 作為討論輸入 |

---

## 📂 3. 目錄結構

```
infrastructure/
├── README.md                            ← 本文件
├── resources-inventory.md               ← ⭐ 規格清單（不論 IaC 與否都需要）
├── naming-conventions.md                ← 命名規範（rg- / acr / kv- / 等）
├── cost-estimate.md                     ← Azure Calculator 試算（待 Infra Admin 提供）
├── network-topology.md                  ← 由 Infra Admin 提供（網路架構）
│
├── bicep/                               ← Bicep 模板（Optional，Mode A）
│   ├── main.bicep                       ← 應用層資源 orchestration
│   ├── parameters/
│   │   ├── uat.parameters.json          ← UAT 環境參數
│   │   └── prod.parameters.json         ← Prod 環境參數
│   └── modules/
│       ├── acr.bicep                    ← Azure Container Registry
│       ├── container-apps-env.bicep     ← Container Apps Environment
│       ├── container-app.bicep          ← Container App
│       ├── postgres.bicep               ← PostgreSQL Flexible Server
│       ├── storage.bicep                ← Storage Account + Blob Container
│       └── app-insights.bicep           ← Application Insights
│
└── manual-setup/                        ← 等價手動 az CLI 流程（Mode B 後備）
    └── resources-checklist.md           ← Manual setup checklist
```

---

## 🔧 4. 三種使用模式

### Mode A：完全使用 Bicep（推薦）

適用：Infra Team 同意採用 Bicep。

```bash
# 1. Login Azure
az login --tenant ${TENANT_ID}
az account set --subscription ${SUBSCRIPTION_ID}

# 2. What-if（預覽變更，不實際部署）
az deployment group what-if \
  --resource-group ${RG_NAME} \
  --template-file bicep/main.bicep \
  --parameters @bicep/parameters/uat.parameters.json

# 3. Deploy（真正執行）
az deployment group create \
  --resource-group ${RG_NAME} \
  --template-file bicep/main.bicep \
  --parameters @bicep/parameters/uat.parameters.json \
  --name deploy-uat-$(date +%Y%m%d-%H%M%S)
```

**優點**：
- ✅ 一鍵部署 6 大資源
- ✅ Idempotent（重複執行只更新差異）
- ✅ Git 追蹤所有配置變更
- ✅ DR 重建快速

### Mode B：Manual Setup（用 Bicep 作為 spec 參考）

適用：Infra Team 用自己的 pipeline，但需要 App Team 規格輸入。

→ 參考 `manual-setup/resources-checklist.md` 逐項建立。

**優點**：
- ✅ 不引入新工具
- ✅ Infra Team 維持既有流程

**缺點**：
- ❌ 需手動同步配置變更
- ❌ DR 重建較慢

### Mode C：Hybrid（部分 Bicep + 部分 manual）

適用：Infra Team 已建好部分資源（如 ACR / Storage），App Team 只 deploy 剩餘部分。

```bash
# 跳過已建資源，只 deploy 特定 module
az deployment group create \
  --resource-group ${RG_NAME} \
  --template-file bicep/modules/container-app.bicep \
  --parameters caName=${CA_NAME} acrLoginServer=${ACR_LOGIN_SERVER} ...
```

---

## 🔐 5. 安全注意事項

| 注意 | 說明 |
|------|------|
| 🔴 **絕不 commit secret values** | `parameters/*.json` 只放非敏感參數（資源名稱 / SKU / location）；secret 透過 KV reference 注入 |
| 🔴 **`subscriptionId` / `tenantId` 不入 git** | 用 environment variables 注入：`--parameters subscriptionId=${SUBSCRIPTION_ID}` |
| 🟡 **What-if 必先做** | 任何 prod 部署前必須先跑 `what-if` review |
| 🟡 **Bicep 版本鎖定** | `bicep version` >= 0.24.x（避免新語法相容性問題） |

---

## 📋 6. 與 UAT 部署文件的關係

UAT 部署文件（`../uat-deployment/00-11.md`）採**雙路徑並存**：

| STEP | 文件 | 雙路徑提供 |
|------|------|-----------|
| STEP-02 | azure-resources-setup | ✅ 每個 Action 含「📝 Bicep 替代路徑」區塊 |
| STEP-03 | secrets-configuration | ⚠️ 不提供 Bicep（secrets 應永遠透過 az CLI 互動式注入）|
| STEP-08 | first-deployment | ✅ 含 Container App spec Bicep 範例 |

執行者可選擇**全 Bicep**、**全 az CLI**、或**混合**。

---

## 🚦 7. 適用時機（CHANGE-055 v0.3 路徑圖）

| 階段 | 對 Bicep 的依賴 | 行動 |
|------|----------------|------|
| **W1（Phase 1 收尾）** | 撰寫 Bicep 模板（本目錄） | 階段 D（本任務） |
| **W2 Review 1** | Infra Team 審查 Bicep | 取得採用決策（A / B / C） |
| **W3-W4（Phase 2 實施）** | 若 Mode A：執行 Bicep；若 B/C：手動 | STEP-02 第一次部署 |
| **W5+（Phase 3 CI/CD）** | GitHub Actions 集成 Bicep deploy | 自動化 |

---

## 📞 8. 後續步驟

階段 D 完成後：
1. ✅ 階段 D：建立 Bicep 模板（本目錄產出）
2. ⏳ Infra Admin Review：取得 Mode A/B/C 決策
3. ⏳ 階段 E：在 UAT 環境執行 Bicep（Mode A）或 manual setup（Mode B/C）
4. ⏳ 補充 `cost-estimate.md`（Infra Admin 提供 Azure Calculator 試算）
5. ⏳ 補充 `network-topology.md`（Infra Admin 提供網路架構圖）

---

## 🔗 相關文件

- **CHANGE-055 主規劃**：`../azure-deployment-plan.md`
- **UAT 部署 SOP**：`../uat-deployment/00-overview.md`
- **CHANGE-056（Schema baseline）**：`../../../../claudedocs/4-changes/feature-changes/CHANGE-056-prisma-migration-baseline.md`
- **本地部署對照**：`../../01-local-deployment/`

---

*文件版本: v1.0（階段 D）*
*最後更新: 2026-04-27*
*維護者: AI 助手 + 開發團隊*
