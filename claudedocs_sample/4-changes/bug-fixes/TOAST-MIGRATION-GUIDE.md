# Toast API 遷移指南

## 問題描述
專案中同時存在兩個 Toast 系統，造成通知無法正確自動關閉和手動關閉。

## 解決方案
統一使用 shadcn/ui 的 Toast 系統（use-toast.tsx + toaster.tsx）

## API 轉換規則

### 1. 導入語句
**舊版** (Toast.tsx):
```typescript
import { useToast } from '@/components/ui';
const { showToast } = useToast();
```

**新版** (use-toast.tsx):
```typescript
import { useToast } from '@/components/ui';
const { toast } = useToast();
```

### 2. 成功通知
**舊版**:
```typescript
showToast('操作成功', 'success');
```

**新版**:
```typescript
toast({
  title: '成功',
  description: '操作成功',
  variant: 'success',
});
```

### 3. 錯誤通知
**舊版**:
```typescript
showToast('操作失敗', 'error');
```

**新版**:
```typescript
toast({
  title: '錯誤',
  description: '操作失敗',
  variant: 'destructive',
});
```

### 4. 信息通知
**舊版**:
```typescript
showToast('提示信息', 'info');
```

**新版**:
```typescript
toast({
  title: '提示',
  description: '提示信息',
  variant: 'default',
});
```

## 需要更新的文件清單
1. apps/web/src/app/expenses/page.tsx
2. apps/web/src/components/proposal/ProposalActions.tsx
3. apps/web/src/app/purchase-orders/page.tsx
4. apps/web/src/app/quotes/page.tsx
5. apps/web/src/app/vendors/page.tsx
6. apps/web/src/app/budget-pools/page.tsx
7. apps/web/src/components/budget-pool/BudgetPoolForm.tsx
8. apps/web/src/components/vendor/VendorForm.tsx
9. apps/web/src/components/user/UserForm.tsx

## 優勢
- ✅ 自動關閉（預設 5 秒）
- ✅ 手動關閉按鈕
- ✅ 支援更多變體（success, destructive, warning, default）
- ✅ 更好的動畫效果
- ✅ 更好的無障礙支援
- ✅ 可自定義持續時間
- ✅ 支援操作按鈕
