# FIX-098: Template Field Mappings 無法刪除（前端競態送出空白 id → 405）

> **建立日期**: 2026-06-29
> **發現方式**: 用戶回報 + Playwright E2E 重現
> **影響頁面/功能**: 模版欄位映射頁（`/[locale]/admin/template-field-mappings`）刪除功能 — `DELETE /api/v1/template-field-mappings/[id]`
> **優先級**: 中（UI 刪除功能自始無法運作；非安全問題、非環境問題）
> **狀態**: ✅ 已修復（2026-06-29，本地 type-check / lint / Playwright live E2E 通過）

---

## 問題描述

在模版欄位映射頁點任一筆記錄的「刪除」→ 確認對話框按「刪除」後，記錄**並未被刪除**，UI 只顯示一個 toast：

```
刪除失敗 / 刪除映射配置失敗
```

本地與 Azure DEV **兩個環境都會發生**，是定位的關鍵線索 —— 代表這不是環境 / 資料庫 / schema 漂移問題，而是前端代碼的共通缺陷。

---

## 重現步驟

1. 登入後進入 `/zh-TW/admin/template-field-mappings`。
2. 任一筆記錄點「刪除」→ 確認對話框按「刪除」。
3. 觀察現象：
   - 記錄未刪除（列表中仍存在、狀態仍為「啟用」）。
   - 出現 toast「刪除映射配置失敗」。
   - DevTools Network 顯示 DELETE 請求回 **405**。

---

## 根本原因

前端刪除 hook 存在**競態條件（race condition）**，導致 DELETE 請求帶著**空白 id** 送出，打到沒有 DELETE handler 的 collection endpoint 而回 405。

### 實測證據（Playwright，本地 port 3200）

| # | 請求 | 結果 |
|---|------|------|
| 16 | `DELETE /api/v1/template-field-mappings/`（結尾僅斜線、無 id） | 308 永久重定向 |
| 17 | `DELETE /api/v1/template-field-mappings`（collection endpoint） | **405 Method Not Allowed** |

正常應為 `DELETE /api/v1/template-field-mappings/{id}`。

### 完整因果鏈

1. **組件以可被重置的 state 綁定 hook**（`TemplateFieldMappingList.tsx:167`）：
   ```tsx
   const { deleteMapping, isDeleting } = useDeleteTemplateFieldMapping(deleteId || '');
   ```
   當 `deleteId` 為 `null` 時，hook 以空字串 `''` 綁定 id。

2. **對話框關閉會把 `deleteId` 重置為 null**（`TemplateFieldMappingList.tsx:430`）：
   ```tsx
   <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
   ```
   按下確認按鈕（`AlertDialogAction`）時，Radix 會關閉對話框並觸發 `onOpenChange` → `setDeleteId(null)`，與 `handleDelete` 形成競態。

3. **hook 的 `mutationFn` 用閉包捕獲 id**（`use-template-field-mappings.ts:519-520`）：
   ```tsx
   const mutation = useMutation({ mutationFn: () => deleteMapping(id), /* ... */ });
   ```
   `setDeleteId(null)` 觸發重新渲染，hook 以 `''` 重新綁定 `mutationFn`；React Query 的 mutation observer 跨渲染共享，實際執行時讀到的 id 已是空字串。

4. fetch URL 變成 `/api/v1/template-field-mappings/`（尾斜線、無 id）→ Next.js 對尾斜線做 **308** 重定向去掉斜線 → 變成 collection endpoint `/api/v1/template-field-mappings`。

5. 該 collection route（`src/app/api/v1/template-field-mappings/route.ts`）只 `export` `GET` / `POST`，**無 `DELETE`** → **405** → 前端 `fetch` 視為失敗 → catch → toast「刪除映射配置失敗」。

> 後端 `[id]/route.ts` 的 DELETE handler（軟刪除，`isActive=false`）邏輯其實正確，**但從未被執行** —— 請求根本沒走到那裡。

### 與 FIX-096 的對比

| | FIX-096（文件詳情刪除） | FIX-098（本案） |
|---|---|---|
| 現象 | DELETE 回 405 | DELETE 回 405 |
| 根因 | **後端**缺 DELETE handler | **前端**送出空白 id，打到無 handler 的 collection endpoint |
| 修法 | 補後端 handler | 修前端 id 傳遞方式 |

---

## 解決方案

讓 id 在呼叫時作為 **mutation variable** 傳入，而非靠閉包捕獲。此寫法亦**回歸 tech-spec（story 19-4 第 126 行）原設計** `useDeleteTemplateFieldMapping()`（無參數版本），不屬於設計偏離。

### Hook（`use-template-field-mappings.ts`）

```tsx
// 改為無參數；mutationFn 透過 variables 收 id
export function useDeleteTemplateFieldMapping(): UseDeleteTemplateFieldMappingResult {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (id: string) => deleteMapping(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: templateFieldMappingQueryKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: templateFieldMappingQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: templateFieldMappingQueryKeys.resolve() });
    },
  });
  return {
    deleteMapping: (id: string) => mutation.mutateAsync(id),
    isDeleting: mutation.isPending,
    error: mutation.error as Error | null,
  };
}
```

### 組件（`TemplateFieldMappingList.tsx`）

```tsx
const { deleteMapping, isDeleting } = useDeleteTemplateFieldMapping(); // 無參數

const handleDelete = React.useCallback(async () => {
  if (!deleteId) return;
  try {
    await deleteMapping(deleteId); // 明確傳入，鎖定當下 id
    toast.success(t('toast.deleted.title'));
    setDeleteId(null);
  } catch (err) {
    toast.error(t('toast.deleteError.title'), {
      description: err instanceof Error ? err.message : undefined,
    });
  }
}, [deleteId, deleteMapping, t]);
```

---

## 修改的檔案

| 檔案 | 修改內容 |
|------|----------|
| `src/hooks/use-template-field-mappings.ts` | `useDeleteTemplateFieldMapping` 改為無參數；`mutationFn` 改收 `id` variable；`onSuccess` 改用 `(_data, id)` 第二參數取得 id；`deleteMapping` 回傳改為 `(id: string) => mutation.mutateAsync(id)`；同步更新 `UseDeleteTemplateFieldMappingResult` 介面與 JSDoc 範例 |
| `src/components/features/template-field-mapping/TemplateFieldMappingList.tsx` | 呼叫處改 `useDeleteTemplateFieldMapping()`（移除 `deleteId || ''`）；`handleDelete` 改 `await deleteMapping(deleteId)` |

---

## 測試驗證

- [x] 模版欄位映射頁點「刪除」→ 確認 → DELETE 回 200（非 405）、記錄狀態變「停用」（軟刪除設計）
- [x] Network 顯示請求帶正確 id（`/template-field-mappings/{id}`，無 308 重定向）
- [x] `npm run type-check` 通過
- [x] `npx eslint`（兩個修改檔案）通過，0 error 0 warning
- [x] console 0 errors（修復前點確認後為 2 errors）

### Live E2E（2026-06-29，本地 port 3200，全域管理員）

刪除「Test data template mapping 1 - 20260602」（id `cmpwj31260001awxgv82a5n17`）：

| 項目 | 修復前 | 修復後 |
|------|--------|--------|
| DELETE URL | `/template-field-mappings/`（空 id）→ 308 | `/template-field-mappings/cmpwj31260001awxgv82a5n17` |
| DELETE 回應 | 405 Method Not Allowed | **200 OK** |
| Console | 2 errors | 0 errors |
| 列表狀態 | 未變（仍「啟用」）| 軟刪除生效（變「停用」）、列表自動 refetch |

> 驗證後已將該測試記錄 `is_active` 還原為 `true`（避免留下測試副作用）。

---

## 附帶觀察（不在本 FIX 範圍）

列表標題顯示「共 0 個配置」但實際有多筆記錄 —— `total` 計數帶出有誤，屬獨立小問題，本 FIX 不處理，留待後續評估。

---

*文件建立日期: 2026-06-29*
*最後更新: 2026-06-29*
