# FIX-009 NextAuth v5 升級進度報告

**問題編號**: FIX-009
**標題**: NextAuth v4 → v5 升級
**日期**: 2025-10-29
**當前狀態**: ⚠️ 遇到兼容性問題
**進度**: 70% 完成

---

## 📊 完成的工作

### ✅ 1. 套件升級 (完成)
```bash
# 所有 3 個 workspaces 升級成功
- apps/web: next-auth 4.24.10 → 5.0.0-beta.30
- packages/api: next-auth 4.24.10 → 5.0.0-beta.30
- packages/auth: next-auth 4.24.10 → 5.0.0-beta.30
- adapter: @next-auth/prisma-adapter → @auth/prisma-adapter@2.7.4
```

### ✅ 2. 配置文件遷移 (完成)
創建了新的 `apps/web/src/auth.ts`（258 行）：
- ✅ CredentialsProvider 完整配置
- ✅ Azure AD B2C 條件性支持
- ✅ JWT 和 Session callbacks
- ✅ TypeScript 類型擴展
- ✅ 工具函數（hashPassword, verifyPassword）

### ✅ 3. API Route 更新 (完成)
`apps/web/src/app/api/auth/[...nextauth]/route.ts`：
```typescript
import { handlers } from '../../../../auth';
export const { GET, POST } = handlers;
```

### ✅ 4. 環境變數更新 (完成)
`.env` 文件更新：
```bash
AUTH_SECRET="..."
AUTH_URL="http://localhost:3006"
AUTH_TRUST_HOST="true"
```

### ✅ 5. Git 提交 (完成)
提交哈希：`b2d163d`
提交信息：feat(auth): 升級 NextAuth v4 到 v5 (beta) - 解決 E2E 測試認證問題

---

## ⚠️ 當前問題

### 問題：NextAuth v5 beta 版本兼容性錯誤

**錯誤信息**：
```
TypeError: next_dist_server_web_exports_next_request__WEBPACK_IMPORTED_MODULE_0__ is not a constructor
    at reqWithEnvURL (next-auth@5.0.0-beta.30/lib/env.js:16:12)
```

**HTTP 響應**：
```
< HTTP/1.1 500 Internal Server Error
```

**根本原因**：
NextAuth v5.0.0-beta.30 嘗試使用 Next.js 的 `NextRequest` 構造函數，但在 Next.js 14.1.0 中導出方式不兼容。

**影響**：
- ❌ 所有 NextAuth API 端點返回 500 錯誤
- ❌ 無法獲取 CSRF token
- ❌ 無法進行認證

**好的跡象**：
- ✅ `auth.ts` 配置文件被正確載入（日誌顯示："🚀 NextAuth v5 配置文件正在載入..."）
- ✅ Next.js 編譯成功（"✓ Compiled /api/auth/[...nextauth] in 545ms"）
- ✅ 沒有 TypeScript 類型錯誤

---

## 🔍 可能的解決方案

### 選項 1：升級到更新的 NextAuth v5 beta
**理由**：v5 仍在 beta 階段，可能有更新版本修復了此問題

**檢查命令**：
```bash
pnpm view next-auth versions --tag beta
```

### 選項 2：降級到穩定的 NextAuth v4
**理由**：暫時回退，等待 v5 正式發布

**缺點**：
- 無法解決原始問題（v4 與 Next.js 14 App Router 不兼容）
- 回到起點

### 選項 3：升級 Next.js 到最新版本
**理由**：NextAuth v5 可能需要更新的 Next.js 版本

**風險**：
- 可能影響其他功能
- 需要測試整個應用

### 選項 4：查找社區 workaround
**理由**：其他開發者可能已遇到並解決此問題

**行動**：
- 搜索 GitHub Issues
- 查看 NextAuth v5 文檔更新
- 檢查 Discord/論壇討論

---

## 📋 下一步行動

### 立即優先
1. **檢查可用的 next-auth beta 版本**
   ```bash
   pnpm view next-auth versions
   ```

2. **查看 NextAuth v5 官方文檔**
   - 最低 Next.js 版本要求
   - 已知問題列表
   - 推薦的 beta 版本

3. **搜索相關 GitHub Issues**
   - 搜索關鍵字："NextRequest is not a constructor"
   - 檢查 next-auth 倉庫的 Issues

### 待完成任務
- [ ] 解決 NextAuth v5 兼容性問題
- [ ] 驗證 authorize 函數被調用
- [ ] 測試完整認證流程
- [ ] 更新 E2E 測試 fixtures
- [ ] 運行 E2E 測試驗證（預期 7/7 通過）
- [ ] 更新 DEVELOPMENT-LOG.md
- [ ] 更新 FIXLOG.md
- [ ] 提交修復並同步到 GitHub

---

## 🗂️ 相關文件

### 已修改
- `apps/web/src/auth.ts` (NEW)
- `apps/web/src/app/api/auth/[...nextauth]/route.ts` (UPDATED)
- `apps/web/.env` (UPDATED - 未提交)
- `apps/web/package.json` (UPDATED)
- `packages/api/package.json` (UPDATED)
- `packages/auth/package.json` (UPDATED)
- `pnpm-lock.yaml` (UPDATED)

### 參考文檔
- `claudedocs/FIX-009-ROOT-CAUSE-ANALYSIS.md` - 根本原因分析
- `scripts/test-auth-manually.ts` - 手動測試腳本
- NextAuth v5 Migration Guide: https://authjs.dev/getting-started/migrating-to-v5

---

**報告生成時間**: 2025-10-29 18:20 (UTC+8)
**預計剩餘時間**: 2-4 小時（取決於解決方案）
**當前阻塞**: NextAuth v5 beta 兼容性問題
