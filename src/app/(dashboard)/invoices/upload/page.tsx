'use client'

/**
 * @fileoverview 發票上傳頁面
 * @description
 *   提供發票文件上傳功能的頁面。
 *   支援拖放上傳、批量上傳和進度追蹤。
 *   支援選擇城市進行文件分類。
 *
 * @module src/app/(dashboard)/invoices/upload/page
 * @author Development Team
 * @since Epic 2 - Story 2.1 (File Upload Interface & Validation)
 * @lastModified 2026-01-14
 *
 * @related
 *   - src/components/features/invoice/FileUploader.tsx - 上傳組件
 *   - src/app/api/documents/upload/route.ts - 上傳 API
 */

import { useState, useMemo } from 'react'
import { MapPin, Loader2 } from 'lucide-react'
import { FileUploader } from '@/components/features/invoice'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useCitiesGrouped } from '@/hooks/use-cities'

/**
 * 發票上傳頁面
 *
 * @component UploadPage
 * @description 發票文件上傳頁面，提供拖放上傳功能和城市選擇
 */
export default function UploadPage() {
  const [selectedCityCode, setSelectedCityCode] = useState<string>('')
  const { data: groupedCities, isLoading: isLoadingCities } = useCitiesGrouped()

  // 從分組數據中創建城市代碼到名稱的映射
  const cityCodeToName = useMemo(() => {
    const map: Record<string, string> = {}
    groupedCities?.forEach((group) => {
      group.cities.forEach((city) => {
        map[city.code] = city.name
      })
    })
    return map
  }, [groupedCities])

  return (
    <div className="container mx-auto py-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>上傳發票文件</CardTitle>
          <CardDescription>
            上傳發票文件以進行 AI 處理和數據提取。支援 PDF、JPG、PNG 格式。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 城市選擇器 */}
          <div className="space-y-2">
            <Label htmlFor="city-select">
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                選擇城市 <span className="text-destructive">*</span>
              </span>
            </Label>
            <Select
              value={selectedCityCode}
              onValueChange={setSelectedCityCode}
              disabled={isLoadingCities}
            >
              <SelectTrigger id="city-select" className="w-full">
                <SelectValue placeholder={isLoadingCities ? '載入中...' : '請選擇城市'}>
                  {isLoadingCities ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      載入中...
                    </span>
                  ) : selectedCityCode ? (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {cityCodeToName[selectedCityCode]} ({selectedCityCode})
                    </span>
                  ) : (
                    '請選擇城市'
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {groupedCities?.map((group) => (
                  <SelectGroup key={group.region}>
                    <SelectLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {group.region}
                    </SelectLabel>
                    {group.cities.map((city) => (
                      <SelectItem key={city.code} value={city.code}>
                        <span className="flex items-center gap-2">
                          <MapPin className="h-3 w-3" />
                          {city.name} ({city.code})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            {!selectedCityCode && !isLoadingCities && (
              <p className="text-sm text-muted-foreground">
                請先選擇城市，才能上傳發票文件。
              </p>
            )}
          </div>

          {/* 文件上傳器 */}
          {selectedCityCode ? (
            <FileUploader cityCode={selectedCityCode} />
          ) : (
            <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
              <MapPin className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>請先選擇城市，才能上傳文件</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
