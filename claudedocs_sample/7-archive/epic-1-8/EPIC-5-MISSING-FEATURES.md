# Epic 5 (供應商與採購管理) - 缺失功能清單

> **生成日期**: 2025-10-05
> **當前完成度**: 85% (後端 100%, 前端 70%)
> **狀態**: 部分完成，核心功能可用，進階功能待開發

---

## 📊 整體狀態總結

### ✅ 已完成功能 (85%)

#### **1. 後端 API - 100% 完成**
- ✅ **Vendor CRUD** (`packages/api/src/routers/vendor.ts`)
  - 完整的供應商增刪改查
  - 分頁、搜尋、排序功能
  - 關聯數據統計 (報價數、採購單數)
  - 刪除前的關聯檢查

- ✅ **Quote CRUD** (`packages/api/src/routers/quote.ts`)
  - 報價單管理 (CRUD)
  - 按專案/供應商查詢
  - 報價比較功能 (統計最低/最高/平均報價)
  - 業務邏輯驗證 (只有已批准提案的專案才能上傳報價)

- ✅ **PurchaseOrder CRUD** (`packages/api/src/routers/purchaseOrder.ts`)
  - 採購單管理 (CRUD)
  - 從 Quote 自動生成 PO
  - 手動創建 PO (不通過 Quote)
  - 按專案查詢 PO
  - 統計功能

- ✅ **Prisma Schema**
  - Vendor, Quote, PurchaseOrder 模型完整定義
  - 關聯關係正確配置
  - 索引優化完成

- ✅ **種子數據**
  - 5 家供應商 (Microsoft, IBM, Oracle, 本地整合商, AWS)
  - 5 張報價單 (ERP專案 3張, 雲端專案 2張)
  - 1 張採購單 (ERP專案選擇 Microsoft)

#### **2. 前端實現 - 70% 完成**

- ✅ **Story 5.1 - Vendor 管理 (100%)**
  - `/vendors` - 供應商列表頁 (搜尋、排序、分頁)
  - `/vendors/new` - 新增供應商頁面
  - `/vendors/[id]` - 供應商詳情頁
  - `/vendors/[id]/edit` - 編輯供應商頁面
  - `VendorForm` 元件 - 供應商表單

- ✅ **專案詳情頁採購單列表 (50%)**
  - 採購單列表顯示 (供應商名稱、金額、日期)
  - 連結到新增採購單頁面
  - 連結到採購單詳情頁面

---

## ❌ 缺失功能清單

### **Story 5.2 - 為已批准的專案上傳並關聯報價單 (0%)**

#### 缺失功能：
1. **報價單上傳 UI (0%)**
   - ❌ 專案詳情頁中的「報價管理」分頁
   - ❌ 檔案上傳組件 (支援 PDF, Word, Excel)
   - ❌ 選擇供應商下拉選單
   - ❌ 輸入報價金額欄位
   - ❌ 上傳後的報價單列表顯示

2. **檔案上傳處理 (0%)**
   - ❌ Next.js API Route 處理檔案上傳
   - ❌ 檔案存儲方案 (本地文件系統或 Azure Blob Storage)
   - ❌ 檔案大小和類型驗證
   - ❌ 檔案下載功能

#### 技術實現建議：
```typescript
// 1. 創建檔案上傳 API Route
// apps/web/src/app/api/upload/quote/route.ts
export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const projectId = formData.get('projectId') as string;
  const vendorId = formData.get('vendorId') as string;
  const amount = parseFloat(formData.get('amount') as string);

  // 驗證檔案類型和大小
  // 儲存檔案到 /public/uploads/quotes/ 或 Azure Blob
  // 調用 tRPC api.quote.create() 創建記錄
}

// 2. 在專案詳情頁添加報價管理分頁
// apps/web/src/app/projects/[id]/page.tsx
// 添加 Tab 組件: 概覽 | 提案 | 報價 | 採購單

// 3. 創建 QuoteUpload 元件
// apps/web/src/components/quote/QuoteUpload.tsx
```

---

### **Story 5.3 - 選擇最終供應商並記錄採購決策 (0%)**

#### 缺失功能：
1. **報價比較 UI (0%)**
   - ❌ 報價單比較表格 (並排顯示所有報價)
   - ❌ 統計資訊顯示 (最低價、最高價、平均價)
   - ❌ 排序功能 (按金額、上傳日期排序)
   - ❌ 高亮最低/最高報價

2. **選擇供應商功能 (0%)**
   - ❌ 「選擇此供應商」按鈕
   - ❌ 確認對話框
   - ❌ 選擇後禁用其他報價的選擇按鈕
   - ❌ 視覺標記已選擇的報價

#### 技術實現建議：
```typescript
// apps/web/src/app/projects/[id]/quotes/page.tsx
// 使用 api.quote.compare() 獲取報價比較數據
// 提供選擇供應商的 UI

// apps/web/src/components/quote/QuoteComparison.tsx
<QuoteComparisonTable
  quotes={quotes}
  selectedQuoteId={selectedQuoteId}
  onSelect={handleSelectQuote}
/>
```

---

### **Story 5.4 - 生成採購單記錄 (50%)**

#### 已完成：
- ✅ 專案詳情頁顯示採購單列表
- ✅ 新增採購單連結

#### 缺失功能：
1. **從 Quote 生成 PO 的完整 UI 流程 (0%)**
   - ❌ 選擇報價後自動觸發生成 PO
   - ❌ PO 預覽頁面 (確認金額、供應商等)
   - ❌ 生成 PO 確認對話框
   - ❌ 成功生成後的提示和跳轉

2. **PO 詳情頁面 (0%)**
   - ❌ `/purchase-orders/[id]` 頁面
   - ❌ 顯示 PO 完整資訊 (編號、日期、專案、供應商、金額)
   - ❌ 關聯的報價單資訊
   - ❌ 關聯的費用記錄列表 (Epic 6)

3. **PO 管理頁面 (0%)**
   - ❌ `/purchase-orders` 採購單列表頁
   - ❌ 按專案/供應商篩選
   - ❌ 搜尋和排序功能

#### 技術實現建議：
```typescript
// 1. 修改報價選擇流程，直接生成 PO
// 當用戶選擇報價時，調用 api.purchaseOrder.createFromQuote()

// 2. 創建 PO 詳情頁面
// apps/web/src/app/purchase-orders/[id]/page.tsx
const { data: po } = api.purchaseOrder.getById.useQuery({ id });

// 3. 創建 PO 列表頁面
// apps/web/src/app/purchase-orders/page.tsx
const { data } = api.purchaseOrder.getAll.useQuery({ page, limit });
```

---

## 📈 完成優先級建議

### **第一優先級 (P0 - MVP 必須)**
無 - Epic 5 核心功能已可用 (可手動創建供應商和採購單)

### **第二優先級 (P1 - 提升用戶體驗)**
1. **Story 5.4 - PO 詳情頁面** (預計 1小時)
   - 創建 `/purchase-orders/[id]` 頁面
   - 顯示 PO 完整資訊
   - 提供編輯和刪除功能

2. **Story 5.4 - PO 列表頁面** (預計 1.5小時)
   - 創建 `/purchase-orders` 頁面
   - 分頁、篩選、排序功能

### **第三優先級 (P2 - 完整採購流程)**
3. **Story 5.2 - 報價單上傳功能** (預計 3-4小時)
   - 實現檔案上傳 API
   - 在專案頁面添加報價管理分頁
   - 報價單上傳和列表 UI

4. **Story 5.3 - 報價比較和選擇** (預計 2小時)
   - 報價比較表格
   - 選擇供應商 UI
   - 從 Quote 生成 PO 流程

---

## 🔄 當前可用的替代方案

由於報價上傳功能尚未實現，目前可以使用以下方案：

1. **手動記錄報價資訊**：
   - 通過 Prisma Studio 手動添加 Quote 記錄
   - 使用種子數據中的範例報價

2. **直接創建採購單**：
   - 使用 `api.purchaseOrder.createManual()` 手動創建 PO
   - 不依賴報價單，直接輸入供應商和金額

3. **Vendor 管理完全可用**：
   - 可正常使用 Vendor CRUD 功能
   - 通過 `/vendors` 頁面管理所有供應商

---

## 📋 下一步建議

### **選項 A: 完成 Epic 5 所有功能** (預計 6-8 小時)
適合：需要完整採購流程的項目

### **選項 B: 優先實現 PO 管理頁面** (預計 2-3 小時)
適合：Vendor 和 PO 管理比報價上傳更重要

### **選項 C: 暫時跳過，開發其他 Epic** (推薦)
理由：
- Epic 5 核心功能已可用 (85% 完成)
- 報價上傳涉及檔案處理，較為複雜
- 可先完成 Epic 6 (費用記錄) 或 Epic 7 (儀表板)
- 回頭再補全報價上傳功能

---

## 📎 相關文件

- 後端 API: `packages/api/src/routers/vendor.ts`, `quote.ts`, `purchaseOrder.ts`
- 前端頁面: `apps/web/src/app/vendors/`
- 前端元件: `apps/web/src/components/vendor/VendorForm.tsx`
- User Stories: `docs/stories/epic-5-procurement-and-vendor-management/`
- Prisma Schema: `packages/db/prisma/schema.prisma` (Vendor, Quote, PurchaseOrder models)

---

**總結**：Epic 5 已完成 85%，**Vendor 管理功能 100% 完成**，後端 API 全部就緒。缺失的主要是**報價上傳 UI**和**報價比較/選擇流程**。建議先開發其他 Epic，回頭再補全這些進階功能。
