# Epic 7: Dashboard and Basic Reporting - 實施計劃

**創建日期**: 2025-10-05
**狀態**: 規劃中
**預計完成時間**: 4-6 小時

---

## 📋 Epic 概述

Epic 7 專注於為不同角色（專案經理、主管）提供個人化的儀表板視圖，以及基礎的數據導出功能。這是用戶登入後的主要工作入口，將大幅提升日常工作效率。

### 核心目標
1. **專案經理儀表板**: 顯示我的專案和待辦任務
2. **主管儀表板**: 顯示所有專案總覽和預算池狀況
3. **數據導出**: 支援將儀表板數據導出為 CSV
4. **預算池概覽**: 實時監控部門財務狀況

---

## 🎯 Story 分解與實施順序

### Story 7.1: 專案經理儀表板

#### 後端 API (`packages/api/src/routers/dashboard.ts`)

**API 設計**:
```typescript
export const dashboardRouter = createTRPCRouter({
  // 專案經理儀表板數據
  getProjectManagerDashboard: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    // 1. 我負責的專案
    const myProjects = await ctx.prisma.project.findMany({
      where: { managerId: userId },
      include: {
        budgetPool: true,
        proposals: { where: { status: { in: ['PendingApproval', 'MoreInfoRequired'] } } },
        purchaseOrders: { include: { expenses: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // 2. 待我處理的任務
    const pendingTasks = {
      proposalsNeedingInfo: await ctx.prisma.budgetProposal.findMany({
        where: {
          project: { managerId: userId },
          status: 'MoreInfoRequired',
        },
        include: { project: true },
        orderBy: { updatedAt: 'desc' },
      }),
      draftExpenses: await ctx.prisma.expense.findMany({
        where: {
          purchaseOrder: { project: { managerId: userId } },
          status: 'Draft',
        },
        include: { purchaseOrder: { include: { project: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
    };

    // 3. 統計數據
    const stats = {
      totalProjects: myProjects.length,
      activeProjects: myProjects.filter(p => p.status === 'Active').length,
      pendingApprovals: myProjects.reduce((sum, p) =>
        sum + p.proposals.filter(prop => prop.status === 'PendingApproval').length, 0
      ),
      pendingTasks: pendingTasks.proposalsNeedingInfo.length + pendingTasks.draftExpenses.length,
    };

    return { myProjects, pendingTasks, stats };
  }),
});
```

#### 前端頁面 (`apps/web/src/app/dashboard/pm/page.tsx`)

**組件結構**:
```tsx
export default function ProjectManagerDashboard() {
  const { data, isLoading } = api.dashboard.getProjectManagerDashboard.useQuery();

  return (
    <DashboardLayout>
      {/* 統計卡片 */}
      <div className="grid gap-6 md:grid-cols-4">
        <StatCard title="總專案數" value={stats.totalProjects} icon={<Briefcase />} />
        <StatCard title="進行中專案" value={stats.activeProjects} icon={<Play />} />
        <StatCard title="待審批" value={stats.pendingApprovals} icon={<Clock />} />
        <StatCard title="待處理任務" value={stats.pendingTasks} icon={<AlertCircle />} />
      </div>

      {/* 我的專案列表 */}
      <Card>
        <CardHeader>
          <CardTitle>我負責的專案</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectList projects={data.myProjects} />
        </CardContent>
      </Card>

      {/* 待處理任務 */}
      <Card>
        <CardHeader>
          <CardTitle>等待我處理</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs>
            <TabsList>
              <TabsTrigger value="proposals">需補充資訊的提案</TabsTrigger>
              <TabsTrigger value="expenses">草稿費用</TabsTrigger>
            </TabsList>
            <TabsContent value="proposals">
              <ProposalTaskList proposals={data.pendingTasks.proposalsNeedingInfo} />
            </TabsContent>
            <TabsContent value="expenses">
              <ExpenseTaskList expenses={data.pendingTasks.draftExpenses} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
```

**預計時間**: 2 小時 (後端 1h + 前端 1h)

---

### Story 7.2: 主管儀表板

#### 後端 API (擴充 `dashboard.ts`)

**API 設計**:
```typescript
export const dashboardRouter = createTRPCRouter({
  // ... PM dashboard

  // 主管儀表板數據
  getSupervisorDashboard: protectedProcedure
    .input(z.object({
      status: z.enum(['Active', 'Completed', 'Cancelled']).optional(),
      managerId: z.string().uuid().optional(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ ctx, input }) => {
      // 權限檢查
      if (ctx.session.user.role !== 'Supervisor') {
        throw new TRPCError({ code: 'FORBIDDEN', message: '僅主管可訪問' });
      }

      const { status, managerId, page, limit } = input;

      // 構建查詢條件
      const where = {
        ...(status && { status }),
        ...(managerId && { managerId }),
      };

      // 查詢所有專案
      const [projects, total] = await Promise.all([
        ctx.prisma.project.findMany({
          where,
          include: {
            manager: { select: { id: true, name: true, email: true } },
            budgetPool: true,
            proposals: { orderBy: { createdAt: 'desc' }, take: 1 },
            purchaseOrders: { include: { expenses: true } },
          },
          orderBy: { updatedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        ctx.prisma.project.count({ where }),
      ]);

      // 統計數據
      const stats = {
        totalProjects: total,
        activeProjects: await ctx.prisma.project.count({ where: { status: 'Active' } }),
        completedProjects: await ctx.prisma.project.count({ where: { status: 'Completed' } }),
        pendingApprovals: await ctx.prisma.budgetProposal.count({
          where: { status: 'PendingApproval' }
        }),
      };

      return {
        projects,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        stats,
      };
    }),
});
```

#### 前端頁面 (`apps/web/src/app/dashboard/supervisor/page.tsx`)

**組件結構**:
```tsx
export default function SupervisorDashboard() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [managerId, setManagerId] = useState<string | undefined>(undefined);

  const { data, isLoading } = api.dashboard.getSupervisorDashboard.useQuery({
    page, status, managerId,
  });

  return (
    <DashboardLayout>
      {/* 統計卡片 */}
      <div className="grid gap-6 md:grid-cols-4">
        <StatCard title="總專案數" value={stats.totalProjects} />
        <StatCard title="進行中" value={stats.activeProjects} />
        <StatCard title="已完成" value={stats.completedProjects} />
        <StatCard title="待審批提案" value={stats.pendingApprovals} />
      </div>

      {/* 篩選欄 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">所有狀態</option>
              <option value="Active">進行中</option>
              <option value="Completed">已完成</option>
              <option value="Cancelled">已取消</option>
            </Select>

            <Select value={managerId} onChange={(e) => setManagerId(e.target.value)}>
              <option value="">所有專案經理</option>
              {/* 動態載入 PM 列表 */}
            </Select>

            <Button onClick={() => exportData()}>
              <Download className="h-4 w-4 mr-2" />
              導出數據
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 專案列表 */}
      <Card>
        <CardHeader>
          <CardTitle>部門專案總覽</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectTable projects={data.projects} />
        </CardContent>
      </Card>

      {/* 分頁 */}
      <Pagination
        currentPage={data.pagination.page}
        totalPages={data.pagination.totalPages}
        onPageChange={setPage}
      />
    </DashboardLayout>
  );
}
```

**預計時間**: 2 小時 (後端 1h + 前端 1h)

---

### Story 7.4: 預算池概覽 (整合到主管儀表板)

#### 後端 API (擴充 `getSupervisorDashboard`)

**數據聚合**:
```typescript
// 在 getSupervisorDashboard 中添加
const budgetPools = await ctx.prisma.budgetPool.findMany({
  include: {
    projects: {
      include: {
        purchaseOrders: {
          include: {
            expenses: {
              where: { status: { in: ['Approved', 'Paid'] } },
            },
          },
        },
      },
    },
  },
  orderBy: { fiscalYear: 'desc' },
});

// 計算每個預算池的使用情況
const budgetPoolOverview = budgetPools.map(pool => {
  const totalUsed = pool.usedAmount; // 已在 Epic 6 中實現實時扣款
  const remaining = pool.totalAmount - totalUsed;
  const usagePercentage = (totalUsed / pool.totalAmount) * 100;

  return {
    id: pool.id,
    fiscalYear: pool.fiscalYear,
    totalAmount: pool.totalAmount,
    usedAmount: totalUsed,
    remainingAmount: remaining,
    usagePercentage,
    projectCount: pool.projects.length,
  };
});

return { projects, stats, budgetPoolOverview };
```

#### 前端組件 (`apps/web/src/components/dashboard/BudgetPoolOverview.tsx`)

**視覺化展示**:
```tsx
export function BudgetPoolOverview({ budgetPools }: Props) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {budgetPools.map(pool => (
        <Card key={pool.id}>
          <CardHeader>
            <CardTitle>{pool.fiscalYear} 年度預算池</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* 總預算 */}
              <div>
                <p className="text-sm text-gray-600">總預算</p>
                <p className="text-2xl font-bold">
                  ${pool.totalAmount.toLocaleString()}
                </p>
              </div>

              {/* 已用金額 */}
              <div>
                <p className="text-sm text-gray-600">已使用</p>
                <p className="text-xl font-semibold text-orange-600">
                  ${pool.usedAmount.toLocaleString()}
                </p>
              </div>

              {/* 剩餘金額 */}
              <div>
                <p className="text-sm text-gray-600">剩餘</p>
                <p className="text-xl font-semibold text-green-600">
                  ${pool.remainingAmount.toLocaleString()}
                </p>
              </div>

              {/* 使用進度條 */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>使用率</span>
                  <span className="font-medium">{pool.usagePercentage.toFixed(1)}%</span>
                </div>
                <Progress value={pool.usagePercentage} />
              </div>

              {/* 專案數量 */}
              <div className="pt-2 border-t">
                <p className="text-sm text-gray-600">
                  關聯專案: <span className="font-medium">{pool.projectCount}</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

**預計時間**: 1.5 小時 (後端 0.5h + 前端 1h)

---

### Story 7.3: 數據導出功能

#### 後端 API (新增 `export` 端點)

**API 設計**:
```typescript
export const dashboardRouter = createTRPCRouter({
  // ... 其他端點

  exportProjects: protectedProcedure
    .input(z.object({
      role: z.enum(['ProjectManager', 'Supervisor']),
      status: z.string().optional(),
      managerId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // 根據角色和篩選條件獲取數據
      let projects;

      if (input.role === 'ProjectManager') {
        projects = await ctx.prisma.project.findMany({
          where: { managerId: ctx.session.user.id },
          include: { budgetPool: true, manager: true, proposals: true },
        });
      } else {
        // Supervisor
        const where = {
          ...(input.status && { status: input.status }),
          ...(input.managerId && { managerId: input.managerId }),
        };

        projects = await ctx.prisma.project.findMany({
          where,
          include: { budgetPool: true, manager: true, proposals: true },
        });
      }

      // 轉換為 CSV 友好的格式
      const csvData = projects.map(p => ({
        '專案名稱': p.name,
        '專案編號': p.code,
        '專案經理': p.manager.name,
        '狀態': p.status,
        '預算池': p.budgetPool.fiscalYear,
        '創建日期': new Date(p.createdAt).toLocaleDateString('zh-TW'),
        '最後更新': new Date(p.updatedAt).toLocaleDateString('zh-TW'),
      }));

      return csvData;
    }),
});
```

#### 前端實現 (客戶端 CSV 生成)

**使用 `papaparse` 或原生實現**:
```tsx
// apps/web/src/lib/export.ts
export function downloadCSV(data: any[], filename: string) {
  // 生成 CSV 內容
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','), // 標頭
    ...data.map(row => headers.map(h => `"${row[h] || ''}"`).join(',')),
  ].join('\n');

  // 創建 Blob 並下載
  const blob = new Blob(['\uFEFF' + csvContent], {
    type: 'text/csv;charset=utf-8;'
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
}

// 在儀表板組件中使用
const handleExport = async () => {
  const data = await api.dashboard.exportProjects.query({ role: 'Supervisor', status, managerId });
  downloadCSV(data, 'projects');
  showToast('數據已成功導出!', 'success');
};
```

**預計時間**: 1 小時 (後端 0.5h + 前端 0.5h)

---

## 🔧 技術實現細節

### 1. 數據庫查詢優化

**索引建議**:
```sql
-- 優化 Project 查詢
CREATE INDEX idx_project_manager_status ON Project(managerId, status);
CREATE INDEX idx_project_updated_at ON Project(updatedAt DESC);

-- 優化 BudgetProposal 查詢
CREATE INDEX idx_proposal_status ON BudgetProposal(status);
CREATE INDEX idx_proposal_project_status ON BudgetProposal(projectId, status);

-- 優化 Expense 查詢
CREATE INDEX idx_expense_status ON Expense(status);
```

**查詢性能考量**:
- 使用 `include` 時注意 N+1 查詢問題
- 考慮為主管儀表板添加緩存機制 (Redis)
- 預算池聚合可能需要定期預計算並緩存

### 2. 權限控制

**中間件實現**:
```typescript
// packages/api/src/middleware/role.ts
export const requireSupervisor = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session || ctx.session.user.role !== 'Supervisor') {
    throw new TRPCError({ code: 'FORBIDDEN', message: '需要主管權限' });
  }
  return next();
});

// 使用
const supervisorProcedure = protectedProcedure.use(requireSupervisor);
```

### 3. 前端組件復用

**共用組件清單**:
- `StatCard` - 統計卡片
- `ProjectTable` - 專案列表表格
- `ProjectList` - 專案列表 (卡片式)
- `TaskList` - 任務列表
- `BudgetPoolCard` - 預算池卡片
- `ExportButton` - 導出按鈕

### 4. 響應式設計

**斷點策略**:
- 手機 (< 768px): 單欄佈局，統計卡片堆疊
- 平板 (768px - 1024px): 兩欄統計卡片
- 桌面 (> 1024px): 四欄統計卡片，表格完整展示

---

## 📊 數據結構設計

### ProjectManagerDashboard 返回結構
```typescript
{
  myProjects: Project[], // 包含 budgetPool, proposals, purchaseOrders
  pendingTasks: {
    proposalsNeedingInfo: BudgetProposal[], // 需補充資訊
    draftExpenses: Expense[], // 草稿費用
  },
  stats: {
    totalProjects: number,
    activeProjects: number,
    pendingApprovals: number,
    pendingTasks: number,
  }
}
```

### SupervisorDashboard 返回結構
```typescript
{
  projects: Project[], // 包含 manager, budgetPool, proposals, purchaseOrders
  budgetPoolOverview: BudgetPoolSummary[],
  stats: {
    totalProjects: number,
    activeProjects: number,
    completedProjects: number,
    pendingApprovals: number,
  },
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number,
  }
}
```

### BudgetPoolSummary 結構
```typescript
{
  id: string,
  fiscalYear: number,
  totalAmount: number,
  usedAmount: number,
  remainingAmount: number,
  usagePercentage: number,
  projectCount: number,
}
```

---

## 🧪 測試計劃

### 後端 API 測試
1. **權限測試**:
   - 專案經理只能看到自己的專案
   - 主管可以看到所有專案
   - 非主管無法訪問主管儀表板

2. **數據準確性測試**:
   - 統計數字計算正確
   - 預算池使用金額與實際費用一致
   - 分頁功能正確

3. **性能測試**:
   - 100 個專案的載入時間 < 2 秒
   - 預算池聚合查詢 < 1 秒

### 前端 UI 測試
1. **顯示測試**:
   - 統計卡片正確顯示
   - 列表和表格正確渲染
   - 空狀態提示

2. **互動測試**:
   - 篩選功能正常
   - 分頁切換順暢
   - 導出功能成功

3. **響應式測試**:
   - 手機、平板、桌面佈局適配

---

## 📈 實施時間表

| Story | 任務 | 預計時間 | 優先級 |
|-------|------|---------|--------|
| 7.1 | PM Dashboard 後端 API | 1h | P0 |
| 7.1 | PM Dashboard 前端 UI | 1h | P0 |
| 7.2 | Supervisor Dashboard 後端 API | 1h | P0 |
| 7.2 | Supervisor Dashboard 前端 UI | 1h | P0 |
| 7.4 | 預算池概覽後端 | 0.5h | P1 |
| 7.4 | 預算池概覽前端 | 1h | P1 |
| 7.3 | 數據導出功能 | 1h | P2 |
| - | 導航整合和測試 | 1h | P1 |
| - | 文檔更新 | 0.5h | P2 |

**總計**: 約 8 小時

---

## 🚀 實施步驟

### 階段 1: 核心儀表板 (4-5 小時)
1. 創建 `dashboard.ts` router
2. 實現 PM Dashboard API
3. 實現 PM Dashboard UI
4. 實現 Supervisor Dashboard API
5. 實現 Supervisor Dashboard UI

### 階段 2: 預算池整合 (1.5 小時)
1. 擴充 Supervisor API 加入預算池數據
2. 創建 BudgetPoolOverview 組件
3. 整合到主管儀表板

### 階段 3: 數據導出 (1 小時)
1. 實現 export API
2. 實現前端 CSV 下載功能
3. 整合到兩個儀表板

### 階段 4: 整合與測試 (1.5 小時)
1. 更新導航系統（根據角色顯示對應儀表板）
2. 執行完整測試
3. 修復問題
4. 更新文檔

---

## 📝 驗收標準總結

### Story 7.1
- [ ] PM 登入後看到個人儀表板
- [ ] 顯示「我的專案」列表
- [ ] 顯示「待處理任務」列表
- [ ] 所有項目可點擊跳轉詳情

### Story 7.2
- [ ] 主管登入後看到主管儀表板
- [ ] 顯示所有專案列表
- [ ] 支援按狀態和 PM 篩選
- [ ] 顯示關鍵專案資訊

### Story 7.4
- [ ] 主管儀表板顯示預算池概覽
- [ ] 每個預算池顯示總額、已用、剩餘
- [ ] 數據即時更新（與 Epic 6 費用批准聯動）

### Story 7.3
- [ ] 儀表板有「導出」按鈕
- [ ] 點擊下載 CSV 文件
- [ ] 導出數據與篩選條件一致

---

## 🔄 與其他 Epic 的整合

### Epic 3 (專案管理)
- 儀表板顯示專案列表和狀態
- 點擊跳轉到專案詳情頁

### Epic 4 (提案審批)
- 顯示待審批的提案數量
- PM 儀表板顯示需補充資訊的提案

### Epic 6 (費用管理)
- 顯示草稿費用作為待辦任務
- 預算池使用 Epic 6 實現的實時扣款數據

---

## 📌 技術債務與未來改進

### MVP 階段不包含
- 複雜的圖表可視化（折線圖、餅圖）
- 儀表板自定義佈局
- Excel 格式導出（僅支援 CSV）
- 預算池下鑽分析

### 未來考慮
- 使用 Chart.js 或 Recharts 添加圖表
- 添加儀表板小工具拖放功能
- 支援自定義報告模板
- 添加數據趨勢分析

---

**文檔版本**: 1.0
**最後更新**: 2025-10-05
**更新者**: Claude Code
