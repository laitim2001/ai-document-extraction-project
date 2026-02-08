# CHANGE-030: Sidebar Navigation Reorganization

> **日期**: 2026-02-06
> **狀態**: ✅ 已完成
> **影響範圍**: Sidebar 導航、i18n 翻譯文件

---

## 變更背景

System Admin 分類下累積了 11 個 menu items，包含模版管理、提取配置、測試工具、業務參考數據等不同性質的功能，導致導航結構混亂，用戶難以快速找到所需功能。

## 變更內容

### 從 5 個分類重組為 8 個分類

| # | 分類 | EN | zh-TW | zh-CN | Items |
|---|------|-----|--------|--------|-------|
| 1 | Overview | Overview | 概覽 | 概览 | 2 (不變) |
| 2 | Document Processing | Document Processing | 文件處理 | 文件处理 | 4 (不變) |
| 3 | **Template Management** | Template Management | 模版管理 | 模板管理 | 3 (新增) |
| 4 | **Extraction Config** | Extraction Config | 提取配置 | 提取配置 | 3 (新增) |
| 5 | Rule Management | Rule Management | 規則管理 | 规则管理 | 4 (擴充) |
| 6 | Reports | Reports | 報表 | 报表 | 2 (不變) |
| 7 | System Admin | System Admin | 系統管理 | 系统管理 | 2 (精簡) |
| 8 | **Dev Tools** | Dev Tools | 開發工具 | 开发工具 | 2 (新增) |

### 項目遷移明細

#### 新增分類：Template Management (模版管理)
- Data Templates (從 System Admin 移出)
- Template Field Mappings (從 System Admin 移出)
- Template Instances (從 System Admin 移出)

#### 新增分類：Extraction Config (提取配置)
- Field Mapping Config (從 System Admin 移出)
- Prompt Config (從 System Admin 移出)
- Term Analysis (從 System Admin 移出)

#### 擴充：Rule Management (規則管理)
- Mapping Rules (原有)
- Companies (原有)
- Reference Numbers (從 System Admin 移入)
- Exchange Rates (新增至 sidebar，頁面已存在)

#### 精簡：System Admin (系統管理)
- User Management (保留)
- Historical Data Init (保留)

#### 新增分類：Dev Tools (開發工具)
- Document Preview Test (從 System Admin 移出)
- Template Matching Test (從 System Admin 移出)

## 修改文件

| 文件 | 變更 |
|------|------|
| `src/components/layout/Sidebar.tsx` | 重組 navigation 陣列為 8 sections、新增 DollarSign/Wrench icon imports、更新 fileoverview |
| `messages/en/navigation.json` | 新增 sections.templates、sections.extraction、sections.devTools、sidebar.exchangeRates |
| `messages/zh-TW/navigation.json` | 同上（繁體中文翻譯） |
| `messages/zh-CN/navigation.json` | 同上（簡體中文翻譯） |

## 設計決策

1. **Dev Tools 獨立分類** - 測試工具與日常業務操作無關，獨立後更清晰
2. **Exchange Rates 歸入 Rule Management** - 匯率屬於業務參考數據，與 Companies、Mapping Rules 同性質
3. **Historical Data Init 留在 System Admin** - 屬一次性管理操作，保留在系統管理合理
4. **Template vs Extraction 分開** - 模版定義結構，提取配置定義 AI 行為，職責不同應分開
