# 開發後文檔更新檢查

> **來源**: 從 `CLAUDE.md` v2.6.0 搬遷（CHANGE-033）
> **查閱時機**: 完成開發任務後執行質量檢查時

---

## 文檔更新決策流程

每次完成開發任務後，AI 助手必須執行以下檢查流程，確保項目文檔保持最新狀態。

```
開發任務完成後，依序檢查：

1. 是否完成 CHANGE-XXX 或 FIX-XXX？（🔴 必須）
   └─ 是 → 將規劃文件的「狀態」從 📋 規劃中 改為 ✅ 已完成
   └─ 路徑: claudedocs/4-changes/feature-changes/CHANGE-XXX-*.md
   └─ 路徑: claudedocs/4-changes/bug-fixes/FIX-XXX-*.md

2. 是否涉及技術棧/架構變更？
   └─ 是 → 更新 CLAUDE.md（技術棧、目錄結構等章節）

3. 是否新增/修改模組的公開 API？
   └─ 是 → 更新對應模組的 index.ts（導出、文檔註釋）

4. 是否發現新的開發規範/最佳實踐/踩坑經驗？
   └─ 是 → 更新對應的 .claude/rules/*.md

5. 是否完成 Epic/Story？
   └─ 是 → 更新 CLAUDE.md 項目進度追蹤表
```

---

## 各文檔更新時機

| 文檔類型                | 更新觸發條件                              | 更新頻率 |
| ----------------------- | ----------------------------------------- | -------- |
| **CLAUDE.md**           | 技術棧變更、架構調整、目錄重組、Epic 完成 | 低       |
| **index.ts**            | 新增服務、導出變更、常數調整              | 中       |
| **.claude/rules/\*.md** | 新開發模式、踩坑經驗、團隊約定變更        | 中低     |

---

## 開發完成檢查清單

完成每個 Story 或重要功能後，AI 助手應自動執行以下檢查：

```markdown
## 開發完成檢查

### 代碼品質

- [ ] 通過 TypeScript 類型檢查 (`npm run type-check`)
- [ ] 通過 ESLint 檢查 (`npm run lint`)
- [ ] 新增代碼包含標準 JSDoc 註釋

### 文檔同步

- [ ] 如完成 CHANGE/FIX → 已更新規劃文件狀態為 ✅ 已完成（🔴 必須）
- [ ] 如涉及新模組 → 已更新/建立 index.ts
- [ ] 如涉及架構變更 → 已更新 CLAUDE.md
- [ ] 如發現新規範/踩坑 → 已更新 .claude/rules/
- [ ] 如完成 Story → 已更新項目進度

### 測試驗證

- [ ] 相關測試通過
- [ ] 新功能已有對應測試（如適用）
```

---

## 自動提醒規則

AI 助手在以下情況應**主動提醒**用戶考慮更新文檔：

1. **建立新的 service 文件** → 提醒更新 `src/services/index.ts`
2. **新增外部依賴** → 提醒檢查是否需更新 CLAUDE.md 技術棧
3. **修改 Prisma Schema** → 提醒檢查 `.claude/rules/database.md`
4. **建立新的 API 端點** → 提醒檢查 API 路由結構文檔
5. **遇到並解決複雜問題** → 提醒記錄到 `.claude/rules/` 作為經驗

---

## 範例：開發完成後的文檔更新

```bash
# 情境：完成 Story 3.2 - 新增映射服務

## 需要更新的文檔：

1. src/services/index.ts
   - 新增 export * from './mapping-service'
   - 更新 @features 列表

2. CLAUDE.md
   - 更新項目進度：Epic 3 狀態改為 🟡 進行中

3. .claude/rules/services.md（如發現新模式）
   - 記錄映射服務的設計模式
   - 記錄三層映射的實現要點
```

---

**來源**: CLAUDE.md v2.6.0 (2026-02-08)
**搬遷日期**: 2026-02-09 (CHANGE-033)
