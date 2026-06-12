# 全面安全與風險審查協議（2026-06-10）

> 本文件為並行安全審查 agent 的統一作業協議。每個 agent 被指派一個 scope 檔案（檔案路徑清單），
> 必須逐檔逐行完整審查，並將報告寫入指定的報告檔案。

---

## 你的任務

你是安全審查 agent。對 scope 檔案中列出的**每一個檔案**，逐行完整閱讀並進行安全與風險審查。

## 強制要求（不可違反）

1. **必須用 Read 完整讀取 scope 清單中每一個檔案** — 不可抽樣、不可只讀開頭、不可用 Grep 結果代替閱讀。檔案超過 2000 行時，用 offset 分段把整個檔案讀完。
2. **不可修改任何專案源代碼，不可執行任何 git 寫入操作**。唯一可寫的檔案是你被指派的報告檔案。
3. 可以用 Grep / Glob 輔助交叉確認（例如確認某個函數的呼叫者、確認某 route 是否被 middleware 保護），但這是輔助，不能取代逐檔閱讀。
4. 審查的是「現狀代碼」，不要建議重構無關的東西，只報告安全與風險問題。

## 審查維度（每個檔案都要過一遍）

| 代號 | 維度 | 重點 |
|------|------|------|
| A | 認證與授權 | API route 是否檢查 session/權限？是否有 IDOR（依 id 存取資源但未驗證擁有者 / 城市範圍 / 角色）？權限檢查是否可繞過？admin 端點是否驗 admin 角色？ |
| B | 注入 | SQL（`$queryRaw` / `$queryRawUnsafe` / `$executeRawUnsafe` / 字串拼接 SQL）、command injection（exec / spawn / execSync）、path traversal（使用者輸入拼進檔案路徑）、NoSQL / LDAP injection |
| C | 輸入驗證 | POST/PATCH/PUT 是否有 Zod（或等效）驗證？數值 / 長度 / 枚舉是否約束？分頁參數是否限制上限？id 是否驗格式？ |
| D | Secrets 與設定 | 硬編碼 API key / 密碼 / connection string / tenant ID / subscription ID / 內部主機名；secrets 是否可能進 log 或回應 |
| E | PII 與日誌 | console.log / logger 是否輸出 email、token、密碼、完整檔案內容等敏感資料 |
| F | XSS 與前端 | `dangerouslySetInnerHTML`、未轉義的使用者內容渲染、`href` 可被注入 `javascript:`、postMessage 無來源驗證、客戶端組件 import prisma / server 模組 |
| G | SSRF 與外部呼叫 | fetch / axios 的 URL 是否含使用者輸入？是否限制目標主機？webhook URL 是否驗證？ |
| H | 檔案處理 | 上傳檔案類型 / 大小驗證、檔名清洗、下載路徑控制、zip slip、Content-Type / Content-Disposition 設定 |
| I | 認證機制本身 | token 生成 / 驗證邏輯、session 設定、密碼雜湊演算法、CSRF、open redirect、時序攻擊 |
| J | 資訊洩漏 | 錯誤回應是否回傳 stack trace / 內部路徑 / SQL 錯誤 / 套件版本；debug 端點是否暴露 |
| K | 其他風險 | race condition、缺 transaction 造成資料不一致、無界查詢（缺 take/limit 的 findMany）、無 rate limit 的昂貴操作（DoS 面）、不安全隨機數（Math.random 用於 token）、原型污染 |

## 嚴重度定義

| 等級 | 定義 |
|------|------|
| Critical | 可直接被未授權者利用，造成資料外洩 / 篡改 / RCE / 帳號接管 |
| High | 需一定條件但可造成重大影響（如已登入的低權限使用者可越權、SQL injection 需特定輸入） |
| Medium | 有風險但利用條件高，或屬縱深防禦缺層（如缺 Zod 驗證但 Prisma 參數化擋住注入） |
| Low | 最佳實踐缺失、輕微資訊洩漏、理論性風險 |
| Info | 觀察與建議 |

## 報告格式（寫入你被指派的報告檔案）

```markdown
# 安全審查報告 — <區域名>

> 審查日期：2026-06-10 | Scope：<scope 檔名> | Agent：<你的名稱>

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
（每個檔案一列；行數 = 該檔案實際總行數；完整讀取 = ✅ / 路徑不存在）

## 2. 發現

### [嚴重度] <區域代號-編號> <標題>
- **檔案**：path:line
- **類別**：A–K
- **描述**：…
- **證據**：引用 1–5 行代碼
- **建議**：…

## 3. 統計

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|

## 4. 區域整體觀察

（該區域的系統性模式：例如「此目錄 80% route 無 auth 檢查」）
```

## 回傳訊息格式（給主 session 的最終回覆）

只回傳以下內容，**不要**貼完整報告：
1. 覆蓋檔案數 / 總行數
2. 各嚴重度數量
3. Critical 與 High 的一行式摘要清單（每條含 path:line）
4. 報告檔案路徑

## 項目背景（審查時的已知慣例）

- 認證：NextAuth（Azure AD SSO + 本地帳號），session 檢查慣例為 `auth()` / `getServerSession`
- DB：Prisma 7.2 + PostgreSQL，正常情況下參數化；只有 raw query 需要特別檢查
- 新 API 錯誤格式：RFC 7807 top-level
- 已知歷史問題（已修復，但要驗證沒有回歸）：FIX-050（auth.config.ts console.log email）、FIX-051（db-context.ts:87 SQL injection）
- 已知系統性缺口（仍要記錄具體位置）：auth 覆蓋率約 60%、Zod 覆蓋率約 60-65%、console.log 約 279 處
- 不要報 i18n / 語言 / 代碼風格問題（非本次範圍）

## 語言

報告與回傳訊息用繁體中文撰寫（程式碼識別符、檔案路徑、API 端點保留原文）。
