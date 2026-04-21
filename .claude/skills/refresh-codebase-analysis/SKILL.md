---
name: refresh-codebase-analysis
description: 季度性重新掃瞄 codebase，比對 docs/06-codebase-analyze/ 舊版報告，標註變化差異，產生同步 CLAUDE.md 的建議
trigger: /refresh-codebase-analysis
---

# Refresh Codebase Analysis - 季度性 Codebase 分析更新

讓 `docs/06-codebase-analyze/` 的深度分析報告保持活躍，避免投入過的分析成果慢慢過時。此 skill **不會**直接修改分析報告（因為 80 份文件涉及大量驗證），而是產生**差異報告 + 同步建議**，由用戶決定下一步。

> **配套機制**: 本 skill 與 `scripts/verify-claude-md-sync.sh` 互補 — 腳本每次 session 結束檢查「主 CLAUDE.md 聲稱 vs 實際」；本 skill 則是跨季度檢查「docs/06-codebase-analyze/ vs 實際」。

## 何時使用

- 每季度結束（建議 3/6/9/12 月）
- 完成重大 Epic 或 10+ 個 CHANGE 之後
- `verify-claude-md-sync.sh` 出現大量漂移時
- 主 CLAUDE.md 版本升版前

## 執行流程

### Step 1: 讀取舊版基準數據

```
1. Read: docs/06-codebase-analyze/00-analysis-index.md
   → 擷取「Codebase Scale Summary」表格中的基準數字
   → 記錄每個指標的舊值
2. Read: docs/06-codebase-analyze/01-project-overview/project-metrics.md
   → 擷取更詳細的指標（LOC、依賴、等）
```

### Step 2: 執行實測統計

使用 bash 命令重新測量（不要相信 MEMORY.md，以當前 codebase 為準）：

```bash
# 程式碼規模
find src/services -maxdepth 3 -type f -name "*.ts" | wc -l        # Services
find src/app/api -type f -name "route.ts" | wc -l                 # API routes
find src/components -type f -name "*.tsx" | wc -l                 # Components
find src/hooks -type f -name "*.ts" | wc -l                       # Hooks
find src/types -type f -name "*.ts" | wc -l                       # Types
find src/lib -type f -name "*.ts" | wc -l                         # Lib
find src/app/\[locale\] -type f -name "page.tsx" | wc -l          # Pages

# i18n
ls messages/en/ | wc -l                                           # i18n namespaces

# Prisma
grep -cE "^model [A-Z]" prisma/schema.prisma                      # Models
grep -cE "^enum [A-Z]" prisma/schema.prisma                       # Enums
wc -l prisma/schema.prisma                                        # Schema lines

# Python
find python-services -type f -name "*.py" | wc -l

# Tests
find tests -type f -name "*.test.ts" -o -name "*.spec.ts" | wc -l

# 文檔變更追蹤
ls claudedocs/4-changes/feature-changes/CHANGE-*.md | wc -l       # CHANGE 總數
ls claudedocs/4-changes/bug-fixes/FIX-*.md | wc -l                # FIX 總數
```

另外執行進階檢測：

```bash
# Auth 覆蓋率（含 getServerSession 或 authenticate 檢查的 route 比例）
total=$(find src/app/api -name "route.ts" | wc -l)
with_auth=$(grep -rl "getServerSession\|authenticate\|verifyToken" src/app/api --include="route.ts" | wc -l)
echo "Auth coverage: $with_auth/$total"

# console.log 數量（PII 風險）
grep -r "console\.log" src --include="*.ts" --include="*.tsx" | wc -l

# Zod 驗證覆蓋率（POST/PATCH/PUT 路由中使用 zod 的比例）
grep -rl "z\.object\|\.parse(" src/app/api --include="route.ts" | wc -l

# Rate limit 實作檢測
grep -rE "redis|Redis|upstash" src/services/rate-limit*.ts src/lib/rate-limit*.ts 2>/dev/null | wc -l
```

### Step 3: 產生差異報告

建立新文件 `docs/06-codebase-analyze/verification/R-refresh-{YYYY-MM-DD}.md`：

```markdown
# Codebase Refresh Verification - YYYY-MM-DD

> **基準版本**: 00-analysis-index.md 版本（YYYY-MM-DD）
> **本次掃瞄**: YYYY-MM-DD
> **觸發原因**: [季度檢查 / Epic 完成 / 手動觸發]

## 代碼規模變化

| 指標 | 基準值 | 當前值 | 變化 | 變化率 |
|------|-------|-------|------|--------|
| Services | 200 | NNN | +/-NN | +/-N% |
| API Routes | 331 | NNN | ... | ... |
| ...

## 新增區域（需分析）

[列出 git log 中新增的主要目錄或文件類別]

## 關鍵指標變化

- Auth 覆蓋率: X% → Y% [改善/惡化]
- console.log: 279 → N
- Zod 驗證: X% → Y%

## 建議同步項目

- [ ] 更新 CLAUDE.md §代碼規模概覽
- [ ] 更新 `docs/06-codebase-analyze/00-analysis-index.md` Codebase Scale Summary
- [ ] 驗證 [specific file] 中的細節分析是否仍正確
- [ ] 新增 Epic XX / CHANGE-NNN 相關的分析章節

## 仍未解決的已知差異

[從主 CLAUDE.md §已知差異複製未解決項目]
- Rate Limit in-memory Map → 待決策
- Smart Routing dual logic → FIX-053
- ...
```

### Step 4: 更新 MEMORY.md 摘要

在 `memory/MEMORY.md` 新增或更新一條：

```markdown
## Codebase Refresh (YYYY-MM-DD)
- Services: NNN (基準 200, 變化 +/-NN)
- API Routes: NNN (基準 331)
- [其他主要變化]
- Verification report: `docs/06-codebase-analyze/verification/R-refresh-YYYY-MM-DD.md`
```

### Step 5: 互動詢問下一步

詢問用戶：

```markdown
📊 Codebase Refresh 完成，差異報告已產生：
`docs/06-codebase-analyze/verification/R-refresh-YYYY-MM-DD.md`

發現 N 項重大變化，建議執行：
1. 自動更新主 CLAUDE.md 統計數字
2. 建立 CHANGE-XXX 規劃完整的 analysis refresh（更新 00-analysis-index.md）
3. 暫不處理（僅記錄差異報告）

請選擇：1 / 2 / 3
```

## 禁止事項

- ❌ 不要直接覆寫 `docs/06-codebase-analyze/` 下的 31 份分析報告（那是驗證過的成果）
- ❌ 不要修改 `verification/R1-R15-*.md`（歷史驗證記錄）
- ❌ 不要跳過 Step 5 的用戶確認，擅自修改 CLAUDE.md
- ❌ 不要在差異 < 5% 時產生噪音警告

## 與其他工具的關係

```
┌─────────────────────────────────────────────────────────┐
│ Session 結束 → scripts/verify-claude-md-sync.sh (輕量)  │
│   ↓ 若連續多次漂移 → 提示執行 /refresh-codebase-analysis │
│                                                          │
│ 季度結束 → /refresh-codebase-analysis (本 skill)        │
│   ↓ 產生差異報告                                         │
│   ↓ 用戶決定 → 更新 CLAUDE.md / 建立 CHANGE / 記錄      │
│                                                          │
│ 重大重構後 → 完整重新執行 codebase-analyze-playbook.md  │
│   ↓ 產生新的 R1-R15 驗證報告                            │
└─────────────────────────────────────────────────────────┘
```

## 相關文件

- 方法論: `docs/06-codebase-analyze/codebase-analyze-playbook.md`
- 舊版基準: `docs/06-codebase-analyze/00-analysis-index.md`
- 輕量檢查: `scripts/verify-claude-md-sync.sh`
- Hook 配置: `.claude/settings.json` (Stop hook)
