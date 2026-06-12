<!-- Story 22-4 AC10 (Gov-02)：PR 表單含 security checklist -->

## Summary

<!-- 簡述本 PR 的變更內容與目的 -->

## Type of change

- [ ] feature（新功能）
- [ ] fix（bug 修復）
- [ ] docs（文檔）
- [ ] refactor（重構，不改外部行為）
- [ ] chore（建置 / 工具 / 依賴）

## 對應規劃

<!-- quote 對應的 CHANGE-XXX / FIX-XXX / Story / Tech Spec 編號 -->

## Security Checklist

- [ ] 無新增 secret hardcoding（API key / password / connection string）
- [ ] 新增 API 已加 Zod 驗證
- [ ] 新增 API 已加 auth middleware（除非明列為 public）
- [ ] 無 `$executeRawUnsafe` / `$queryRawUnsafe`（或已參數化 / 白名單）
- [ ] 新增使用者輸入處的 `dangerouslySetInnerHTML` 已 sanitize
- [ ] 新增對外部 URL 的 fetch 已加 SSRF guard（若適用）
- [ ] 已執行 `npm run i18n:check`（涉及 UI 字串時）

## Testing notes

<!-- 描述如何驗證此變更；貼上 type-check / lint / test 結果 -->

## Screenshots

<!-- UI 變動時附上前後對照截圖 -->
