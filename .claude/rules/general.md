---
paths: "**/*"
---

# 通用開發規範

## 語言設定
- **用戶溝通**: 繁體中文
- **代碼註釋**: 中文或英文（依上下文）
- **Commit Message**: 英文
- **技術文檔**: 繁體中文為主

## 國際化（i18n）架構

> **核心框架**: next-intl | **支援語言**: en, zh-TW, zh-CN

| 項目 | 說明 |
|------|------|
| 路由結構 | `/[locale]/(dashboard)/...` |
| 翻譯文件 | `messages/{locale}/*.json` |
| 格式化工具 | `src/lib/i18n-{date,number,currency}.ts` |
| 配置文件 | `src/i18n/config.ts` |

**重要規則**:
- ✅ 所有使用者可見文字必須使用翻譯系統
- ✅ 新增翻譯時必須同步更新所有語言文件
- ✅ 使用 `@/i18n/routing` 的 Link 和 Router
- ❌ 不要硬編碼使用者可見文字

> **完整規範**: 請參考 `.claude/rules/i18n.md`

## 代碼品質要求
- 所有代碼必須通過 TypeScript 類型檢查
- 所有代碼必須通過 ESLint 檢查
- 禁止使用 `any` 類型
- 禁止硬編碼敏感資訊（API keys、密碼等）

## 文件頭部註釋（必須）
所有業務邏輯文件必須包含標準 JSDoc 頭部：
```typescript
/**
 * @fileoverview [文件功能概述]
 * @module [模組路徑]
 * @since Epic X - Story X.X
 * @lastModified YYYY-MM-DD
 */
```

## 命名規範
| 類型 | 規範 | 範例 |
|------|------|------|
| 文件名 | kebab-case | `use-document-upload.ts` |
| 組件 | PascalCase | `DocumentUploadForm` |
| 函數 | camelCase | `calculateConfidenceScore` |
| 常數 | UPPER_SNAKE_CASE | `MAX_FILE_SIZE` |
| 類型 | PascalCase | `DocumentMetadata` |

## Git 工作流
- 功能分支: `feature/epic-X-story-Y`
- 修復分支: `fix/issue-description`
- 禁止直接提交到 main 分支
- Commit 格式: `<type>(<scope>): <subject>`

## 禁止事項
- ❌ 不要跳過錯誤處理
- ❌ 不要在客戶端組件直接訪問資料庫
- ❌ 不要忽略 TypeScript 錯誤
- ❌ 不要提交包含 console.log 的代碼（除非調試用途）
