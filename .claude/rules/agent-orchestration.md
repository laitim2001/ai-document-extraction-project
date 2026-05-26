# 並行 Agent 編排協議

> **本文件為 CLAUDE.md §AI 開發輔助 → 並行 Agent 編排 的完整展開**。摘要在 CLAUDE.md，詳細觸發條件 / 流程細節 / Agent 詳表 / 衝突處理 / worktree 隔離都在此處。

---

## 核心原則

當任務可拆分為多個獨立子任務時，AI 助手應**主動**使用並行 Agent 編排來最大化開發效率。**不需要用戶明確指示**——若符合觸發條件即自動使用。

---

## 自動觸發條件

| 條件 | 說明 | 範例 |
|------|------|------|
| **多 CHANGE/FIX 同時開發** | 2+ 個獨立的 CHANGE 或 FIX | Sprint 含 CHANGE-043 + CHANGE-044 |
| **大型功能實作** | 單一功能可拆分為 ≥3 個獨立模組 | API + Service + Component + i18n |
| **多文件修改** | 涉及 >5 個文件且各自獨立 | 批量重構、模式統一 |
| **用戶明確要求** | 用戶提及「並行」「同時」「一起做」 | — |

---

## 標準執行流程

### Step 1: 探索與規劃（主 Session）

```
- 讀取規劃文件（tech-spec、CHANGE doc、相關代碼）
- 識別可並行的獨立子任務
- 確認各子任務之間無文件衝突
- 使用 TaskCreate 建立任務清單
```

### Step 2: 並行派發（使用 Agent tool）

為每個獨立子任務啟動 Agent（`run_in_background: true`），每個 Agent 的 prompt **必須包含**：

- ✅ 明確的實作範圍和預期產出
- ✅ 相關文件路徑（具體到行號為佳）
- ✅ 必須遵守的代碼規範引用（CLAUDE.md §X / .claude/rules/*.md）
- ✅ **不可修改的文件**（避免衝突）
- ✅ 是否需要寫測試 / i18n 同步

**啟動後輸出啟動狀態表**讓用戶看到全貌：

```markdown
| Agent ID | 任務 | 修改文件範圍 | 狀態 |
|----------|------|------------|------|
| task-1 | CHANGE-XXX: 描述 | src/services/X/ | 🔄 已派發 |
| task-2 | CHANGE-YYY: 描述 | src/components/Y/ | 🔄 已派發 |
```

### Step 3: 監控與彙總（主 Session）

```
- 追蹤每個 Agent 的完成狀態（TaskOutput 讀取輸出）
- Agent 完成後 TaskUpdate 更新狀態
- 如有 Agent 失敗：
  * 分析原因
  * 決定 retry / 手動修復 / 撤銷整批
- 所有 Agent 完成後輸出最終狀態表
```

### Step 4: 統一驗證（主 Session）

並行驗證任務完整性：

```bash
npm run type-check     # TypeScript 類型檢查
npm run lint           # ESLint
npm run i18n:check     # i18n 同步（如涉及 UI 文字）
npm run test           # 測試（如涉及核心邏輯）
```

確認模組間整合正確性：
- 跨 Agent 修改是否相容？
- API contract 是否一致？
- 共用 type 是否同步更新？

### Step 5: 統一 Commit（**僅在用戶要求時**）

- Agent 內**絕不**執行 git operations
- 所有 commit 由主 Session 統一處理
- 可分多個 commit（每個 CHANGE 一個）或單一 commit（功能整體）

---

## Agent 選擇指南

| 任務類型 | subagent_type | 用途 | 適用場景 |
|---------|---------------|------|---------|
| 功能實作（API + Service + Component） | `code-implementer` | 寫代碼，遵循規範 | 主力 implementation agent |
| 代碼品質檢查 | `code-quality-checker` | 檢查 9 條規則合規性 | 完成後品質 gate |
| i18n 翻譯同步 | `i18n-guardian` | 驗證 en/zh-TW/zh-CN 同步 | UI 文字變更後 |
| 架構設計驗證 | `architecture-reviewer` | 驗證設計決策 | 新 API/模型/多層改動 |
| 代碼探索與研究 | `Explore` | 快速搜尋代碼結構 | 不需修改代碼的探索 |
| 功能腳手架生成 | `fullstack-scaffolder` | 生成代碼骨架 | 新 CRUD 模組 |
| 測試策略規劃 | `test-strategist` | 生成測試計劃文檔 | 功能完成後 |
| 需求分析 | `requirement-analyst` | 影響分析、Tier 評估 | 新功能討論階段 |

---

## 進度追蹤格式

```markdown
## 並行 Agent 執行狀態

| Agent | 任務 | 狀態 | 修改文件 | 備註 |
|-------|------|------|---------|------|
| task-1 | CHANGE-XXX: API endpoint | ✅ 完成 | 3 文件 | — |
| task-2 | CHANGE-XXX: Service layer | ✅ 完成 | 2 文件 | — |
| task-3 | CHANGE-XXX: Component | 🔄 進行中 | 預計 4 文件 | — |
| task-4 | CHANGE-YYY: i18n | ⏸️ 等待 task-3 | 9 JSON 文件 | 需先確認 keys |
| task-5 | FIX-ZZZ: 修復 console.log | ❌ 失敗 | — | 重試 1 次 |

**整體進度**：3/5 完成（60%）
**預計剩餘時間**：~2 分鐘
```

---

## 限制與安全規則

### 🔴 絕對禁止

| # | 規則 | 理由 |
|---|------|------|
| 1 | 並行修改同一文件 | 會造成 merge conflict |
| 2 | Agent 內執行 git 操作（commit/push/rebase） | 必須由主 Session 統一控制 |
| 3 | 有依賴的任務並行 | 必須用 `addBlockedBy` 串接成序列 |
| 4 | 派發 Agent 修改 `.env` / secrets / `prisma/migrations/` 等敏感文件 | 安全 |
| 5 | Agent 內呼叫其他 Agent（巢狀） | 失控風險，使用扁平結構 |

### 🟡 衝突時的處理策略

#### 情境 1: 兩個 Agent 需修改同一文件

**Default**: 序列化處理（不並行）
**例外**: 使用 worktree 隔離

```typescript
Agent({
  description: "CHANGE-XXX impl",
  prompt: "...",
  isolation: "worktree",   // ← 創建獨立 git worktree
  run_in_background: true,
})
```

完成後主 Session 統一 merge worktree changes（手動 review diff）。

#### 情境 2: i18n 翻譯文件衝突

**規則**: 翻譯文件（`messages/*.json`）的修改**必須**在所有功能 Agent 完成後**統一處理**，由單一 `i18n-guardian` agent 或主 Session 處理。

理由：JSON 文件易產生 merge conflict，且 keys 需在所有功能完成後才能確定。

#### 情境 3: Schema 變更（Prisma）

**規則**: Schema 變更**絕不並行**——必須單一 Agent 或主 Session 處理，且：
1. 先寫 migration
2. dry-run 驗證
3. 再讓其他 Agent 開始實作（讀新 schema）

---

## Agent Prompt 模板

```markdown
## 任務描述
[一句話描述]

## 範圍
- 實作：[具體要做的]
- 修改文件：[檔案路徑列表]
- 預期產出：[最終狀態]

## 規範引用
- 遵循 CLAUDE.md §代碼規範
- 遵循 .claude/rules/hard-constraints.md H1-H6
- 遵循 .claude/rules/[specific].md

## 不可修改文件（避免衝突）
- [文件 A]（其他 Agent 在處理）
- [文件 B]（必須由主 Session 處理）

## 完成條件
- [ ] [具體 verifiable goal 1]
- [ ] [具體 verifiable goal 2]
- [ ] 不執行任何 git 操作
- [ ] 完成後回報修改的文件清單

## 注意事項
- 若遇到 Hard Constraint trigger → STOP 並回報，不要自行 ask user（由主 Session 統一處理）
- 若發現規範不清楚 → 在回報中標註，不要自行假設
```

---

## 範例：3-Agent 並行實作 CHANGE-XXX

```typescript
// 主 Session
TaskCreate({ task: "CHANGE-XXX 並行實作" })

// 並行派發 3 個 Agent（單一訊息中多個 tool call）
Agent({
  description: "CHANGE-XXX API",
  subagent_type: "code-implementer",
  prompt: "[完整 prompt: 修改 src/app/api/xxx/route.ts 加 POST endpoint]",
  run_in_background: true,
})
Agent({
  description: "CHANGE-XXX Service",
  subagent_type: "code-implementer",
  prompt: "[完整 prompt: 加 src/services/xxx/yyy.service.ts]",
  run_in_background: true,
})
Agent({
  description: "CHANGE-XXX Component",
  subagent_type: "code-implementer",
  prompt: "[完整 prompt: 加 src/components/features/xxx/Form.tsx]",
  run_in_background: true,
})

// 等待完成（被自動通知）
// 統一驗證
Bash({ command: "npm run type-check && npm run lint" })

// 統一 i18n 同步（單一 Agent）
Agent({
  description: "CHANGE-XXX i18n sync",
  subagent_type: "i18n-guardian",
  prompt: "[檢查 3 個 Agent 引入的新 i18n keys，同步 3 語言]",
})

// 統一 commit（用戶要求時）
```

---

## 何時**不**使用並行 Agent

- 單一 small fix（< 5 文件，< 1 hour）
- 探索性任務（不確定要改什麼）
- 涉及多輪用戶確認的任務（並行會打斷對話）
- Prisma migration（必須序列化）
- 用戶 explicit 說「我想一步步看」

---

*本文件建立日期：2026-05-26（CLAUDE.md v4.0.0）*
*從 CLAUDE.md v3.4.1 §開發編排協議 完整遷移 + 擴充範例*
