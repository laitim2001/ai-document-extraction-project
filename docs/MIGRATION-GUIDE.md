# 項目遷移指南 — 搬到另一台電腦繼續開發

> 最後更新: 2026-03-09

---

## 一、遷移前概覽

### 需要遷移的內容

| 類別 | 來源路徑 | 大約大小 | 必要性 |
|------|----------|----------|--------|
| **項目代碼** | 整個項目資料夾 | ~65 MB（排除 node_modules/.next） | 🔴 必須 |
| **環境變數** | `.env` + `.env.local` | ~3 KB | 🔴 必須（含敏感資訊） |
| **Claude Code 項目設定** | 項目內 `.claude/` | ~0.2 MB | 🔴 已在 Git 中 |
| **Claude Code Session 記錄** | `~/.claude/projects/C--Users-rci-ChrisLai-Documents-GitHub-ai-document-extraction-project/` | ~313 MB | 🟡 可選（歷史對話） |
| **Claude Code 全域設定** | `~/.claude/settings.json` + `~/.claude/rules/` | ~28 MB | 🟡 建議（個人偏好） |
| **node_modules** | `node_modules/` | ~1.1 GB | ❌ 不需要（npm install 重建） |
| **.next 快取** | `.next/` | ~220 MB | ❌ 不需要（自動生成） |

### 當前工具版本（來源電腦）

| 工具 | 版本 | 說明 |
|------|------|------|
| Node.js | v25.2.1 | 建議目標電腦使用相同大版本 |
| npm | 11.6.2 | 隨 Node.js 安裝 |
| Python | 3.13.9 | Python OCR/Mapping 服務用 |
| Docker | 29.1.3 | Docker Desktop for Windows |
| Git | 2.52.0 | — |
| Claude Code | 最新版 | `npm install -g @anthropic-ai/claude-code` |

---

## 二、遷移步驟

### Step 1: 確保來源電腦代碼已推送

```bash
# 在來源電腦
cd ai-document-extraction-project

# 確認所有變更已 commit
git status

# 推送到 GitHub
git push origin main
```

### Step 2: 複製項目資料夾

**方式 A: 整個資料夾複製（推薦，保留所有內容）**

```bash
# 複製時排除不需要的大型目錄以加快速度
# Windows PowerShell:
robocopy "C:\Users\rci.ChrisLai\Documents\GitHub\ai-document-extraction-project" `
  "D:\轉移目標\ai-document-extraction-project" `
  /E /XD node_modules .next coverage .nyc_output

# 或使用 7-Zip 打包（排除大型目錄）:
7z a project-backup.7z ai-document-extraction-project\ `
  -xr!node_modules -xr!.next -xr!coverage
```

**方式 B: Git clone + 手動補充**

```bash
# 在目標電腦
git clone https://github.com/YOUR_USER/ai-document-extraction-project.git
# 然後手動複製 .env、.env.local 和其他 untracked 文件
```

### Step 3: 複製 Claude Code Session 記錄（可選但推薦）

Claude Code 的 session 記錄和 memory 文件存放在使用者家目錄：

```
來源路徑（Windows）:
  %USERPROFILE%\.claude\projects\C--Users-rci-ChrisLai-Documents-GitHub-ai-document-extraction-project\

需要複製的內容:
  ├── memory/                    # 🔴 重要 — AI 助手的項目記憶
  │   └── MEMORY.md             #     跨會話的知識累積
  ├── *.jsonl                    # 🟡 可選 — 歷史 Session 對話記錄（~313 MB）
  ├── <session-uuid>/           # 🟡 可選 — Session 工作目錄
  └── sessions-index.json       # 🟡 可選 — Session 索引
```

**重要**: 目標電腦的路徑格式取決於項目放置位置。Claude Code 會根據項目絕對路徑自動建立目錄，格式為：
```
~/.claude/projects/<PATH-WITH-DASHES>/
```

例如：
- 如果目標電腦項目放在 `C:\Users\NewUser\Documents\GitHub\ai-document-extraction-project`
- 則 Claude Code 會使用 `~/.claude/projects/C--Users-NewUser-Documents-GitHub-ai-document-extraction-project/`
- 你需要將舊路徑的內容複製到新路徑下

**最小必要複製**: 只複製 `memory/` 資料夾即可保留跨會話記憶。

### Step 4: 複製全域 Claude Code 設定（可選）

```
來源: %USERPROFILE%\.claude\
需要的文件:
  ├── settings.json             # 🟡 全域權限設定與偏好
  ├── rules/                    # 🟡 全域規則文件
  ├── skills/                   # 🟡 全域 Skills
  ├── statusline.mjs            # 🟡 狀態列自訂
  ├── statusline-command.ps1    # 🟡 狀態列命令
  └── statusline-command.sh     # 🟡 狀態列命令

不需要複製:
  ├── .credentials.json         # ❌ 會重新 /login 產生
  ├── history.jsonl             # ❌ 全域歷史（非必要，且很大）
  ├── cache/                    # ❌ 快取
  ├── chrome/                   # ❌ 瀏覽器資料
  ├── debug/                    # ❌ 除錯日誌
  ├── telemetry/                # ❌ 遙測數據
  └── stats-cache.json          # ❌ 統計快取
```

### Step 5: 複製環境變數文件

以下文件在 `.gitignore` 中被排除，必須手動複製：

```
必須複製:
  .env                          # 主要環境變數（資料庫、API keys 等）
  .env.local                    # 本地覆蓋設定

參考用:
  .env.example                  # ✅ 已在 Git 中，不需額外複製
```

**⚠️ 安全提醒**: `.env` 包含敏感資訊（API keys、資料庫密碼），傳輸時請使用加密方式。

---

## 三、目標電腦環境建置

### Step 1: 安裝必要工具

```bash
# 1. 安裝 Node.js v25.x（或最新 LTS）
#    https://nodejs.org/

# 2. 安裝 Python 3.13+
#    https://www.python.org/

# 3. 安裝 Docker Desktop
#    https://www.docker.com/products/docker-desktop/

# 4. 安裝 Git
#    https://git-scm.com/

# 5. 安裝 Claude Code
npm install -g @anthropic-ai/claude-code
```

### Step 2: 啟動 Docker 服務

```bash
cd ai-document-extraction-project

# 啟動所有 Docker 服務
docker-compose up -d

# 確認服務運行中
docker-compose ps
# 預期: postgres, pgadmin, azurite 都在運行
# （ocr-extraction, forwarder-mapping 需要 Azure 金鑰才能正常運作）
```

**Docker 服務端口表**:

| 服務 | 容器名 | 端口 | 用途 |
|------|--------|------|------|
| PostgreSQL | ai-doc-extraction-db | 5433:5432 | 資料庫 |
| pgAdmin | ai-doc-extraction-pgadmin | 5050:80 | 資料庫管理 UI |
| Azurite (Blob) | ai-doc-extraction-azurite | 10010:10000 | Azure Blob 模擬器 |
| Azurite (Queue) | — | 10011:10001 | Azure Queue 模擬器 |
| Azurite (Table) | — | 10012:10002 | Azure Table 模擬器 |
| OCR Service | ai-doc-extraction-ocr | 8000 | Python OCR |
| Mapping Service | ai-doc-extraction-mapping | 8001 | Python Mapping |

### Step 3: 安裝依賴與初始化

```bash
# 安裝 npm 依賴
npm install

# 生成 Prisma Client
npx prisma generate

# 執行資料庫遷移
npx prisma migrate dev

# （可選）執行 Seed 數據
npx prisma db seed
```

### Step 4: 調整 .env（如需要）

如果目標電腦的端口或配置不同，需要調整 `.env`：

```env
# 資料庫連接（預設使用 Docker 的 5433 端口）
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/ai_document_extraction?schema=public"

# 應用 URL（如果使用不同端口）
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Azurite（確認端口與 docker-compose.yml 一致）
AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10010/devstoreaccount1;"
```

### Step 5: 啟動開發伺服器

```bash
# 檢查端口是否被佔用
netstat -ano | findstr :3000 | findstr LISTENING

# 啟動（預設 port 3000）
npm run dev

# 如果 3000 被佔用，使用備用端口
npm run dev -- -p 3200
```

### Step 6: Claude Code 登入與驗證

```bash
# 進入項目目錄
cd ai-document-extraction-project

# 啟動 Claude Code
claude

# 在 Claude Code 中登入
/login

# 驗證項目設定是否正確載入
# Claude Code 會自動讀取 CLAUDE.md 和 .claude/rules/
```

---

## 四、驗證清單

在目標電腦上逐項確認：

- [ ] `docker-compose ps` — 所有服務 Running
- [ ] `npm run dev` — 開發伺服器正常啟動
- [ ] 瀏覽器打開 `http://localhost:3000`（或備用端口）— 頁面正常顯示
- [ ] `npm run type-check` — TypeScript 類型檢查通過
- [ ] `npm run lint` — ESLint 檢查通過
- [ ] `npx prisma studio` — 可以看到資料庫表
- [ ] `claude` — Claude Code 可正常使用
- [ ] Claude Code 回應使用繁體中文 — CLAUDE.md 配置正確載入

---

## 五、常見問題

### Q1: Docker 服務啟動失敗
```bash
# 確認 Docker Desktop 已啟動
# 確認端口未被其他服務佔用
docker-compose down
docker-compose up -d
```

### Q2: Prisma 遷移失敗
```bash
# 重設資料庫（開發環境）
npx prisma migrate reset
# 或推送 Schema（不執行遷移歷史）
npx prisma db push
```

### Q3: Claude Code Session 路徑對不上
Claude Code 根據項目的**絕對路徑**生成 session 目錄。如果目標電腦的路徑不同（例如使用者名稱不同），需要手動將 session 文件移到新路徑。

```
舊: ~/.claude/projects/C--Users-rci-ChrisLai-Documents-GitHub-ai-document-extraction-project/
新: ~/.claude/projects/C--Users-NewUser-Documents-GitHub-ai-document-extraction-project/
```

只需重新命名/複製整個目錄即可。

### Q4: node_modules 安裝出錯
```bash
# 清除快取重裝
rm -rf node_modules package-lock.json
npm install
```

### Q5: Python 服務無法啟動
Python OCR 和 Mapping 服務需要在 Docker 中運行，且需要有效的 Azure Document Intelligence 金鑰。開發時如果不需要 OCR 功能，可以只啟動核心服務：
```bash
docker-compose up -d postgres pgadmin azurite
```

---

## 六、不需要遷移的檔案清單

以下目錄/檔案會在目標電腦自動生成，不需要手動複製：

```
node_modules/           # npm install 重建（~1.1 GB）
.next/                  # npm run dev 自動生成（~220 MB）
coverage/               # 測試覆蓋率報告
.nyc_output/            # 測試輸出
dist/                   # 建置輸出
build/                  # 建置輸出
uploads/                # 上傳檔案（開發環境）
exports/                # 匯出檔案（開發環境）
```

---

## 七、快速遷移指令摘要

```powershell
# === 來源電腦 ===

# 1. 推送代碼
cd C:\Users\rci.ChrisLai\Documents\GitHub\ai-document-extraction-project
git add -A && git commit -m "chore: pre-migration commit" && git push

# 2. 打包項目（排除大型目錄）
7z a D:\project-migration.7z . -xr!node_modules -xr!.next -xr!coverage

# 3. 打包 Claude Code 記憶（最小必要）
7z a D:\claude-memory.7z %USERPROFILE%\.claude\projects\C--Users-rci-ChrisLai-Documents-GitHub-ai-document-extraction-project\memory\

# 4. 打包 Claude Code Sessions（完整，可選）
7z a D:\claude-sessions.7z %USERPROFILE%\.claude\projects\C--Users-rci-ChrisLai-Documents-GitHub-ai-document-extraction-project\

# 5. 複製全域設定（可選）
copy %USERPROFILE%\.claude\settings.json D:\claude-global-settings.json
xcopy %USERPROFILE%\.claude\rules D:\claude-global-rules\ /E /I

# === 目標電腦 ===

# 1. 解壓到目標位置
7z x project-migration.7z -oC:\Users\NEW_USER\Documents\GitHub\ai-document-extraction-project

# 2. 還原 Claude Code 記憶
mkdir %USERPROFILE%\.claude\projects\C--Users-NEW_USER-Documents-GitHub-ai-document-extraction-project\memory
7z x claude-memory.7z -o%USERPROFILE%\.claude\projects\C--Users-NEW_USER-Documents-GitHub-ai-document-extraction-project\memory\

# 3. 環境建置
cd C:\Users\NEW_USER\Documents\GitHub\ai-document-extraction-project
docker-compose up -d
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

---

## 八、AI 自動環境檢查與準備

> **使用方式**: 在新電腦上啟動 Claude Code 後，將以下指令貼入即可讓 AI 自動執行完整環境檢查。
> 前提：你已手動完成工具安裝（Node.js、Docker、Git）並將項目資料夾放到目標位置。

### 指令（複製貼上到 Claude Code）

```
請依照 docs/MIGRATION-GUIDE.md 的「AI 自動檢查清單」執行環境檢查與準備。逐步執行，每步報告結果，遇到問題嘗試自動修復，無法修復時告知我。
```

### AI 自動檢查清單

AI 助手收到上述指令後，應依序執行以下步驟：

#### Phase 1: 基礎環境驗證

```
CHECK-01: 工具版本檢查
  命令: node -v && npm -v && python --version && docker --version && git --version
  預期: 所有工具已安裝且版本合理
  失敗處理: 列出缺失的工具，提示用戶安裝

CHECK-02: 項目結構完整性
  命令: ls -la package.json CLAUDE.md docker-compose.yml prisma/schema.prisma .env
  預期: 所有文件存在
  失敗處理:
    - 缺 .env → 提示用戶從來源電腦複製，或引導基於 .env.example 建立
    - 缺其他文件 → 可能項目複製不完整

CHECK-03: Claude Code 配置載入
  驗證: .claude/rules/ 目錄存在且包含 9 個規則文件
  命令: ls .claude/rules/
  預期: general.md, typescript.md, api-design.md, components.md, database.md,
        i18n.md, services.md, testing.md, technical-obstacles.md

CHECK-04: Claude Code Memory 檢查
  驗證: 項目記憶是否已遷移
  檢查 ~/.claude/projects/ 下是否有對應本項目路徑的 memory/ 目錄
  失敗處理: 告知用戶記憶未遷移，AI 將從 CLAUDE.md 重新學習（功能不受影響）
```

#### Phase 2: Docker 服務

```
CHECK-05: Docker Desktop 運行狀態
  命令: docker info > /dev/null 2>&1 && echo "Docker OK" || echo "Docker NOT running"
  失敗處理: 提示用戶啟動 Docker Desktop

CHECK-06: 啟動 Docker 服務
  命令: docker-compose up -d
  預期: 所有容器成功啟動

CHECK-07: 驗證 Docker 服務健康
  命令: docker-compose ps
  預期: postgres, pgadmin, azurite 狀態為 running/healthy
  失敗處理:
    - postgres 失敗 → 檢查端口 5433 是否被佔用
    - azurite 失敗 → 檢查端口 10010-10012 是否被佔用
    - ocr/mapping 失敗 → 正常（需要 Azure 金鑰，開發可忽略）

CHECK-08: 資料庫連接測試
  命令: npx prisma db pull --print 2>&1 | head -5
  預期: 能成功連接資料庫
  失敗處理: 檢查 .env 中 DATABASE_URL 端口是否為 5433
```

#### Phase 3: 依賴安裝與建置

```
CHECK-09: npm 依賴安裝
  命令: npm install
  預期: 安裝成功，無重大錯誤
  失敗處理:
    - 權限問題 → 嘗試清除快取: npm cache clean --force
    - 版本衝突 → rm -rf node_modules package-lock.json && npm install

CHECK-10: Prisma Client 生成
  命令: npx prisma generate
  預期: Prisma Client generated successfully

CHECK-11: 資料庫遷移
  命令: npx prisma migrate dev
  預期: 所有遷移成功執行
  失敗處理:
    - 如全新資料庫 → npx prisma migrate dev 會自動執行所有遷移
    - 如遷移衝突 → npx prisma migrate reset（會清除數據）

CHECK-12: （可選）Seed 數據
  命令: npx prisma db seed
  預期: Seed 數據成功寫入
  備註: 首次建置建議執行，提供初始數據
```

#### Phase 4: 代碼品質驗證

```
CHECK-13: TypeScript 類型檢查
  命令: npm run type-check
  預期: 通過（測試文件的 jest 類型錯誤可忽略）
  備註: 如有非測試文件的錯誤，報告給用戶

CHECK-14: ESLint 檢查
  命令: npm run lint
  預期: 通過或僅有 warnings

CHECK-15: i18n 翻譯同步檢查
  命令: npm run i18n:check
  預期: 所有語言文件同步
```

#### Phase 5: 開發伺服器啟動

```
CHECK-16: 端口可用性檢查
  命令: netstat -ano | findstr :3000 | findstr LISTENING
  預期: 端口 3000 未被佔用
  如被佔用: 改用 3200（記錄備用端口供後續使用）

CHECK-17: 開發伺服器啟動
  命令: npm run dev（或 npm run dev -- -p 3200）
  預期: 看到 "✓ Ready" 訊息
  等待: 45-60 秒（首次編譯）

CHECK-18: 伺服器存活驗證
  命令: netstat -ano | findstr :<PORT> | findstr LISTENING
  預期: 端口正在監聽
```

#### Phase 6: 結果報告

AI 助手完成所有檢查後，輸出以下格式的報告：

```markdown
## 🏥 環境遷移檢查報告

| # | 檢查項目 | 狀態 | 備註 |
|---|----------|------|------|
| 01 | 工具版本 | ✅/❌ | Node vXX, npm vXX, ... |
| 02 | 項目結構 | ✅/❌ | — |
| 03 | Claude Code 配置 | ✅/❌ | 9/9 規則文件 |
| 04 | Claude Code Memory | ✅/⚠️ | 已遷移/未遷移 |
| 05 | Docker Desktop | ✅/❌ | — |
| 06 | Docker 服務啟動 | ✅/❌ | — |
| 07 | Docker 健康檢查 | ✅/⚠️ | core 3/3, optional X/2 |
| 08 | 資料庫連接 | ✅/❌ | — |
| 09 | npm install | ✅/❌ | — |
| 10 | Prisma generate | ✅/❌ | — |
| 11 | 資料庫遷移 | ✅/❌ | X migrations applied |
| 12 | Seed 數據 | ✅/⏭️ | 已執行/跳過 |
| 13 | TypeScript | ✅/⚠️ | — |
| 14 | ESLint | ✅/⚠️ | — |
| 15 | i18n 同步 | ✅/⚠️ | — |
| 16 | 端口檢查 | ✅ | 使用端口 XXXX |
| 17 | 開發伺服器 | ✅/❌ | — |
| 18 | 伺服器存活 | ✅/❌ | — |

### 總結
- ✅ 通過: XX/18
- ⚠️ 警告: XX/18
- ❌ 失敗: XX/18

### 需要用戶處理的問題
1. [如有列出]

### 環境已就緒，可以開始開發！
```
