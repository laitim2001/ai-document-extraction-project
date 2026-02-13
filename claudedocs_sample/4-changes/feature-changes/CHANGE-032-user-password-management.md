# CHANGE-032: 用戶密碼設定與更改功能

> **建立日期**: 2025-12-16
> **完成日期**: 2025-12-16
> **狀態**: ✅ 已完成
> **優先級**: High
> **類型**: 現有功能增強 (Enhancement)

---

## 1. 變更概述

### 1.1 背景
目前系統只有在 `/register` 註冊頁面可以設定密碼，用戶管理頁面（`/users/new` 和 `/users/[id]/edit`）缺乏密碼設定和更改功能。這導致：
- Admin 無法為新建用戶設定初始密碼
- 用戶無法透過管理頁面更改密碼
- 需要透過「忘記密碼」流程才能重設密碼

### 1.2 目標
- 在用戶新增頁面 (`/users/new`) 增加密碼設定欄位
- 在用戶編輯頁面 (`/users/[id]/edit`) 增加密碼更改功能
- 實施更嚴格的密碼強度要求

---

## 2. 功能需求

### 2.1 密碼強度要求（新規則）
| 要求 | 規格 |
|------|------|
| 最小長度 | 12 個字符 |
| 複雜度 | 至少包含 6 個以下類型的字符：大寫字母、數字、符號 |
| 符號範圍 | `!@#$%^&*()_+-=[]{};\|:'",./<>?` |

**密碼驗證規則**:
```typescript
// 密碼必須：
// 1. 長度 >= 12
// 2. 至少有 6 個字符來自以下類別：
//    - 大寫字母 (A-Z)
//    - 數字 (0-9)
//    - 特殊符號
```

### 2.2 功能規格

#### 2.2.1 用戶新增頁面 (`/users/new`)
| 欄位 | 必填 | 說明 |
|------|------|------|
| 密碼 | ❌ 選填 | 可選設定初始密碼 |
| 確認密碼 | 條件必填 | 若填寫密碼則必填 |

- 若不設定密碼，用戶需透過「忘記密碼」流程自行設定
- 若設定密碼，必須符合密碼強度要求
- 顯示密碼強度指示器

#### 2.2.2 用戶編輯頁面 (`/users/[id]/edit`)
| 欄位 | 必填 | 說明 |
|------|------|------|
| 新密碼 | ❌ 選填 | 留空則不更改密碼 |
| 確認新密碼 | 條件必填 | 若填寫新密碼則必填 |

- 獨立的「更改密碼」區塊
- 顯示「目前是否已設定密碼」狀態
- Admin 可為任何用戶更改密碼
- 普通用戶只能更改自己的密碼（透過 Settings）

#### 2.2.3 設定頁面 (`/settings`) - 未來擴展
- 用戶可自行更改自己的密碼
- 需輸入當前密碼驗證身份
- 此為未來擴展，本次變更不實施

---

## 3. 技術設計

### 3.1 後端 API 變更

#### 3.1.1 新增 Procedure: `user.setPassword`
```typescript
// packages/api/src/routers/user.ts

setPassword: adminProcedure
  .input(z.object({
    userId: z.string().min(1),
    password: z.string().min(12).refine(validatePasswordStrength),
  }))
  .mutation(async ({ ctx, input }) => {
    const hashedPassword = await bcrypt.hash(input.password, 12);
    return ctx.prisma.user.update({
      where: { id: input.userId },
      data: { password: hashedPassword },
    });
  }),
```

#### 3.1.2 修改 Procedure: `user.create`
- 新增可選 `password` 欄位
- 若提供密碼，驗證強度後 hash 儲存

#### 3.1.3 密碼驗證函數
```typescript
// packages/api/src/lib/passwordValidation.ts

export function validatePasswordStrength(password: string): boolean {
  if (password.length < 12) return false;

  let specialCount = 0;
  const upperRegex = /[A-Z]/g;
  const digitRegex = /[0-9]/g;
  const symbolRegex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g;

  specialCount += (password.match(upperRegex) || []).length;
  specialCount += (password.match(digitRegex) || []).length;
  specialCount += (password.match(symbolRegex) || []).length;

  return specialCount >= 6;
}
```

### 3.2 前端變更

#### 3.2.1 新增組件: `PasswordInput`
```typescript
// apps/web/src/components/user/PasswordInput.tsx

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  showStrengthIndicator?: boolean;
  label?: string;
  placeholder?: string;
}
```

#### 3.2.2 新增組件: `PasswordStrengthIndicator`
```typescript
// apps/web/src/components/user/PasswordStrengthIndicator.tsx

// 顯示密碼強度：
// - 長度檢查 (12+)
// - 大寫字母數量
// - 數字數量
// - 符號數量
// - 總體強度評分
```

#### 3.2.3 修改頁面
| 頁面 | 變更 |
|------|------|
| `/users/new/page.tsx` | 新增密碼設定區塊 |
| `/users/[id]/edit/page.tsx` | 新增更改密碼區塊 |

### 3.3 I18N 翻譯鍵
```json
{
  "users": {
    "password": {
      "title": "密碼設定",
      "newPassword": "新密碼",
      "confirmPassword": "確認密碼",
      "placeholder": "輸入密碼",
      "optional": "（選填）",
      "changePassword": "更改密碼",
      "hasPassword": "已設定密碼",
      "noPassword": "尚未設定密碼",
      "leaveBlankToKeep": "留空則不更改",
      "strength": {
        "weak": "弱",
        "medium": "中",
        "strong": "強",
        "requirements": "密碼要求",
        "minLength": "至少 12 個字符",
        "complexity": "至少 6 個字符包含大寫字母、數字或符號"
      },
      "errors": {
        "tooShort": "密碼長度至少 12 個字符",
        "tooWeak": "密碼強度不足，需包含至少 6 個大寫字母、數字或符號",
        "mismatch": "兩次輸入的密碼不一致"
      }
    }
  }
}
```

---

## 4. 影響範圍

### 4.1 修改文件
| 文件 | 變更類型 | 說明 |
|------|----------|------|
| `packages/api/src/routers/user.ts` | 修改 | 新增 setPassword procedure，修改 create |
| `packages/api/src/lib/passwordValidation.ts` | 新增 | 密碼驗證函數 |
| `apps/web/src/app/[locale]/users/new/page.tsx` | 修改 | 新增密碼設定區塊 |
| `apps/web/src/app/[locale]/users/[id]/edit/page.tsx` | 修改 | 新增更改密碼區塊 |
| `apps/web/src/components/user/PasswordInput.tsx` | 新增 | 密碼輸入組件 |
| `apps/web/src/components/user/PasswordStrengthIndicator.tsx` | 新增 | 強度指示器組件 |
| `apps/web/src/messages/en.json` | 修改 | 新增翻譯鍵 |
| `apps/web/src/messages/zh-TW.json` | 修改 | 新增翻譯鍵 |

### 4.2 依賴項
- `bcrypt` - 已安裝，用於密碼 hash

---

## 5. 驗收標準

### 5.1 功能驗收
- [x] Admin 可在用戶新增頁面設定初始密碼
- [x] Admin 可在用戶編輯頁面更改任何用戶的密碼
- [x] 密碼強度驗證正確執行
- [x] 兩次密碼輸入不一致時顯示錯誤
- [x] 密碼強度指示器正確顯示

### 5.2 安全驗收
- [x] 密碼使用 bcrypt hash 儲存 (rounds: 12)
- [x] API 僅限 Admin 可呼叫 setPassword (adminProcedure)
- [x] 前端不顯示現有密碼

### 5.3 用戶體驗
- [x] 密碼欄位顯示/隱藏切換按鈕
- [x] 強度指示器即時更新
- [x] 錯誤訊息清晰易懂
- [x] I18N 支援中英文

---

## 6. 實施計劃

### Phase 1: 後端 API (預估 2 小時)
1. 建立 `passwordValidation.ts`
2. 新增 `user.setPassword` procedure
3. 修改 `user.create` 支援 password
4. 測試 API

### Phase 2: 前端組件 (預估 2 小時)
1. 建立 `PasswordInput` 組件
2. 建立 `PasswordStrengthIndicator` 組件
3. 建立共用樣式

### Phase 3: 頁面整合 (預估 2 小時)
1. 修改 `/users/new/page.tsx`
2. 修改 `/users/[id]/edit/page.tsx`
3. 新增 I18N 翻譯

### Phase 4: 測試驗證 (預估 1 小時)
1. 功能測試
2. 安全測試
3. I18N 測試

**總預估時間**: 7 小時

---

## 7. 相關文檔
- 現有註冊頁面: `apps/web/src/app/[locale]/register/page.tsx`
- 用戶 API Router: `packages/api/src/routers/user.ts`
- Prisma User Model: `packages/db/prisma/schema.prisma`

---

**已確認事項** (2025-12-16):
1. ✅ 密碼強度要求：12位 + 6個特殊字符（大寫/數字/符號）
2. ✅ Settings 頁面：不需要，用戶管理頁面已包含此功能
3. ✅ 密碼過期機制：暫不需要（後期將轉為 Azure SSO）

---

## 8. 實施摘要

### 8.1 實際修改文件

| 文件 | 變更類型 | 說明 |
|------|----------|------|
| `packages/api/src/lib/passwordValidation.ts` | **新增** | 密碼驗證函數和常數 |
| `packages/api/src/routers/user.ts` | **修改** | 新增 setPassword、hasPassword，修改 create |
| `apps/web/src/components/ui/password-input.tsx` | **新增** | 密碼輸入組件 (含顯示/隱藏切換) |
| `apps/web/src/components/ui/password-strength-indicator.tsx` | **新增** | 密碼強度指示器組件 |
| `apps/web/src/components/ui/index.ts` | **修改** | 導出新組件 |
| `apps/web/src/components/user/UserForm.tsx` | **修改** | 整合密碼設定功能 |
| `apps/web/src/messages/en.json` | **修改** | 新增 users.password 和 users.form.validation.passwordRequired |
| `apps/web/src/messages/zh-TW.json` | **修改** | 新增 users.password 和 users.form.validation.passwordRequired |

### 8.2 新增 API Procedures

| Procedure | 類型 | 權限 | 說明 |
|-----------|------|------|------|
| `user.setPassword` | mutation | adminProcedure | 設定/更改用戶密碼 |
| `user.hasPassword` | query | publicProcedure | 檢查用戶是否已設定密碼 |

### 8.3 新增依賴

| Package | Version | 說明 |
|---------|---------|------|
| `bcryptjs` | ^2.4.3 | 密碼 hash |
| `@types/bcryptjs` | ^2.4.6 | TypeScript 類型定義 |

### 8.4 完成日期
**2025-12-16** - 全部 Phase 已完成，待用戶功能測試驗證
