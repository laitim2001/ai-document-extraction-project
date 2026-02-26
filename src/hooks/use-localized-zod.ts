/**
 * @fileoverview 國際化 Zod 驗證 Hook
 * @description
 *   提供簡化的 API 來使用 Zod 4.x 的國際化支援。
 *   自動根據當前語言設定 Zod locale。
 *
 * @module src/hooks/use-localized-zod
 * @author Development Team
 * @since Epic 17 - Story 17.3 (Validation Internationalization)
 * @lastModified 2026-01-17
 *
 * @features
 *   - 自動設定 Zod 內建 locale
 *   - 支援自定義 ErrorMap
 *   - 支援欄位名稱自定義
 *
 * @dependencies
 *   - next-intl - 國際化框架
 *   - zod - Schema 驗證
 *
 * @related
 *   - src/lib/i18n-zod.ts - Zod 國際化工具
 *   - messages/{locale}/validation.json - 驗證訊息翻譯
 */

'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useMemo } from 'react'
import type { core } from 'zod'

import {
  setZodLocale,
  createZodErrorMap,
  type TranslateFunction,
} from '@/lib/i18n-zod'

/**
 * 國際化 Zod 驗證 Hook 返回類型
 */
interface UseLocalizedZodReturn {
  /** 自定義 ErrorMap（使用 next-intl 翻譯） */
  errorMap: core.$ZodErrorMap
  /** 驗證翻譯函數（來自 validation namespace） */
  t: TranslateFunction
  /** 當前 locale */
  locale: string
}

/**
 * 國際化 Zod 驗證 Hook
 *
 * @description
 *   此 Hook 會自動設定 Zod 的全域 locale，並提供
 *   自定義 ErrorMap 供需要額外欄位標籤的情況使用。
 *
 *   **Zod 4.x 內建 locale 說明**：
 *   Zod 4.x 已內建 locale 支援，此 Hook 會自動
 *   在組件掛載時設定對應的 locale，無需手動處理。
 *
 * @param fieldLabels - 欄位名稱映射（key: schema 欄位名，value: 顯示名稱）
 * @returns 工具函數和 ErrorMap
 *
 * @example
 * function MyForm() {
 *   const { locale, t } = useLocalizedZod();
 *
 *   // Zod 驗證會自動使用當前語言的錯誤訊息
 *   const schema = z.object({
 *     name: z.string().min(1),
 *     email: z.string().email(),
 *   });
 *
 *   const result = schema.safeParse(data);
 *   // result.error?.issues[0].message 會是當前語言的訊息
 * }
 *
 * @example
 * // 使用自定義欄位標籤
 * function MyForm() {
 *   const { errorMap } = useLocalizedZod({
 *     name: '名稱',
 *     email: '電郵',
 *   });
 *
 *   // 使用 react-hook-form + zodResolver
 *   // const form = useForm({
 *   //   resolver: zodResolver(schema, { errorMap }),
 *   // });
 * }
 */
export function useLocalizedZod(
  fieldLabels?: Record<string, string>
): UseLocalizedZodReturn {
  const locale = useLocale()
  const t = useTranslations('validation')

  // 設定 Zod 全域 locale
  useEffect(() => {
    setZodLocale(locale)
  }, [locale])

  // 建立自定義 ErrorMap（如果需要欄位標籤）
  const errorMap = useMemo(
    () => createZodErrorMap(t as TranslateFunction, fieldLabels),
    [t, fieldLabels]
  )

  return {
    errorMap,
    t: t as TranslateFunction,
    locale,
  }
}

/**
 * 欄位標籤定義（常用欄位）
 * 使用方式：根據當前語言取得對應的欄位標籤
 */
export const COMMON_FIELD_LABELS = {
  'zh-TW': {
    name: '名稱',
    email: '電郵',
    password: '密碼',
    confirmPassword: '確認密碼',
    phone: '電話',
    description: '描述',
    companyId: '公司',
    formatId: '格式',
    fieldName: '欄位名稱',
    displayLabel: '顯示標籤',
    code: '代碼',
    city: '城市',
    status: '狀態',
    priority: '優先級',
    amount: '金額',
    quantity: '數量',
    date: '日期',
    startDate: '開始日期',
    endDate: '結束日期',
    file: '檔案',
    title: '標題',
    content: '內容',
    comment: '備註',
  },
  'zh-CN': {
    name: '名称',
    email: '邮箱',
    password: '密码',
    confirmPassword: '确认密码',
    phone: '电话',
    description: '描述',
    companyId: '公司',
    formatId: '格式',
    fieldName: '字段名称',
    displayLabel: '显示标签',
    code: '代码',
    city: '城市',
    status: '状态',
    priority: '优先级',
    amount: '金额',
    quantity: '数量',
    date: '日期',
    startDate: '开始日期',
    endDate: '结束日期',
    file: '文件',
    title: '标题',
    content: '内容',
    comment: '备注',
  },
  en: {
    name: 'Name',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    phone: 'Phone',
    description: 'Description',
    companyId: 'Company',
    formatId: 'Format',
    fieldName: 'Field Name',
    displayLabel: 'Display Label',
    code: 'Code',
    city: 'City',
    status: 'Status',
    priority: 'Priority',
    amount: 'Amount',
    quantity: 'Quantity',
    date: 'Date',
    startDate: 'Start Date',
    endDate: 'End Date',
    file: 'File',
    title: 'Title',
    content: 'Content',
    comment: 'Comment',
  },
} as const

/**
 * 根據 locale 取得欄位標籤
 */
export function getFieldLabels(
  locale: keyof typeof COMMON_FIELD_LABELS
): Record<string, string> {
  return COMMON_FIELD_LABELS[locale] || COMMON_FIELD_LABELS.en
}
