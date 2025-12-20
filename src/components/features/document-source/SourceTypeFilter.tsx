/**
 * @fileoverview 來源類型篩選器組件
 * @description
 *   用於文件列表的來源類型篩選下拉選單
 *
 * @module src/components/features/document-source/SourceTypeFilter
 * @author Development Team
 * @since Epic 9 - Story 9.5 (自動獲取來源追蹤)
 * @lastModified 2025-12-20
 */

'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Upload, Mail, FileSpreadsheet, Globe, Filter } from 'lucide-react'
import { SOURCE_TYPE_OPTIONS } from '@/lib/constants/source-types'

// ============================================================
// Types
// ============================================================

interface SourceTypeFilterProps {
  /** 當前選擇的值 */
  value: string
  /** 變更事件 */
  onChange: (value: string) => void
  /** 是否禁用 */
  disabled?: boolean
  /** 佔位符 */
  placeholder?: string
}

const ICON_MAP = {
  '': Filter,
  MANUAL_UPLOAD: Upload,
  SHAREPOINT: FileSpreadsheet,
  OUTLOOK: Mail,
  API: Globe,
}

// ============================================================
// Component
// ============================================================

/**
 * @component SourceTypeFilter
 * @description 來源類型篩選下拉選單
 */
export function SourceTypeFilter({
  value,
  onChange,
  disabled = false,
  placeholder = '篩選來源',
}: SourceTypeFilterProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {SOURCE_TYPE_OPTIONS.map((option) => {
          const Icon = ICON_MAP[option.value as keyof typeof ICON_MAP] || Filter
          return (
            <SelectItem key={option.value} value={option.value || '_all'}>
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span>{option.label}</span>
              </div>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
