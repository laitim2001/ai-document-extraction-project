# FIX-062: Charge-Outs 頁面 I18N 修復報告

**修復日期**: 2025-11-07
**修復範圍**: Charge-Outs 頁面麵包屑路由與翻譯檔案完整性
**嚴重等級**: 🟡 中等 (影響使用者體驗和多語言功能)
**狀態**: ✅ 已完成

---

## 問題描述

### 問題 1: Charge-Outs 頁面麵包屑路由問題
- **檔案**: `apps/web/src/app/[locale]/charge-outs/[id]/page.tsx`, `apps/web/src/app/[locale]/charge-outs/new/page.tsx`
- **問題**:
  - 麵包屑使用 `BreadcrumbLink` 而非 i18n Link 組件
  - 硬編碼中文文字未使用翻譯鍵
  - 返回按鈕使用 `router.push()` 而非 `router.back()`

### 問題 2: 翻譯檔案完整性問題
- **檔案**: `apps/web/src/messages/en.json`, `apps/web/src/messages/zh-TW.json`
- **問題**:
  - proposals.comments 有重複鍵 (中文版和英文版)
  - proposals.history.action 中有中文值
  - zh-TW.json 缺少 projects.detail 相關鍵
  - zh-TW.json 有多餘的鍵 (entityName, edit.notFound, 等)
  - chargeOuts.detail 翻譯不完整

---

## 修復內容

### 1. Charge-Outs [id]/page.tsx

**修改項目**:
1. 添加 `import { Link } from "@/i18n/routing"`
2. 添加 `tNav` 和 `tCommon` 翻譯 hooks
3. 修復麵包屑導航:
   ```typescript
   // Before
   <BreadcrumbLink href="/dashboard">首頁</BreadcrumbLink>
   <BreadcrumbLink href="/charge-outs">費用轉嫁</BreadcrumbLink>

   // After
   <Link href="/dashboard">{tNav('home')}</Link>
   <Link href="/charge-outs">{tNav('menu.chargeOuts')}</Link>
   ```

4. 替換所有硬編碼中文:
   - Loading: `載入中...` → `{tCommon('loading')}`
   - Not Found: `找不到 ChargeOut 記錄` → `{t('detail.notFound')}`
   - Status text: 使用 `tCommon('status.*')` 翻譯
   - 所有欄位標籤: 使用 `t('detail.*')` 翻譯

5. 修改返回按鈕:
   ```typescript
   // Before
   <Button onClick={() => router.push('/charge-outs')}>

   // After
   <Button onClick={() => router.back()}>
   ```

**翻譯鍵使用統計**:
- `chargeOuts.detail.*`: 20+ 個鍵
- `common.status.*`: 5 個狀態鍵
- `common.fields.*`: 3 個通用欄位
- `common.actions.*`: 2 個操作按鈕

### 2. Charge-Outs new/page.tsx

**修改項目**:
1. 添加 `import { Link } from "@/i18n/routing"`
2. 添加 `tNav` 翻譯 hook
3. 修復麵包屑導航 (同上)
4. 替換頁面標題和描述:
   ```typescript
   // Before
   <h1>新增 ChargeOut</h1>
   <p>創建新的費用轉嫁記錄，將 IT 費用轉嫁至營運公司 (OpCo)</p>

   // After
   <h1>{t('form.create.title')}</h1>
   <p>{t('form.create.subtitle')}</p>
   ```

5. 修改返回按鈕 (同上)

### 3. en.json 翻譯檔案修復

**修復項目**:
1. **移除重複的 proposals.comments** (第一個中文版):
   ```json
   // 移除:
   "comments": {
     "title": "討論區",
     "addComment": "新增評論",
     ...
   }
   ```

2. **修復 proposals.history 中文值**:
   ```json
   // Before
   "history": {
     "title": "審批歷史",
     "action": {
       "created": "建立提案",
       ...
     }
   }

   // After
   "history": {
     "title": "Approval History",
     "action": {
       "created": "Created",
       "submitted": "Submitted",
       "approved": "Approved",
       ...
     }
   }
   ```

3. **補充 chargeOuts.detail 翻譯**:
   ```json
   "detail": {
     "notFound": "Charge out record not found",
     "noDescription": "No description",
     "basicInfo": "Basic Information",
     "debitNoteNumber": "Debit Note Number",
     "issueDate": "Issue Date",
     "paymentDate": "Payment Date",
     "confirmer": "Confirmer",
     "confirmedAt": "Confirmed At",
     "expenseItems": "Expense Items",
     "itemsCount": "{count} expense item(s)",
     "table": {
       "expenseName": "Expense Name",
       "invoiceNumber": "Invoice Number",
       "amount": "Amount (HKD)"
     },
     "total": "Total",
     "projectInfo": "Project Information",
     "projectName": "Project Name",
     "projectDescription": "Project Description",
     "projectManager": "Project Manager",
     "opCoInfo": "Operating Company (OpCo)",
     "opCoCode": "OpCo Code",
     "opCoName": "OpCo Name",
     "timeline": "Timeline"
   }
   ```

4. **補充 common.status**:
   ```json
   "status": {
     ...
     "submitted": "Submitted",
     "confirmed": "Confirmed"
   }
   ```

5. **補充 common.fields.status**:
   ```json
   "fields": {
     ...
     "status": "Status"
   }
   ```

### 4. zh-TW.json 翻譯檔案修復

**修復項目**:
1. **移除重複的 proposals.comments** (同 en.json)

2. **補充 projects.detail 缺失鍵**:
   ```json
   "detail": {
     ...
     "overview": "概覽",
     "budget": "預算資訊",
     "proposals": "預算提案",
     "purchaseOrders": "採購單",
     "expenses": "費用",
     "tabs": {
       "overview": "概覽",
       "proposals": "提案",
       "quotes": "報價",
       "purchaseOrders": "採購單",
       "expenses": "費用"
     }
   }
   ```

3. **移除多餘的鍵**:
   - `projects.form.entityName`: ❌ 移除
   - `projects.form.edit.notFound`: ❌ 移除
   - `projects.form.edit.backToList`: ❌ 移除
   - `proposals.dashboard`: ❌ 移除
   - `proposals.noData`: ❌ 移除
   - `proposals.empty.hint`: ❌ 移除
   - `proposals.fields.actions`: ❌ 移除
   - `proposals.fields.createdAt`: ❌ 移除

4. **補充 proposals.summary**:
   ```json
   "summary": {
     "total": "總計"
   }
   ```

5. **補充 chargeOuts.detail** (同 en.json 的中文版)

6. **補充 common.status** (同 en.json)

---

## 驗證結果

### 修復前驗證輸出:
```
❌ 發現 5 個重複鍵:
  - proposals.comments
  - proposals.comments.title
  - proposals.comments.addComment
  - proposals.comments.placeholder
  - proposals.comments.submit

⚠️ zh-TW.json 缺少 10 個鍵
⚠️ zh-TW.json 多出 8 個鍵
```

### 修復後驗證輸出:
```
✅ JSON 語法正確
✅ 沒有發現重複鍵
✅ 沒有發現空值
✅ 鍵結構完全一致 (1303 個鍵)
✅ 所有檢查通過!翻譯文件完全正確。
```

---

## 測試建議

### 1. 功能測試
```bash
# 啟動開發伺服器
pnpm dev

# 測試項目:
✅ 訪問 /charge-outs/[id] 頁面
✅ 驗證麵包屑可點擊並正確導航
✅ 切換語言 (en/zh-TW) 驗證翻譯
✅ 點擊返回按鈕 (應使用瀏覽器歷史)
✅ 驗證所有文字都已翻譯 (無硬編碼中文)
```

### 2. 路由測試
```bash
# 測試麵包屑導航:
1. 從 Dashboard → Charge Outs → 詳情頁
2. 點擊麵包屑 "Charge Outs" → 應返回列表頁
3. 點擊麵包屑 "Dashboard" → 應返回首頁
4. 點擊返回按鈕 → 應返回上一頁 (使用 history.back)
```

### 3. 翻譯測試
```bash
# 在瀏覽器中切換語言:
1. 訪問 http://localhost:3000/en/charge-outs/xxx
2. 訪問 http://localhost:3000/zh-TW/charge-outs/xxx
3. 驗證所有UI文字正確翻譯
4. 驗證沒有顯示 "Missing translation" 錯誤
```

---

## 影響範圍

### 修改檔案統計:
- **前端頁面**: 2 個檔案
  - `apps/web/src/app/[locale]/charge-outs/[id]/page.tsx`
  - `apps/web/src/app/[locale]/charge-outs/new/page.tsx`

- **翻譯檔案**: 2 個檔案
  - `apps/web/src/messages/en.json` (+30 個鍵, -7 個重複鍵)
  - `apps/web/src/messages/zh-TW.json` (+15 個鍵, -13 個多餘鍵)

### 新增翻譯鍵統計:
- `chargeOuts.detail.*`: 24 個鍵
- `chargeOuts.form.create.*`: 2 個鍵
- `projects.detail.*`: 10 個鍵
- `common.status.*`: 2 個鍵
- `common.fields.*`: 1 個鍵

---

## 後續工作

### 待修復項目:
1. ✅ Charge-Outs 頁面 (已完成)
2. ⏳ ChargeOutForm.tsx 組件 (待修復)
3. ⏳ ProposalFileUpload.tsx 組件 (待修復)
4. ⏳ ProposalMeetingNotes.tsx 組件 (待修復)
5. ⏳ OM Expenses 所有頁面 (待修復)
6. ⏳ Projects Quotes 頁面 (待修復)

### 建議的修復順序:
1. **優先**: 修復組件中的硬編碼文字 (ChargeOutForm, ProposalFileUpload, ProposalMeetingNotes)
2. **次要**: 修復 OM Expenses 頁面
3. **一般**: 修復 Projects Quotes 頁面

---

## 經驗總結

### 成功經驗:
1. ✅ **系統性修復**: 按照優先順序逐步修復,避免遺漏
2. ✅ **驗證先行**: 使用 `pnpm validate:i18n` 先發現問題,再針對性修復
3. ✅ **模式一致**: 統一使用 Link from "@/i18n/routing" 進行路由導航
4. ✅ **翻譯分層**: 使用 tNav, tCommon, t 三層翻譯 hooks,避免重複

### 注意事項:
1. ⚠️ **麵包屑組件**: 必須使用 `Link from "@/i18n/routing"`,而非 `BreadcrumbLink`
2. ⚠️ **返回按鈕**: 優先使用 `router.back()` 而非 `router.push()`
3. ⚠️ **翻譯鍵命名**: 遵循層級結構 (module.section.field)
4. ⚠️ **重複鍵檢查**: 注意 en.json 中的中文值 (應全部為英文)

---

**修復完成**: ✅ 所有 Charge-Outs 頁面的 I18N 問題已修復並通過驗證
**驗證狀態**: ✅ `pnpm validate:i18n` 全部檢查通過 (1303 個鍵)
**下一步**: 修復 ChargeOutForm, ProposalFileUpload, ProposalMeetingNotes 組件
