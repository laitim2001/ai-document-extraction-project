---
name: git-sync
description: 跨電腦開發的 Git 例行同步檢查 — 拉取、狀態檢查、推送、環境同步一站式完成
trigger: /git-sync
---

# Git Sync — 跨電腦開發同步檢查

跨電腦協作的 Git 例行操作，確保兩台機器的代碼、資料庫、依賴始終同步。

## 執行流程

### Step 1: 環境快照

並行執行以下檢查，輸出環境總覽表：

```bash
git branch --show-current          # 當前分支
git status --short                 # 工作目錄狀態（是否有未提交的變更）
git stash list                     # 是否有暫存的變更
git remote -v                      # 遠端設定
```

輸出格式：
```
| 項目 | 狀態 |
|------|------|
| 當前分支 | main / feature/xxx |
| 工作目錄 | 乾淨 / N 個修改 / N 個未追蹤 |
| 暫存區 (stash) | 無 / N 筆 |
| 遠端 | origin → URL |
```

### Step 2: 同步狀態分析

```bash
git fetch origin                   # 拉取遠端最新資訊（不合併）
git log --oneline HEAD..origin/main --count  # 遠端比本地多幾個 commits
git log --oneline origin/main..HEAD --count  # 本地比遠端多幾個 commits
```

根據結果判斷並輸出：

| 狀態 | 判斷 | 建議動作 |
|------|------|----------|
| ✅ 完全同步 | 本地 = 遠端 | 無需操作 |
| ⬇️ 需要拉取 | 遠端有新 commits | 建議執行 `git pull` |
| ⬆️ 需要推送 | 本地有未推送的 commits | 建議執行 `git push` |
| ⚠️ 雙向差異 | 本地和遠端都有新 commits | 建議 `git pull --rebase` 後再推送 |
| 🔀 分支偏離 | 當前不在 main 分支 | 提示用戶確認是否需要合併 |

如果工作目錄不乾淨（有未提交的變更），先提醒用戶處理後再同步。

### Step 3: 執行同步

根據 Step 2 的分析結果，**詢問用戶確認後**依序執行：

#### 情境 A: 需要拉取（最常見）
```bash
git pull origin main               # 拉取並合併遠端變更
```

拉取完成後，檢查是否需要更新環境：
```bash
# 檢查 package.json 或 package-lock.json 是否有變更
git diff HEAD~N --name-only | grep -E "package(-lock)?\.json"

# 檢查 prisma/schema.prisma 是否有變更
git diff HEAD~N --name-only | grep "prisma/schema.prisma"

# 檢查是否有新的遷移檔案
git diff HEAD~N --name-only | grep "prisma/migrations/"
```

根據變更自動建議：

| 變更檔案 | 需要執行 |
|----------|----------|
| `package.json` / `package-lock.json` | `npm install` |
| `prisma/schema.prisma` | `npx prisma generate` + `npx prisma db push --accept-data-loss` |
| `prisma/migrations/` | `npx prisma migrate dev` |
| `prisma/seed.ts` / `prisma/seed-data/` | `npx prisma db seed`（提示用戶決定） |

#### 情境 B: 需要推送
```bash
git push origin main
```

#### 情境 C: 雙向差異
```bash
git pull --rebase origin main      # rebase 模式拉取，保持線性歷史
git push origin main
```

### Step 4: 環境同步（如 Step 3 觸發）

依序執行需要的環境更新命令，每步輸出結果：

```bash
npm install                                   # 依賴更新
npx prisma generate                           # Prisma Client 重新生成
npx prisma db push --accept-data-loss         # Schema 同步
npx prisma db seed                            # 種子資料（僅在用戶確認後）
```

### Step 5: 最終狀態報告

輸出最終同步結果：

```markdown
## Git Sync 完成

| 項目 | 結果 |
|------|------|
| 分支 | main |
| 同步方向 | ⬇️ 拉取 / ⬆️ 推送 / ✅ 已同步 |
| Commits 同步 | N 個 |
| 依賴更新 | ✅ 已更新 / ➖ 無需更新 |
| Prisma Schema | ✅ 已同步 / ➖ 無變更 |
| 資料庫遷移 | ✅ 已執行 / ➖ 無新遷移 |
| 最新 commit | `abc1234` — commit message |
```

## 注意事項

- **不要自動執行 `git push`**：推送前必須詢問用戶確認
- **不要終止 node.exe 進程**：可能是 Claude Code 進程
- **衝突處理**：如果 `git pull` 遇到衝突，列出衝突檔案並詢問用戶如何處理，不要自動解決
- **種子資料謹慎**：`prisma db seed` 可能覆蓋已有資料，需用戶確認後才執行
- **DATABASE_URL 端口**：本項目 Docker PostgreSQL 對外端口是 **5433**，不是 5432
