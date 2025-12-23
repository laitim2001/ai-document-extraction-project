# 全部 Story 開發提示 (方式一：簡短版)

本文檔包含所有 Story 的簡短版開發提示。使用時直接複製對應 Story 的內容貼到 AI 助手對話中。

---

## Epic 00: 歷史數據初始化

> **說明**：此 Epic 在系統正式運營前執行，用於處理歷史發票文件並建立初始映射規則。

### Story 0-1: 批量文件上傳與元數據檢測

```
# 開發任務：Story 0-1 批量文件上傳與元數據檢測

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/0-1-batch-file-upload-metadata-detection.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md
- docs/03-epics/sections/epic-0-historical-data-initialization.md

## 開發要求
1. 嚴格遵循 Story 文件中的 Tasks 和 Dev Notes
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/0-1-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 0-2: 智能處理路由

```
# 開發任務：Story 0-2 智能處理路由

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/0-2-intelligent-processing-routing.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md
- docs/03-epics/sections/epic-0-historical-data-initialization.md

## 開發要求
1. 嚴格遵循 Story 文件中的 Tasks 和 Dev Notes
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件：Status 改為 `done`，Tasks 打勾 `[x]`

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 0-3: 即時公司 Profile 建立

```
# 開發任務：Story 0-3 即時公司 Profile 建立（Just-in-Time）

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/0-3-just-in-time-company-profile.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/03-epics/sections/epic-0-historical-data-initialization.md
- claudedocs/4-changes/refactors/REFACTOR-001-forwarder-to-company.md (如存在)

## 開發要求
1. 嚴格遵循 Story 文件中的 Tasks 和 Dev Notes
2. **注意**：此 Story 涉及 Company 模型，需要與 REFACTOR-001 協調
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`
- [ ] 更新 Story 文件

### 3. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 0-4: 批量處理進度追蹤

```
# 開發任務：Story 0-4 批量處理進度追蹤

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/0-4-batch-processing-progress-tracking.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/03-epics/sections/epic-0-historical-data-initialization.md

## 開發要求
1. 嚴格遵循 Story 文件中的 Tasks 和 Dev Notes
2. 實現即時更新機制（推薦 SSE）
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`
- [ ] 更新 Story 文件

### 3. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 0-5: 術語聚合與初始規則建立

```
# 開發任務：Story 0-5 術語聚合與初始規則建立

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/0-5-term-aggregation-initial-rules.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/03-epics/sections/epic-0-historical-data-initialization.md
- docs/04-implementation/stories/4-1-mapping-rule-list-view.md (規則模型參考)

## 開發要求
1. 嚴格遵循 Story 文件中的 Tasks 和 Dev Notes
2. GPT-4o 分類需注意 token 限制，使用批量處理
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`
- [ ] 更新 Story 文件

### 3. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

## Epic 01: 用戶認證與權限管理

### Story 1-0: 專案初始化

```
# 開發任務：Story 1-0 專案初始化

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/1-0-project-init-foundation.md
3. docs/04-implementation/tech-specs/epic-01-auth/tech-spec-story-1-0.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 1-1: Azure AD SSO 登入

```
# 開發任務：Story 1-1 Azure AD SSO 登入

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/1-1-azure-ad-sso-login.md
3. docs/04-implementation/tech-specs/epic-01-auth/tech-spec-story-1-1.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 1-2: 用戶資料庫與角色基礎

```
# 開發任務：Story 1-2 用戶資料庫與角色基礎

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/1-2-user-database-role-foundation.md
3. docs/04-implementation/tech-specs/epic-01-auth/tech-spec-story-1-2.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 1-3: 用戶列表與搜尋

```
# 開發任務：Story 1-3 用戶列表與搜尋

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/1-3-user-list-search.md
3. docs/04-implementation/tech-specs/epic-01-auth/tech-spec-story-1-3.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 1-4: 新增用戶與角色分配

```
# 開發任務：Story 1-4 新增用戶與角色分配

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/1-4-add-user-role-assignment.md
3. docs/04-implementation/tech-specs/epic-01-auth/tech-spec-story-1-4.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 1-5: 修改用戶角色與城市

```
# 開發任務：Story 1-5 修改用戶角色與城市

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/1-5-modify-user-role-city.md
3. docs/04-implementation/tech-specs/epic-01-auth/tech-spec-story-1-5.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 1-6: 停用/啟用用戶帳號

```
# 開發任務：Story 1-6 停用/啟用用戶帳號

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/1-6-disable-enable-user-account.md
3. docs/04-implementation/tech-specs/epic-01-auth/tech-spec-story-1-6.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 1-7: 自訂角色管理

```
# 開發任務：Story 1-7 自訂角色管理

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/1-7-custom-role-management.md
3. docs/04-implementation/tech-specs/epic-01-auth/tech-spec-story-1-7.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 1-8: 城市管理員用戶管理

```
# 開發任務：Story 1-8 城市管理員用戶管理

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/1-8-city-manager-user-management.md
3. docs/04-implementation/tech-specs/epic-01-auth/tech-spec-story-1-8.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

## Epic 02: 文件上傳與 AI 處理

### Story 2-1: 文件上傳介面與驗證

```
# 開發任務：Story 2-1 文件上傳介面與驗證

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/2-1-file-upload-interface-validation.md
3. docs/04-implementation/tech-specs/epic-02-ai-processing/tech-spec-story-2-1.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 2-2: 文件 OCR 擷取服務

```
# 開發任務：Story 2-2 文件 OCR 擷取服務

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/2-2-file-ocr-extraction-service.md
3. docs/04-implementation/tech-specs/epic-02-ai-processing/tech-spec-story-2-2.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 2-3: 貨代商自動識別

```
# 開發任務：Story 2-3 貨代商自動識別

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/2-3-forwarder-auto-identification.md
3. docs/04-implementation/tech-specs/epic-02-ai-processing/tech-spec-story-2-3.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 2-4: 欄位映射擷取

```
# 開發任務：Story 2-4 欄位映射擷取

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/2-4-field-mapping-extraction.md
3. docs/04-implementation/tech-specs/epic-02-ai-processing/tech-spec-story-2-4.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 2-5: 信心分數計算

```
# 開發任務：Story 2-5 信心分數計算

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/2-5-confidence-score-calculation.md
3. docs/04-implementation/tech-specs/epic-02-ai-processing/tech-spec-story-2-5.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 2-6: 處理路徑自動路由

```
# 開發任務：Story 2-6 處理路徑自動路由

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/2-6-processing-path-auto-routing.md
3. docs/04-implementation/tech-specs/epic-02-ai-processing/tech-spec-story-2-6.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 2-7: 處理狀態追蹤顯示

```
# 開發任務：Story 2-7 處理狀態追蹤顯示

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/2-7-processing-status-tracking-display.md
3. docs/04-implementation/tech-specs/epic-02-ai-processing/tech-spec-story-2-7.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

## Epic 03: 人工審核工作流程

### Story 3-1: 待審核發票列表

```
# 開發任務：Story 3-1 待審核發票列表

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/3-1-pending-review-invoice-list.md
3. docs/04-implementation/tech-specs/epic-03-review-workflow/tech-spec-story-3-1.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 3-2: 並排 PDF 審核介面

```
# 開發任務：Story 3-2 並排 PDF 審核介面

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/3-2-side-by-side-pdf-review-interface.md
3. docs/04-implementation/tech-specs/epic-03-review-workflow/tech-spec-story-3-2.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 3-3: 信心度顏色編碼顯示

```
# 開發任務：Story 3-3 信心度顏色編碼顯示

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/3-3-confidence-color-coding-display.md
3. docs/04-implementation/tech-specs/epic-03-review-workflow/tech-spec-story-3-3.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 3-4: 確認擷取結果

```
# 開發任務：Story 3-4 確認擷取結果

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/3-4-confirm-extraction-result.md
3. docs/04-implementation/tech-specs/epic-03-review-workflow/tech-spec-story-3-4.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 3-5: 修正擷取結果

```
# 開發任務：Story 3-5 修正擷取結果

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/3-5-correct-extraction-result.md
3. docs/04-implementation/tech-specs/epic-03-review-workflow/tech-spec-story-3-5.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 3-6: 修正類型標記

```
# 開發任務：Story 3-6 修正類型標記

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/3-6-correction-type-marking.md
3. docs/04-implementation/tech-specs/epic-03-review-workflow/tech-spec-story-3-6.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 3-7: 升級複雜案例

```
# 開發任務：Story 3-7 升級複雜案例

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/3-7-escalate-complex-cases.md
3. docs/04-implementation/tech-specs/epic-03-review-workflow/tech-spec-story-3-7.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 3-8: Super User 處理升級案例

```
# 開發任務：Story 3-8 Super User 處理升級案例

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/3-8-super-user-handle-escalated-cases.md
3. docs/04-implementation/tech-specs/epic-03-review-workflow/tech-spec-story-3-8.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

## Epic 04: 映射規則管理

### Story 4-1: 映射規則列表檢視

```
# 開發任務：Story 4-1 映射規則列表檢視

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/4-1-mapping-rule-list-view.md
3. docs/04-implementation/tech-specs/epic-04-mapping-rules/tech-spec-story-4-1.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 4-2: 建議新映射規則

```
# 開發任務：Story 4-2 建議新映射規則

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/4-2-suggest-new-mapping-rule.md
3. docs/04-implementation/tech-specs/epic-04-mapping-rules/tech-spec-story-4-2.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 4-3: 修正模式記錄分析

```
# 開發任務：Story 4-3 修正模式記錄分析

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/4-3-correction-pattern-recording-analysis.md
3. docs/04-implementation/tech-specs/epic-04-mapping-rules/tech-spec-story-4-3.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 4-4: 規則升級建議生成

```
# 開發任務：Story 4-4 規則升級建議生成

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/4-4-rule-upgrade-suggestion-generation.md
3. docs/04-implementation/tech-specs/epic-04-mapping-rules/tech-spec-story-4-4.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 4-5: 規則影響範圍分析

```
# 開發任務：Story 4-5 規則影響範圍分析

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/4-5-rule-impact-scope-analysis.md
3. docs/04-implementation/tech-specs/epic-04-mapping-rules/tech-spec-story-4-5.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 4-6: 審核學習規則

```
# 開發任務：Story 4-6 審核學習規則

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/4-6-review-learning-rule.md
3. docs/04-implementation/tech-specs/epic-04-mapping-rules/tech-spec-story-4-6.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 4-7: 規則版本歷史管理

```
# 開發任務：Story 4-7 規則版本歷史管理

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/4-7-rule-version-history-management.md
3. docs/04-implementation/tech-specs/epic-04-mapping-rules/tech-spec-story-4-7.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 4-8: 規則自動回滾

```
# 開發任務：Story 4-8 規則自動回滾

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/4-8-rule-auto-rollback.md
3. docs/04-implementation/tech-specs/epic-04-mapping-rules/tech-spec-story-4-8.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

## Epic 05: 貨代商設定管理

### Story 5-1: 貨代商配置檔列表

```
# 開發任務：Story 5-1 貨代商配置檔列表

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/5-1-forwarder-profile-list.md
3. docs/04-implementation/tech-specs/epic-05-forwarder-config/tech-spec-story-5-1.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 5-2: 貨代商詳細設定檢視

```
# 開發任務：Story 5-2 貨代商詳細設定檢視

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/5-2-forwarder-detail-config-view.md
3. docs/04-implementation/tech-specs/epic-05-forwarder-config/tech-spec-story-5-2.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 5-3: 編輯貨代商映射規則

```
# 開發任務：Story 5-3 編輯貨代商映射規則

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/5-3-edit-forwarder-mapping-rules.md
3. docs/04-implementation/tech-specs/epic-05-forwarder-config/tech-spec-story-5-3.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 5-4: 測試規則變更效果

```
# 開發任務：Story 5-4 測試規則變更效果

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/5-4-test-rule-change-effect.md
3. docs/04-implementation/tech-specs/epic-05-forwarder-config/tech-spec-story-5-4.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 5-5: 新增/停用貨代商配置

```
# 開發任務：Story 5-5 新增/停用貨代商配置

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/5-5-add-disable-forwarder-profile.md
3. docs/04-implementation/tech-specs/epic-05-forwarder-config/tech-spec-story-5-5.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

## Epic 06: 多城市資料隔離

### Story 6-1: 城市資料模型與 RLS 設定

```
# 開發任務：Story 6-1 城市資料模型與 RLS 設定

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/6-1-city-data-model-rls-config.md
3. docs/04-implementation/tech-specs/epic-06-multi-city/tech-spec-story-6-1.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 6-2: 城市用戶資料存取控制

```
# 開發任務：Story 6-2 城市用戶資料存取控制

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/6-2-city-user-data-access-control.md
3. docs/04-implementation/tech-specs/epic-06-multi-city/tech-spec-story-6-2.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 6-3: 區域經理跨城市存取

```
# 開發任務：Story 6-3 區域經理跨城市存取

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/6-3-regional-manager-cross-city-access.md
3. docs/04-implementation/tech-specs/epic-06-multi-city/tech-spec-story-6-3.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 6-4: Global Admin 完整存取

```
# 開發任務：Story 6-4 Global Admin 完整存取

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/6-4-global-admin-full-access.md
3. docs/04-implementation/tech-specs/epic-06-multi-city/tech-spec-story-6-4.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 6-5: 全域規則共享機制

```
# 開發任務：Story 6-5 全域規則共享機制

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/6-5-global-rule-sharing-mechanism.md
3. docs/04-implementation/tech-specs/epic-06-multi-city/tech-spec-story-6-5.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

## Epic 07: 報表與儀表板

### Story 7-1: 處理統計儀表板

```
# 開發任務：Story 7-1 處理統計儀表板

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/7-1-processing-statistics-dashboard.md
3. docs/04-implementation/tech-specs/epic-07-reports-dashboard/tech-spec-story-7-1.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 7-2: 時間範圍篩選器

```
# 開發任務：Story 7-2 時間範圍篩選器

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/7-2-time-range-filter.md
3. docs/04-implementation/tech-specs/epic-07-reports-dashboard/tech-spec-story-7-2.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 7-3: 貨代商篩選器

```
# 開發任務：Story 7-3 貨代商篩選器

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/7-3-forwarder-filter.md
3. docs/04-implementation/tech-specs/epic-07-reports-dashboard/tech-spec-story-7-3.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 7-4: 費用明細報表匯出

```
# 開發任務：Story 7-4 費用明細報表匯出

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/7-4-expense-detail-report-export.md
3. docs/04-implementation/tech-specs/epic-07-reports-dashboard/tech-spec-story-7-4.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 7-5: 跨城市匯總報表

```
# 開發任務：Story 7-5 跨城市匯總報表

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/7-5-cross-city-summary-report.md
3. docs/04-implementation/tech-specs/epic-07-reports-dashboard/tech-spec-story-7-5.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 7-6: AI API 使用成本顯示

```
# 開發任務：Story 7-6 AI API 使用成本顯示

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/7-6-ai-api-usage-cost-display.md
3. docs/04-implementation/tech-specs/epic-07-reports-dashboard/tech-spec-story-7-6.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 7-7: 城市處理量追蹤

```
# 開發任務：Story 7-7 城市處理量追蹤

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/7-7-city-processing-volume-tracking.md
3. docs/04-implementation/tech-specs/epic-07-reports-dashboard/tech-spec-story-7-7.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 7-8: 城市 AI 成本追蹤

```
# 開發任務：Story 7-8 城市 AI 成本追蹤

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/7-8-city-ai-cost-tracking.md
3. docs/04-implementation/tech-specs/epic-07-reports-dashboard/tech-spec-story-7-8.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 7-9: 城市成本報表

```
# 開發任務：Story 7-9 城市成本報表

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/7-9-city-cost-report.md
3. docs/04-implementation/tech-specs/epic-07-reports-dashboard/tech-spec-story-7-9.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 7-10: 月度成本分攤報表

```
# 開發任務：Story 7-10 月度成本分攤報表

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/7-10-monthly-cost-allocation-report.md
3. docs/04-implementation/tech-specs/epic-07-reports-dashboard/tech-spec-story-7-10.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

## Epic 08: 稽核與合規

### Story 8-1: 用戶操作日誌記錄

```
# 開發任務：Story 8-1 用戶操作日誌記錄

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/8-1-user-operation-log-recording.md
3. docs/04-implementation/tech-specs/epic-08-audit-compliance/tech-spec-story-8-1.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 8-2: 資料變更追蹤

```
# 開發任務：Story 8-2 資料變更追蹤

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/8-2-data-change-tracking.md
3. docs/04-implementation/tech-specs/epic-08-audit-compliance/tech-spec-story-8-2.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 8-3: 處理記錄查詢

```
# 開發任務：Story 8-3 處理記錄查詢

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/8-3-processing-record-query.md
3. docs/04-implementation/tech-specs/epic-08-audit-compliance/tech-spec-story-8-3.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 8-4: 原始文件追溯

```
# 開發任務：Story 8-4 原始文件追溯

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/8-4-original-file-traceability.md
3. docs/04-implementation/tech-specs/epic-08-audit-compliance/tech-spec-story-8-4.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 8-5: 稽核報表匯出

```
# 開發任務：Story 8-5 稽核報表匯出

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/8-5-audit-report-export.md
3. docs/04-implementation/tech-specs/epic-08-audit-compliance/tech-spec-story-8-5.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 8-6: 長期資料保留

```
# 開發任務：Story 8-6 長期資料保留

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/8-6-long-term-data-retention.md
3. docs/04-implementation/tech-specs/epic-08-audit-compliance/tech-spec-story-8-6.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

## Epic 09: 自動化檔案擷取

### Story 9-1: SharePoint 文件監控 API

```
# 開發任務：Story 9-1 SharePoint 文件監控 API

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/9-1-sharepoint-file-monitoring-api.md
3. docs/04-implementation/tech-specs/epic-09-auto-retrieval/tech-spec-story-9-1.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 9-2: SharePoint 連線設定

```
# 開發任務：Story 9-2 SharePoint 連線設定

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/9-2-sharepoint-connection-config.md
3. docs/04-implementation/tech-specs/epic-09-auto-retrieval/tech-spec-story-9-2.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 9-3: Outlook 郵件附件擷取 API

```
# 開發任務：Story 9-3 Outlook 郵件附件擷取 API

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/9-3-outlook-mail-attachment-extraction-api.md
3. docs/04-implementation/tech-specs/epic-09-auto-retrieval/tech-spec-story-9-3.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 9-4: Outlook 連線設定

```
# 開發任務：Story 9-4 Outlook 連線設定

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/9-4-outlook-connection-config.md
3. docs/04-implementation/tech-specs/epic-09-auto-retrieval/tech-spec-story-9-4.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 9-5: 自動擷取來源追蹤

```
# 開發任務：Story 9-5 自動擷取來源追蹤

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/9-5-auto-retrieval-source-tracking.md
3. docs/04-implementation/tech-specs/epic-09-auto-retrieval/tech-spec-story-9-5.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

## Epic 10: n8n 工作流程整合

### Story 10-1: n8n 雙向通訊 API

```
# 開發任務：Story 10-1 n8n 雙向通訊 API

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/10-1-n8n-bidirectional-communication-api.md
3. docs/04-implementation/tech-specs/epic-10-n8n-integration/tech-spec-story-10-1.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 10-2: Webhook 設定管理

```
# 開發任務：Story 10-2 Webhook 設定管理

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/10-2-webhook-config-management.md
3. docs/04-implementation/tech-specs/epic-10-n8n-integration/tech-spec-story-10-2.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 10-3: 工作流程執行狀態檢視

```
# 開發任務：Story 10-3 工作流程執行狀態檢視

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/10-3-workflow-execution-status-view.md
3. docs/04-implementation/tech-specs/epic-10-n8n-integration/tech-spec-story-10-3.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 10-4: 手動觸發工作流程

```
# 開發任務：Story 10-4 手動觸發工作流程

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/10-4-manual-trigger-workflow.md
3. docs/04-implementation/tech-specs/epic-10-n8n-integration/tech-spec-story-10-4.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 10-5: 工作流程錯誤詳情檢視

```
# 開發任務：Story 10-5 工作流程錯誤詳情檢視

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/10-5-workflow-error-detail-view.md
3. docs/04-implementation/tech-specs/epic-10-n8n-integration/tech-spec-story-10-5.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 10-6: 文件處理進度追蹤

```
# 開發任務：Story 10-6 文件處理進度追蹤

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/10-6-document-processing-progress-tracking.md
3. docs/04-implementation/tech-specs/epic-10-n8n-integration/tech-spec-story-10-6.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 10-7: n8n 連線狀態監控

```
# 開發任務：Story 10-7 n8n 連線狀態監控

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/10-7-n8n-connection-status-monitoring.md
3. docs/04-implementation/tech-specs/epic-10-n8n-integration/tech-spec-story-10-7.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

## Epic 11: 外部 API 服務

### Story 11-1: API 發票提交端點

```
# 開發任務：Story 11-1 API 發票提交端點

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/11-1-api-invoice-submission-endpoint.md
3. docs/04-implementation/tech-specs/epic-11-external-api/tech-spec-story-11-1.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 11-2: API 處理狀態查詢端點

```
# 開發任務：Story 11-2 API 處理狀態查詢端點

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/11-2-api-processing-status-query-endpoint.md
3. docs/04-implementation/tech-specs/epic-11-external-api/tech-spec-story-11-2.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 11-3: API 處理結果擷取端點

```
# 開發任務：Story 11-3 API 處理結果擷取端點

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/11-3-api-processing-result-retrieval-endpoint.md
3. docs/04-implementation/tech-specs/epic-11-external-api/tech-spec-story-11-3.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 11-4: Webhook 通知服務

```
# 開發任務：Story 11-4 Webhook 通知服務

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/11-4-webhook-notification-service.md
3. docs/04-implementation/tech-specs/epic-11-external-api/tech-spec-story-11-4.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 11-5: API 存取控制與認證

```
# 開發任務：Story 11-5 API 存取控制與認證

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/11-5-api-access-control-authentication.md
3. docs/04-implementation/tech-specs/epic-11-external-api/tech-spec-story-11-5.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 11-6: API 文件與開發者支援

```
# 開發任務：Story 11-6 API 文件與開發者支援

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/11-6-api-documentation-developer-support.md
3. docs/04-implementation/tech-specs/epic-11-external-api/tech-spec-story-11-6.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

## Epic 12: 系統管理與監控

### Story 12-1: 系統健康監控儀表板

```
# 開發任務：Story 12-1 系統健康監控儀表板

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/12-1-system-health-monitoring-dashboard.md
3. docs/04-implementation/tech-specs/epic-12-system-admin/tech-spec-story-12-1.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 12-2: 效能指標追蹤

```
# 開發任務：Story 12-2 效能指標追蹤

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/12-2-performance-metrics-tracking.md
3. docs/04-implementation/tech-specs/epic-12-system-admin/tech-spec-story-12-2.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 12-3: 錯誤警報設定

```
# 開發任務：Story 12-3 錯誤警報設定

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/12-3-error-alert-configuration.md
3. docs/04-implementation/tech-specs/epic-12-system-admin/tech-spec-story-12-3.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 12-4: 系統設定管理

```
# 開發任務：Story 12-4 系統設定管理

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/12-4-system-configuration-management.md
3. docs/04-implementation/tech-specs/epic-12-system-admin/tech-spec-story-12-4.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 12-5: 資料備份管理

```
# 開發任務：Story 12-5 資料備份管理

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/12-5-data-backup-management.md
3. docs/04-implementation/tech-specs/epic-12-system-admin/tech-spec-story-12-5.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 12-6: 資料復原功能

```
# 開發任務：Story 12-6 資料復原功能

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/12-6-data-recovery-functionality.md
3. docs/04-implementation/tech-specs/epic-12-system-admin/tech-spec-story-12-6.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

### Story 12-7: 系統日誌查詢

```
# 開發任務：Story 12-7 系統日誌查詢

## 必讀文件 (請依序閱讀)
1. docs/04-implementation/implementation-context.md
2. docs/04-implementation/stories/12-7-system-log-query.md
3. docs/04-implementation/tech-specs/epic-12-system-admin/tech-spec-story-12-7.md

## 參考文件 (開發時查閱)
- docs/04-implementation/dev-checklist.md
- docs/04-implementation/component-registry.md
- docs/04-implementation/api-registry.md

## 開發要求
1. 嚴格遵循 Tech Spec 的架構設計
2. 使用 dev-checklist.md 作為品質檢查標準
3. 新增的元件需更新 component-registry.md
4. 新增的 API 需更新 api-registry.md
5. 重要發現記錄到 lessons-learned.md
6. **🚨 技術障礙處理**：遇到技術障礙時**絕不擅自改變設計**，必須先詢問用戶（詳見 .claude/rules/technical-obstacles.md）

請開始實作此 Story。

---

## 🚨 強制完成檢查（不可跳過）

> ⚠️ **重要**: 以下所有項目完成前，Story 不視為完成。Context 中斷時，新 session 必須優先完成這些步驟。

### 1. 代碼品質驗證
- [ ] 執行 `npm run type-check` 並確認通過
- [ ] 執行 `npm run lint` 並確認通過

### 2. 狀態文檔更新（必須執行）
- [ ] 更新 `docs/04-implementation/sprint-status.yaml`：將此 Story 狀態改為 `done`
- [ ] 更新 Story 文件 (`docs/04-implementation/stories/X-X-*.md`)：
  - Status 改為 `done`
  - 所有 Tasks 打勾 `[x]`
  - 添加 Implementation Notes

### 3. 附加文檔（如適用）
- [ ] 如有新模組 → 更新/建立對應 index.ts
- [ ] 如有架構變更 → 更新 CLAUDE.md
- [ ] 如發現踩坑經驗 → 更新 .claude/rules/

### 4. Git 提交
- [ ] Git commit 並 push

**⛔ 未完成以上所有步驟，禁止回報 Story 完成。**
```

---

## 使用說明

### 如何使用這些提示

1. **複製對應 Story 的程式碼區塊內容** (包含在 ``` 之間的文字)
2. **開啟新的 AI 助手對話**
3. **貼上提示內容**
4. **等待 AI 助手閱讀文件後開始實作**

### 開發流程建議

1. **依序開發**: 建議按照 Epic 和 Story 編號順序開發
2. **完成驗證**: 每個 Story 完成後使用 dev-checklist.md 進行品質檢查
3. **更新記錄**: 及時更新 component-registry.md、api-registry.md 和 lessons-learned.md
4. **版本控制**: 每個 Story 完成後進行 git commit

### Story 依賴關係提醒

- **Epic 01**: Story 1-0 必須最先完成 (專案基礎架構)
- **Epic 02**: 依賴 Epic 01 的認證基礎
- **Epic 03**: 依賴 Epic 02 的處理結果
- **Epic 06**: 多城市功能可能需要回頭調整早期 Story
