# Open Questions（OQ）追蹤

> **本文件追蹤項目中**未解決的設計決策、文檔誤差、規格與代碼不一致**等狀況。AI 助手按 OQ 狀態決定 default behavior（詳見 CLAUDE.md §Open Questions 機制）。
> **最後更新**：2026-05-26

---

## 機制摘要

| 狀態 | AI 行為 |
|------|---------|
| **Open** | 用 spec/代碼 default 繼續，但 commit message 標註 `Note: depends on OQ-Q<N>` |
| **Resolved** | 直接用 resolved value，無需 note |
| **Blocked** | STOP 對應 work item，ask user |

---

## 當前 Open Questions

### OQ-Q1: 信心度路由閾值文檔誤差

- **狀態**：🟡 Open
- **問題**：CLAUDE.md 文檔記錄信心度閾值為 95%/80%，但代碼實際為 90%/70%
- **代碼位置**：`src/services/extraction-v3/confidence-v3-1.service.ts` 第 112-119 行
- **影響**：開發新功能時不清楚該以哪個為準
- **AI Default Behavior**：**以代碼實際值為準（90%/70%）**，commit message 標 `Note: depends on OQ-Q1`
- **解決方向**：用戶確認哪個是正確值 →
  - 選項 A：修文檔配合代碼（90%/70%）
  - 選項 B：修代碼配合文檔（95%/80%）— 影響歷史資料路由結果
- **待用戶決策日期**：—

---

### OQ-Q2: Auth 覆蓋率缺口處理優先順序

- **狀態**：🟡 Open
- **問題**：當前 Auth 覆蓋率 60.7%（201/331 routes），距企業級基準 95% 還缺 130 routes
- **資料來源**：Phase 2 安全治理盤點 2026-04-28
- **影響**：開發新 API 時不清楚是否要立刻加 auth（特別是 `/companies/*` `/cost/*` `/reports/*` 等當前無 auth 的 domain）
- **AI Default Behavior**：**新 API 一律加 auth**（除非用戶明確說該 endpoint 為公開）；舊 API 不主動補加（除非屬於當前 task scope）
- **解決方向**：用戶提供完整的「公開 vs 受保護」API 清單
- **相關 CHANGE**：CHANGE-057（API auth coverage 95%），CHANGE-061（permission check unification）

---

### OQ-Q3: RFC 7807 錯誤格式統一進度

- **狀態**：🟡 Open
- **問題**：部分 API 使用 top-level `{ type, title, status, detail }`，部分使用 nested `{ error: {...} }`
- **影響**：前端錯誤處理需 fallback 兼容兩種格式 → 增加複雜度
- **AI Default Behavior**：**新 API 統一採 top-level**；舊 API 在 task scope 內順帶遷移（不主動 refactor）
- **解決方向**：規劃批次遷移 CHANGE（將所有 nested 格式 API 統一）
- **預估工作量**：~40 個 API 文件

---

## 已解決 Questions（歷史）

> 移到此區段表示已 resolved，AI 直接用 resolved value 即可。

（暫無記錄 — 等開始累積 OQ 後再加入歷史）

---

## Blocked Questions

> 移到此區段表示**等待用戶決策才能繼續**對應 work item。AI 遇到 blocked OQ 必須 STOP 並 ask user。

（暫無記錄）

---

## 處理機制

### 發現新 OQ 時

1. **加入「當前 Open Questions」**並編號（OQ-Q<N>）
2. 明確記錄：問題 / 影響 / AI Default Behavior / 解決方向
3. 在 CLAUDE.md §當前 Open 差異 同步加一條（若屬於差異類）

### OQ 解決時

1. **移到「已解決 Questions」**
2. 標註 resolved date + resolved value
3. 更新對應 CHANGE/FIX 文件
4. 若 AI Default Behavior 改變 → 通知用戶下次 session 起生效

### OQ 升級為 Blocked 時

1. **移到「Blocked Questions」**
2. 明確標註：阻塞了哪些 work item / 需要什麼決策才能解除
3. AI 遇到 blocked OQ 對應 work item 時 → 必須 STOP + ask

---

## 變更歷史

- **2026-05-26**：初版（CLAUDE.md v4.0.0 引入 OQ 機制時建立）

---

*本文件由 CLAUDE.md v4.0.0 引入 Open Questions 機制時建立*
