# 跨電腦開發工作流程

> **建立日期**: 2026-04-22（CHANGE-054）
> **適用情境**: 同一位開發者在多台電腦間切換（如辦公室 / 家中），透過 GitHub 同步代碼

本文件涵蓋跨電腦開發的**同步流程**、**常見陷阱**與 **FIX-054 的 SYSTEM_USER_ID 遷移指引**。

---

## 🧭 核心觀念

| 元素 | 同步機制 | 注意 |
|------|---------|------|
| 📝 代碼 | Git | 正常 push / pull |
| 📦 依賴（`node_modules`） | 不同步，每台本機重裝 | 新 dependency 拉下來時需 `npm install` |
| 🗃️ 資料庫 Schema | Prisma Schema（代碼） + `prisma db push` | 拉代碼後需檢查 schema 變更 |
| 📊 資料庫資料 | **不同步**（每台電腦獨立 DB） | 若需要一致資料，需手動 dump / restore |
| 🔐 `.env` | **不同步**（在 `.gitignore`） | 每台電腦各自保管 |
| 🏗️ `.next` 快取 | **不同步**，硬編碼絕對路徑 | 切換電腦後**必須**清除，否則 500 錯誤 |

---

## 🚀 標準切換電腦流程

### 在離開前的電腦（A）

```bash
# 1. 確認所有變更已 commit
git status

# 2. Push 到遠端
git push origin main
# 或 feature branch
git push origin feature/my-branch

# 3. （可選）如果 DB 有重要資料，備份
docker exec ai-doc-extraction-db pg_dump -U postgres ai_document_extraction \
  > backup-$(date +%Y%m%d).sql
```

### 在新電腦（B）

#### 情境 A：**全新 clone**

```bash
# 1. Clone
git clone https://github.com/laitim2001/ai-document-extraction-project.git
cd ai-document-extraction-project

# 2. 啟動 Docker Desktop

# 3. 一鍵初始化
./scripts/init-new-environment.sh          # Unix / Git Bash
.\scripts\init-new-environment.ps1         # Windows PowerShell

# 4. 編輯 .env 填入真實 Azure / OpenAI 憑證
#    （腳本會從 .env.example 複製，內容是 placeholder）

# 5. 自檢並啟動
npm run verify-environment
npm run dev
```

#### 情境 B：**既有 clone，拉取最新更新**

```bash
# 1. 拉取最新代碼
git pull origin main

# 2. 檢查 .env 是否需要補新變數（CHANGE-054 後尤其重要）
diff <(grep -oE '^[A-Z_]+' .env | sort) <(grep -oE '^[A-Z_]+' .env.example | sort)
# 若輸出有差異 → 參考 .env.example 補齊

# 3. 依賴更新
npm install

# 4. Prisma
npx prisma generate

# 5. Schema 檢查（若有變更）
npx prisma migrate status
# 若顯示 "Drift detected" 或有 pending migration → 執行 db push
npx prisma db push --accept-data-loss

# 6. 清除舊快取（🔴 必須）
rm -rf .next

# 7. 驗證
npm run verify-environment

# 8. 啟動
npm run dev
```

---

## ⚠️ 必踩陷阱

### 陷阱 1：`.next` 快取包含舊絕對路徑

**症狀**：
```
Error: Cannot find module '#main-entry-point'
    at /home/previous-user/.../some-path
```

**原因**：Next.js build 快取會記錄絕對路徑。從 A 電腦的 `C:\Users\A\...` 切到 B 電腦的 `C:\Users\B\...` 時快取失效。

**解決**：
```bash
rm -rf .next
npm run dev
```

**何時必做**：
- ✅ 切換電腦後第一次啟動
- ✅ 移動專案目錄後
- ✅ Node.js 版本變更後
- ✅ 遇到「找不到模組」類的奇怪錯誤

### 陷阱 2：資料庫 Schema 漂移

**症狀**：應用報 `column "xxx" does not exist` 或 Prisma Client 類型不符

**原因**：A 電腦新增的 Schema 欄位已 push 到遠端（`prisma/schema.prisma` 更新），但 B 電腦的 DB 還是舊 schema。

**解決**：
```bash
npx prisma generate          # 同步 Client 類型
npx prisma db push --accept-data-loss   # 同步 DB schema
```

**⚠️ 資料損失風險**：`--accept-data-loss` 在變更欄位型別或刪除欄位時會清空該欄位資料。慎用，或先 dump 備份。

### 陷阱 3：新變數未加入本地 `.env`

**症狀**：拉完最新代碼後啟動失敗，抱怨某個 env 未定義

**原因**：CHANGE-054（2026-04-22）補了 15 個必要變數；FIX-054 加了 `SYSTEM_USER_ID`。既有 `.env` 沒有這些。

**解決**：
```bash
diff <(grep -oE '^[A-Z_]+' .env | sort) <(grep -oE '^[A-Z_]+' .env.example | sort)
# 根據差異補齊
```

**CHANGE-054 後新增的必要變數清單**：
- `AUTH_URL` / `AUTH_TRUST_HOST`
- `JWT_SECRET` / `JWT_EXPIRES_IN` / `SESSION_SECRET` / `ENCRYPTION_KEY`
- `SYSTEM_USER_ID`（FIX-054）
- 等（共 15+1 個）

### 陷阱 4：Docker 容器在 A 電腦有資料，B 電腦沒有

**現實**：每台電腦的 Docker volume 是獨立的。若你在 A 上傳了文件、建立了測試公司，B 電腦的 DB 是空的。

**選項**：
```bash
# 選項 1：B 電腦重跑 seed（獲得乾淨基礎資料）
npx prisma db seed

# 選項 2：從 A 備份 DB，到 B 還原
# A 電腦：
docker exec ai-doc-extraction-db pg_dump -U postgres ai_document_extraction > backup.sql
# 同步 backup.sql 到 B（scp / 雲端硬碟 / etc.）
# B 電腦：
docker exec ai-doc-extraction-db psql -U postgres -d ai_document_extraction < backup.sql

# 選項 3：使用 exported-data.json（項目已支援，170 KB）
# prisma/seed/exported-data.json 已入 git，seed 會自動讀取
npx prisma db seed
```

### 陷阱 5：`DOCKER_HOST` 環境變數

**症狀**：`docker-compose` 或 `docker` 指令連不上引擎

**解決**：見 `docker-services-architecture.md` §除錯問題 4

---

## 🔑 FIX-054 SYSTEM_USER_ID 跨電腦遷移

### 為何需要特別處理

FIX-054 起，`company-auto-create` / `batch-processor` / `issuer-identification` 等服務依賴 `SYSTEM_USER_ID` env 變數（預設 `'system-user-1'`）。

- **全新電腦**：跑 `prisma db seed` 會自動建立 `id='system-user-1'` 的系統用戶 → 不需設 env
- **既有電腦**（DB 先前已存在的系統用戶 UUID 不是 `system-user-1`）：必須設 env 指向現有 UUID，避免動資料

### 既有電腦的遷移步驟

```bash
# Step 1: 查詢現有 systemUser UUID
node -e "
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(\"SELECT id, email FROM users WHERE email = 'system@ai-document-extraction.internal';\")
  .then(r => { console.log(r.rows); pool.end(); });
"

# 輸出範例：
# [ { id: 'cmkngdv0s0006skxg0voe9b3w', email: 'system@ai-document-extraction.internal' } ]

# Step 2: 將 UUID 寫入 .env
# 編輯 .env，加入或修改：
# SYSTEM_USER_ID="cmkngdv0s0006skxg0voe9b3w"

# Step 3: 驗證
npm run verify-environment
# 應看到：
# ✅ system@ai-document-extraction.internal (System) — id: cmkngdv0s0006skxg0voe9b3w
```

### 三種電腦切換情境

| 情境 | A 電腦設定 | B 電腦應該做什麼 |
|------|----------|----------------|
| **全新 B 電腦**（乾淨 DB） | `SYSTEM_USER_ID="aaa..."` | `npx prisma db seed` 建立 `system-user-1`；B 的 `.env` 設 `SYSTEM_USER_ID="system-user-1"`（或不設，讀 fallback） |
| **既有 B 電腦** | `SYSTEM_USER_ID="aaa..."` | 查 B 的既有 UUID（可能不同，因為各自跑過 seed）；B 設自己的 UUID |
| **同步 A 的資料到 B** | `SYSTEM_USER_ID="aaa..."` | 從 A 還原 SQL dump 到 B；B 設 `SYSTEM_USER_ID="aaa..."`（與 A 相同） |

**關鍵**：`SYSTEM_USER_ID` 是**電腦 local 的 env**（因為每台電腦的 DB 可能不同），不應 commit 到 git。

---

## 🛠️ Git Slash Commands

本項目提供兩個輔助 slash commands（位於 `.claude/skills/`）：

### `/git-status`
快速檢查：
- Git 分支、sync 狀態、未 commit 變更
- Docker 服務狀態
- 開發伺服器狀態

### `/git-sync`
完整同步：
- 拉取最新
- 偵測依賴 / Schema 變更並建議 `npm install` / `prisma db push`
- Push 本地變更

---

## 📋 切換電腦 Checklist

```
離開前（A）：
□ git status 確認無未 commit 變更
□ git push 到遠端
□ （可選）dump DB 若需要同步資料

到達後（B）：
□ Docker Desktop 啟動
□ git pull 最新
□ diff .env 與 .env.example，補齊新變數
□ npm install（若有 dependency 變更）
□ npx prisma generate
□ npx prisma db push --accept-data-loss（若有 schema 變更）
□ rm -rf .next 🔴 必須
□ 確認 SYSTEM_USER_ID 指向 B 電腦的正確 UUID
□ npm run verify-environment
□ npm run dev
```

---

## 🔗 相關文件

- 主要指南：[`project-initialization-guide.md`](./project-initialization-guide.md) §跨電腦開發協作
- 環境變數：[`environment-variables-reference.md`](./environment-variables-reference.md)
- Docker 操作：[`docker-services-architecture.md`](./docker-services-architecture.md)
- 根 `CLAUDE.md` §跨電腦開發協作（多機同步）
- Git Slash Commands：`.claude/skills/git-sync/` + `.claude/skills/git-status/`
- FIX-054：`claudedocs/4-changes/bug-fixes/FIX-054-*.md`
