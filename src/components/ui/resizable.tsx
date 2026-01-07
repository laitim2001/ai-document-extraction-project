"use client"

/**
 * @fileoverview Resizable Panel 組件
 * @description
 *   基於 react-resizable-panels v2.x 的可調整大小面板組件。
 *   v2.x API:
 *   - PanelGroup (容器組件)
 *   - Panel (面板組件)
 *   - PanelResizeHandle (調整大小把手)
 *   - direction 屬性 (horizontal/vertical)
 *   - 尺寸值為 0-100 的數字，代表百分比
 *
 * @module src/components/ui/resizable
 * @since Epic 13 - Story 13.6
 * @lastModified 2026-01-03
 */

import { GripVertical } from "lucide-react"
import * as ResizablePrimitive from "react-resizable-panels"
import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

/**
 * ResizablePanelGroup - 可調整大小面板群組容器
 * 使用 direction 屬性指定排列方向
 */
const ResizablePanelGroup = ({
  className,
  ...props
}: ComponentProps<typeof ResizablePrimitive.PanelGroup>) => (
  <ResizablePrimitive.PanelGroup
    className={cn(
      "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
      className
    )}
    {...props}
  />
)

const ResizablePanel = ResizablePrimitive.Panel

/**
 * ResizableHandle - 可拖曳的分隔線組件
 * v2.x 使用 data-panel-group-direction 屬性
 */
const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean
}) => (
  <ResizablePrimitive.PanelResizeHandle
    className={cn(
      "relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90",
      className
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
        <GripVertical className="h-2.5 w-2.5" />
      </div>
    )}
  </ResizablePrimitive.PanelResizeHandle>
)

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
