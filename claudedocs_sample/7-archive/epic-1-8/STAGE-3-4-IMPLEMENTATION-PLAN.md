# i18n Phase 2-3 完整實施規劃

## 文件概述

**建立日期**: 2025-11-03
**目標**: 為 IT 專案流程管理平台建立完整的國際化（i18n）支援系統
**範圍**: Phase 2（翻譯檔案架構）+ Phase 3（組件遷移）
**語言**: 繁體中文 (zh-TW) 預設 + 英文 (en)

---

## 專案現狀分析

### 已完成 (Phase 1)
- ✅ 路由結構改為 `[locale]` 動態片段
- ✅ middleware.ts 配置完成（語言檢測與重定向）
- ✅ 所有組件已改用 next-intl 的 Link 和 useRouter
- ✅ 基礎翻譯檔案結構建立（`apps/web/src/messages/zh-TW.json`, `en.json`）
- ✅ i18n 路由配置完成（`apps/web/src/i18n/routing.ts`）

### 需要處理的技術債
- ❌ 18 個頁面全部使用硬編碼繁體中文文字
- ❌ 46 個組件（26 個設計系統 + 20 個業務組件）使用硬編碼文字
- ❌ 表單驗證錯誤訊息未國際化
- ❌ Toast 通知訊息未國際化
- ❌ 狀態標籤（Draft, Approved 等）未國際化
- ❌ 日期、數字、貨幣格式未國際化

### 技術環境
- **Framework**: Next.js 14.2.33 (App Router)
- **i18n Library**: next-intl 4.4.0
- **Languages**: zh-TW (預設), en
- **Message Files**: `apps/web/src/messages/`
- **Total Pages**: 18
- **Total Components**: 46 (26 design system + 20 business)

---

## Phase 2: 翻譯檔案架構設計

### 2.1 架構決策

#### 選擇：扁平化 + Namespace 混合架構

**原因**:
1. **維護性**: 單一檔案便於全局搜尋和一致性檢查
2. **效能**: next-intl 在單一檔案下效能最佳（避免多次檔案讀取）
3. **類型安全**: TypeScript 自動推斷更精確
4. **團隊協作**: 減少 merge conflicts（namespace 隔離）

**結構**:
```
apps/web/src/messages/
├── zh-TW.json  (單一檔案，約 2000-3000 行)
└── en.json     (單一檔案，約 2000-3000 行)
```

**內部組織**: 使用 Namespace 進行邏輯分組

---

### 2.2 完整翻譯 Key 結構設計

#### 頂層 Namespace 分類

```json
{
  "common": {},           // 通用元素（按鈕、標籤、狀態等）
  "navigation": {},       // 導航與選單
  "auth": {},            // 認證相關（登入、註冊、忘記密碼）
  "dashboard": {},       // 儀表板
  "projects": {},        // 專案管理
  "proposals": {},       // 預算提案
  "budgetPools": {},     // 預算池
  "vendors": {},         // 供應商
  "quotes": {},          // 報價單
  "purchaseOrders": {}, // 採購單
  "expenses": {},        // 費用記錄
  "omExpenses": {},      // OM 費用
  "chargeOuts": {},      // 費用轉嫁
  "users": {},           // 用戶管理
  "notifications": {},   // 通知系統
  "settings": {},        // 設定
  "validation": {},      // 表單驗證訊息
  "toast": {},           // Toast 通知訊息
  "errors": {}           // 錯誤訊息
}
```

---

### 2.3 詳細翻譯 Key 結構

#### 2.3.1 common (通用元素)

```json
{
  "common": {
    "actions": {
      "save": "儲存",
      "cancel": "取消",
      "delete": "刪除",
      "edit": "編輯",
      "create": "新增",
      "submit": "提交",
      "search": "搜尋",
      "filter": "篩選",
      "export": "匯出",
      "import": "匯入",
      "confirm": "確認",
      "back": "返回",
      "next": "下一步",
      "previous": "上一步",
      "close": "關閉",
      "yes": "是",
      "no": "否",
      "view": "查看",
      "viewAll": "查看全部",
      "download": "下載",
      "upload": "上傳",
      "approve": "批准",
      "reject": "駁回",
      "withdraw": "撤回",
      "requestMoreInfo": "要求更多資訊",
      "refresh": "重新整理"
    },
    "status": {
      "draft": "草稿",
      "pending": "待審批",
      "pendingApproval": "待審批",
      "approved": "已批准",
      "rejected": "已駁回",
      "moreInfoRequired": "需要更多資訊",
      "completed": "已完成",
      "paid": "已支付",
      "cancelled": "已取消",
      "active": "進行中",
      "inactive": "非活動"
    },
    "loading": "載入中...",
    "saving": "儲存中...",
    "submitting": "提交中...",
    "processing": "處理中...",
    "error": "發生錯誤",
    "success": "操作成功",
    "noData": "無資料",
    "noResults": "無搜尋結果",
    "selectPlaceholder": "請選擇",
    "searchPlaceholder": "搜尋...",
    "required": "必填",
    "optional": "選填",
    "all": "全部",
    "pagination": {
      "page": "頁",
      "of": "共",
      "rowsPerPage": "每頁顯示",
      "showing": "顯示",
      "to": "至",
      "entries": "筆資料"
    },
    "date": {
      "today": "今天",
      "yesterday": "昨天",
      "lastWeek": "上週",
      "lastMonth": "上月",
      "thisMonth": "本月",
      "thisYear": "今年",
      "startDate": "開始日期",
      "endDate": "結束日期"
    },
    "currency": {
      "myr": "RM",
      "amount": "金額"
    }
  }
}
```

#### 2.3.2 navigation (導航與選單)

```json
{
  "navigation": {
    "brand": {
      "title": "IT 專案管理",
      "subtitle": "流程平台"
    },
    "sections": {
      "overview": "概覽",
      "projectBudget": "專案與預算",
      "procurement": "採購管理",
      "system": "系統管理"
    },
    "menu": {
      "dashboard": "儀表板",
      "projects": "專案管理",
      "proposals": "預算提案",
      "budgetPools": "預算池",
      "vendors": "供應商",
      "quotes": "報價單",
      "purchaseOrders": "採購單",
      "expenses": "費用記錄",
      "omExpenses": "OM 費用",
      "chargeOuts": "費用轉嫁",
      "users": "用戶管理",
      "notifications": "通知",
      "settings": "系統設定",
      "help": "幫助中心"
    },
    "descriptions": {
      "dashboard": "專案總覽和關鍵指標",
      "projects": "專案資料和進度管理",
      "proposals": "預算提案申請與審批",
      "budgetPools": "年度預算分配管理",
      "vendors": "供應商資料管理",
      "quotes": "供應商報價管理",
      "purchaseOrders": "採購訂單追蹤",
      "expenses": "費用發票與核銷",
      "omExpenses": "操作與維護費用管理",
      "chargeOuts": "ChargeOut 費用轉嫁管理",
      "users": "用戶帳號和權限",
      "settings": "系統參數設定",
      "help": "使用指南和支援"
    },
    "user": {
      "profile": "個人資料",
      "logout": "登出",
      "role": "角色",
      "status": {
        "online": "在線",
        "offline": "離線"
      }
    }
  }
}
```

#### 2.3.3 auth (認證相關)

```json
{
  "auth": {
    "login": {
      "title": "登入",
      "subtitle": "歡迎回到 IT 專案管理平台",
      "email": "電子郵件",
      "password": "密碼",
      "rememberMe": "記住我",
      "forgotPassword": "忘記密碼？",
      "noAccount": "還沒有帳號？",
      "signUp": "註冊",
      "loginButton": "登入",
      "orLoginWith": "或使用以下方式登入",
      "azureAD": "Azure AD",
      "loggingIn": "登入中..."
    },
    "register": {
      "title": "註冊",
      "subtitle": "建立您的帳號",
      "name": "姓名",
      "email": "電子郵件",
      "password": "密碼",
      "confirmPassword": "確認密碼",
      "hasAccount": "已有帳號？",
      "signIn": "登入",
      "registerButton": "註冊",
      "registering": "註冊中..."
    },
    "forgotPassword": {
      "title": "忘記密碼",
      "subtitle": "輸入您的電子郵件以重設密碼",
      "email": "電子郵件",
      "sendResetLink": "發送重設連結",
      "backToLogin": "返回登入",
      "sending": "發送中...",
      "success": "重設連結已發送至您的信箱"
    }
  }
}
```

#### 2.3.4 dashboard (儀表板)

```json
{
  "dashboard": {
    "title": "儀表板",
    "subtitle": "歡迎回來！查看您的專案進度和最新動態",
    "stats": {
      "monthlyBudget": {
        "title": "本月預算額",
        "change": "較上月"
      },
      "activeProjects": {
        "title": "進行中項目",
        "change": "較上月"
      },
      "pendingProposals": {
        "title": "待審批提案",
        "change": "較上月"
      },
      "budgetUtilization": {
        "title": "預算執行率",
        "change": "較上月"
      }
    },
    "budgetTrends": {
      "title": "預算趨勢",
      "period": {
        "last6Months": "近 6 個月",
        "last3Months": "近 3 個月",
        "thisMonth": "本月"
      },
      "metrics": {
        "currentBudget": "本月預算額",
        "growthRate": "月增長率",
        "totalProposals": "總提案數"
      }
    },
    "quickActions": {
      "title": "快速操作",
      "subtitle": "常用功能快捷入口",
      "actions": {
        "newProject": {
          "name": "新增專案",
          "description": "建立新的 IT 專案"
        },
        "newProposal": {
          "name": "建立提案",
          "description": "提交預算提案申請"
        },
        "newBudgetPool": {
          "name": "新增預算池",
          "description": "創建財政年度預算池"
        },
        "manageVendors": {
          "name": "供應商管理",
          "description": "管理供應商資料"
        },
        "viewPurchaseOrders": {
          "name": "查看採購單",
          "description": "檢視採購訂單狀態"
        },
        "recordExpense": {
          "name": "費用記錄",
          "description": "記錄專案費用支出"
        }
      }
    },
    "recentActivities": {
      "title": "最近活動",
      "viewAll": "查看全部",
      "timeAgo": {
        "hour": "小時前",
        "hours": "小時前",
        "day": "天前",
        "days": "天前"
      }
    },
    "aiInsights": {
      "title": "AI 洞察",
      "subtitle": "基於數據分析的智能建議",
      "confidence": "信心度",
      "viewDetails": "查看詳情",
      "todayStats": "今日統計",
      "pendingProposalsCount": "待處理提案",
      "meetingsToday": "今日會議"
    }
  }
}
```

#### 2.3.5 projects (專案管理)

```json
{
  "projects": {
    "title": "專案管理",
    "list": {
      "title": "專案列表",
      "subtitle": "管理所有 IT 專案",
      "newProject": "新增專案",
      "search": "搜尋專案...",
      "filter": {
        "all": "全部",
        "active": "進行中",
        "completed": "已完成",
        "onHold": "暫停"
      },
      "table": {
        "name": "專案名稱",
        "budgetPool": "預算池",
        "manager": "專案經理",
        "supervisor": "主管",
        "startDate": "開始日期",
        "endDate": "結束日期",
        "budget": "預算",
        "status": "狀態",
        "actions": "操作"
      },
      "empty": "尚無專案資料"
    },
    "detail": {
      "title": "專案詳情",
      "overview": "概覽",
      "budget": "預算資訊",
      "proposals": "預算提案",
      "purchaseOrders": "採購單",
      "expenses": "費用記錄",
      "tabs": {
        "overview": "概覽",
        "proposals": "提案",
        "quotes": "報價",
        "purchaseOrders": "採購單",
        "expenses": "費用"
      }
    },
    "form": {
      "create": {
        "title": "新增專案",
        "subtitle": "建立新的 IT 專案"
      },
      "edit": {
        "title": "編輯專案",
        "subtitle": "更新專案資訊"
      },
      "fields": {
        "name": {
          "label": "專案名稱",
          "placeholder": "例如：雲端遷移第一階段"
        },
        "description": {
          "label": "專案描述",
          "placeholder": "描述專案目標和範圍..."
        },
        "budgetPool": {
          "label": "預算池",
          "placeholder": "選擇預算池"
        },
        "budgetCategory": {
          "label": "預算類別",
          "placeholder": "選擇預算類別（選填）",
          "selectPoolFirst": "請先選擇預算池"
        },
        "requestedBudget": {
          "label": "請求預算金額",
          "placeholder": "0.00"
        },
        "manager": {
          "label": "專案經理",
          "placeholder": "選擇專案經理"
        },
        "supervisor": {
          "label": "主管",
          "placeholder": "選擇主管"
        },
        "startDate": {
          "label": "開始日期"
        },
        "endDate": {
          "label": "結束日期"
        }
      },
      "actions": {
        "creating": "創建專案",
        "updating": "更新專案",
        "create": "創建專案",
        "update": "更新專案"
      }
    }
  }
}
```

#### 2.3.6 proposals (預算提案)

```json
{
  "proposals": {
    "title": "預算提案",
    "list": {
      "title": "預算提案列表",
      "subtitle": "管理所有預算提案",
      "newProposal": "新增提案",
      "search": "搜尋提案...",
      "filter": {
        "all": "全部",
        "draft": "草稿",
        "pending": "待審批",
        "approved": "已批准",
        "rejected": "已駁回"
      },
      "table": {
        "id": "提案編號",
        "project": "所屬專案",
        "amount": "申請金額",
        "status": "狀態",
        "submittedBy": "提交人",
        "submittedAt": "提交時間",
        "approvedBy": "審批人",
        "approvedAt": "審批時間",
        "actions": "操作"
      }
    },
    "detail": {
      "title": "提案詳情",
      "basicInfo": "基本資訊",
      "budgetDetails": "預算明細",
      "attachments": "附件",
      "comments": "討論",
      "history": "審批歷史"
    },
    "form": {
      "create": {
        "title": "新增預算提案",
        "subtitle": "建立新的預算申請"
      },
      "edit": {
        "title": "編輯預算提案",
        "subtitle": "更新提案資訊"
      },
      "fields": {
        "project": {
          "label": "所屬專案",
          "placeholder": "選擇專案"
        },
        "amount": {
          "label": "申請金額",
          "placeholder": "0.00"
        },
        "description": {
          "label": "提案說明",
          "placeholder": "詳細描述預算需求..."
        },
        "justification": {
          "label": "申請理由",
          "placeholder": "說明為何需要此預算..."
        }
      }
    },
    "actions": {
      "submit": "提交審批",
      "approve": "批准",
      "reject": "駁回",
      "requestMoreInfo": "要求更多資訊",
      "withdraw": "撤回",
      "confirmApprove": "確認批准此提案？",
      "confirmReject": "確認駁回此提案？",
      "rejectReason": "駁回原因",
      "moreInfoReason": "需要補充的資訊"
    },
    "comments": {
      "title": "討論區",
      "addComment": "新增評論",
      "placeholder": "輸入您的評論...",
      "submit": "發送",
      "empty": "尚無評論"
    },
    "history": {
      "title": "審批歷史",
      "action": {
        "created": "建立提案",
        "submitted": "提交審批",
        "approved": "批准",
        "rejected": "駁回",
        "moreInfoRequested": "要求更多資訊",
        "withdrawn": "撤回"
      }
    }
  }
}
```

#### 2.3.7 budgetPools (預算池)

```json
{
  "budgetPools": {
    "title": "預算池",
    "list": {
      "title": "預算池列表",
      "subtitle": "管理財政年度預算分配",
      "newBudgetPool": "新增預算池",
      "search": "搜尋預算池...",
      "filter": {
        "all": "所有年度",
        "current": "當前年度",
        "previous": "過往年度"
      },
      "table": {
        "name": "預算池名稱",
        "financialYear": "財政年度",
        "totalAmount": "總金額",
        "usedAmount": "已使用",
        "remainingAmount": "剩餘",
        "utilization": "使用率",
        "categories": "預算類別",
        "projects": "專案數",
        "actions": "操作"
      }
    },
    "detail": {
      "title": "預算池詳情",
      "overview": "概覽",
      "categories": "預算類別",
      "projects": "關聯專案",
      "utilization": "使用情況"
    },
    "form": {
      "create": {
        "title": "新增預算池",
        "subtitle": "建立新的財政年度預算池"
      },
      "edit": {
        "title": "編輯預算池",
        "subtitle": "更新預算池資訊"
      },
      "fields": {
        "name": {
          "label": "預算池名稱",
          "placeholder": "例如：2024 財政年度 IT 預算"
        },
        "financialYear": {
          "label": "財政年度",
          "placeholder": "選擇年度"
        },
        "totalAmount": {
          "label": "總預算金額",
          "placeholder": "0.00"
        },
        "description": {
          "label": "描述",
          "placeholder": "預算池描述..."
        }
      },
      "categories": {
        "title": "預算類別",
        "add": "新增類別",
        "remove": "移除",
        "fields": {
          "name": "類別名稱",
          "amount": "分配金額",
          "description": "說明"
        },
        "placeholder": {
          "name": "例如：硬體設備",
          "amount": "0.00",
          "description": "類別說明..."
        }
      }
    },
    "utilization": {
      "total": "總預算",
      "used": "已使用",
      "remaining": "剩餘",
      "percentage": "使用率",
      "health": {
        "good": "良好",
        "warning": "警告",
        "critical": "超支"
      }
    }
  }
}
```

#### 2.3.8 vendors (供應商)

```json
{
  "vendors": {
    "title": "供應商",
    "list": {
      "title": "供應商列表",
      "subtitle": "管理供應商資料",
      "newVendor": "新增供應商",
      "search": "搜尋供應商...",
      "table": {
        "name": "供應商名稱",
        "contactName": "聯絡人",
        "email": "電子郵件",
        "phone": "電話",
        "address": "地址",
        "quotesCount": "報價單數",
        "purchaseOrdersCount": "採購單數",
        "actions": "操作"
      }
    },
    "detail": {
      "title": "供應商詳情",
      "info": "基本資訊",
      "quotes": "報價記錄",
      "purchaseOrders": "採購記錄"
    },
    "form": {
      "create": {
        "title": "新增供應商",
        "subtitle": "建立新的供應商資料"
      },
      "edit": {
        "title": "編輯供應商",
        "subtitle": "更新供應商資訊"
      },
      "fields": {
        "name": {
          "label": "供應商名稱",
          "placeholder": "例如：Tech Solutions Ltd"
        },
        "contactName": {
          "label": "聯絡人姓名",
          "placeholder": "例如：張三"
        },
        "email": {
          "label": "電子郵件",
          "placeholder": "例如：contact@techsolutions.com"
        },
        "phone": {
          "label": "電話",
          "placeholder": "例如：+60 12-345 6789"
        },
        "address": {
          "label": "地址",
          "placeholder": "供應商地址..."
        },
        "website": {
          "label": "網站",
          "placeholder": "https://"
        },
        "notes": {
          "label": "備註",
          "placeholder": "其他資訊..."
        }
      }
    }
  }
}
```

#### 2.3.9 validation (表單驗證訊息)

```json
{
  "validation": {
    "required": "此欄位為必填",
    "email": "請輸入有效的電子郵件地址",
    "minLength": "至少需要 {min} 個字元",
    "maxLength": "不能超過 {max} 個字元",
    "min": "最小值為 {min}",
    "max": "最大值為 {max}",
    "passwordMismatch": "密碼不一致",
    "invalidDate": "無效的日期",
    "endDateBeforeStart": "結束日期必須晚於開始日期",
    "invalidAmount": "請輸入有效的金額",
    "positiveNumber": "必須為正數",
    "duplicateEntry": "此項目已存在",
    "invalidFileType": "不支援的檔案類型",
    "fileTooLarge": "檔案大小不能超過 {size}MB",
    "invalidUrl": "請輸入有效的網址"
  }
}
```

#### 2.3.10 toast (Toast 通知訊息)

```json
{
  "toast": {
    "success": {
      "title": "成功",
      "created": "{entity} 創建成功！",
      "updated": "{entity} 更新成功！",
      "deleted": "{entity} 刪除成功！",
      "submitted": "{entity} 提交成功！",
      "approved": "{entity} 批准成功！",
      "rejected": "{entity} 駁回成功！",
      "saved": "儲存成功！"
    },
    "error": {
      "title": "錯誤",
      "general": "操作失敗，請稍後再試",
      "network": "網路錯誤，請檢查您的連線",
      "unauthorized": "您沒有權限執行此操作",
      "notFound": "找不到資源",
      "validation": "請檢查輸入的資料",
      "server": "伺服器錯誤，請稍後再試"
    },
    "warning": {
      "title": "警告",
      "unsavedChanges": "您有未儲存的變更",
      "confirmDelete": "確認刪除此項目？此操作無法復原"
    },
    "info": {
      "title": "提示",
      "loading": "載入中...",
      "processing": "處理中..."
    }
  }
}
```

---

### 2.4 翻譯 Key 命名規範

#### 命名原則
1. **語義化**: Key 名稱應清楚表達內容意義
2. **層級化**: 使用 `.` 分隔層級（最多 4 層）
3. **簡潔性**: 避免冗長，保持可讀性
4. **一致性**: 同類內容使用相同命名模式

#### 命名模式

**頁面特定內容**:
```
{namespace}.{section}.{element}.{property}

範例：
- projects.form.fields.name.label
- dashboard.stats.monthlyBudget.title
```

**通用元素**:
```
common.{category}.{element}

範例：
- common.actions.save
- common.status.approved
```

**驗證訊息**:
```
validation.{rule}

範例：
- validation.required
- validation.email
```

**動態內容使用變數**:
```json
{
  "toast.success.created": "{entity} 創建成功！"
}

// 使用時：
t('toast.success.created', { entity: t('projects.title') })
// 輸出：專案管理 創建成功！
```

---

### 2.5 完整翻譯檔案結構（zh-TW.json）

由於完整檔案過長（預估 2000-3000 行），以下提供完整結構大綱：

```json
{
  "common": {
    "actions": { /* 20+ 個動作按鈕 */ },
    "status": { /* 15+ 個狀態標籤 */ },
    "loading": "...",
    "pagination": { /* 分頁相關 */ },
    "date": { /* 日期相關 */ },
    "currency": { /* 貨幣相關 */ }
  },
  "navigation": {
    "brand": { /* 品牌資訊 */ },
    "sections": { /* 4 個區塊標題 */ },
    "menu": { /* 14 個選單項目 */ },
    "descriptions": { /* 14 個選單描述 */ },
    "user": { /* 用戶相關 */ }
  },
  "auth": {
    "login": { /* 登入頁 10+ 個欄位 */ },
    "register": { /* 註冊頁 10+ 個欄位 */ },
    "forgotPassword": { /* 忘記密碼頁 */ }
  },
  "dashboard": {
    "title": "...",
    "stats": { /* 4 個統計卡片 */ },
    "budgetTrends": { /* 預算趨勢圖 */ },
    "quickActions": { /* 6 個快速操作 */ },
    "recentActivities": { /* 最近活動 */ },
    "aiInsights": { /* AI 洞察 */ }
  },
  "projects": {
    "list": { /* 列表頁 20+ 個文字 */ },
    "detail": { /* 詳情頁 */ },
    "form": { /* 表單頁 15+ 個欄位 */ }
  },
  "proposals": { /* 同上結構 */ },
  "budgetPools": { /* 同上結構 */ },
  "vendors": { /* 同上結構 */ },
  "quotes": { /* 同上結構 */ },
  "purchaseOrders": { /* 同上結構 */ },
  "expenses": { /* 同上結構 */ },
  "omExpenses": { /* 同上結構 */ },
  "chargeOuts": { /* 同上結構 */ },
  "users": { /* 同上結構 */ },
  "notifications": { /* 同上結構 */ },
  "settings": { /* 同上結構 */ },
  "validation": { /* 15+ 個驗證規則 */ },
  "toast": {
    "success": { /* 10+ 個成功訊息模板 */ },
    "error": { /* 10+ 個錯誤訊息模板 */ },
    "warning": { /* 警告訊息 */ },
    "info": { /* 資訊訊息 */ }
  },
  "errors": {
    "404": { /* 頁面未找到 */ },
    "500": { /* 伺服器錯誤 */ },
    "unauthorized": { /* 未授權 */ }
  }
}
```

**完整檔案估算**:
- zh-TW.json: ~2500 行（包含所有翻譯 key）
- en.json: ~2500 行（英文翻譯）

---

## Phase 3: 組件遷移策略

### 3.1 遷移優先級排序

#### 高優先級（P0 - 立即遷移）
**原因**: 用戶最常使用的核心流程

1. **Layout 組件**（3 個）
   - `sidebar.tsx` - 導航選單（所有頁面共用）
   - `TopBar.tsx` - 頂部欄位（所有頁面共用）
   - `dashboard-layout.tsx` - 布局框架

2. **Dashboard 組件**（3 個）
   - `dashboard/page.tsx` - 主儀表板頁面
   - `StatCard.tsx` - 統計卡片
   - `BudgetPoolOverview.tsx` - 預算池概覽

3. **Auth 組件**（3 個）
   - `login/page.tsx` - 登入頁
   - `register/page.tsx` - 註冊頁
   - `forgot-password/page.tsx` - 忘記密碼頁

**預計工作量**: 3 天（9 個組件）

---

#### 中優先級（P1 - 第二批遷移）
**原因**: 核心業務流程頁面

4. **Projects 模組**（5 個）
   - `projects/page.tsx` - 專案列表
   - `projects/[id]/page.tsx` - 專案詳情
   - `projects/new/page.tsx` - 新增專案
   - `projects/[id]/edit/page.tsx` - 編輯專案
   - `ProjectForm.tsx` - 專案表單組件

5. **Proposals 模組**（6 個）
   - `proposals/page.tsx` - 提案列表
   - `proposals/[id]/page.tsx` - 提案詳情
   - `proposals/new/page.tsx` - 新增提案
   - `proposals/[id]/edit/page.tsx` - 編輯提案
   - `BudgetProposalForm.tsx` - 提案表單
   - `ProposalActions.tsx` - 提案操作按鈕
   - `CommentSection.tsx` - 評論區

6. **BudgetPools 模組**（5 個）
   - `budget-pools/page.tsx` - 預算池列表
   - `budget-pools/[id]/page.tsx` - 預算池詳情
   - `budget-pools/new/page.tsx` - 新增預算池
   - `budget-pools/[id]/edit/page.tsx` - 編輯預算池
   - `BudgetPoolForm.tsx` - 預算池表單

**預計工作量**: 5 天（16 個組件）

---

#### 低優先級（P2 - 第三批遷移）
**原因**: 輔助功能和管理功能

7. **Vendors 模組**（4 個）
   - `vendors/page.tsx` - 供應商列表
   - `vendors/[id]/page.tsx` - 供應商詳情
   - `vendors/new/page.tsx` - 新增供應商
   - `VendorForm.tsx` - 供應商表單

8. **Quotes 模組**（3 個）
   - `quotes/page.tsx` - 報價單列表
   - `quotes/new/page.tsx` - 新增報價單
   - `QuoteUploadForm.tsx` - 報價單上傳表單

9. **PurchaseOrders 模組**（5 個）
   - `purchase-orders/page.tsx` - 採購單列表
   - `purchase-orders/[id]/page.tsx` - 採購單詳情
   - `purchase-orders/new/page.tsx` - 新增採購單
   - `PurchaseOrderForm.tsx` - 採購單表單
   - `PurchaseOrderActions.tsx` - 採購單操作

10. **Expenses 模組**（5 個）
    - `expenses/page.tsx` - 費用列表
    - `expenses/[id]/page.tsx` - 費用詳情
    - `expenses/new/page.tsx` - 新增費用
    - `ExpenseForm.tsx` - 費用表單
    - `ExpenseActions.tsx` - 費用操作

11. **OMExpenses 模組**（4 個）
    - `om-expenses/page.tsx` - OM 費用列表
    - `om-expenses/new/page.tsx` - 新增 OM 費用
    - `OMExpenseForm.tsx` - OM 費用表單
    - `OMExpenseMonthlyGrid.tsx` - 月度網格

12. **ChargeOuts 模組**（4 個）
    - `charge-outs/page.tsx` - 費用轉嫁列表
    - `charge-outs/new/page.tsx` - 新增費用轉嫁
    - `ChargeOutForm.tsx` - 費用轉嫁表單
    - `ChargeOutActions.tsx` - 費用轉嫁操作

13. **Users 模組**（4 個）
    - `users/page.tsx` - 用戶列表
    - `users/[id]/page.tsx` - 用戶詳情
    - `users/new/page.tsx` - 新增用戶
    - `UserForm.tsx` - 用戶表單

14. **其他模組**（5 個）
    - `notifications/page.tsx` - 通知列表
    - `NotificationBell.tsx` - 通知鈴鐺
    - `NotificationDropdown.tsx` - 通知下拉選單
    - `settings/page.tsx` - 設定頁
    - `ThemeToggle.tsx` - 主題切換

**預計工作量**: 6 天（34 個組件）

---

### 3.2 遷移策略選擇

#### 策略：批次遷移 + 模組化處理

**原因**:
1. **降低風險**: 每批遷移後進行完整測試，降低大範圍錯誤風險
2. **增量交付**: 每批完成後即可交付部分國際化功能
3. **學習曲線**: 第一批遷移過程中建立最佳實踐，後續批次加速
4. **回滾容易**: 若發現問題，只需回滾該批次變更

#### 遷移流程（每批次）

```
Day 1: 準備階段
├─ 建立該批次的翻譯 key（zh-TW.json + en.json）
├─ Code Review 翻譯內容
└─ 建立測試計劃

Day 2-3: 遷移階段
├─ 逐一遷移組件
├─ 每個組件遷移後進行單元測試
└─ 提交獨立的 commit（便於回滾）

Day 4: 測試階段
├─ 手動測試所有頁面（zh-TW + en 雙語言）
├─ 檢查 UI 無破損
├─ 檢查翻譯無缺失
└─ 修復發現的問題

Day 5: Code Review + 合併
├─ 提交 PR
├─ Code Review
├─ 合併到主分支
└─ 準備下一批次
```

---

### 3.3 組件遷移技術指引

#### 3.3.1 頁面組件遷移模式

**Before (硬編碼)**:
```tsx
// apps/web/src/app/[locale]/dashboard/page.tsx
export default function DashboardPage() {
  return (
    <div>
      <h1>儀表板</h1>
      <p>歡迎回來！查看您的專案進度和最新動態</p>
    </div>
  );
}
```

**After (使用翻譯)**:
```tsx
// apps/web/src/app/[locale]/dashboard/page.tsx
import { useTranslations } from 'next-intl';

export default function DashboardPage() {
  const t = useTranslations('dashboard');

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('subtitle')}</p>
    </div>
  );
}
```

---

#### 3.3.2 表單組件遷移模式

**Before (硬編碼)**:
```tsx
// apps/web/src/components/project/ProjectForm.tsx
export function ProjectForm({ initialData, mode }: ProjectFormProps) {
  return (
    <form>
      <label htmlFor="name">專案名稱 *</label>
      <input
        id="name"
        placeholder="例如：雲端遷移第一階段"
      />
      {errors.name && <p>{errors.name}</p>}

      <button type="submit">
        {mode === 'create' ? '創建專案' : '更新專案'}
      </button>
    </form>
  );
}
```

**After (使用翻譯)**:
```tsx
// apps/web/src/components/project/ProjectForm.tsx
import { useTranslations } from 'next-intl';

export function ProjectForm({ initialData, mode }: ProjectFormProps) {
  const t = useTranslations('projects.form');
  const tCommon = useTranslations('common');
  const tValidation = useTranslations('validation');

  return (
    <form>
      <label htmlFor="name">
        {t('fields.name.label')} {tCommon('required')}
      </label>
      <input
        id="name"
        placeholder={t('fields.name.placeholder')}
      />
      {errors.name && <p>{tValidation('required')}</p>}

      <button type="submit">
        {mode === 'create' ? t('actions.create') : t('actions.update')}
      </button>
    </form>
  );
}
```

---

#### 3.3.3 Toast 通知遷移模式

**Before (硬編碼)**:
```tsx
const createMutation = api.project.create.useMutation({
  onSuccess: (project) => {
    toast({
      title: '成功',
      description: '專案創建成功！',
      variant: 'success',
    });
  },
  onError: (error) => {
    toast({
      title: '錯誤',
      description: error.message,
      variant: 'destructive',
    });
  },
});
```

**After (使用翻譯)**:
```tsx
import { useTranslations } from 'next-intl';

const t = useTranslations('toast');
const tProjects = useTranslations('projects');

const createMutation = api.project.create.useMutation({
  onSuccess: (project) => {
    toast({
      title: t('success.title'),
      description: t('success.created', { entity: tProjects('title') }),
      variant: 'success',
    });
  },
  onError: (error) => {
    toast({
      title: t('error.title'),
      description: error.message || t('error.general'),
      variant: 'destructive',
    });
  },
});
```

---

#### 3.3.4 動態內容遷移模式

**使用變數插值**:
```tsx
// 翻譯檔案
{
  "budgetPools.detail.budget": "總預算：{total}，已使用：{used}，剩餘：{remaining}"
}

// 組件中使用
const t = useTranslations('budgetPools.detail');

<p>
  {t('budget', {
    total: formatCurrency(pool.totalAmount),
    used: formatCurrency(pool.usedAmount),
    remaining: formatCurrency(pool.totalAmount - pool.usedAmount)
  })}
</p>
```

**使用 Rich Text（包含 HTML 標籤）**:
```tsx
// 翻譯檔案
{
  "dashboard.aiInsights.suggestion": "系統分析顯示：<strong>{project}</strong> 預算使用率偏低，建議重新分配至開發項目以提高整體效益。"
}

// 組件中使用
import { useTranslations } from 'next-intl';

const t = useTranslations('dashboard.aiInsights');

<p
  dangerouslySetInnerHTML={{
    __html: t.raw('suggestion', { project: 'Q4 雲端服務項目' })
  }}
/>
```

---

#### 3.3.5 日期、數字、貨幣格式化

**使用 next-intl 內建格式化**:
```tsx
import { useFormatter } from 'next-intl';

export function BudgetDisplay({ amount, date }: Props) {
  const format = useFormatter();

  return (
    <div>
      {/* 貨幣格式化 */}
      <p>{format.number(amount, { style: 'currency', currency: 'MYR' })}</p>
      {/* 輸出：RM 12,345.67 */}

      {/* 日期格式化 */}
      <p>{format.dateTime(date, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })}</p>
      {/* zh-TW: 2024年11月3日 */}
      {/* en: November 3, 2024 */}

      {/* 相對時間 */}
      <p>{format.relativeTime(date)}</p>
      {/* zh-TW: 2 小時前 */}
      {/* en: 2 hours ago */}
    </div>
  );
}
```

**配置格式化規則**:
```ts
// apps/web/src/i18n/request.ts
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`../messages/${locale}.json`)).default,
  formats: {
    dateTime: {
      short: {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }
    },
    number: {
      currency: {
        style: 'currency',
        currency: 'MYR'
      }
    }
  }
}));
```

---

#### 3.3.6 條件內容遷移模式

**處理複數形式**:
```tsx
// 翻譯檔案
{
  "projects.list.count": {
    "zero": "無專案",
    "one": "{count} 個專案",
    "other": "{count} 個專案"
  }
}

// 組件中使用
const t = useTranslations('projects.list');

<p>{t('count', { count: projects.length })}</p>
```

**處理性別/角色差異**:
```tsx
// 翻譯檔案
{
  "dashboard.welcome": {
    "manager": "歡迎回來，專案經理 {name}！",
    "supervisor": "歡迎回來，主管 {name}！",
    "admin": "歡迎回來，管理員 {name}！"
  }
}

// 組件中使用
const t = useTranslations('dashboard');
const role = session.user.role.name.toLowerCase();

<h1>{t(`welcome.${role}`, { name: session.user.name })}</h1>
```

---

### 3.4 遷移檢查清單（每個組件）

#### 遷移前檢查
- [ ] 閱讀組件代碼，識別所有硬編碼文字
- [ ] 確認該組件的翻譯 key 已存在於 zh-TW.json 和 en.json
- [ ] 確認是否需要動態內容（變數插值）
- [ ] 確認是否需要格式化（日期、數字、貨幣）

#### 遷移時執行
- [ ] 在組件頂部引入 `useTranslations` hook
- [ ] 替換所有硬編碼文字為翻譯 key
- [ ] 處理動態內容（使用變數插值）
- [ ] 處理格式化需求（使用 `useFormatter`）
- [ ] 檢查 TypeScript 類型錯誤
- [ ] 檢查 ESLint 警告

#### 遷移後測試
- [ ] 切換到繁體中文 (`/zh-TW/...`)，檢查顯示是否正確
- [ ] 切換到英文 (`/en/...`)，檢查顯示是否正確
- [ ] 測試表單提交（驗證訊息是否翻譯）
- [ ] 測試 Toast 通知（成功/錯誤訊息是否翻譯）
- [ ] 測試動態內容（變數是否正確插入）
- [ ] 測試格式化（日期、貨幣格式是否正確）
- [ ] 檢查 UI 無破損（CSS 樣式、布局）
- [ ] 截圖對比（遷移前後視覺一致性）

---

## Phase 2 詳細任務分解

### Task 2.1: 建立完整翻譯檔案架構 (3 天)

#### Subtask 2.1.1: 建立 common + navigation namespace (0.5 天)
**負責範圍**:
- `common.actions` - 25 個通用動作按鈕
- `common.status` - 15 個狀態標籤
- `common.loading` / `success` / `error` - 通用訊息
- `common.pagination` - 分頁相關
- `common.date` - 日期相關
- `common.currency` - 貨幣相關
- `navigation.*` - 所有導航選單文字

**產出**:
- 更新 `apps/web/src/messages/zh-TW.json`（新增 ~150 個 key）
- 更新 `apps/web/src/messages/en.json`（新增 ~150 個 key）

**驗證**:
```bash
# 檢查翻譯檔案語法
pnpm lint
# 檢查 JSON 格式
node -e "require('./apps/web/src/messages/zh-TW.json')"
node -e "require('./apps/web/src/messages/en.json')"
```

---

#### Subtask 2.1.2: 建立 auth + dashboard namespace (0.5 天)
**負責範圍**:
- `auth.login` - 登入頁所有文字
- `auth.register` - 註冊頁所有文字
- `auth.forgotPassword` - 忘記密碼頁所有文字
- `dashboard.*` - 儀表板所有文字（統計卡片、快速操作、最近活動、AI 洞察）

**產出**:
- 更新 `apps/web/src/messages/zh-TW.json`（新增 ~120 個 key）
- 更新 `apps/web/src/messages/en.json`（新增 ~120 個 key）

---

#### Subtask 2.1.3: 建立 projects + proposals namespace (1 天)
**負責範圍**:
- `projects.list` - 專案列表頁
- `projects.detail` - 專案詳情頁
- `projects.form` - 專案表單（新增/編輯）
- `proposals.list` - 提案列表頁
- `proposals.detail` - 提案詳情頁
- `proposals.form` - 提案表單
- `proposals.actions` - 提案操作（批准、駁回等）
- `proposals.comments` - 評論區
- `proposals.history` - 審批歷史

**產出**:
- 更新 `apps/web/src/messages/zh-TW.json`（新增 ~200 個 key）
- 更新 `apps/web/src/messages/en.json`（新增 ~200 個 key）

---

#### Subtask 2.1.4: 建立 budgetPools + vendors namespace (0.5 天)
**負責範圍**:
- `budgetPools.list` - 預算池列表
- `budgetPools.detail` - 預算池詳情
- `budgetPools.form` - 預算池表單
- `budgetPools.categories` - 預算類別
- `budgetPools.utilization` - 使用情況
- `vendors.list` - 供應商列表
- `vendors.detail` - 供應商詳情
- `vendors.form` - 供應商表單

**產出**:
- 更新 `apps/web/src/messages/zh-TW.json`（新增 ~150 個 key）
- 更新 `apps/web/src/messages/en.json`（新增 ~150 個 key）

---

#### Subtask 2.1.5: 建立剩餘業務模組 namespace (0.5 天)
**負責範圍**:
- `quotes.*` - 報價單模組
- `purchaseOrders.*` - 採購單模組
- `expenses.*` - 費用記錄模組
- `omExpenses.*` - OM 費用模組
- `chargeOuts.*` - 費用轉嫁模組
- `users.*` - 用戶管理模組
- `notifications.*` - 通知模組
- `settings.*` - 設定模組

**產出**:
- 更新 `apps/web/src/messages/zh-TW.json`（新增 ~300 個 key）
- 更新 `apps/web/src/messages/en.json`（新增 ~300 個 key）

---

#### Subtask 2.1.6: 建立 validation + toast + errors namespace (0.5 天)
**負責範圍**:
- `validation.*` - 所有表單驗證訊息（15+ 個規則）
- `toast.success.*` - 成功訊息模板（10+ 個）
- `toast.error.*` - 錯誤訊息模板（10+ 個）
- `toast.warning.*` - 警告訊息
- `toast.info.*` - 資訊訊息
- `errors.*` - 錯誤頁面（404, 500, unauthorized）

**產出**:
- 更新 `apps/web/src/messages/zh-TW.json`（新增 ~80 個 key）
- 更新 `apps/web/src/messages/en.json`（新增 ~80 個 key）

---

#### Subtask 2.1.7: Code Review + 測試 (0.5 天)
**工作內容**:
1. **一致性檢查**:
   - 確保所有 namespace 命名一致
   - 確保 zh-TW.json 和 en.json 的 key 結構完全一致
   - 檢查是否有重複的翻譯 key

2. **質量檢查**:
   - 英文翻譯是否自然流暢
   - 繁體中文翻譯是否符合業界慣例
   - 變數插值是否正確（{entity}, {count} 等）

3. **技術驗證**:
   - JSON 格式是否正確（無語法錯誤）
   - TypeScript 類型推斷是否正常
   - 在測試頁面中驗證翻譯載入

**驗證指令**:
```bash
# 語法檢查
pnpm lint

# 翻譯 key 一致性檢查（自定義腳本）
node scripts/check-translation-keys.js

# 啟動開發伺服器測試
pnpm dev
```

**測試步驟**:
1. 建立測試頁面 `apps/web/src/app/[locale]/test-i18n/page.tsx`
2. 測試所有 namespace 的 key 是否正確載入
3. 測試語言切換（zh-TW ↔ en）
4. 測試動態內容（變數插值）
5. 測試格式化（日期、貨幣）

---

### Task 2.2: 建立翻譯 Key 一致性檢查工具 (0.5 天)

#### Subtask 2.2.1: 建立檢查腳本

**檔案路徑**: `scripts/check-translation-keys.js`

**功能需求**:
1. 檢查 zh-TW.json 和 en.json 的 key 結構是否一致
2. 檢查是否有缺失的翻譯 key
3. 檢查是否有未使用的翻譯 key（掃描組件檔案）
4. 輸出詳細報告

**腳本範例**:
```javascript
const fs = require('fs');
const path = require('path');

// 載入翻譯檔案
const zhTW = require('../apps/web/src/messages/zh-TW.json');
const en = require('../apps/web/src/messages/en.json');

// 遞迴取得所有 key
function getAllKeys(obj, prefix = '') {
  let keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys = keys.concat(getAllKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

// 檢查一致性
const zhTWKeys = new Set(getAllKeys(zhTW));
const enKeys = new Set(getAllKeys(en));

const missingInEn = [...zhTWKeys].filter(key => !enKeys.has(key));
const missingInZhTW = [...enKeys].filter(key => !zhTWKeys.has(key));

// 輸出報告
console.log('=== Translation Keys Consistency Check ===\n');
console.log(`Total zh-TW keys: ${zhTWKeys.size}`);
console.log(`Total en keys: ${enKeys.size}\n`);

if (missingInEn.length > 0) {
  console.log('❌ Missing in en.json:');
  missingInEn.forEach(key => console.log(`   - ${key}`));
  console.log('');
}

if (missingInZhTW.length > 0) {
  console.log('❌ Missing in zh-TW.json:');
  missingInZhTW.forEach(key => console.log(`   - ${key}`));
  console.log('');
}

if (missingInEn.length === 0 && missingInZhTW.length === 0) {
  console.log('✅ All keys are consistent!');
}

process.exit(missingInEn.length + missingInZhTW.length > 0 ? 1 : 0);
```

**整合到 package.json**:
```json
{
  "scripts": {
    "check:i18n": "node scripts/check-translation-keys.js"
  }
}
```

---

## Phase 3 詳細任務分解

### Batch 1: Layout + Dashboard + Auth (3 天) - P0

#### Task 3.1.1: 遷移 Layout 組件 (1 天)

**組件列表**:
1. `apps/web/src/components/layout/sidebar.tsx`
2. `apps/web/src/components/layout/TopBar.tsx`
3. `apps/web/src/components/layout/dashboard-layout.tsx`

**遷移步驟（以 sidebar.tsx 為例）**:

```tsx
// Before: 硬編碼
const navigation: NavigationSection[] = [
  {
    title: "概覽",
    items: [
      {
        name: "儀表板",
        href: "/dashboard",
        description: "專案總覽和關鍵指標"
      }
    ]
  }
];

// After: 使用翻譯
import { useTranslations } from 'next-intl';

export function Sidebar() {
  const t = useTranslations('navigation');

  const navigation: NavigationSection[] = [
    {
      title: t('sections.overview'),
      items: [
        {
          name: t('menu.dashboard'),
          href: "/dashboard",
          description: t('descriptions.dashboard')
        }
      ]
    }
  ];

  // ... rest of component
}
```

**測試**:
- [ ] 側邊欄所有選單項目顯示正確（zh-TW + en）
- [ ] 品牌資訊顯示正確
- [ ] 用戶資訊顯示正確
- [ ] hover 提示顯示正確

---

#### Task 3.1.2: 遷移 Dashboard 組件 (1 天)

**組件列表**:
1. `apps/web/src/app/[locale]/dashboard/page.tsx`
2. `apps/web/src/components/dashboard/StatCard.tsx`
3. `apps/web/src/components/dashboard/BudgetPoolOverview.tsx`

**關鍵遷移點**:
- 統計卡片標題和變化標籤
- 預算趨勢圖表標籤
- 快速操作按鈕文字
- 最近活動列表
- AI 洞察區塊

**遷移範例**:
```tsx
// Before
const stats = [
  {
    title: '本月預算額',
    value: 'RM 485,200',
    change: { value: '+12.5%', isPositive: true, label: '較上月' },
  }
];

// After
const t = useTranslations('dashboard.stats');

const stats = [
  {
    title: t('monthlyBudget.title'),
    value: 'RM 485,200',
    change: { value: '+12.5%', isPositive: true, label: t('monthlyBudget.change') },
  }
];
```

---

#### Task 3.1.3: 遷移 Auth 組件 (1 天)

**組件列表**:
1. `apps/web/src/app/[locale]/login/page.tsx`
2. `apps/web/src/app/[locale]/register/page.tsx`
3. `apps/web/src/app/[locale]/forgot-password/page.tsx`

**關鍵遷移點**:
- 表單欄位標籤
- 佔位符文字
- 按鈕文字
- 驗證錯誤訊息
- 引導連結文字

**遷移範例**:
```tsx
// Before
<input
  type="email"
  placeholder="輸入您的電子郵件"
  className="..."
/>
<button type="submit">登入</button>
{error && <p>請輸入有效的電子郵件地址</p>}

// After
const t = useTranslations('auth.login');
const tValidation = useTranslations('validation');

<input
  type="email"
  placeholder={t('email')}
  className="..."
/>
<button type="submit">{t('loginButton')}</button>
{error && <p>{tValidation('email')}</p>}
```

---

### Batch 2: Projects + Proposals + BudgetPools (5 天) - P1

#### Task 3.2.1: 遷移 Projects 模組 (2 天)

**Day 1: 頁面組件**
- `projects/page.tsx` - 列表頁
- `projects/[id]/page.tsx` - 詳情頁
- `projects/new/page.tsx` - 新增頁
- `projects/[id]/edit/page.tsx` - 編輯頁

**Day 2: 業務組件 + 測試**
- `ProjectForm.tsx` - 表單組件
- 完整測試（CRUD 流程、驗證、Toast 訊息）

---

#### Task 3.2.2: 遷移 Proposals 模組 (2 天)

**Day 1: 頁面組件**
- `proposals/page.tsx` - 列表頁
- `proposals/[id]/page.tsx` - 詳情頁
- `proposals/new/page.tsx` - 新增頁
- `proposals/[id]/edit/page.tsx` - 編輯頁

**Day 2: 業務組件 + 測試**
- `BudgetProposalForm.tsx` - 表單組件
- `ProposalActions.tsx` - 操作按鈕
- `CommentSection.tsx` - 評論區
- 完整測試（提案流程、審批流程、評論功能）

---

#### Task 3.2.3: 遷移 BudgetPools 模組 (1 天)

**組件列表**:
- `budget-pools/page.tsx` - 列表頁
- `budget-pools/[id]/page.tsx` - 詳情頁
- `budget-pools/new/page.tsx` - 新增頁
- `budget-pools/[id]/edit/page.tsx` - 編輯頁
- `BudgetPoolForm.tsx` - 表單組件

**測試重點**:
- 預算類別動態新增/刪除
- 預算使用率顯示
- 健康狀態指示器

---

### Batch 3: 剩餘模組 (6 天) - P2

**分配策略**:
- Day 1: Vendors + Quotes
- Day 2: PurchaseOrders + Expenses
- Day 3: OMExpenses + ChargeOuts
- Day 4: Users + Notifications + Settings
- Day 5: Theme 組件 + 其他組件
- Day 6: 完整回歸測試 + 修復

---

## 工作量預估總結

| Phase | Task | 預估工時 | 人天 |
|-------|------|---------|------|
| **Phase 2** | 建立翻譯檔案架構 | | |
| 2.1 | 建立完整翻譯檔案 | 24 小時 | 3 天 |
| 2.2 | 建立檢查工具 | 4 小時 | 0.5 天 |
| **Phase 2 小計** | | **28 小時** | **3.5 天** |
| **Phase 3** | 組件遷移 | | |
| 3.1 | Batch 1 (P0) | 24 小時 | 3 天 |
| 3.2 | Batch 2 (P1) | 40 小時 | 5 天 |
| 3.3 | Batch 3 (P2) | 48 小時 | 6 天 |
| **Phase 3 小計** | | **112 小時** | **14 天** |
| **總計** | | **140 小時** | **17.5 天** |

**備註**:
- 以上預估基於 1 人全職開發（8 小時/天）
- 包含 Code Review、測試、修復時間
- 預留 10% buffer 時間應對突發問題

---

## 風險評估與緩解策略

### 風險 1: 翻譯 Key 命名不一致

**影響**: 中度
**可能性**: 高

**緩解策略**:
1. 建立明確的命名規範文件（已完成）
2. 使用自動檢查工具（Task 2.2）
3. Code Review 時特別關注命名一致性
4. 建立 ESLint 規則檢查翻譯 key 使用

---

### 風險 2: 遺漏硬編碼文字

**影響**: 中度
**可能性**: 中度

**緩解策略**:
1. 使用 Grep 工具搜尋常見硬編碼中文字（例如：`grep -r "[\u4e00-\u9fa5]" apps/web/src/`）
2. 每個組件遷移後進行完整手動測試
3. 建立遷移檢查清單（已提供）
4. 使用 ESLint 規則禁止硬編碼文字

---

### 風險 3: UI 破損（CSS、布局問題）

**影響**: 低
**可能性**: 低

**緩解策略**:
1. 遷移前截圖所有頁面（zh-TW）
2. 遷移後對比截圖，確保視覺一致性
3. 測試不同語言的文字長度影響（中文通常比英文短）
4. 使用 Tailwind CSS 的 responsive utilities

---

### 風險 4: 動態內容翻譯錯誤

**影響**: 高
**可能性**: 中度

**緩解策略**:
1. 為所有動態內容建立單元測試
2. 測試所有變數插值場景
3. 測試 Edge Cases（空值、null、undefined）
4. 在 Code Review 時特別關注動態內容

---

### 風險 5: 翻譯質量不佳

**影響**: 中度
**可能性**: 中度

**緩解策略**:
1. 英文翻譯由母語者審閱
2. 繁體中文翻譯遵循業界慣例（ERP、CRM 系統用語）
3. 建立術語表（Glossary）統一專業術語
4. 邀請終端用戶參與測試

---

### 風險 6: TypeScript 類型錯誤

**影響**: 低
**可能性**: 低

**緩解策略**:
1. 遷移過程中持續運行 `pnpm typecheck`
2. 使用 next-intl 的類型安全 API
3. 配置 TypeScript strict mode
4. 在 CI/CD 中加入類型檢查

---

## 成功標準

### Phase 2 成功標準
- [ ] zh-TW.json 和 en.json 包含所有必需的翻譯 key（~2500 個）
- [ ] 兩個檔案的 key 結構 100% 一致
- [ ] 所有英文翻譯自然流暢
- [ ] 所有繁體中文翻譯符合業界慣例
- [ ] 翻譯 key 一致性檢查腳本運行通過
- [ ] 測試頁面成功載入所有翻譯

### Phase 3 成功標準
- [ ] 所有 64 個組件（18 頁面 + 46 組件）遷移完成
- [ ] 所有頁面在 zh-TW 和 en 下顯示正確
- [ ] 所有表單驗證訊息翻譯正確
- [ ] 所有 Toast 通知訊息翻譯正確
- [ ] 所有狀態標籤翻譯正確
- [ ] 日期、數字、貨幣格式化正確
- [ ] 無 TypeScript 類型錯誤
- [ ] 無 ESLint 警告
- [ ] 所有測試通過
- [ ] 視覺回歸測試通過（截圖對比）

### 整體成功標準
- [ ] 用戶可以在 `/zh-TW/...` 和 `/en/...` 之間無縫切換
- [ ] 所有功能在兩種語言下運作正常
- [ ] 無性能回退（頁面載入時間無明顯增加）
- [ ] Code Review 通過
- [ ] 終端用戶測試通過

---

## 後續優化建議

### 短期優化（3 個月內）
1. **建立翻譯管理流程**:
   - 新增功能時同步更新翻譯檔案
   - 建立翻譯審閱流程（PR 必須包含翻譯）

2. **改進開發者體驗**:
   - 建立 VS Code snippets 快速插入翻譯 key
   - 建立 CLI 工具自動生成翻譯 key

3. **測試自動化**:
   - 建立 E2E 測試覆蓋多語言場景
   - 建立視覺回歸測試自動化

### 中期優化（6 個月內）
1. **支援更多語言**:
   - 簡體中文（zh-CN）
   - 馬來語（ms）

2. **翻譯管理平台**:
   - 整合 Crowdin 或 Lokalise
   - 允許非技術人員更新翻譯

3. **性能優化**:
   - 實施翻譯檔案分割（按路由動態載入）
   - 實施翻譯快取策略

### 長期優化（12 個月內）
1. **AI 輔助翻譯**:
   - 使用 GPT-4 自動生成初稿翻譯
   - 人工審閱和修正

2. **翻譯分析**:
   - 追蹤最常用的翻譯 key
   - 識別未使用的翻譯 key

3. **多租戶支援**:
   - 允許不同租戶自定義翻譯
   - 支援區域性方言差異

---

## 附錄

### A. 翻譯檔案完整範例（zh-TW.json 片段）

```json
{
  "common": {
    "actions": {
      "save": "儲存",
      "cancel": "取消",
      "delete": "刪除",
      "edit": "編輯",
      "create": "新增",
      "submit": "提交",
      "search": "搜尋",
      "filter": "篩選",
      "export": "匯出",
      "import": "匯入",
      "confirm": "確認",
      "back": "返回",
      "next": "下一步",
      "previous": "上一步",
      "close": "關閉",
      "yes": "是",
      "no": "否",
      "view": "查看",
      "viewAll": "查看全部",
      "download": "下載",
      "upload": "上傳",
      "approve": "批准",
      "reject": "駁回",
      "withdraw": "撤回",
      "requestMoreInfo": "要求更多資訊",
      "refresh": "重新整理"
    },
    "status": {
      "draft": "草稿",
      "pending": "待審批",
      "pendingApproval": "待審批",
      "approved": "已批准",
      "rejected": "已駁回",
      "moreInfoRequired": "需要更多資訊",
      "completed": "已完成",
      "paid": "已支付",
      "cancelled": "已取消",
      "active": "進行中",
      "inactive": "非活動"
    },
    "loading": "載入中...",
    "saving": "儲存中...",
    "submitting": "提交中...",
    "processing": "處理中...",
    "error": "發生錯誤",
    "success": "操作成功",
    "noData": "無資料",
    "noResults": "無搜尋結果",
    "selectPlaceholder": "請選擇",
    "searchPlaceholder": "搜尋...",
    "required": "必填",
    "optional": "選填"
  },
  "navigation": {
    "brand": {
      "title": "IT 專案管理",
      "subtitle": "流程平台"
    },
    "sections": {
      "overview": "概覽",
      "projectBudget": "專案與預算",
      "procurement": "採購管理",
      "system": "系統管理"
    },
    "menu": {
      "dashboard": "儀表板",
      "projects": "專案管理",
      "proposals": "預算提案",
      "budgetPools": "預算池",
      "vendors": "供應商",
      "quotes": "報價單",
      "purchaseOrders": "採購單",
      "expenses": "費用記錄",
      "omExpenses": "OM 費用",
      "chargeOuts": "費用轉嫁",
      "users": "用戶管理",
      "notifications": "通知",
      "settings": "系統設定",
      "help": "幫助中心"
    },
    "descriptions": {
      "dashboard": "專案總覽和關鍵指標",
      "projects": "專案資料和進度管理",
      "proposals": "預算提案申請與審批",
      "budgetPools": "年度預算分配管理",
      "vendors": "供應商資料管理",
      "quotes": "供應商報價管理",
      "purchaseOrders": "採購訂單追蹤",
      "expenses": "費用發票與核銷",
      "omExpenses": "操作與維護費用管理",
      "chargeOuts": "ChargeOut 費用轉嫁管理",
      "users": "用戶帳號和權限",
      "settings": "系統參數設定",
      "help": "使用指南和支援"
    }
  }
}
```

### B. 組件遷移範例（完整）

**Before (sidebar.tsx - 硬編碼)**:
```tsx
"use client"

import { Link, usePathname } from "@/i18n/routing"
import { Building } from "lucide-react"

export function Sidebar() {
  const pathname = usePathname()

  const navigation = [
    {
      title: "概覽",
      items: [
        {
          name: "儀表板",
          href: "/dashboard",
          description: "專案總覽和關鍵指標"
        }
      ]
    }
  ]

  return (
    <div className="...">
      <div className="...">
        <Link href="/dashboard">
          <span>IT 專案管理</span>
          <span>流程平台</span>
        </Link>
      </div>

      <nav>
        {navigation.map((section) => (
          <div key={section.title}>
            <h3>{section.title}</h3>
            {section.items.map((item) => (
              <Link key={item.name} href={item.href}>
                {item.name}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </div>
  )
}
```

**After (sidebar.tsx - 使用翻譯)**:
```tsx
"use client"

import { useTranslations } from 'next-intl'
import { Link, usePathname } from "@/i18n/routing"
import { Building, LayoutDashboard } from "lucide-react"

export function Sidebar() {
  const pathname = usePathname()
  const t = useTranslations('navigation')

  const navigation = [
    {
      title: t('sections.overview'),
      items: [
        {
          name: t('menu.dashboard'),
          href: "/dashboard",
          icon: LayoutDashboard,
          description: t('descriptions.dashboard')
        }
      ]
    }
  ]

  return (
    <div className="...">
      {/* 品牌區域 */}
      <div className="...">
        <Link href="/dashboard">
          <div className="...">
            <Building className="..." />
          </div>
          <div>
            <span>{t('brand.title')}</span>
            <span>{t('brand.subtitle')}</span>
          </div>
        </Link>
      </div>

      {/* 導航選單 */}
      <nav>
        {navigation.map((section) => (
          <div key={section.title}>
            <h3>{section.title}</h3>
            {section.items.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                title={item.description}
              >
                <item.icon className="..." />
                <span>{item.name}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </div>
  )
}
```

### C. 相關資源連結

- **next-intl 官方文件**: https://next-intl-docs.vercel.app/
- **Next.js i18n 指南**: https://nextjs.org/docs/app/building-your-application/routing/internationalization
- **翻譯最佳實踐**: https://phrase.com/blog/posts/i18n-best-practices/
- **TypeScript 類型安全 i18n**: https://www.i18next.com/overview/typescript

---

**文件版本**: 1.0
**最後更新**: 2025-11-03
**維護者**: Development Team
