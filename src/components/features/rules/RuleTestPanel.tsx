'use client'

/**
 * @fileoverview 規則測試面板組件
 * @description
 *   Story 4-2: 建議新映射規則 - 測試面板
 *   提供即時測試提取規則的功能：
 *   - 輸入測試文本或選擇已處理文件
 *   - 執行提取測試
 *   - 顯示匹配結果和調試資訊
 *   - 高亮顯示匹配位置
 *
 * @module src/components/features/rules/RuleTestPanel
 * @since Epic 4 - Story 4.2 (建議新映射規則)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/hooks/useTestRule - 規則測試 Hook
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
import { useTestRule, TestResultData } from '@/hooks/useTestRule'
import {
  Play,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Target,
  Info,
  Loader2,
} from 'lucide-react'

// ============================================================
// Types
// ============================================================

interface RuleTestPanelProps {
  /** 提取類型 */
  extractionType: string
  /** 提取模式 */
  pattern: string
}

// ============================================================
// Sample Test Content
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
// Components
// ============================================================

/**
 * 測試結果顯示組件
 */
function TestResultDisplay({ result }: { result: TestResultData }) {
  const [showDebug, setShowDebug] = React.useState(false)

  return (
    <div className="space-y-4">
      {/* 匹配狀態 */}
      <div className="flex items-center gap-4">
        {result.matched ? (
          <>
            <Badge variant="default" className="bg-green-600">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              匹配成功
            </Badge>
            <Badge variant="outline">
              信心度: {(result.confidence * 100).toFixed(0)}%
            </Badge>
          </>
        ) : (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            未匹配
          </Badge>
        )}
      </div>

      {/* 提取值 */}
      {result.matched && result.extractedValue && (
        <div className="rounded-md border p-4 bg-muted/50">
          <Label className="text-sm text-muted-foreground">提取的值</Label>
          <p className="mt-1 font-mono text-lg">{result.extractedValue}</p>
        </div>
      )}

      {/* 匹配位置 */}
      {result.matchPositions && result.matchPositions.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">
            匹配位置 ({result.matchPositions.length} 處)
          </Label>
          <div className="space-y-2">
            {result.matchPositions.slice(0, 3).map((pos, idx) => (
              <div
                key={idx}
                className="rounded border p-2 text-sm font-mono bg-background"
              >
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Target className="h-3 w-3" />
                  <span>
                    行 {pos.line}, 列 {pos.column} (字元 {pos.start}-{pos.end})
                  </span>
                </div>
                {pos.context && (
                  <div className="mt-1 text-xs bg-muted p-1 rounded overflow-hidden">
                    ...{pos.context}...
                  </div>
                )}
              </div>
            ))}
            {result.matchPositions.length > 3 && (
              <p className="text-sm text-muted-foreground">
                還有 {result.matchPositions.length - 3} 處匹配...
              </p>
            )}
          </div>
        </div>
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
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span>處理時間: {result.debugInfo.processingTime.toFixed(2)} ms</span>
              </div>
              <div className="flex items-center gap-2">
                <Target className="h-3 w-3 text-muted-foreground" />
                <span>嘗試次數: {result.debugInfo.matchAttempts}</span>
              </div>
              {result.debugInfo.errors && result.debugInfo.errors.length > 0 && (
                <div className="mt-2">
                  <Label className="text-xs text-destructive">錯誤訊息:</Label>
                  {result.debugInfo.errors.map((err, idx) => (
                    <p key={idx} className="text-xs text-destructive mt-1">
                      {err}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}

/**
 * 規則測試面板
 *
 * @description
 *   提供測試提取規則的界面，支持輸入測試文本或使用範例內容
 */
export function RuleTestPanel({ extractionType, pattern }: RuleTestPanelProps) {
  const [testContent, setTestContent] = React.useState('')
  const { mutate: testRule, isPending, data: testResult, reset } = useTestRule()

  // --- Handlers ---
  const handleTest = () => {
    if (!pattern || !testContent) {
      return
    }

    testRule({
      extractionType: extractionType as 'REGEX' | 'POSITION' | 'KEYWORD' | 'AI_PROMPT' | 'TEMPLATE',
      pattern,
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

  // 當 pattern 改變時重置結果
  React.useEffect(() => {
    reset()
  }, [pattern, extractionType, reset])

  // --- Render ---
  return (
    <div className="space-y-4">
      {/* 測試提示 */}
      {(!pattern || pattern.trim() === '') && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            請先在上方配置提取模式，然後再進行測試
          </AlertDescription>
        </Alert>
      )}

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

      {/* 測試按鈕 */}
      <Button
        type="button"
        onClick={handleTest}
        disabled={isPending || !pattern || !testContent}
        className="w-full"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            測試中...
          </>
        ) : (
          <>
            <Play className="h-4 w-4 mr-2" />
            執行測試
          </>
        )}
      </Button>

      {/* 測試結果 */}
      {testResult && (
        <>
          <Separator />
          <div>
            <Label className="text-sm font-medium mb-2 block">測試結果</Label>
            <TestResultDisplay result={testResult} />
          </div>
        </>
      )}
    </div>
  )
}
