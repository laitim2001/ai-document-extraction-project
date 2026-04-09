---
name: git-status
description: 快速查看 Git 和服務狀態 — 分支、同步、未提交變更、Docker 服務一覽
trigger: /git-status
---

# Git Status — 快速狀態檢查

一鍵查看 Git 工作狀態和開發環境服務狀態，不做任何修改操作。

## 執行流程

### 並行執行所有檢查

同時執行以下所有命令（全部為唯讀操作）：

```bash
# Git 狀態
git branch --show-current
git status --short
git stash list
git log --oneline -1

# 同步狀態
git fetch origin 2>/dev/null
git rev-list --count HEAD..origin/main
git rev-list --count origin/main..HEAD

# Docker 服務
docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null

# 開發伺服器
netstat -ano | findstr LISTENING | grep ":3[0-9]"
```

### 輸出格式

```markdown
## 📊 項目狀態總覽

### Git
| 項目 | 狀態 |
|------|------|
| 分支 | `main` |
| 最新 commit | `abc1234` — message |
| 工作目錄 | ✅ 乾淨 / ⚠️ 3 modified, 2 untracked |
| Stash | 無 / ⚠️ 2 筆暫存 |
| 與遠端同步 | ✅ 同步 / ⬇️ 落後 N 個 / ⬆️ 領先 N 個 |

### 服務
| 服務 | 端口 | 狀態 |
|------|------|------|
| PostgreSQL | 5433 | ✅ Up / ❌ Down |
| Azurite | 10010 | ✅ Up / ❌ Down |
| Next.js Dev | 3005/3200/... | ✅ Running / ❌ Not running |
```

如果有需要注意的事項（未提交變更、落後遠端、服務未啟動），在最後用 `> ⚠️` 提示。

## 注意事項

- 此命令為**純唯讀**，不會修改任何檔案或執行任何同步操作
- 如需同步，請使用 `/git-sync`
