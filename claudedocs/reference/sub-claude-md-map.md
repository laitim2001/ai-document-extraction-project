# Sub-CLAUDE.md 完整地圖

> **本文件為 CLAUDE.md §Sub-CLAUDE.md 自動載入機制 的完整展開**。CLAUDE.md 只提機制，本文件含完整 15 個 sub-CLAUDE.md 索引 + 過時統計。
> **最後更新**：2026-05-26

---

## 機制說明

Claude Code 會**自動遞迴載入**當前工作目錄及父目錄的 CLAUDE.md 內容。修改子目錄檔案時，相對應的 sub-CLAUDE.md 會**自動注入 context**，**無需手動讀取**。

**總數**：15 個 sub-CLAUDE.md（不含根目錄 CLAUDE.md）

---

## 依目錄分層索引

| 目錄 | 路徑 | 用途 | 何時自動載入 |
|------|------|------|------------|
| 🎯 **根** | `CLAUDE.md` | 專案總指南 | 所有 session |
| 🛠️ Claude 設定 | `.claude/CLAUDE.md` | 服務啟動流程、問題排解 | 修改 `.claude/**` |
| 📚 AI 助手文檔 | `claudedocs/CLAUDE.md` | ClaudeDocs 完整索引（7 層分類） | 修改 `claudedocs/**` |
| 🌐 i18n 翻譯 | `messages/CLAUDE.md` | 34 個命名空間清單、同步規則 | 修改翻譯文件 |
| 🗃️ 資料庫 | `prisma/CLAUDE.md` | 122 Models / 113 Enums / Migration 流程 | 修改 Schema / Migration |
| 📜 工具腳本 | `scripts/CLAUDE.md` | 104 個腳本分類（測試/調試/資料檢查） | 修改 scripts/ |
| 📄 Next.js 頁面 | `src/app/[locale]/CLAUDE.md` | 76 個 page.tsx，2 個路由組 | 修改頁面 |
| 🔌 API Routes | `src/app/api/CLAUDE.md` | 331 routes / 414 HTTP methods | 修改 API |
| 🎨 組件庫 | `src/components/CLAUDE.md` | 371 組件，37 個 feature 子目錄 | 修改組件 |
| 🪝 React Hooks | `src/hooks/CLAUDE.md` | 104 Hooks，命名風格混用 | 修改 Hooks |
| 🌍 i18n 配置 | `src/i18n/CLAUDE.md` | next-intl 設定、34 命名空間註冊 | 修改 i18n 配置 |
| 🧰 工具庫 | `src/lib/CLAUDE.md` | 65 個工具文件，12 子目錄 | 修改 lib/ |
| ⚙️ 業務服務 | `src/services/CLAUDE.md` | 200 服務，22 個分類 | 修改服務 |
| 🔄 V3 提取管線 | `src/services/extraction-v3/CLAUDE.md` | 三階段管線（V3 vs V3.1） | 修改 extraction-v3/ |
| 📦 類型定義 | `src/types/CLAUDE.md` | 93 types，index.ts 616 行 | 修改 types/ |

---

## 使用規則

### 新增目錄時

- 若新目錄 ≥ 10 個文件**或**具有獨立架構，**考慮**新增 sub-CLAUDE.md
- 若 < 10 文件且無獨立架構，**不要**新增 sub-CLAUDE.md（避免碎片化）

### 更新規則

- sub-CLAUDE.md **必須**標註「最後更新」日期與版本
- **必須**引用對應的 `docs/06-codebase-analyze/` 分析文件作為數據來源
- 統計數字（檔案數、命名空間數等）變動 5% 以上時更新

### 避免重複

- **根 CLAUDE.md**：放「跨目錄共通規則」（行為規則、Hard Constraints、Karpathy）
- **sub-CLAUDE.md**：放「該目錄特定規則」（命名慣例、檔案組織、特殊 pattern）
- **禁止**兩處重複同樣規則 — 一處改另一處忘改 = drift

---

## 已知過時檢查（需下次批次更新）

以下 sub-CLAUDE.md 的統計與 `docs/06-codebase-analyze/` 仍有小幅差異（2026-04-09 掃瞄結果）：

| 文件 | 聲稱 | 實際 | 差異 |
|------|------|------|------|
| `src/hooks/CLAUDE.md` | 101 Hook | 104 | +3 |
| `src/types/CLAUDE.md` | 83 類型文件 | 93 | +10 |
| `src/lib/CLAUDE.md` | 65 文件 | 68 | +3 |
| `src/app/[locale]/CLAUDE.md` | 76 page.tsx | 82 | +6 |
| `src/i18n/CLAUDE.md` | 31 命名空間 | 34 | +3 |
| `src/services/extraction-v3/CLAUDE.md` | 19 文件 | 17 | -2 |
| `scripts/CLAUDE.md` | 104 腳本 | （待驗證） | — |

**處理優先級**：
- 🟢 **低**：差異 < 5% 且不影響規則 — 季度更新即可
- 🟡 **中**：差異 5-15% — 建議下次 codebase analyze 時同步
- 🔴 **高**：差異 > 15% 或影響規則理解 — 立即更新

當前所有差異都屬 🟢 低優先級。

---

## 自動同步機制

| 層級 | 工具 | 觸發時機 | 效果 |
|------|------|---------|------|
| **輕量檢查** | `scripts/verify-claude-md-sync.sh` | 每次 session 結束（Stop hook） | 檢查主 CLAUDE.md 統計數字是否與 codebase 漂移 > 5% |
| **深度同步** | `/refresh-codebase-analysis` skill | 季度結束 / Epic 完成 / 手動 | 重掃 codebase → 產生 `verification/R-refresh-YYYY-MM-DD.md` 差異報告 → 詢問是否更新 |
| **完整重做** | `docs/06-codebase-analyze/codebase-analyze-playbook.md` | 重大重構後 | 重跑整套 R1-R15 驗證流程 |

---

## 變更歷史

- **2026-05-26**：初版（從 CLAUDE.md v3.4.1 §Sub-CLAUDE.md 地圖 完整遷移）

---

*本文件由 CLAUDE.md v4.0.0 升級時建立，請隨 sub-CLAUDE.md 變更同步更新*
