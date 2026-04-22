# 新開發者 Day-1 Checklist

> **建立日期**: 2026-04-22（CHANGE-054）
> **預期時長**: ~2-3 小時（首次含軟體下載與容器 image pull）
> **需要協助**: 取得 Azure / OpenAI 憑證（或暫用 dev mode）

本文件是新進開發者加入 AI Document Extraction 專案的 **Day-1 執行清單**。依順序完成即可從零到在本機跑起應用並理解架構全貌。

---

## 🎯 目標

完成此 checklist 後，你將擁有：
- ✅ 可運作的本地開發環境
- ✅ 成功登入應用並瀏覽主要頁面
- ✅ 理解核心架構（三層映射 / 信心度路由 / Epic 分工）
- ✅ 建立第一個功能分支並送出試驗性 PR

---

## 📦 階段 1：軟體安裝（~30 分鐘）

### 必要軟體

| 軟體 | 版本 | 檢查指令 | 下載 |
|------|------|---------|------|
| Node.js | 20.x+ | `node -v` | https://nodejs.org/ |
| npm | 10.x+ | `npm -v` | （隨 Node.js） |
| Docker Desktop | 4.x+ | `docker --version` | https://www.docker.com/products/docker-desktop |
| Git | 2.x+ | `git --version` | https://git-scm.com/ |

### 建議軟體

| 軟體 | 用途 |
|------|------|
| VS Code | 編輯器（項目已包含 `.vscode/` 推薦設定） |
| pgAdmin 4（可選） | 已內建於 docker-compose，訪問 http://localhost:5050 |
| Postman / Insomnia | API 測試 |

---

## 🔐 階段 2：取得存取權限（並行進行）

依需求申請以下憑證（若暫時不需，可先用 dev mode 繼續）：

| 憑證 | 用途 | 聯絡對象 |
|------|------|---------|
| **GitHub repo 權限** | clone 代碼 | 技術主管 |
| **Azure OpenAI API Key** | AI 提取、分類 | Azure 管理員 |
| **Azure Document Intelligence Key** | OCR | Azure 管理員 |
| **Azure AD App Registration**（可選） | 真實 SSO 登入 | Azure 管理員 |
| **Azure Blob Storage 帳號**（可選） | 生產級文件儲存 | Azure 管理員 |

> 💡 **沒有憑證也能跑起來**：dev mode 接受任何 email 登入，Azurite 模擬 Blob Storage。只有 AI / OCR 功能需要真實 Azure 憑證才能運作。

---

## 🚀 階段 3：環境設置（~30-60 分鐘）

### Step 1：Clone 代碼

```bash
git clone https://github.com/laitim2001/ai-document-extraction-project.git
cd ai-document-extraction-project
```

### Step 2：啟動 Docker Desktop

打開 Docker Desktop 應用，等待「Engine running」狀態。

### Step 3：一鍵初始化

```bash
# Unix / macOS / Git Bash
./scripts/init-new-environment.sh

# Windows PowerShell
.\scripts\init-new-environment.ps1

# 或透過 npm
npm run init-env
```

腳本會自動完成 10 步流程（檢查軟體 → 啟動 Docker → npm install → Prisma generate → db push → seed → 自檢）。

### Step 4：填入 `.env` 的真實憑證

編輯專案根目錄的 `.env`，將 placeholder 換成真實值：

| 變數 | 若無憑證的暫代 |
|------|---------------|
| `AZURE_OPENAI_API_KEY` | 留 placeholder（AI 功能不可用但可啟動） |
| `AZURE_DI_KEY` | 留 placeholder（OCR 不可用） |
| `AZURE_AD_*` | 留 placeholder（自動進入 dev mode） |

🔴 **必須改的**（若用 CHANGE-054 `init-env` 的話，腳本已從 `.env.example` 複製 placeholder，需換掉）：
- `AUTH_SECRET`：執行 `npx auth secret` 生成
- `JWT_SECRET` / `SESSION_SECRET` / `ENCRYPTION_KEY`：
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

> 📖 完整變數說明：[`environment-variables-reference.md`](./environment-variables-reference.md)

### Step 5：驗證

```bash
npm run verify-environment
```

**預期**：27 項全通過 / 僅 warnings（Azure 功能相關）。若有 🔴 critical 錯誤，修正後重跑。

### Step 6：啟動

```bash
npm run dev
```

等 45-60 秒看到：
```
▲ Next.js 15.x
- Local:    http://localhost:3005
✓ Ready in X.Xs
```

---

## 🌐 階段 4：首次登入與探索（~30 分鐘）

### 登入

打開 http://localhost:3005

**選項 A：管理員帳號**（推薦，功能完整）
```
帳號：admin@ai-document-extraction.com
密碼：ChangeMe@2026!
```

**選項 B：Dev mode**（任意 email）
```
輸入任何包含 @ 的 email（例：me@test.com）
```

### 探索核心頁面

| 頁面 | URL | 檢查什麼 |
|------|-----|---------|
| Dashboard | `/zh-TW/dashboard` | 儀表板正常載入 |
| 公司管理 | `/zh-TW/companies` | 顯示 16 家預設公司（DHL, FedEx, UPS, Maersk 等） |
| 文件上傳 | `/zh-TW/documents/upload` | 城市下拉有 10 個（Taipei, HK, SG, Tokyo 等） |
| 規則管理 | `/zh-TW/rules` | 顯示 31 條映射規則 |
| 資料模板 | `/zh-TW/admin/data-templates` | 3 個預設模板 |
| 用戶管理 | `/zh-TW/admin/users` | 3 個種子用戶（admin / dev / system） |

### 切換語言

右上角語言切換器測試 en / zh-TW / zh-CN。

---

## 📚 階段 5：理解架構（~60 分鐘）

依序閱讀（先看 CLAUDE.md，建立全貌；再看其他詳細參考）：

### 必讀

1. **根 `CLAUDE.md`**（專案總指南，~600 行）
   - 項目使命、三層映射系統、信心度路由
   - 技術棧、代碼規範、已知差異
2. **`docs/01-planning/prd/prd.md`**（產品需求，若存在）
3. **`claudedocs/CLAUDE.md`**（AI 助手文檔索引）

### 選讀（依興趣）

| 你關注什麼？ | 讀哪個 |
|-----------|--------|
| 前端 React 組件 | `src/components/CLAUDE.md` |
| API 路由設計 | `src/app/api/CLAUDE.md` |
| 資料庫 Schema | `prisma/CLAUDE.md` |
| V3 提取管線 | `src/services/extraction-v3/CLAUDE.md` |
| i18n 多語言 | `src/i18n/CLAUDE.md` + `.claude/rules/i18n.md` |
| 開發規範 | `.claude/rules/*.md`（9 份） |
| Codebase 深度分析 | `docs/06-codebase-analyze/00-analysis-index.md` |

---

## 🔧 階段 6：開發工作流（~30 分鐘）

### Git 工作流

```bash
# 1. 從 main 建立 feature branch
git checkout -b feature/my-first-task

# 2. 開發...

# 3. 提交前檢查
npm run type-check           # TypeScript
npm run lint                 # ESLint
npm run i18n:check           # i18n 同步
npm run verify-environment   # 環境自檢

# 4. Commit（遵循 Conventional Commits）
git add .
git commit -m "feat(scope): description"

# 5. Push 並建立 PR
git push origin feature/my-first-task
gh pr create --title "..." --body "..."
```

### Commit 訊息格式

```
<type>(<scope>): <subject>

類型：feat / fix / docs / style / refactor / test / chore
範例：
  feat(documents): add bulk upload support
  fix(FIX-055): resolve race condition in processing queue
  docs(CLAUDE.md): update i18n namespace list
```

### 嘗試性 PR（可選）

做一個最小變更（例：更新某個翻譯文字、改 README typo），走完整個 PR 流程，熟悉環境。

---

## 🛠️ 有用的 slash commands

| 命令 | 用途 |
|------|------|
| `/git-status` | 快速檢查 Git / Docker / 服務狀態 |
| `/git-sync` | 完整同步（pull / push / 環境檢查） |
| `/plan-fix` | 建立 FIX-XXX 規劃文件 |
| `/plan-change` | 建立 CHANGE-XXX 規劃文件 |

---

## ✅ Day-1 完成確認

結束 Day-1 時應能肯定地回答：

- [ ] 我可以在本機啟動應用並登入
- [ ] 我知道 docker-compose 啟動哪些容器
- [ ] 我能解釋三層映射系統的分層概念
- [ ] 我知道信心度路由的三個區間（≥90 / 70-89 / <70）
- [ ] 我能查閱 `.env.example` 找變數用途
- [ ] 我知道遇到 `.next` 問題如何修復
- [ ] 我成功跑過 `npm run verify-environment`
- [ ] 我建立過至少 1 個 feature branch

---

## 🆘 卡關時

| 問題 | 找這裡 |
|------|--------|
| 啟動錯誤 | [`project-initialization-guide.md`](./project-initialization-guide.md) §9 常見問題 |
| env 變數不清楚 | [`environment-variables-reference.md`](./environment-variables-reference.md) |
| Docker 容器問題 | [`docker-services-architecture.md`](./docker-services-architecture.md) |
| 跨電腦切換 | [`cross-computer-workflow.md`](./cross-computer-workflow.md) |
| 代碼架構疑問 | 相關目錄的 `CLAUDE.md` |
| 一般問題 | Slack / Teams / 技術主管 |

---

## 📅 Day-2 之後

完成 Day-1 後，建議的下一步：
- Day 2：深入閱讀你負責模組的 Epic 規劃與 tech spec
- Day 3：實作第一個小任務（建議 FIX 或文件改善類）
- 第一週結束前：走完一次完整 CHANGE / FIX 流程（規劃→實施→PR→review→merge）

歡迎加入 🎉
