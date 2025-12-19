'use client'

/**
 * @fileoverview 規則預覽面板組件
 * @description
 *   Story 5-3: 編輯 Forwarder 映射規則
 *   提供規則在文件上的預覽功能：
 *   - 選擇測試文件或輸入測試內容
 *   - 執行規則提取預覽
 *   - 顯示匹配結果和調試資訊
 *
 * @module src/components/features/rules/RulePreviewPanel
 * @since Epic 5 - Story 5.3 (編輯 Forwarder 映射規則)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/hooks/useRulePreview - 規則預覽 Hook
 */

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { useRulePreview, RulePreviewResult } from '@/hooks/useRulePreview'
import {
  Play,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Info,
  Loader2,
  FileText,
} from 'lucide-react'

// ============================================================
// Types
// ============================================================

interface RulePreviewPanelProps {
  /** 規則 ID */
  ruleId: string
  /** 規則欄位名稱 */
  fieldName: string
  /** 規則欄位標籤 */
  fieldLabel: string
}

// ============================================================
// Sample Content
// ============================================================

const SAMPLE_INVOICE_CONTENT = `
FREIGHT INVOICE

Invoice No: INV-2024-123456
Date: 2024-12-15

Bill To:
ABC Trading Company
123 Main Street
Hong Kong

Shipper: XYZ Logistics Ltd
Consignee: DEF Import Export Co.

Container: MSCU1234567
B/L No: MAEU123456789
Vessel: EVER GIVEN
Voyage: 2024E

Origin: Shanghai, China
Destination: Los Angeles, USA

Description of Goods: Electronic Components
Weight: 15,000 KGS
Volume: 25 CBM

Charges:
Ocean Freight: USD 2,500.00
BAF: USD 150.00
THC: USD 200.00
Documentation Fee: USD 50.00

Total Amount: USD 2,900.00
Currency: USD

Payment Terms: Net 30 Days
`.trim()

// ============================================================
// Helper Components
// ============================================================

/**
 * 預覽結果顯示組件
 */
function PreviewResultDisplay({ result }: { result: RulePreviewResult }) {
  const [showDebug, setShowDebug] = React.useState(false)

  return (
    <div className="space-y-4">
      {/* 匹配狀態 */}
      <div className="flex items-center gap-4 flex-wrap">
        {result.matched ? (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            匹配成功
          </Badge>
        ) : (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            未匹配
          </Badge>
        )}
        <Badge variant="outline">
          信心度: {(result.confidence * 100).toFixed(0)}%
        </Badge>
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          {result.processingTime}ms
        </Badge>
      </div>

      {/* 提取值 */}
      {result.matched && result.extractedValue && (
        <div className="rounded-md border p-4 bg-muted/50">
          <Label className="text-sm text-muted-foreground">提取的值</Label>
          <p className="mt-1 font-mono text-lg break-all">{result.extractedValue}</p>
        </div>
      )}

      {/* 規則資訊 */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FileText className="h-4 w-4" />
        <span>
          規則: {result.rule.fieldLabel} ({result.rule.fieldName})
        </span>
      </div>

      {/* 預覽配置 */}
      {(result.previewConfig.usedCustomPattern ||
        result.previewConfig.usedCustomType) && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            {result.previewConfig.usedCustomPattern && '使用了自定義 Pattern。'}
            {result.previewConfig.usedCustomType && '使用了自定義提取類型。'}
          </AlertDescription>
        </Alert>
      )}

      {/* 調試資訊 */}
      {result.debugInfo && (
        <Collapsible open={showDebug} onOpenChange={setShowDebug}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              {showDebug ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              調試資訊
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="rounded border p-3 bg-muted/30 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">模式匹配:</span>
                <span>{result.debugInfo.patternMatched ? '是' : '否'}</span>
              </div>
              {result.debugInfo.matchDetails && (
                <div>
                  <span className="text-muted-foreground">匹配詳情:</span>
                  <p className="mt-1 text-xs">{result.debugInfo.matchDetails}</p>
                </div>
              )}
              {result.debugInfo.errorMessage && (
                <div>
                  <Label className="text-xs text-destructive">錯誤訊息:</Label>
                  <p className="text-xs text-destructive mt-1">
                    {result.debugInfo.errorMessage}
                  </p>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}

// ============================================================
// Component
// ============================================================

/**
 * 規則預覽面板
 *
 * @description
 *   提供規則預覽的獨立面板，可用於規則詳情頁或側邊欄
 *
 * @example
 * ```tsx
 * <RulePreviewPanel
 *   ruleId="rule123"
 *   fieldName="invoice_number"
 *   fieldLabel="發票號碼"
 * />
 * ```
 */
export function RulePreviewPanel({
  ruleId,
  fieldName,
  fieldLabel,
}: RulePreviewPanelProps) {
  const [testContent, setTestContent] = React.useState('')

  // --- Hooks ---
  const {
    mutate: previewRule,
    isPending,
    data: previewResult,
    error,
    reset,
  } = useRulePreview()

  // --- Handlers ---
  const handlePreview = () => {
    if (!testContent.trim()) return

    previewRule({
      ruleId,
      documentContent: testContent,
    })
  }

  const handleUseSample = () => {
    setTestContent(SAMPLE_INVOICE_CONTENT)
    reset()
  }

  const handleClear = () => {
    setTestContent('')
    reset()
  }

  // --- Render ---
  return (
    <div className="space-y-4">
      {/* 標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">規則預覽</h3>
          <p className="text-sm text-muted-foreground">
            測試 {fieldLabel} ({fieldName}) 規則的提取效果
          </p>
        </div>
      </div>

      {/* 測試內容輸入 */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label>測試文本</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUseSample}
            >
              使用範例
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
            >
              清除
            </Button>
          </div>
        </div>
        <Textarea
          placeholder="貼上發票文本內容進行測試..."
          className="min-h-[200px] font-mono text-sm"
          value={testContent}
          onChange={(e) => {
            setTestContent(e.target.value)
            reset()
          }}
        />
      </div>

      {/* 預覽按鈕 */}
      <Button
        type="button"
        onClick={handlePreview}
        disabled={isPending || !testContent.trim()}
        className="w-full"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            預覽中...
          </>
        ) : (
          <>
            <Play className="h-4 w-4 mr-2" />
            執行預覽
          </>
        )}
      </Button>

      {/* 錯誤顯示 */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {/* 預覽結果 */}
      {previewResult && (
        <>
          <Separator />
          <div>
            <Label className="text-sm font-medium mb-2 block">預覽結果</Label>
            <PreviewResultDisplay result={previewResult} />
          </div>
        </>
      )}
    </div>
  )
}
