# Lessons Learned (經驗教訓記錄)

本文件記錄開發過程中的重要發現、解決方案和最佳實踐，幫助後續開發避免重複踩坑。

> **維護指南**: 每當遇到值得記錄的問題或發現時，請更新此文件。

---

## 目錄

- [架構決策](#架構決策)
- [技術問題與解決方案](#技術問題與解決方案)
- [效能優化](#效能優化)
- [安全性考量](#安全性考量)
- [第三方整合](#第三方整合)
- [開發流程改進](#開發流程改進)

---

## 架構決策

### AD-001: 使用 Next.js App Router 而非 Pages Router
- **日期**: 2025-12-XX
- **決策**: 採用 Next.js 14+ App Router
- **原因**:
  - Server Components 支援，減少客戶端 JavaScript
  - 更好的 layout 和 loading 狀態支援
  - 與 React 18+ 特性更好整合
- **影響**: 所有路由都在 `src/app/` 目錄下

### AD-002: 使用 Prisma 作為 ORM
- **日期**: 2025-12-XX
- **決策**: 採用 Prisma 而非 TypeORM 或 Drizzle
- **原因**:
  - 類型安全的查詢
  - 優秀的 migration 工具
  - 直觀的 schema 定義
- **注意事項**:
  - 複雜查詢需使用 `$queryRaw`
  - N+1 問題需使用 `include` 解決

### AD-003: Row Level Security (RLS) 實作方式
- **日期**: 2025-12-XX
- **決策**: 在 Service 層實作 RLS，而非資料庫層
- **原因**:
  - Prisma 不原生支援 PostgreSQL RLS
  - 更靈活的權限控制
  - 易於測試和除錯
- **實作**: 每個查詢都需帶入 `cityId` 過濾條件

---

## 技術問題與解決方案

### TP-001: [問題標題]
- **日期**: YYYY-MM-DD
- **Story**: X-Y
- **問題描述**:
  [描述遇到的問題]
- **根本原因**:
  [分析問題的根本原因]
- **解決方案**:
  [詳細的解決步驟]
- **程式碼範例**:
  ```typescript
  // 解決方案的程式碼
  ```
- **預防措施**:
  [如何避免類似問題]

---

## 效能優化

### PO-001: 大量資料表格虛擬化
- **日期**: YYYY-MM-DD
- **Story**: X-Y
- **場景**: 發票列表顯示 1000+ 筆資料
- **原始問題**: 頁面卡頓，FPS 降至 15
- **解決方案**: 使用 TanStack Virtual 實作虛擬捲動
- **效果**: FPS 恢復至 60，初始載入減少 80%
- **程式碼範例**:
  ```typescript
  import { useVirtualizer } from '@tanstack/react-virtual';

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
  });
  ```

### PO-002: API 回應分頁
- **日期**: YYYY-MM-DD
- **建議**: 所有列表 API 必須支援分頁
- **標準參數**: `page`, `pageSize` (預設 20，最大 100)
- **回應格式**:
  ```json
  {
    "data": [...],
    "meta": {
      "total": 1000,
      "page": 1,
      "pageSize": 20,
      "totalPages": 50
    }
  }
  ```

---

## 安全性考量

### SC-001: API 輸入驗證
- **日期**: YYYY-MM-DD
- **原則**: 永遠不信任客戶端輸入
- **實作**: 使用 Zod 驗證所有 API 請求
- **範例**:
  ```typescript
  const schema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(100),
    email: z.string().email(),
  });

  const validation = schema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.flatten() },
      { status: 400 }
    );
  }
  ```

### SC-002: 敏感資料處理
- **原則**:
  - 密碼永不記錄到日誌
  - API Key 只顯示部分字元
  - 敏感欄位使用 `@map` 或 `@ignore`
- **範例**:
  ```typescript
  // 記錄 API 呼叫時隱藏敏感資料
  console.log('API Call:', {
    ...request,
    apiKey: request.apiKey?.slice(0, 8) + '****',
  });
  ```

---

## 第三方整合

### TI-001: Azure AD SSO 整合
- **日期**: YYYY-MM-DD
- **Story**: 1-1
- **整合方式**: NextAuth.js + Azure AD Provider
- **注意事項**:
  - 需設定正確的 Redirect URI
  - Token 過期處理
  - 群組權限同步

### TI-002: Document Intelligence 整合
- **日期**: YYYY-MM-DD
- **Story**: 2-2
- **整合方式**: Azure AI Document Intelligence REST API
- **注意事項**:
  - API 呼叫有速率限制
  - 大檔案需使用非同步處理
  - 錯誤重試機制

### TI-003: n8n Webhook 整合
- **日期**: YYYY-MM-DD
- **Story**: 10-1
- **整合方式**: 雙向 Webhook 通訊
- **注意事項**:
  - Webhook Secret 驗證
  - 重試和冪等性
  - 錯誤通知機制

### TI-004: 資料庫備份實作
- **日期**: 2025-12-21
- **Story**: 12-5
- **整合方式**: Prisma + Node.js 備份服務
- **實作決策**:
  1. **Cron 解析**: 使用自定義邏輯而非 `cron-parser` 套件
     - 原因: 減少依賴、簡化維護、符合專案需求
     - 實作: `parseCronExpression()` 函數處理 5 欄位 cron 格式
  2. **自動備份偵測**: 檢查已啟用的 BackupSchedule 數量
     - `isAutoBackupEnabled = enabledScheduleCount > 0`
  3. **儲存空間上限**: 透過環境變數 `BACKUP_MAX_STORAGE_BYTES` 設定
     - 預設值: 100GB (107374182400 bytes)
  4. **備份執行**: 目前為模擬實作
     - 實際部署需整合 `pg_dump` 和 Azure Blob Storage
     - 加密方式: AES-256-CBC
- **技術債務**:
  - 備份執行為模擬，需在部署前實作實際備份邏輯
  - 需增加備份驗證機制（還原測試）
- **程式碼範例**:
  ```typescript
  // Cron 下次執行時間計算
  function getNextRunTime(cronExpression: string): Date {
    const parts = cronExpression.split(' ');
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    // ... 解析邏輯
  }
  ```

---

## 開發流程改進

### DP-001: Story 開發工作流
- **日期**: 2025-12-XX
- **建議流程**:
  1. 閱讀 Story + Tech Spec (完整理解需求)
  2. 檢查 component-registry.md 和 api-registry.md (避免重複)
  3. 實作後端 → 前端 → 測試
  4. 更新相關文件
  5. 記錄 lessons-learned.md

### DP-002: Tech Spec 參考方式
- **日期**: 2025-12-17
- **新結構**: Tech Specs 已按 Epic 分類
  - `tech-specs/epic-01-auth/` - 認證相關
  - `tech-specs/epic-02-ai-processing/` - AI 處理相關
  - 以此類推...
- **參考順序**:
  1. 先閱讀 Story 了解業務需求
  2. 再閱讀 Tech Spec 了解技術細節
  3. 參考已實作的類似功能

### DP-003: 程式碼審查重點
- **必查項目**:
  - [ ] 類型安全 (無 `any`)
  - [ ] 錯誤處理完整
  - [ ] 權限檢查正確
  - [ ] RLS 過濾條件
  - [ ] 輸入驗證
  - [ ] 適當的日誌記錄

---

## 常見陷阱 (Common Pitfalls)

### CP-001: Prisma 關聯查詢
- **問題**: 忘記 include 導致 N+1 查詢
- **解決**: 使用 `include` 或 `select` 明確指定
  ```typescript
  // ❌ 錯誤
  const users = await prisma.user.findMany();
  for (const user of users) {
    const city = await prisma.city.findUnique({ where: { id: user.cityId } });
  }

  // ✅ 正確
  const users = await prisma.user.findMany({
    include: { city: true }
  });
  ```

### CP-002: React Query 快取失效
- **問題**: 更新後列表沒有刷新
- **解決**: 使用 `invalidateQueries` 或設定正確的 `queryKey`
  ```typescript
  const mutation = useMutation({
    mutationFn: updateUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
  ```

### CP-003: Server Component vs Client Component
- **問題**: 在 Server Component 中使用 hooks
- **解決**: 需要互動的元件加上 `'use client'`
- **原則**:
  - 資料獲取 → Server Component
  - 互動/狀態 → Client Component

---

## 記錄模板

複製以下模板來新增記錄:

```markdown
### [類別]-[編號]: [標題]
- **日期**: YYYY-MM-DD
- **Story**: X-Y (如適用)
- **問題/場景描述**:
  [詳細描述]
- **解決方案/建議**:
  [詳細說明]
- **程式碼範例** (如適用):
  \`\`\`typescript
  // 程式碼
  \`\`\`
- **相關連結**:
  - [連結說明](URL)
```

---

*最後更新: 2025-12-21*
*請持續記錄開發過程中的重要發現*
