/**
 * @fileoverview i18n 語言感知的根佈局組件
 * @description
 *   為所有頁面提供語言上下文，整合 next-intl Provider。
 *   此佈局會根據 URL 中的 locale 參數載入對應的翻譯。
 *
 * @module src/app/[locale]/layout
 * @author Development Team
 * @since Epic 17 - Story 17.1 (i18n Infrastructure Setup)
 * @lastModified 2026-01-16
 *
 * @features
 *   - 語言感知的 HTML lang 屬性
 *   - NextIntlClientProvider 整合
 *   - SEO hreflang 標籤
 *
 * @dependencies
 *   - next-intl - i18n 框架
 *   - next-intl/navigation - 路由整合
 *
 * @related
 *   - src/i18n/config.ts - 語言配置
 *   - src/i18n/request.ts - 翻譯載入
 */

import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Inter } from 'next/font/google'
import { locales, localeHtmlLang, type Locale } from '@/i18n/config'
import { QueryProvider } from '@/providers/QueryProvider'
import { AuthProvider } from '@/providers/AuthProvider'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { Toaster } from '@/components/ui/toaster'
import '../globals.css'

const inter = Inter({ subsets: ['latin'] })

interface LocaleLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

// 生成靜態路由參數
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

// 生成元數據
export async function generateMetadata({ params }: LocaleLayoutProps) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'metadata' })
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://example.com'

  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: `${baseUrl}/${locale}`,
      languages: Object.fromEntries(locales.map((loc) => [loc, `${baseUrl}/${loc}`])),
    },
  }
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params

  // 驗證 locale 是否有效
  if (!locales.includes(locale as Locale)) {
    notFound()
  }

  // 載入翻譯訊息
  const messages = await getMessages()

  return (
    <html lang={localeHtmlLang[locale as Locale]} suppressHydrationWarning>
      <head>
        {/* hreflang 標籤 */}
        {locales.map((loc) => (
          <link
            key={loc}
            rel="alternate"
            hrefLang={localeHtmlLang[loc]}
            href={`${process.env.NEXT_PUBLIC_APP_URL || ''}/${loc}`}
          />
        ))}
        <link
          rel="alternate"
          hrefLang="x-default"
          href={`${process.env.NEXT_PUBLIC_APP_URL || ''}/en`}
        />
      </head>
      <body className={inter.className}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider>
            <AuthProvider>
              <QueryProvider>
                {children}
                <Toaster />
              </QueryProvider>
            </AuthProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
