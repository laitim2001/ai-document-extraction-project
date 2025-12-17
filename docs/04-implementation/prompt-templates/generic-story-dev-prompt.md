# AI 助手開發指令：通用 Story 範本

> **使用說明**: 複製此範本，替換 `[X-Y]` 為實際的 Story 編號（如 `1-1`, `2-3`），
> 並替換其他 `[佔位符]` 為實際內容。

---

## 開發任務

**Story**: [X-Y] [Story 名稱]
**Epic**: Epic [X] - [Epic 名稱]
**狀態**: ready-for-dev

---

## 第一步：載入專案上下文

請依序閱讀以下文件：

### 必讀文件 (按順序)

1. **專案整體上下文**
   ```
   docs/04-implementation/implementation-context.md
   ```

2. **Story 需求定義**
   ```
   docs/04-implementation/stories/[X-Y]-[story-name].md
   ```

3. **技術規格**
   ```
   docs/04-implementation/tech-specs/epic-[XX]-[epic-folder]/tech-spec-story-[X-Y].md
   ```

### 參考文件 (開發時查閱)

```
docs/04-implementation/dev-checklist.md        # 開發檢查清單
docs/04-implementation/component-registry.md   # 已實作元件
docs/04-implementation/api-registry.md         # 已實作 API
docs/04-implementation/lessons-learned.md      # 經驗教訓
```

---

## 第二步：理解需求

### 閱讀後請確認

- [ ] 我理解這個 Story 的業務目標
- [ ] 我理解所有的 Acceptance Criteria
- [ ] 我知道這個 Story 的前置依賴
- [ ] 我已檢查 component-registry.md 中有無可重用的元件
- [ ] 我已檢查 api-registry.md 中有無相關的 API

### 如有疑問

在開始開發前，請提出任何疑問或需要澄清的地方。

---

## 第三步：執行開發

### 遵循的原則

1. **嚴格遵循 Tech Spec** - Tech Spec 是實作的主要依據
2. **使用 dev-checklist.md** - 確保品質標準
3. **避免重複實作** - 先查閱 registry 文件
4. **遵循編碼規範** - 參考 implementation-context.md 第 3 節

### 開發順序建議

```
1. 後端 (Backend)
   ├── Prisma Schema 更新 (如需要)
   ├── Service 層實作
   └── API Routes 實作

2. 前端 (Frontend)
   ├── 頁面建立
   ├── 元件開發
   └── 狀態管理整合

3. 測試與驗證
   ├── 單元測試 (如適用)
   ├── 手動測試所有 AC
   └── 執行 lint 和 type-check
```

---

## 第四步：品質檢查

### 開發完成後必須確認

- [ ] 所有 Acceptance Criteria 已滿足
- [ ] `npm run lint` 無錯誤
- [ ] `npm run build` 無錯誤
- [ ] `npx tsc --noEmit` 無類型錯誤
- [ ] 無遺留的 TODO 或 FIXME
- [ ] 無硬編碼的敏感資訊
- [ ] API 響應格式符合標準

### 權限與安全檢查 (如適用)

- [ ] API 有身份驗證檢查
- [ ] API 有角色權限檢查
- [ ] 資料查詢有城市隔離 (RLS)
- [ ] 輸入有 Zod 驗證

---

## 第五步：更新文件

### 必須更新的文件

1. **如有新增元件**
   ```
   docs/04-implementation/component-registry.md
   ```

2. **如有新增 API**
   ```
   docs/04-implementation/api-registry.md
   ```

3. **如有重要發現**
   ```
   docs/04-implementation/lessons-learned.md
   ```

### 更新 Story 狀態

完成後更新 `docs/04-implementation/sprint-status.yaml`:
- 將此 Story 狀態從 `ready-for-dev` 改為 `done`

---

## 常用命令參考

```bash
# 開發伺服器
npm run dev

# 類型檢查
npm run build
npx tsc --noEmit

# Lint 檢查
npm run lint

# Prisma
npx prisma generate          # 生成客戶端
npx prisma migrate dev       # 開發遷移
npx prisma studio            # 資料庫 GUI

# 測試
npm run test
```

---

## Epic 對應的 Tech Spec 資料夾

| Epic | Tech Spec 路徑 |
|------|----------------|
| Epic 1 | `tech-specs/epic-01-auth/` |
| Epic 2 | `tech-specs/epic-02-ai-processing/` |
| Epic 3 | `tech-specs/epic-03-review-workflow/` |
| Epic 4 | `tech-specs/epic-04-mapping-rules/` |
| Epic 5 | `tech-specs/epic-05-forwarder-config/` |
| Epic 6 | `tech-specs/epic-06-multi-city/` |
| Epic 7 | `tech-specs/epic-07-reports-dashboard/` |
| Epic 8 | `tech-specs/epic-08-audit-compliance/` |
| Epic 9 | `tech-specs/epic-09-auto-retrieval/` |
| Epic 10 | `tech-specs/epic-10-n8n-integration/` |
| Epic 11 | `tech-specs/epic-11-external-api/` |
| Epic 12 | `tech-specs/epic-12-system-admin/` |

---

*範本版本: 1.0*
*建立日期: 2025-12-17*
