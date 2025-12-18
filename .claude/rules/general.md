---
paths: "**/*"
---

# 通用開發規範

## 語言設定
- **用戶溝通**: 繁體中文
- **代碼註釋**: 中文或英文（依上下文）
- **Commit Message**: 英文
- **技術文檔**: 繁體中文為主

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
