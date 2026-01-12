/**
 * @fileoverview Sidebar Component - 側邊欄導航組件
 *
 * @description
 *   提供應用程式側邊欄導航，包含分類導航選單、用戶資訊顯示和收合功能。
 *   支援響應式設計，在移動端作為 overlay 顯示。
 *
 * @component Sidebar
 *
 * @features
 *   - 分類導航選單（概覽、文件處理、規則管理、報表、系統管理）
 *   - 收合/展開功能
 *   - 當前路徑高亮
 *   - 用戶資訊顯示
 *   - 響應式設計
 *   - 歷史數據初始化入口 (Epic 0)
 *   - 文件預覽測試入口 (Epic 13)
 *
 * @since CHANGE-001 - Dashboard Layout Redesign
 * @lastModified 2026-01-03
 *
 * @dependencies
 *   - next/navigation: 路由導航
 *   - lucide-react: 圖示組件
 *   - @/components/ui: shadcn/ui 組件
 */

'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Globe,
  FileText,
  Upload,
  ClipboardCheck,
  AlertTriangle,
  GitBranch,
  Building2,
  BarChart3,
  History,
  Settings,
  Users,
  ChevronLeft,
  ChevronRight,
  FileSearch,
  Database,
  Layers,
  ArrowRightLeft,
  MessageSquareCode,
  Tags,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// ============================================================
// Types
// ============================================================

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavSection {
  title: string
  items: NavItem[]
}

interface SidebarProps {
  isCollapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
}

// ============================================================
// Navigation Configuration
// ============================================================

const navigation: NavSection[] = [
  {
    title: '概覽',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: '全局視圖', href: '/global', icon: Globe },
    ],
  },
  {
    title: '文件處理',
    items: [
      { name: '發票列表', href: '/invoices', icon: FileText },
      { name: '上傳發票', href: '/invoices/upload', icon: Upload },
      { name: '待審核', href: '/review', icon: ClipboardCheck },
      { name: '升級案例', href: '/escalations', icon: AlertTriangle },
    ],
  },
  {
    title: '規則管理',
    items: [
      { name: '映射規則', href: '/rules', icon: GitBranch },
      { name: '公司管理', href: '/companies', icon: Building2 },
    ],
  },
  {
    title: '報表',
    items: [
      { name: '分析報表', href: '/reports/monthly', icon: BarChart3 },
      { name: '審計日誌', href: '/audit/query', icon: History },
      // { name: '文件追蹤', href: '/trace', icon: FileSearch }, // TODO: 待實現
    ],
  },
  {
    title: '系統管理',
    items: [
      // { name: '系統設定', href: '/settings', icon: Settings }, // TODO: 待實現
      { name: '用戶管理', href: '/admin/users', icon: Users },
      { name: '歷史數據初始化', href: '/admin/historical-data', icon: Database },
      { name: '文件預覽測試', href: '/admin/document-preview-test', icon: Layers },
      { name: '欄位映射配置', href: '/admin/field-mapping-configs', icon: ArrowRightLeft },
      { name: 'Prompt 配置', href: '/admin/prompt-configs', icon: MessageSquareCode },
      { name: '術語分析', href: '/admin/term-analysis', icon: Tags },
    ],
  },
]

// ============================================================
// Component
// ============================================================

/**
 * @component Sidebar
 * @description 側邊欄導航組件，提供應用程式主要導航功能
 */
export function Sidebar({ isCollapsed = false, onCollapsedChange }: SidebarProps) {
  const pathname = usePathname()

  const isActiveLink = (href: string) => {
    // 使用精確匹配，避免父路徑誤匹配子路徑
    // 例如：/invoices 不應該匹配 /invoices/upload
    return pathname === href
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          'flex h-full flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300',
          isCollapsed ? 'w-16' : 'w-72'
        )}
      >
        {/* Logo 區域 */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800">
          {!isCollapsed && (
            <div className="flex items-center">
              <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <span className="ml-2 text-lg font-semibold text-gray-900 dark:text-white truncate">
                AI Doc Extract
              </span>
            </div>
          )}
          {isCollapsed && (
            <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center mx-auto">
              <FileText className="h-5 w-5 text-white" />
            </div>
          )}
          {onCollapsedChange && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8 flex-shrink-0',
                isCollapsed && 'absolute -right-3 top-5 z-50 rounded-full border bg-white dark:bg-gray-900 shadow-md'
              )}
              onClick={() => onCollapsedChange(!isCollapsed)}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>

        {/* 導航區域 */}
        <ScrollArea className="flex-1 py-4">
          <nav className="space-y-6 px-2">
            {navigation.map((section, sectionIndex) => (
              <div key={section.title}>
                {!isCollapsed && (
                  <h3 className="mb-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {section.title}
                  </h3>
                )}
                {isCollapsed && sectionIndex > 0 && (
                  <Separator className="my-2" />
                )}
                <ul className={cn('space-y-1', !isCollapsed && 'pl-2')}>
                  {section.items.map((item) => {
                    const Icon = item.icon
                    const isActive = isActiveLink(item.href)

                    if (isCollapsed) {
                      return (
                        <li key={item.name}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link
                                href={item.href}
                                className={cn(
                                  'flex items-center justify-center rounded-lg p-3 transition-colors',
                                  isActive
                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                                )}
                              >
                                <Icon className="h-5 w-5" />
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                              {item.name}
                            </TooltipContent>
                          </Tooltip>
                        </li>
                      )
                    }

                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          className={cn(
                            'flex items-center rounded-lg px-3 py-2 text-sm transition-colors',
                            isActive
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                          )}
                        >
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          <span className="ml-3 truncate">{item.name}</span>
                          {isActive && (
                            <div className="ml-auto h-2 w-2 rounded-full bg-blue-600" />
                          )}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </ScrollArea>

        {/* 底部版本資訊 */}
        {!isCollapsed && (
          <div className="border-t border-gray-200 dark:border-gray-800 p-4">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              <p>AI Document Extraction</p>
              <p>Version 1.0.0</p>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
