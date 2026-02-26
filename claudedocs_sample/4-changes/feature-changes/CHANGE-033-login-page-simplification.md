# CHANGE-033: Login 頁面簡化

## 概述
簡化 Login 頁面，移除不需要的連結和文字說明。

## 變更類型
- **類型**: UI 變更 (CHANGE)
- **優先級**: 中
- **影響範圍**: 僅前端

## 需求描述
隱藏 Login 頁面以下元素：
1. "Forgot password?" 連結
2. "Don't have an account? Sign Up" 註冊連結
3. Terms of Service 和 Privacy Policy 說明文字

## 受影響的檔案
| 檔案路徑 | 變更說明 |
|----------|----------|
| `apps/web/src/app/[locale]/login/page.tsx` | 移除/隱藏指定 UI 元素 |

## 技術方案

### 方案 A：直接刪除代碼（推薦）
直接移除相關 JSX 代碼，簡潔明瞭。

### 方案 B：條件渲染
使用環境變數或配置控制顯示，保留未來可能恢復的彈性。

### 建議採用方案 A
理由：需求明確為永久隱藏，無需保留條件渲染的複雜度。

## 實施細節

### 需要移除的代碼區塊

#### 1. Forgot Password 連結 (約 Line 255-262)
```tsx
// 移除此區塊
<div className="flex items-center justify-between text-sm">
  <a href="/forgot-password" className="text-primary hover:underline">
    {t('forgotPassword')}
  </a>
</div>
```

#### 2. Sign Up 連結和 Terms 文字 (約 Line 274-286)
```tsx
// 移除整個 CardFooter 或其中的內容
<CardFooter className="flex flex-col space-y-4">
  <div className="text-center text-sm">
    <span className="text-muted-foreground">{t('noAccount')}</span>{' '}
    <Link href="/register" className="text-primary font-medium hover:underline">
      {t('register')}
    </Link>
  </div>
  <p className="text-center text-xs text-muted-foreground w-full">
    {t('termsAgreement')}
  </p>
</CardFooter>
```

## 測試驗證
- [ ] Login 頁面不顯示 "Forgot password?" 連結
- [ ] Login 頁面不顯示 "Don't have an account? Sign Up" 連結
- [ ] Login 頁面不顯示 Terms of Service 說明文字
- [ ] Login 功能正常運作
- [ ] 頁面佈局保持美觀

## 預估工作量
- **開發時間**: 0.5 小時
- **測試時間**: 0.25 小時

## 相關文件
- 原始頁面: `apps/web/src/app/[locale]/login/page.tsx`

---

**建立日期**: 2025-12-18
**狀態**: 已確認，待實施
