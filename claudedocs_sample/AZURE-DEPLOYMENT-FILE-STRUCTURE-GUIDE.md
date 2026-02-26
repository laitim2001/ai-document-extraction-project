# Azure 部署文件結構指引

> **目的**: 解決 Azure 部署相關文件分散在多個目錄的混亂問題
> **創建日期**: 2025-11-23
> **狀態**: ✅ 正式指引

---

## 🎯 問題背景

目前項目中有 4 個不同位置包含 Azure 部署相關文件，導致以下問題：
1. 不清楚應該查閱哪個目錄
2. 不確定哪些文件是最新的
3. 文件之間的關係和依賴不明確

## 📁 各目錄角色說明

### 1. `azure/` - **執行層（Production）** ⭐⭐⭐⭐⭐

**角色**: 實際執行部署的腳本、配置和工具

**重要性**: ⭐⭐⭐⭐⭐ **最重要，部署時必須查閱**

**包含內容**:
```
azure/
├── README.md                    # 主要入口文檔
├── environments/                # 環境配置
│   ├── personal/               # 個人 Azure 訂閱配置
│   └── company/                # 公司 Azure 訂閱配置
├── scripts/                     # 部署腳本
│   ├── deploy-to-personal.sh   # 個人環境部署入口
│   ├── deploy-to-company.sh    # 公司環境部署入口
│   ├── 01-06.sh                # 資源設置腳本
│   └── helper/                 # 工具腳本
├── templates/                   # Infrastructure as Code
└── tests/                       # 部署測試腳本
```

**使用時機**:
- ✅ 執行實際部署時
- ✅ 配置環境變數時
- ✅ 運行部署腳本時
- ✅ 故障排查時運行測試

**特點**:
- 包含可執行的腳本
- 包含環境配置範例
- 包含 Bicep/ARM 模板
- **這是唯一需要直接執行的目錄**

**關鍵文件**:
- `docker/startup.sh` - 容器啟動腳本（自動執行 Migration + Seed）

---

### 2. `docs/deployment/` - **文檔層（Documentation）** ⭐⭐⭐⭐

**角色**: 正式的部署指南和操作手冊

**重要性**: ⭐⭐⭐⭐ **重要，了解流程時必須閱讀**

**包含內容**:
```
docs/deployment/
├── AZURE-DEPLOYMENT-GUIDE.md     # 完整部署指南
├── 00-prerequisites.md           # 前置需求
├── 01-first-time-setup.md        # 首次部署指南
├── 02-ci-cd-setup.md            # CI/CD 配置
├── 03-troubleshooting.md        # 故障排查
├── 04-rollback.md               # 回滾程序
├── environment-variables-map.md  # 環境變數對照表
└── key-vault-secrets-list.md    # Key Vault 密鑰清單
```

**使用時機**:
- ✅ 首次部署前閱讀完整流程
- ✅ 了解 CI/CD 配置方式
- ✅ 遇到問題時查閱故障排查指南
- ✅ 需要回滾時查閱回滾程序

**特點**:
- 結構化的操作手冊
- 包含最佳實踐說明
- 包含故障排查步驟
- 面向人類開發者閱讀

---

### 3. `claudedocs/` 下的 Azure 部署文件 - **記錄層（History）** ⭐⭐⭐

**角色**: 部署歷史記錄、問題分析、AI 生成的文檔

**重要性**: ⭐⭐⭐ **參考價值，了解歷史和問題分析**

**包含內容**:
```
claudedocs/
├── AZURE-DEPLOYMENT-CHECKLIST.md                 # 部署檢查清單
├── AZURE-LOGIN-I18N-FIX-DEPLOYMENT.md           # v7 I18N 修復記錄
├── AZURE-NEXTAUTH-CONFIGURATION-ERROR-ROOT-CAUSE.md  # 根本原因分析
├── AZURE-PRISMA-FIX-DEPLOYMENT-SUCCESS.md       # v8 Prisma 修復記錄
└── AZURE-SEED-DATA-IMPLEMENTATION-SUMMARY.md    # 種子數據實施總結
```

**使用時機**:
- ✅ 了解過去的部署問題和解決方案
- ✅ 查看根本原因分析
- ✅ 參考類似問題的解決歷史
- ❌ 不適合作為執行部署的主要參考

**特點**:
- AI 生成的分析文檔
- 記錄歷史部署問題
- 包含詳細的問題診斷過程
- 主要用於回顧和學習

---

### 4. `claudedocs/1-planning/features/AZURE-DEPLOY-PREP/` - **規劃層（Planning）** ⭐⭐

**角色**: 早期規劃文檔和準備工作

**重要性**: ⭐⭐ **歷史參考，已被執行層取代**

**使用時機**:
- ✅ 了解最初的部署規劃思路
- ✅ 查看早期的架構設計決策
- ❌ 不適合用於實際部署執行

**特點**:
- 早期規劃階段的文檔
- 可能包含已過時的信息
- 主要價值在於了解設計思路

---

## 🎯 部署時應該查閱的優先級

### 執行部署時的查閱順序

```yaml
部署流程參考順序:
  第1步 - 了解流程:
    主要: docs/deployment/AZURE-DEPLOYMENT-GUIDE.md
    輔助: docs/deployment/01-first-time-setup.md

  第2步 - 準備環境:
    主要: azure/README.md
    輔助: azure/environments/personal/README.md 或 company/README.md

  第3步 - 執行部署:
    主要: azure/scripts/deploy-to-personal.sh 或 deploy-to-company.sh
    輔助: azure/scripts/01-06.sh

  第4步 - 遇到問題:
    主要: docs/deployment/03-troubleshooting.md
    輔助: claudedocs/AZURE-*.md（查看歷史問題）

  第5步 - 驗證部署:
    主要: azure/tests/smoke-test.sh
    輔助: azure/scripts/helper/verify-deployment.sh
```

---

## 📊 快速決策表

| 您的需求 | 應該查閱的目錄 | 原因 |
|----------|---------------|------|
| **執行實際部署** | `azure/` | 包含可執行腳本和配置 |
| **了解部署流程** | `docs/deployment/` | 結構化的操作手冊 |
| **配置環境變數** | `azure/environments/` | 環境配置範例 |
| **運行部署腳本** | `azure/scripts/` | 部署自動化腳本 |
| **查看歷史問題** | `claudedocs/AZURE-*.md` | 問題分析和解決記錄 |
| **故障排查** | `docs/deployment/03-troubleshooting.md` | 故障排查指南 |
| **回滾部署** | `docs/deployment/04-rollback.md` | 回滾程序 |
| **CI/CD 配置** | `docs/deployment/02-ci-cd-setup.md` | CI/CD 設置指南 |

---

## 🔄 目錄之間的關係

```
┌─────────────────────────────────────────────────────────┐
│  docs/deployment/ (文檔層)                              │
│  - 提供完整的操作指南和最佳實踐                         │
│  - 面向開發者閱讀                                       │
└────────────────┬────────────────────────────────────────┘
                 │ 指導
                 ▼
┌─────────────────────────────────────────────────────────┐
│  azure/ (執行層)                                         │
│  - 實際執行部署的腳本和配置                             │
│  - 根據文檔指南實現自動化                               │
└────────────────┬────────────────────────────────────────┘
                 │ 記錄
                 ▼
┌─────────────────────────────────────────────────────────┐
│  claudedocs/ (記錄層)                                    │
│  - 記錄部署歷史和問題分析                               │
│  - 提供問題解決的參考案例                               │
└─────────────────────────────────────────────────────────┘
                 ▲
                 │ 回顧
┌─────────────────────────────────────────────────────────┐
│  claudedocs/1-planning/features/AZURE-DEPLOY-PREP/      │
│  - 早期規劃文檔（歷史參考）                             │
└─────────────────────────────────────────────────────────┘
```

---

## 🎓 實際使用案例

### 案例 1: 首次部署到個人 Azure

**步驟**:
1. **閱讀文檔層**: `docs/deployment/01-first-time-setup.md`
   - 了解完整流程
2. **查看執行層**: `azure/README.md`
   - 了解目錄結構
3. **配置環境**: `azure/environments/personal/dev.env.example`
   - 創建實際配置文件
4. **執行部署**: `bash azure/scripts/deploy-to-personal.sh dev`
   - 運行自動化腳本

### 案例 2: 遇到 Prisma Client 錯誤

**步驟**:
1. **查看記錄層**: `claudedocs/AZURE-PRISMA-FIX-DEPLOYMENT-SUCCESS.md`
   - 了解類似問題的歷史解決方案
2. **查閱文檔層**: `docs/deployment/03-troubleshooting.md`
   - 查找故障排查步驟
3. **執行層驗證**: `bash azure/tests/test-azure-connectivity.sh`
   - 運行診斷腳本

### 案例 3: 配置公司環境

**步驟**:
1. **查看執行層**: `azure/environments/company/README.md`
   - 了解需要配置的內容
2. **參考文檔層**: `docs/deployment/key-vault-secrets-list.md`
   - 了解需要設置的密鑰
3. **執行部署**: `bash azure/scripts/deploy-to-company.sh dev`
   - 運行公司環境部署（含安全確認）

---

## ⚠️ 常見錯誤

### ❌ 錯誤做法

1. **只看規劃層**: 直接查閱 `claudedocs/1-planning/` 執行部署
   - 問題: 可能包含過時信息

2. **忽略文檔層**: 直接運行 `azure/scripts/` 腳本
   - 問題: 不了解完整流程和注意事項

3. **混淆記錄層和文檔層**: 將問題分析文檔當作操作手冊
   - 問題: 記錄層主要用於回顧，不適合作為操作指南

### ✅ 正確做法

1. **先讀文檔，後執行**: `docs/deployment/` → `azure/`
2. **遇到問題看記錄**: `claudedocs/AZURE-*.md` 查看歷史案例
3. **執行時以執行層為準**: `azure/` 是唯一的執行真相來源

---

## 📝 維護建議

### 文檔同步策略

1. **執行層變更時**:
   - ✅ 更新 `azure/README.md`
   - ✅ 更新相關的 `docs/deployment/` 文檔
   - ✅ 記錄變更到 `claudedocs/`

2. **遇到新問題時**:
   - ✅ 在 `claudedocs/` 創建問題分析文檔
   - ✅ 更新 `docs/deployment/03-troubleshooting.md`
   - ✅ 必要時更新 `azure/` 腳本

3. **定期審查**:
   - 每月檢查 `claudedocs/1-planning/` 是否有過時內容可以歸檔
   - 每季度確保 `docs/deployment/` 與 `azure/` 同步

---

## 🎯 總結

### 快速記憶口訣

```
執行用 azure/       (腳本和配置)
學習用 docs/        (操作手冊)
回顧用 claudedocs/  (歷史記錄)
規劃已過時         (早期規劃)
```

### 部署時的黃金法則

> **部署前看 docs/，部署時用 azure/，問題後查 claudedocs/**

---

**最後更新**: 2025-11-26
**維護者**: 開發團隊
**版本**: 1.1.0

---

## 📝 更新記錄

### v1.1.0 (2025-11-26)
- 新增 `docker/startup.sh` 說明（自動執行 Migration + Seed）
- 更新關鍵文件列表

### v1.0.0 (2025-11-23)
- 初始版本
