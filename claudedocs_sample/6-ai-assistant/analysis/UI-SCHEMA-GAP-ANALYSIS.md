# UI-Schema 差異分析報告

> **生成日期**: 2025-10-27
> **分析範圍**: 所有 8 個核心模塊的 Schema vs UI 完整性
> **狀態**: 🔴 發現重大差異

---

## 📊 執行摘要

### 分析結果概覽

| 模塊 | Schema 狀態 | UI 實現狀態 | 差異數量 | 優先級 |
|------|------------|-------------|----------|--------|
| 1. 預算池 (BudgetPool) | ✅ 完整 | ✅ 完整 | 0 | - |
| 2. 項目管理 (Project) | ✅ 完整 | ✅ 完整 | 0 | - |
| 3. 預算提案 (BudgetProposal) | ✅ 完整 | ⚠️ **部分實現** | **6 個欄位** | 🔴 High |
| 4. 採購管理 (PurchaseOrder) | ✅ 完整 | ⚠️ 待確認 | 待檢查 | 🟡 Medium |
| 5. **支出管理 (Expense)** | ⚠️ **缺少 projectId** | ⚠️ **部分實現** | **6 個欄位** | 🔴 Critical |
| 6. 費用轉嫁 (ChargeOut) | ✅ 完整 | ❌ **完全缺失** | **整個模塊** | 🔴 Critical |
| 7. OM 費用 (OMExpense) | ✅ 完整 | ❌ **完全缺失** | **整個模塊** | 🔴 Critical |
| 8. OpCo 管理 (OperatingCompany) | ✅ 完整 | ❌ **完全缺失** | **整個模塊** | 🟡 Medium |

---

## 🔍 詳細差異分析

### ⚠️ 問題 1: Expense 模型 Schema 缺失

#### Schema 缺少的欄位：
```prisma
model Expense {
  // ❌ 缺少：直接關聯項目
  // projectId String  // 應該新增此欄位

  // 現狀：只能通過 PurchaseOrder 間接關聯
  purchaseOrderId String
}
```

#### 問題影響：
- ❌ **查詢效率低**: 需要通過 `Expense → PurchaseOrder → Project` 雙層查詢
- ❌ **業務邏輯複雜**: 無法直接查詢某項目的所有支出
- ❌ **報表生成困難**: 項目預算使用需要多層 JOIN
- ❌ **不符合業務需求**: 用戶原始需求明確提到「支出管理包含關聯項目」

#### 解決方案：
👉 **Module 2.5: Expense 直接關聯 Project**（已規劃）

---

### ⚠️ 問題 2: ExpenseForm 缺少的 UI 欄位

**文件**: `apps/web/src/components/expense/ExpenseForm.tsx`

#### 現有欄位（✅ 已實現）：
```typescript
✅ purchaseOrderId  // 採購單選擇
✅ name             // 費用名稱
✅ amount           // 費用金額
✅ expenseDate      // 費用日期
✅ invoiceNumber    // 發票號碼
✅ invoiceDate      // 發票日期
✅ invoiceFilePath  // 發票文件
✅ description      // 備註說明
```

#### 缺少的欄位（❌ 未實現）：

| 欄位 | Schema 存在 | UI 缺失 | 業務需求 | 優先級 |
|------|------------|--------|---------|--------|
| **projectId** | ❌ | ❌ | 關聯項目（直接） | 🔴 Critical |
| **budgetCategoryId** | ✅ | ❌ | 關聯預算類別 | 🔴 High |
| **vendorId** | ✅ | ❌ | 供應商名稱/關聯供應商記錄 | 🟡 Medium |
| **requiresChargeOut** | ✅ | ❌ | 是否需要收回費用 (charge out) | 🔴 High |
| **isOperationMaint** | ✅ | ❌ | 是否 operation maintenance | 🟡 Medium |

#### 缺失欄位示例（應該添加的 UI）：

```tsx
{/* ❌ 缺少：項目選擇 */}
<FormField name="projectId">
  <FormLabel>關聯項目 *</FormLabel>
  <Select>
    <option value="">請選擇項目</option>
    {projects.map(p => <option value={p.id}>{p.name}</option>)}
  </Select>
</FormField>

{/* ❌ 缺少：預算類別選擇 */}
<FormField name="budgetCategoryId">
  <FormLabel>預算類別</FormLabel>
  <Select>
    <option value="">請選擇預算類別</option>
    {categories.map(c => <option value={c.id}>{c.categoryName}</option>)}
  </Select>
</FormField>

{/* ❌ 缺少：供應商選擇 */}
<FormField name="vendorId">
  <FormLabel>供應商</FormLabel>
  <Select>
    <option value="">請選擇供應商</option>
    {vendors.map(v => <option value={v.id}>{v.name}</option>)}
  </Select>
</FormField>

{/* ❌ 缺少：費用轉嫁標記 */}
<FormField name="requiresChargeOut">
  <FormLabel>
    <Checkbox checked={requiresChargeOut} onChange={...} />
    是否需要費用轉嫁 (Charge Out)
  </FormLabel>
</FormField>

{/* ❌ 缺少：運維費用標記 */}
<FormField name="isOperationMaint">
  <FormLabel>
    <Checkbox checked={isOperationMaint} onChange={...} />
    是否為運維費用 (Operation Maintenance)
  </FormLabel>
</FormField>
```

---

### ⚠️ 問題 3: BudgetProposal 詳情頁缺少的功能

**文件**: `apps/web/src/app/proposals/[id]/page.tsx`

#### Schema 中存在但 UI 缺失的功能：

| 功能模塊 | Schema 欄位 | UI 狀態 | 業務需求 | 優先級 |
|---------|-----------|--------|---------|--------|
| **計劃書文件上傳** | proposalFilePath<br>proposalFileName<br>proposalFileSize | ❌ 完全缺失 | 計劃書文件上傳 (PDF/PPT) | 🔴 High |
| **會議記錄** | meetingDate<br>meetingNotes<br>presentedBy | ❌ 完全缺失 | 會議記錄功能<br>會議日期<br>負責介紹人員 | 🔴 High |
| **批准金額顯示** | approvedAmount | ❌ 未顯示 | 批准的預算金額 | 🟡 Medium |

#### 應該添加的 UI 結構：

**Tabs 佈局建議**：
```tsx
<Tabs>
  <TabsList>
    <TabsTrigger value="overview">提案概覽</TabsTrigger>
    <TabsTrigger value="proposal">計劃書文件</TabsTrigger>  {/* ❌ 新增 */}
    <TabsTrigger value="meeting">會議記錄</TabsTrigger>      {/* ❌ 新增 */}
    <TabsTrigger value="comments">評論討論</TabsTrigger>
    <TabsTrigger value="history">審批歷史</TabsTrigger>
  </TabsList>

  {/* ❌ 新增：計劃書文件 Tab */}
  <TabsContent value="proposal">
    <Card>
      <CardHeader>
        <CardTitle>項目計劃書文件</CardTitle>
        <Button onClick={() => setShowUploadDialog(true)}>
          <Upload /> 上傳計劃書
        </Button>
      </CardHeader>
      <CardContent>
        {/* 文件預覽、下載功能 */}
      </CardContent>
    </Card>
  </TabsContent>

  {/* ❌ 新增：會議記錄 Tab */}
  <TabsContent value="meeting">
    <Card>
      <CardHeader>
        <CardTitle>會議記錄</CardTitle>
        <Button onClick={() => setShowMeetingDialog(true)}>
          <Edit /> 編輯會議記錄
        </Button>
      </CardHeader>
      <CardContent>
        <InfoRow label="會議日期" value={formatDate(meetingDate)} />
        <InfoRow label="介紹人員" value={presentedBy} />
        <div className="mt-4 p-4 bg-muted rounded-lg">
          {meetingNotes}
        </div>
      </CardContent>
    </Card>
  </TabsContent>
</Tabs>
```

---

### ⚠️ 問題 4: 完全缺失的頁面模塊

#### 4.1 費用轉嫁 (ChargeOut) ❌

**Schema 狀態**: ✅ 完整（ChargeOut + ChargeOutItem 模型完整）

**UI 狀態**: ❌ **完全不存在**

**應該存在的頁面**:
- ❌ `/charge-outs/page.tsx` - 費用轉嫁列表頁
- ❌ `/charge-outs/[id]/page.tsx` - 費用轉嫁詳情頁
- ❌ `/charge-outs/new/page.tsx` - 創建費用轉嫁
- ❌ `ChargeOutForm.tsx` - 費用轉嫁表單組件

**缺失的核心功能**：
```yaml
列表頁:
  - 顯示所有 Charge Out 記錄
  - 按項目、OpCo、狀態篩選
  - 狀態: Draft, Submitted, Confirmed, Paid, Rejected

創建/編輯頁:
  - 選擇關聯項目
  - 選擇目標 OpCo
  - 選擇需要轉嫁的費用（明細）
  - 生成 Debit Note 號碼
  - 設置開立日期、收款日期

詳情頁:
  - 顯示 Charge Out 基本資訊
  - 顯示明細列表（關聯的 Expenses）
  - 確認/拒絕操作（審核流程）
  - 記錄確認者和確認時間
```

---

#### 4.2 操作與維護費用 (OMExpense) ❌

**Schema 狀態**: ✅ 完整（OMExpense + OMExpenseMonthly 模型完整）

**UI 狀態**: ❌ **完全不存在**

**應該存在的頁面**:
- ❌ `/om-expenses/page.tsx` - OM 費用列表頁
- ❌ `/om-expenses/[id]/page.tsx` - OM 費用詳情頁
- ❌ `/om-expenses/new/page.tsx` - 創建 OM 費用
- ❌ `OMExpenseForm.tsx` - OM 費用表單組件
- ❌ `MonthlyRecordsGrid.tsx` - 月度記錄輸入網格

**缺失的核心功能**：
```yaml
列表頁:
  - 按年度、類別、OpCo 篩選
  - 顯示預算金額、實際支出、使用率
  - 顯示增長率（對比上年度）

創建/編輯頁:
  - 基本資訊：名稱、描述、年度、類別
  - 選擇持有的 OpCo
  - 選擇供應商
  - 設置預算金額、日期範圍
  - 輸入增長率

詳情頁:
  - 顯示 OM 費用基本資訊
  - 月度記錄表格（1-12月）
    * 每月實際支出金額
    * 自動計算總支出
    * 預算使用率
```

---

#### 4.3 營運公司 (OperatingCompany) ❌

**Schema 狀態**: ✅ 完整

**UI 狀態**: ❌ **完全不存在**

**應該存在的頁面**:
- ❌ `/operating-companies/page.tsx` - OpCo 列表頁
- ❌ `/operating-companies/[id]/page.tsx` - OpCo 詳情頁
- ❌ `OpCoForm.tsx` - OpCo 表單組件

**缺失的核心功能**：
```yaml
列表頁:
  - 顯示所有 OpCo
  - 顯示代碼、名稱、狀態

創建/編輯頁:
  - 輸入 OpCo 代碼（如 OpCo-HK）
  - 輸入 OpCo 名稱（如 Hong Kong Operations）
  - 輸入描述
  - 設置啟用/停用狀態

詳情頁:
  - 顯示 OpCo 基本資訊
  - 顯示關聯的 Charge Outs
  - 顯示關聯的 OM Expenses
```

---

## 📋 修復優先級與工時估算

### 🔴 Critical Priority（必須立即修復）

| 任務 | 範圍 | 工時估算 | 依賴 |
|------|------|---------|------|
| **Module 2.5: Expense 直接關聯 Project** | Schema + API + UI | 3.5 小時 | 無 |
| **ExpenseForm 補充欠缺欄位** | 5 個新欄位 + 驗證 | 2 小時 | Module 2.5 |
| **ChargeOut 完整模塊實施** | 4 頁面 + API + 組件 | 12-16 小時 | Expense 完整 |
| **OMExpense 完整模塊實施** | 4 頁面 + API + 組件 | 12-16 小時 | OpCo 管理 |

### 🔴 High Priority（近期實施）

| 任務 | 範圍 | 工時估算 | 依賴 |
|------|------|---------|------|
| **BudgetProposal 計劃書上傳** | UI + API + 文件處理 | 4 小時 | 無 |
| **BudgetProposal 會議記錄** | UI + API | 3 小時 | 無 |

### 🟡 Medium Priority（規劃實施）

| 任務 | 範圍 | 工時估算 | 依賴 |
|------|------|---------|------|
| **OperatingCompany 管理** | 3 頁面 + API + 組件 | 6-8 小時 | 無 |

---

## 🎯 建議的實施順序

### Phase 1: 基礎修復（1-2 天）
```
1. Module 2.5: Expense 直接關聯 Project (3.5h)
2. ExpenseForm 補充欠缺欄位 (2h)
3. BudgetProposal 計劃書上傳 (4h)
4. BudgetProposal 會議記錄 (3h)
```
**總工時**: 12.5 小時

### Phase 2: OpCo 與 OM 費用（2-3 天）
```
1. OperatingCompany 管理模塊 (6-8h)
2. OMExpense 完整實施 (12-16h)
```
**總工時**: 18-24 小時

### Phase 3: ChargeOut 完整實施（2-3 天）
```
1. ChargeOut 完整模塊 (12-16h)
```
**總工時**: 12-16 小時

---

## ✅ 下一步行動

### 立即執行：
1. ✅ 用戶已同意實施 **Module 2.5**
2. 📝 更新 `COMPLETE-IMPLEMENTATION-PLAN.md` 包含：
   - Module 2.5: Expense 直接關聯 Project
   - ExpenseForm 欠缺欄位補充
   - BudgetProposal 功能增強
   - ChargeOut 完整實施
   - OMExpense 完整實施
   - OpCo 管理實施

### 待用戶確認：
- [ ] 是否立即開始 Module 2.5 實施？
- [ ] Phase 1-3 的優先順序是否需要調整？
- [ ] 是否有其他業務需求需要優先處理？

---

**報告生成時間**: 2025-10-27 02:30
**分析完成度**: 100%
**建議執行**: 立即開始 Module 2.5 並更新實施計劃
