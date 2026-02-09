# CHANGE-033: CLAUDE.md Token 優化 — 精簡系統提示以降低每次 Session 成本

> **日期**: 2026-02-09
> **狀態**: 📋 規劃中
> **優先級**: High
> **類型**: Optimization / Documentation Refactor
> **影響範圍**: `CLAUDE.md`（根目錄）、`claudedocs/reference/`（新建）

---

## 變更背景

根目錄的 `CLAUDE.md` 作為 Claude Code 的系統提示，會在**每次 session 啟動時自動載入**。目前該文件有 **970 行**，佔據約 **13,400 token**，造成以下問題：

1. **每次 session 消耗大量 context** — 13.4k token 的固定開銷，壓縮了可用於實際工作的上下文空間
2. **大量內容與 `.claude/rules/` 重複** — 9 個 rules 文件已覆蓋的規範，在 CLAUDE.md 中重複出現（代碼範例、詳細流程等）
3. **歷史資料常駐** — 22 個 Epic 已全部完成，完整進度表和版本更新記錄不需要每次載入
4. **參考性資料佔比過高** — 完整目錄結構樹、開發後檢查清單等屬於「按需查閱」而非「每次必讀」

### 問題量化

| 指標 | 現狀 |
|------|------|
| CLAUDE.md 總行數 | 970 行 |
| 估算 Token 數 | ~13,400 |
| 與 rules/ 重複的 Token | ~4,300（32%） |
| 可移至按需查閱的 Token | ~3,200（24%） |
| 可精簡的冗餘描述 Token | ~1,200（9%） |

---

## 變更目標

- **精簡 CLAUDE.md** 至約 **350-400 行**，約 **5,000-5,500 token**
- **節省約 60%** 的每次 session 固定 token 開銷
- **零資訊遺失** — 所有內容都有明確歸宿（搬遷而非刪除）
- **每個被精簡的區塊都保留摘要和引用路徑** — AI 可按需查閱完整資訊

---

## 變更內容

### 1. 刪除與 `.claude/rules/` 重複的內容（節省 ~4,300 token）

以下 7 個區塊的**代碼範例和詳細流程**已在對應的 rules 文件中完整存在，CLAUDE.md 中保留**摘要 + 引用路徑**即可。

#### 1.1 代碼規範（L275-374，現 100 行）

**現狀**：包含完整 JSDoc 模板、TypeScript 代碼範例、函數註釋範例
**對應 rules**：`.claude/rules/general.md` + `.claude/rules/typescript.md`

**保留內容**：
- 命名規範表格（6 行，快速參考價值高）
- 文件頭部「必須包含 JSDoc」的一行說明
- 適用範圍表格（哪些文件需要/不需要頭部註釋）

**刪除內容**：
- 完整 JSDoc `@fileoverview` 模板（17 行代碼塊）→ 已在 `rules/general.md` 中
- 函數/方法註釋代碼範例（12 行代碼塊）→ 已在 `rules/general.md` 中
- TypeScript 規範代碼範例（interface/type/Zod 示例，22 行）→ 已在 `rules/typescript.md` 中

**精簡後**：~25 行 + 引用說明
```
📋 JSDoc 模板與代碼範例：`.claude/rules/general.md`
📋 TypeScript 完整規範：`.claude/rules/typescript.md`
```

#### 1.2 API 設計規範（L378-435，現 57 行）

**現狀**：包含完整 API 路由目錄樹 + 響應格式代碼塊
**對應 rules**：`.claude/rules/api-design.md`

**保留內容**：
- 成功響應格式要點（`{ success, data, meta? }`，3 行文字說明）
- 錯誤響應 RFC 7807 格式要點（`{ type, title, status, detail }`，3 行文字說明）

**刪除內容**：
- API 路由完整目錄樹（25 行）→ 移至 `claudedocs/reference/directory-structure.md`
- 響應格式完整 TypeScript 代碼塊（20 行）→ 已在 `rules/api-design.md` 中

**精簡後**：~15 行 + 引用說明
```
📋 完整 API 設計規範與代碼範例：`.claude/rules/api-design.md`
📋 API 路由目錄結構：`claudedocs/reference/directory-structure.md`
```

#### 1.3 資料庫規範（L439-467，現 28 行）

**現狀**：包含 Prisma Schema 代碼範例
**對應 rules**：`.claude/rules/database.md`

**保留內容**：
- ID 策略要點：「新建模型使用 `@default(uuid())`，舊模型部分使用 `cuid()` 遷移中」
- 遷移命名格式：`YYYYMMDDHHMMSS_描述`

**刪除內容**：
- Prisma Schema 完整代碼範例（15 行）→ 已在 `rules/database.md` 中

**精簡後**：~8 行 + 引用說明
```
📋 完整資料庫規範與 Schema 範例：`.claude/rules/database.md`
```

#### 1.4 組件開發規範（L471-525，現 54 行）

**現狀**：包含組件結構代碼範例 + 狀態管理代碼範例
**對應 rules**：`.claude/rules/components.md`

**保留內容**：
- 狀態管理原則摘要（1-2 行）：「UI 狀態用 Zustand，伺服器狀態用 React Query」

**刪除內容**：
- 組件結構代碼範例（30 行）→ 已在 `rules/components.md` 中
- Zustand/React Query 代碼範例（16 行）→ 已在 `rules/components.md` 中

**精簡後**：~8 行 + 引用說明
```
📋 完整組件開發規範與代碼範例：`.claude/rules/components.md`
```

#### 1.5 測試規範（L529-550，現 21 行）

**現狀**：包含測試目錄結構 + 覆蓋率目標
**對應 rules**：`.claude/rules/testing.md`

**保留內容**：
- 覆蓋率目標（3 行）：單元 80%+、整合 70%+、E2E 關鍵流程

**刪除內容**：
- 測試目錄結構（10 行）→ 已在 `rules/testing.md` 中

**精簡後**：~6 行 + 引用說明
```
📋 完整測試規範與目錄結構：`.claude/rules/testing.md`
```

#### 1.6 i18n 同步規則（L685-738，現 53 行）

**現狀**：包含命名空間列表、常量映射表、同步檢查清單
**對應 rules**：`.claude/rules/i18n.md`

**保留內容**：
- 命名空間完整列表（保留，因為新增命名空間時需要快速比對）
- 核心同步規則（修改 types/constants 時必須同步 i18n）
- 新增模組的 4 步驟要求

**刪除內容**：
- 常量 → i18n 映射表（7 行）→ 已在 `rules/i18n.md` 中
- 完整同步更新檢查清單（8 行）→ 已在 `rules/i18n.md` 中

**精簡後**：~20 行 + 引用說明
```
📋 完整 i18n 規範與檢查清單：`.claude/rules/i18n.md`
```

#### 1.7 技術障礙處理規範（L742-793，現 51 行）

**現狀**：包含禁止行為表 + 完整處理流程 + 詢問模板
**對應 rules**：`.claude/rules/technical-obstacles.md`

**保留內容**：
- 核心原則（1 行）：「遇到技術障礙時，絕不擅自改變設計決策」
- 禁止行為表格（3 行）

**刪除內容**：
- 完整處理流程圖（12 行）→ 已在 `rules/technical-obstacles.md` 中
- 詢問模板（20 行）→ 已在 `rules/technical-obstacles.md` 中

**精簡後**：~10 行 + 引用說明
```
📋 完整處理流程與詢問模板：`.claude/rules/technical-obstacles.md`
```

---

### 2. 移出至新建參考文件（節省 ~3,200 token）

以下內容從 CLAUDE.md 移至 `claudedocs/reference/` 目錄，CLAUDE.md 保留摘要描述 + 引用路徑。

#### 2.1 新建 `claudedocs/reference/directory-structure.md`

**來源**：CLAUDE.md L96-190（完整目錄結構樹，94 行）+ L378-406（API 路由目錄樹）

**文件內容**：
- 項目完整目錄結構樹（含所有子目錄和說明註釋）
- API 路由完整目錄結構（`src/app/api/` 下的所有子目錄）
- Claude Code 基礎設施表格（Agents 8 個 + Skills 4 個 + Rules 9 個的詳細表格）

**CLAUDE.md 保留**：
- 精簡版目錄結構（只保留 src/ 第一層 + 關鍵子目錄，約 25 行）
- 引用路徑

```
📋 完整目錄結構（含 API 路由）：`claudedocs/reference/directory-structure.md`
📋 Agents/Skills/Rules 詳細說明：同上文件
```

#### 2.2 新建 `claudedocs/reference/dev-checklists.md`

**來源**：CLAUDE.md L797-880（開發後文檔更新檢查，83 行）

**文件內容**：
- 文檔更新決策流程（完整的 4 步驟流程圖）
- 各文檔更新時機表格
- 開發完成檢查清單（代碼品質 + 文檔同步 + 測試驗證）
- 自動提醒規則（5 條觸發規則 + 範例）

**CLAUDE.md 保留**：
- 4 步驟摘要（每步一行，共 4 行）
- 引用路徑

```
📋 完整檢查清單與自動提醒規則：`claudedocs/reference/dev-checklists.md`
```

#### 2.3 新建 `claudedocs/reference/project-progress.md`

**來源**：CLAUDE.md L884-928（項目進度追蹤，44 行）+ L947-969（版本更新記錄，22 行）

**文件內容**：
- 22 個 Epic 完整表格（含 Stories 數量、完成日期）
- 重要重構與變更記錄
- 變更管理統計
- CLAUDE.md 版本更新記錄（v1.0.0 ~ v2.6.0 完整 changelog）

**CLAUDE.md 保留**：
- 摘要（2-3 行）：「全部 22 個 Epic（157+ Stories）已完成。進入 Phase 2 功能變更模式，累計 32 CHANGE + 35 FIX」
- 進度唯一真實來源指向：`docs/04-implementation/sprint-status.yaml`
- 引用路徑

```
📋 完整 Epic 進度表與變更記錄：`claudedocs/reference/project-progress.md`
📋 Sprint 狀態追蹤（唯一真實來源）：`docs/04-implementation/sprint-status.yaml`
```

---

### 3. 精簡保留但內容精練的區塊（節省 ~1,200 token）

以下區塊保留在 CLAUDE.md 中，但精簡冗餘的描述。

#### 3.1 目錄結構（L96-190，現 94 行 → 約 30 行）

**保留**：精簡版結構樹，只展示 src/ 第一層 + 關鍵嵌套（app/api、components/features、services/extraction-v3）
**移出**：完整樹狀圖 → `claudedocs/reference/directory-structure.md`

#### 3.2 ClaudeDocs 說明（L218-271，現 53 行 → 約 20 行）

**保留**：目錄用途表（7 行，有清晰的索引價值）+ SITUATION 提示詞表（6 行）
**刪除**：文檔命名約定（12 行）+ 狀態標記表（6 行）→ 這些資訊已在 `claudedocs/CLAUDE.md` 索引文件中存在

#### 3.3 Git 規範（L553-598，現 45 行 → 約 20 行）

**保留**：分支命名規則 + Commit Message 格式 + 類型列表
**刪除**：Commit 範例代碼塊（8 行）→ 格式已足夠清晰，範例是冗餘的
**刪除**：分支演進說明（3 行）→ 簡化為一行備註

#### 3.4 開發工作流（L602-654，現 52 行 → 約 15 行）

**保留**：快速啟動 6 步命令（精簡版）+ 推薦備用端口 + 提交前檢查命令列表
**刪除**：端口佔用處理表格（7 行）→ 已在 `.claude/CLAUDE.md` 中
**刪除**：詳細說明文字 → 引用 `.claude/CLAUDE.md`

#### 3.5 版本資訊（L947-969，現 22 行 → 約 3 行）

**保留**：當前版本號 + 最後更新日期
**移出**：完整 changelog → `claudedocs/reference/project-progress.md`

---

### 4. 完整保留不變的區塊

以下區塊對每次 session 都有高價值，保持原樣不動：

| 區塊 | 行數 | 保留理由 |
|------|------|----------|
| **語言設定** | ~12 行 | 🔴 關鍵行為規則，確保每次都用繁體中文回應 |
| **項目概覽**（使命+目標+三層映射+信心度） | ~45 行 | 核心領域知識，AI 必須理解的業務背景 |
| **技術棧**（4 子區） | ~45 行 | 每次開發都需要知道的技術環境 |
| **代碼規模概覽** | ~10 行 | 快速了解項目規模 |
| **AI 開發輔助指引**（參考文檔+代碼生成規則+禁止事項） | ~23 行 | 關鍵行為約束，防止生成錯誤代碼 |

---

### 5. 新增「文檔索引」區塊

在 CLAUDE.md 末尾新增一個「按需查閱文檔索引」，集中列出所有參考文件路徑：

```markdown
## 按需查閱文檔索引

| 需要了解 | 查閱路徑 |
|----------|----------|
| 完整目錄結構與 API 路由 | `claudedocs/reference/directory-structure.md` |
| 開發後檢查清單與提醒規則 | `claudedocs/reference/dev-checklists.md` |
| 項目進度表與版本記錄 | `claudedocs/reference/project-progress.md` |
| ClaudeDocs 完整索引 | `claudedocs/CLAUDE.md` |
| 服務啟動與問題排解 | `.claude/CLAUDE.md` |
| Sprint 狀態（唯一真實來源） | `docs/04-implementation/sprint-status.yaml` |
| JSDoc 模板與代碼範例 | `.claude/rules/general.md` |
| TypeScript 完整規範 | `.claude/rules/typescript.md` |
| 服務層規範 | `.claude/rules/services.md` |
| API 設計規範 | `.claude/rules/api-design.md` |
| 組件開發規範 | `.claude/rules/components.md` |
| 資料庫規範 | `.claude/rules/database.md` |
| 測試規範 | `.claude/rules/testing.md` |
| i18n 完整規範 | `.claude/rules/i18n.md` |
| 技術障礙處理流程 | `.claude/rules/technical-obstacles.md` |
| PRD | `docs/01-planning/prd/prd.md` |
| 系統架構設計 | `docs/02-architecture/` |
| Tech Specs | `docs/03-stories/tech-specs/` |
| 實施上下文 | `docs/04-implementation/implementation-context.md` |
```

---

## 新建文件清單

### 文件 1：`claudedocs/reference/directory-structure.md`

| 項目 | 說明 |
|------|------|
| **來源** | CLAUDE.md L96-190 + L192-214 + L378-406 |
| **內容** | 完整目錄結構樹、API 路由結構、Agents/Skills/Rules 詳細表格 |
| **大小** | 約 150 行 |
| **查閱時機** | 需要了解文件位置、新增文件、建立新模組時 |

### 文件 2：`claudedocs/reference/dev-checklists.md`

| 項目 | 說明 |
|------|------|
| **來源** | CLAUDE.md L797-880 |
| **內容** | 文檔更新決策流程、完成檢查清單、各文檔更新時機、自動提醒規則、更新範例 |
| **大小** | 約 90 行 |
| **查閱時機** | 完成開發任務後執行質量檢查時 |

### 文件 3：`claudedocs/reference/project-progress.md`

| 項目 | 說明 |
|------|------|
| **來源** | CLAUDE.md L884-928 + L947-969 |
| **內容** | 22 Epic 完整表格、重構與變更記錄、變更管理統計、CLAUDE.md 版本更新記錄 |
| **大小** | 約 80 行 |
| **查閱時機** | 需要了解項目歷史、查看 Epic 完成狀態、追溯變更記錄時 |

---

## 精簡後 CLAUDE.md 預估結構

```
行數    區塊
------  ----------------------------------------
1-3     # 標題 + 說明
4-15    ## 語言設定（🔴 必須遵守）               ← 完整保留
16-60   ## 項目概覽                               ← 完整保留
61-105  ## 技術棧                                 ← 完整保留
106-135 ## 目錄結構                               ← 精簡版 + 引用
136-160 ## ClaudeDocs - AI 助手文檔目錄           ← 精簡版 + 引用
161-185 ## 代碼規範（摘要）                       ← 保留表格 + 引用
186-200 ## API 設計規範（摘要）                   ← 保留要點 + 引用
201-208 ## 資料庫規範（摘要）                     ← 保留要點 + 引用
209-216 ## 組件與狀態管理（摘要）                 ← 保留要點 + 引用
217-222 ## 測試規範（摘要）                       ← 保留目標 + 引用
223-242 ## Git 規範                               ← 精簡版
243-257 ## 開發工作流                             ← 精簡版 + 引用
258-280 ## AI 開發輔助指引                        ← 完整保留
281-300 ## i18n 同步規則（🔴 必須遵守）           ← 精簡版 + 引用
301-310 ## 技術障礙處理（🔴 必須遵守）            ← 核心原則 + 引用
311-318 ## 開發後文檔更新檢查                     ← 摘要 + 引用
319-325 ## 項目進度追蹤                           ← 摘要 + 引用
326-345 ## 按需查閱文檔索引                       ← 新增
346-350 ## 版本資訊                               ← 僅版本號
------  ----------------------------------------
總計     ~350 行
```

---

## Token 預估

| 指標 | 現狀 | 精簡後 | 變化 |
|------|------|--------|------|
| 總行數 | 970 行 | ~350 行 | -64% |
| 估算 Token | ~13,400 | ~5,200 | -61% |
| 與 rules/ 重複 | ~4,300 | 0 | -100% |
| 每次 Session 固定開銷 | 13.4k | 5.2k | **節省 8.2k token** |

---

## 實施計劃（分 3 階段）

### 階段 1：建立新的參考文件（零風險）

1. 建立 `claudedocs/reference/` 目錄
2. 建立 `claudedocs/reference/directory-structure.md` — 從 CLAUDE.md 搬出完整目錄結構 + API 路由 + Agents/Skills 表格
3. 建立 `claudedocs/reference/dev-checklists.md` — 從 CLAUDE.md 搬出開發後檢查流程
4. 建立 `claudedocs/reference/project-progress.md` — 從 CLAUDE.md 搬出 Epic 進度表 + 版本記錄

### 階段 2：改寫 CLAUDE.md（主要變更）

1. 移動語言設定至文件開頭（提高可見度）
2. 保留項目概覽 + 技術棧區塊（不動）
3. 精簡目錄結構為 ~30 行版本 + 引用
4. 精簡 ClaudeDocs 說明 + 引用
5. 將 7 個重複區塊替換為「摘要 + 引用」格式
6. 精簡 Git 規範、開發工作流
7. 保留 AI 開發輔助指引（不動）
8. 精簡 i18n、技術障礙為「核心規則 + 引用」
9. 將進度追蹤、版本記錄替換為摘要 + 引用
10. 新增「按需查閱文檔索引」

### 階段 3：驗證（確保無資訊遺失）

1. 逐一比對原 CLAUDE.md 每個區塊，確認在新結構中都有對應歸宿
2. 確認所有引用路徑正確
3. 確認 `claudedocs/CLAUDE.md` 索引文件不需同步更新（如需要則更新）

---

## 風險評估

| 風險 | 可能性 | 影響 | 緩解措施 |
|------|--------|------|---------|
| 精簡過度導致 AI 遺漏重要規範 | 低 | 🟡 可能生成不合規代碼 | 每個區塊保留關鍵原則 + 引用路徑 |
| AI 不主動查閱引用文件 | 中 | 🟡 忽略詳細規範 | 在「按需查閱文檔索引」明確列出查閱時機 |
| 新建參考文件與既有文件不一致 | 低 | 🟢 資訊混淆 | 從 CLAUDE.md 原文直接搬遷，不改寫內容 |
| `claudedocs/CLAUDE.md` 索引需同步更新 | 高 | 🟢 索引不完整 | 階段 3 檢查並更新 |

### 回滾計劃

所有變更均為文檔修改，可通過 `git checkout` 完全回滾。建議在實施前建立 commit 作為恢復點。

---

## 設計決策

### 決策 1：保留命名規範表格而非移至 rules/

**理由**：命名規範（kebab-case/PascalCase/camelCase 表格）是高頻參考資料，幾乎每次寫代碼都需要快速查看。保留在 CLAUDE.md 中避免額外的文件讀取。

### 決策 2：保留 i18n 命名空間完整列表

**理由**：30 個命名空間的列表在新增/修改功能時需要快速比對是否已有命名空間。這是防止 `IntlError: MISSING_MESSAGE` 的關鍵資訊。

### 決策 3：Agents/Skills 表格改為引用

**理由**：這些資訊已存在於 `MEMORY.md`（每次自動載入）和 `.claude/agents/`、`.claude/skills/` 目錄中。在 CLAUDE.md 中屬於三重重複。

### 決策 4：語言設定移至文件最前

**理由**：語言設定是 🔴 最高優先級規則，移至文件開頭確保 AI 在讀取任何其他內容前就知道必須用繁體中文回應。

### 決策 5：每個精簡區塊使用統一的引用格式

**格式**：`📋 完整規範：\`.claude/rules/xxx.md\``
**理由**：統一的視覺格式讓 AI 容易辨識「這裡有更多細節可以查閱」，不會忽略引用。

### 決策 6：新建 `claudedocs/reference/` 而非放入既有目錄

**理由**：
- `claudedocs/` 下已有 7 個分類目錄（1-planning ~ 7-archive）
- 這些搬遷的內容不屬於任何既有分類
- `reference/` 名稱清楚表達「參考資料」的定位

---

## 驗收標準

| # | 驗收項目 | 驗收標準 | 優先級 |
|---|----------|----------|--------|
| 1 | CLAUDE.md 行數 | ≤ 400 行 | High |
| 2 | Token 估算 | ≤ 5,500 token | High |
| 3 | 零資訊遺失 | 原 CLAUDE.md 每個區塊都有對應歸宿 | High |
| 4 | 引用路徑正確 | 所有 📋 引用路徑指向實際存在的文件 | High |
| 5 | 參考文件完整 | 3 個新建文件內容與原 CLAUDE.md 搬出內容一致 | High |
| 6 | 關鍵規則保留 | 語言設定、禁止事項、核心架構等在 CLAUDE.md 中完整保留 | High |
| 7 | 摘要可讀性 | 每個精簡區塊的摘要足以理解關鍵概念（不需查閱完整文件即可基本工作） | Medium |
| 8 | 索引表完整 | 「按需查閱文檔索引」涵蓋所有被移出的內容 | Medium |
| 9 | claudedocs/CLAUDE.md 同步 | 索引文件更新以包含 reference/ 目錄 | Medium |

---

## 影響範圍

### 文件影響清單

| 文件路徑 | 類型 | 說明 |
|----------|------|------|
| `CLAUDE.md`（根目錄） | 🔧 大幅改寫 | 970 行 → ~350 行 |
| `claudedocs/reference/directory-structure.md` | ✨ 新建 | 完整目錄結構 + API 路由 + 基礎設施表格 |
| `claudedocs/reference/dev-checklists.md` | ✨ 新建 | 開發後檢查流程 |
| `claudedocs/reference/project-progress.md` | ✨ 新建 | Epic 進度表 + 版本記錄 |
| `claudedocs/CLAUDE.md` | 🔧 小幅更新 | 新增 reference/ 目錄的索引條目 |

**總計：5 個文件**（1 個改寫 + 3 個新建 + 1 個小幅更新）

### 向後兼容性

- **Claude Code 行為**：精簡後 AI 仍能獲得所有關鍵資訊，只是需要按需查閱詳細規範
- **rules/ 文件**：不受影響，保持不變
- **現有工作流**：所有 SITUATION 提示詞、Skills、Agents 不受影響

---

## 版本資訊

- **文件編號**: CHANGE-033
- **建立日期**: 2026-02-09
- **建立者**: AI 助手 + 用戶協作
