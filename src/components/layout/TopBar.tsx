/**
 * @fileoverview TopBar Component - 頂部工具列組件
 *
 * @description
 *   提供應用程式頂部工具列，包含搜尋功能、通知中心、主題切換、語言切換和用戶選單。
 *   支援移動裝置的選單按鈕，整合通知系統即時提醒，
 *   提供用戶資訊展示和登出功能，確保完整的導航和操作體驗。
 *
 * @component TopBar
 *
 * @features
 *   - 移動選單切換按鈕（lg 以下顯示）
 *   - 全域搜尋欄
 *   - 語言切換器（Story 17-5：i18n 整合）
 *   - 主題切換器
 *   - 通知鈴鐺（靜態展示）
 *   - 用戶下拉選單（頭像、姓名、角色、登出）
 *   - 響應式設計
 *
 * @since CHANGE-001 - Dashboard Layout Redesign
 * @lastModified 2026-01-17
 *
 * @dependencies
 *   - next-auth/react: 用戶會話管理和登出功能
 *   - lucide-react: 圖示組件
 *   - @/components/ui: shadcn/ui 組件
 */

'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import {
  Search,
  Menu,
  LogOut,
  User,
  Settings,
  ChevronDown,
  Bell,
  Sun,
  Moon,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CityIndicator } from '@/components/layout/CityIndicator'
import { LocaleSwitcher } from '@/components/features/locale/LocaleSwitcher'

// ============================================================
// Types
// ============================================================

interface TopBarProps {
  onMenuClick?: () => void
}

// ============================================================
// Mock Notifications Data
// ============================================================

const mockNotifications = [
  {
    id: 1,
    type: 'success',
    title: '發票審核完成',
    message: '發票 INV-2024-001 已通過自動審核',
    time: '5分鐘前',
    unread: true,
  },
  {
    id: 2,
    type: 'info',
    title: '新規則建議',
    message: '系統建議為 DHL 新增映射規則',
    time: '1小時前',
    unread: true,
  },
  {
    id: 3,
    type: 'warning',
    title: '低信心度警告',
    message: '3 張發票需要人工審核',
    time: '3小時前',
    unread: false,
  },
]

// ============================================================
// Role Display Names
// ============================================================

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  'System Admin': '系統管理員',
  'Super User': '超級用戶',
  'Data Processor': '資料處理員',
  'City Manager': '城市經理',
  'Regional Manager': '區域經理',
  Auditor: '審計員',
}

// ============================================================
// Component
// ============================================================

/**
 * @component TopBar
 * @description 頂部工具列組件，提供搜尋、通知、主題切換和用戶選單功能
 */
export function TopBar({ onMenuClick }: TopBarProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // 避免 hydration mismatch
  React.useEffect(() => {
    setMounted(true)
  }, [])

  const notifications = mockNotifications
  const unreadCount = notifications.filter((n) => n.unread).length

  // 獲取用戶名稱首字母用於 Avatar
  const getUserInitials = (name: string | null | undefined) => {
    if (!name) return 'U'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // 獲取用戶角色顯示名稱
  const getUserRole = () => {
    const roles = (session?.user as { roles?: Array<{ name: string }> })?.roles
    const primaryRole = roles?.[0]?.name ?? 'Data Processor'
    return ROLE_DISPLAY_NAMES[primaryRole] ?? primaryRole
  }

  // 處理登出
  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/auth/login', redirect: true })
  }

  // 切換主題
  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-800">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* 左側：Mobile 菜單 + 搜索欄 */}
        <div className="flex flex-1 items-center justify-start">
          {/* Mobile Menu Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden mr-2"
            onClick={onMenuClick}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">開啟選單</span>
          </Button>

          {/* 搜索欄 */}
          <div className="w-full max-w-lg lg:max-w-xs">
            <label htmlFor="search" className="sr-only">
              搜尋
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-5 w-5 text-gray-400" aria-hidden="true" />
              </div>
              <Input
                id="search"
                name="search"
                type="search"
                placeholder="搜尋發票、Forwarder..."
                className="block w-full pl-10"
              />
            </div>
          </div>
        </div>

        {/* 右側工具欄 */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* 城市指示器 */}
          <CityIndicator />

          {/* 語言切換 (Story 17-5) */}
          <LocaleSwitcher className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300" />

          {/* 主題切換 */}
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="text-gray-500 hover:text-gray-700"
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
              <span className="sr-only">切換主題</span>
            </Button>
          )}

          {/* 通知 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative text-gray-500 hover:text-gray-700"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                  >
                    {unreadCount}
                  </Badge>
                )}
                <span className="sr-only">查看通知</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="flex items-center justify-between px-4 py-2 border-b">
                <h3 className="text-sm font-medium">通知</h3>
                <Button variant="ghost" size="sm" className="text-xs text-blue-600">
                  全部標為已讀
                </Button>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    className="flex flex-col items-start p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  >
                    <div className="flex w-full items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {notification.title}
                          </p>
                          {notification.unread && (
                            <div className="h-2 w-2 rounded-full bg-blue-600" />
                          )}
                        </div>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                          {notification.message}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {notification.time}
                        </p>
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))}
              </div>
              <div className="border-t p-2">
                <Button variant="ghost" size="sm" className="w-full text-center text-blue-600">
                  查看全部通知
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 用戶選單 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-3 px-3 py-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600">
                  <span className="text-sm font-medium text-white">
                    {getUserInitials(session?.user?.name)}
                  </span>
                </div>
                <div className="hidden lg:block text-left">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {session?.user?.name || '用戶'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {session?.user?.email}
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-3 py-2 border-b">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {session?.user?.name || '用戶'}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {session?.user?.email}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {getUserRole()}
                </div>
              </div>
              <DropdownMenuItem
                className="flex items-center space-x-2 cursor-pointer"
                onClick={() => router.push('/settings/profile')}
              >
                <User className="h-4 w-4" />
                <span>個人資料</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center space-x-2 cursor-pointer"
                onClick={() => router.push('/settings')}
              >
                <Settings className="h-4 w-4" />
                <span>系統設定</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="flex items-center space-x-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
                <span>登出</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
