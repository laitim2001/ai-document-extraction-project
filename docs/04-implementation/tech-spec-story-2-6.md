# Story 2-6: Processing Path Auto Routing - Technical Specification

**Version:** 1.0
**Created:** 2025-12-16
**Status:** Ready for Development
**Story Key:** 2-6-processing-path-auto-routing

---

## Overview

| Field | Value |
|-------|-------|
| Story ID | 2.6 |
| Epic | Epic 2: Manual Invoice Upload & AI Processing |
| Estimated Effort | Medium |
| Dependencies | Story 2.5 (Confidence scoring) |
| Blocking | Story 2.7 |
| FR Coverage | FR8 |

---

## Objective

Implement automatic routing of documents to different processing paths based on confidence scores. High-confidence documents (≥95%) are auto-approved, medium-confidence (80-94%) require quick review, and low-confidence (<80%) require full review.

---

## Acceptance Criteria Mapping

| AC | Description | Technical Implementation |
|----|-------------|-------------------------|
| AC1 | Auto-approve path (≥95%) | Complete without human review |
| AC2 | Quick review path (80-94%) | Review low-confidence fields only |
| AC3 | Full review path (<80%) | Review all fields |
| AC4 | Routing decision logging | Record decision and reason |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Processing Path Routing                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│                     ┌──────────────────────┐                            │
│                     │  Confidence Score    │                            │
│                     │     (0-100%)         │                            │
│                     └──────────────────────┘                            │
│                              │                                           │
│         ┌────────────────────┼────────────────────┐                     │
│         ▼                    ▼                    ▼                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐             │
│  │ AUTO_APPROVE │    │ QUICK_REVIEW │    │ FULL_REVIEW  │             │
│  │   ≥ 95%      │    │   80-94%     │    │    < 80%     │             │
│  └──────────────┘    └──────────────┘    └──────────────┘             │
│         │                    │                    │                     │
│         ▼                    ▼                    ▼                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐             │
│  │  COMPLETED   │    │   Review     │    │   Review     │             │
│  │  (No Review) │    │   Low-Conf   │    │  All Fields  │             │
│  └──────────────┘    │   Fields     │    │              │             │
│                      └──────────────┘    └──────────────┘             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Guide

### Phase 1: Database Schema (15 min)

#### Step 1.1: Add ProcessingQueue Model

Update `prisma/schema.prisma`:

```prisma
// ===========================================
// Processing Queue Model
// ===========================================

model ProcessingQueue {
  id              String         @id @default(uuid())
  documentId      String         @unique @map("document_id")

  // Routing Info
  processingPath  ProcessingPath @map("processing_path")
  priority        Int            @default(0)  // Higher = more urgent
  routingReason   String?        @map("routing_reason")

  // Assignment
  assignedTo      String?        @map("assigned_to")
  assignedAt      DateTime?      @map("assigned_at")

  // Status
  status          QueueStatus    @default(PENDING)
  enteredAt       DateTime       @default(now()) @map("entered_at")
  startedAt       DateTime?      @map("started_at")
  completedAt     DateTime?      @map("completed_at")

  // Review Summary
  fieldsReviewed  Int?           @map("fields_reviewed")
  fieldsModified  Int?           @map("fields_modified")
  reviewNotes     String?        @map("review_notes")

  // Timestamps
  createdAt       DateTime       @default(now()) @map("created_at")
  updatedAt       DateTime       @updatedAt @map("updated_at")

  // Relations
  document        Document       @relation(fields: [documentId], references: [id], onDelete: Cascade)
  assignee        User?          @relation(fields: [assignedTo], references: [id])

  @@index([processingPath, status])
  @@index([assignedTo, status])
  @@index([priority, enteredAt])
  @@map("processing_queues")
}

enum QueueStatus {
  PENDING       // Waiting in queue
  IN_PROGRESS   // Currently being reviewed
  COMPLETED     // Review completed
  SKIPPED       // Skipped (e.g., reassigned)
  CANCELLED     // Cancelled
}

// Update ProcessingPath enum if not exists
enum ProcessingPath {
  AUTO_APPROVE     // >= 95% confidence
  QUICK_REVIEW     // 80-94% confidence
  FULL_REVIEW      // < 80% confidence
  MANUAL_REQUIRED  // Special cases
}
```

#### Step 1.2: Update Document Model

Add routing fields to Document:

```prisma
model Document {
  // ... existing fields ...

  // Routing
  processingPath  ProcessingPath? @map("processing_path")
  routingDecision Json?           @map("routing_decision")
  // routingDecision: {
  //   path: string
  //   reason: string
  //   confidence: number
  //   lowConfidenceFields: string[]
  //   decidedAt: string
  // }

  // Relations
  processingQueue ProcessingQueue?

  // ... existing relations ...
}
```

#### Step 1.3: Run Migration

```bash
npx prisma migrate dev --name add_processing_queue
npx prisma generate
```

---

### Phase 2: Routing Types & Configuration (10 min)

#### Step 2.1: Create Routing Types

Create `src/types/routing.ts`:

```typescript
/**
 * Routing type definitions
 */

export type ProcessingPath =
  | 'AUTO_APPROVE'
  | 'QUICK_REVIEW'
  | 'FULL_REVIEW'
  | 'MANUAL_REQUIRED'

export type QueueStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'SKIPPED'
  | 'CANCELLED'

export interface RoutingDecision {
  path: ProcessingPath
  reason: string
  confidence: number
  lowConfidenceFields: string[]
  criticalFieldsAffected: string[]
  decidedAt: Date
  decidedBy: 'SYSTEM' | string  // SYSTEM or user ID
}

export interface ProcessingQueueItem {
  id: string
  documentId: string
  processingPath: ProcessingPath
  priority: number
  status: QueueStatus
  assignedTo: string | null
  enteredAt: Date
  document: {
    fileName: string
    status: string
    overallConfidence: number | null
  }
}

export interface RoutingConfig {
  autoApproveThreshold: number
  quickReviewThreshold: number
  criticalFields: string[]
  priorityBoostForOlder: boolean
  maxQueueAge: number  // hours
}
```

#### Step 2.2: Create Routing Configuration

Create `src/lib/routing/config.ts`:

```typescript
/**
 * Routing configuration
 */

import type { RoutingConfig, ProcessingPath } from '@/types/routing'

/**
 * Default routing thresholds
 */
export const ROUTING_CONFIG: RoutingConfig = {
  autoApproveThreshold: 95,
  quickReviewThreshold: 80,
  criticalFields: [
    'invoiceNumber',
    'invoiceDate',
    'totalAmount',
    'currency',
    'shipperName',
    'consigneeName'
  ],
  priorityBoostForOlder: true,
  maxQueueAge: 48  // 48 hours
}

/**
 * Processing path configuration
 */
export const PROCESSING_PATH_CONFIG: Record<ProcessingPath, {
  label: string
  labelZh: string
  description: string
  color: string
  reviewRequired: boolean
  reviewScope: 'none' | 'low_confidence' | 'all'
}> = {
  AUTO_APPROVE: {
    label: 'Auto Approve',
    labelZh: '自動通過',
    description: 'High confidence, no review needed',
    color: '#22c55e',  // green
    reviewRequired: false,
    reviewScope: 'none'
  },
  QUICK_REVIEW: {
    label: 'Quick Review',
    labelZh: '快速確認',
    description: 'Review low-confidence fields only',
    color: '#eab308',  // yellow
    reviewRequired: true,
    reviewScope: 'low_confidence'
  },
  FULL_REVIEW: {
    label: 'Full Review',
    labelZh: '完整審核',
    description: 'Review all extracted fields',
    color: '#ef4444',  // red
    reviewRequired: true,
    reviewScope: 'all'
  },
  MANUAL_REQUIRED: {
    label: 'Manual Required',
    labelZh: '需人工處理',
    description: 'Special case requiring manual handling',
    color: '#8b5cf6',  // purple
    reviewRequired: true,
    reviewScope: 'all'
  }
}

/**
 * Queue priority configuration
 */
export const QUEUE_PRIORITY = {
  URGENT: 100,
  HIGH: 75,
  NORMAL: 50,
  LOW: 25
}
```

---

### Phase 3: Routing Logic Module (20 min)

#### Step 3.1: Create Router Module

Create `src/lib/routing/router.ts`:

```typescript
/**
 * Document routing logic
 * Determines processing path based on confidence scores
 */

import type {
  ProcessingPath,
  RoutingDecision
} from '@/types/routing'
import type { DocumentConfidenceResult } from '@/types/confidence'
import { ROUTING_CONFIG, QUEUE_PRIORITY } from './config'

/**
 * Determine processing path based on confidence result
 */
export function determineProcessingPath(
  confidenceResult: DocumentConfidenceResult
): RoutingDecision {
  const { overallScore, fieldScores, stats } = confidenceResult
  const config = ROUTING_CONFIG

  // Get low confidence fields
  const lowConfidenceFields = Object.entries(fieldScores)
    .filter(([_, result]) => result.score < config.quickReviewThreshold)
    .map(([fieldName]) => fieldName)

  // Check critical fields
  const criticalFieldsAffected = config.criticalFields.filter(
    field => fieldScores[field]?.score < config.quickReviewThreshold
  )

  // Determine path
  let path: ProcessingPath
  let reason: string

  // Check for special conditions first
  if (criticalFieldsAffected.length >= 3) {
    // Too many critical fields affected
    path = 'MANUAL_REQUIRED'
    reason = `${criticalFieldsAffected.length} 個關鍵欄位信心度低於 ${config.quickReviewThreshold}%，需人工處理`
  } else if (overallScore >= config.autoApproveThreshold) {
    // High confidence - auto approve
    path = 'AUTO_APPROVE'
    reason = `整體信心度 ${overallScore.toFixed(1)}% >= ${config.autoApproveThreshold}%，自動通過`
  } else if (overallScore >= config.quickReviewThreshold) {
    // Medium confidence - quick review
    path = 'QUICK_REVIEW'
    reason = `整體信心度 ${overallScore.toFixed(1)}%，需確認 ${lowConfidenceFields.length} 個低信心度欄位`
  } else {
    // Low confidence - full review
    path = 'FULL_REVIEW'
    reason = `整體信心度 ${overallScore.toFixed(1)}% < ${config.quickReviewThreshold}%，需完整審核`
  }

  return {
    path,
    reason,
    confidence: overallScore,
    lowConfidenceFields,
    criticalFieldsAffected,
    decidedAt: new Date(),
    decidedBy: 'SYSTEM'
  }
}

/**
 * Calculate queue priority
 */
export function calculateQueuePriority(
  decision: RoutingDecision,
  documentAge: number  // hours since upload
): number {
  let priority = QUEUE_PRIORITY.NORMAL

  // Higher priority for full review (needs more attention)
  if (decision.path === 'FULL_REVIEW') {
    priority = QUEUE_PRIORITY.HIGH
  } else if (decision.path === 'MANUAL_REQUIRED') {
    priority = QUEUE_PRIORITY.URGENT
  }

  // Boost priority for older documents
  if (ROUTING_CONFIG.priorityBoostForOlder && documentAge > 24) {
    priority += Math.min(25, Math.floor(documentAge / 24) * 5)
  }

  // Boost for critical fields affected
  priority += decision.criticalFieldsAffected.length * 5

  return Math.min(100, priority)
}

/**
 * Check if document should be auto-approved
 */
export function shouldAutoApprove(
  confidenceResult: DocumentConfidenceResult
): boolean {
  const decision = determineProcessingPath(confidenceResult)
  return decision.path === 'AUTO_APPROVE'
}

/**
 * Get fields requiring review based on path
 */
export function getFieldsForReview(
  decision: RoutingDecision,
  allFields: string[]
): string[] {
  switch (decision.path) {
    case 'AUTO_APPROVE':
      return []
    case 'QUICK_REVIEW':
      return decision.lowConfidenceFields
    case 'FULL_REVIEW':
    case 'MANUAL_REQUIRED':
      return allFields
    default:
      return allFields
  }
}
```

---

### Phase 4: Routing Service (25 min)

#### Step 4.1: Create Routing Service

Create `src/services/routing.service.ts`:

```typescript
/**
 * Routing Service
 * Handles document routing and queue management
 */

import { prisma } from '@/lib/prisma'
import { DocumentStatus, ProcessingPath, QueueStatus } from '@prisma/client'
import type { RoutingDecision } from '@/types/routing'
import type { DocumentConfidenceResult } from '@/types/confidence'
import {
  determineProcessingPath,
  calculateQueuePriority
} from '@/lib/routing/router'
import { calculateAndSaveConfidence } from './confidence.service'

/**
 * Route a document based on its confidence scores
 */
export async function routeDocument(
  documentId: string
): Promise<RoutingDecision> {
  // Get document with extraction result
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      extractions: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  })

  if (!document) {
    throw new Error(`Document not found: ${documentId}`)
  }

  // Calculate confidence if not already done
  let confidenceResult: DocumentConfidenceResult

  const extraction = document.extractions[0]
  if (extraction?.confidenceScores) {
    confidenceResult = extraction.confidenceScores as DocumentConfidenceResult
  } else {
    confidenceResult = await calculateAndSaveConfidence(documentId)
  }

  // Determine routing
  const decision = determineProcessingPath(confidenceResult)

  // Calculate document age in hours
  const documentAge = (Date.now() - document.createdAt.getTime()) / (1000 * 60 * 60)

  // Calculate priority
  const priority = calculateQueuePriority(decision, documentAge)

  // Update document and create queue entry in transaction
  await prisma.$transaction(async (tx) => {
    // Update document
    await tx.document.update({
      where: { id: documentId },
      data: {
        processingPath: decision.path as ProcessingPath,
        routingDecision: decision,
        status: decision.path === 'AUTO_APPROVE'
          ? DocumentStatus.COMPLETED
          : DocumentStatus.PENDING_REVIEW
      }
    })

    // If auto-approve, mark extraction as approved
    if (decision.path === 'AUTO_APPROVE' && extraction) {
      await tx.extractionResult.update({
        where: { id: extraction.id },
        data: { status: 'COMPLETED' }
      })
    } else {
      // Create queue entry for review paths
      await tx.processingQueue.upsert({
        where: { documentId },
        create: {
          documentId,
          processingPath: decision.path as ProcessingPath,
          priority,
          routingReason: decision.reason,
          status: QueueStatus.PENDING
        },
        update: {
          processingPath: decision.path as ProcessingPath,
          priority,
          routingReason: decision.reason,
          status: QueueStatus.PENDING
        }
      })
    }

    // Log audit
    await tx.auditLog.create({
      data: {
        entityType: 'DOCUMENT',
        entityId: documentId,
        action: 'ROUTED',
        performedBy: 'SYSTEM',
        details: {
          path: decision.path,
          reason: decision.reason,
          confidence: decision.confidence,
          priority
        }
      }
    })
  })

  return decision
}

/**
 * Handle auto-approval completion
 */
export async function handleAutoApprove(documentId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Update document to completed
    await tx.document.update({
      where: { id: documentId },
      data: { status: DocumentStatus.COMPLETED }
    })

    // Get and finalize extraction result
    const extraction = await tx.extractionResult.findFirst({
      where: { documentId },
      orderBy: { createdAt: 'desc' }
    })

    if (extraction) {
      await tx.extractionResult.update({
        where: { id: extraction.id },
        data: { status: 'COMPLETED' }
      })
    }

    // Log audit
    await tx.auditLog.create({
      data: {
        entityType: 'DOCUMENT',
        entityId: documentId,
        action: 'AUTO_APPROVED',
        performedBy: 'SYSTEM',
        details: {
          timestamp: new Date().toISOString()
        }
      }
    })
  })
}

/**
 * Get queue for a processing path
 */
export async function getProcessingQueue(
  path?: ProcessingPath,
  status: QueueStatus = 'PENDING',
  limit: number = 50
) {
  return prisma.processingQueue.findMany({
    where: {
      ...(path && { processingPath: path }),
      status
    },
    include: {
      document: {
        select: {
          id: true,
          fileName: true,
          status: true,
          createdAt: true,
          extractions: {
            select: {
              averageConfidence: true
            },
            take: 1,
            orderBy: { createdAt: 'desc' }
          }
        }
      },
      assignee: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: [
      { priority: 'desc' },
      { enteredAt: 'asc' }
    ],
    take: limit
  })
}

/**
 * Assign queue item to reviewer
 */
export async function assignToReviewer(
  queueId: string,
  reviewerId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const queue = await tx.processingQueue.findUnique({
      where: { id: queueId }
    })

    if (!queue) {
      throw new Error('Queue item not found')
    }

    if (queue.status !== 'PENDING') {
      throw new Error('Queue item is not pending')
    }

    await tx.processingQueue.update({
      where: { id: queueId },
      data: {
        assignedTo: reviewerId,
        assignedAt: new Date(),
        status: QueueStatus.IN_PROGRESS,
        startedAt: new Date()
      }
    })

    await tx.document.update({
      where: { id: queue.documentId },
      data: { status: DocumentStatus.IN_REVIEW }
    })
  })
}

/**
 * Complete queue item review
 */
export async function completeReview(
  queueId: string,
  reviewSummary: {
    fieldsReviewed: number
    fieldsModified: number
    notes?: string
  }
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const queue = await tx.processingQueue.findUnique({
      where: { id: queueId }
    })

    if (!queue) {
      throw new Error('Queue item not found')
    }

    await tx.processingQueue.update({
      where: { id: queueId },
      data: {
        status: QueueStatus.COMPLETED,
        completedAt: new Date(),
        fieldsReviewed: reviewSummary.fieldsReviewed,
        fieldsModified: reviewSummary.fieldsModified,
        reviewNotes: reviewSummary.notes
      }
    })

    await tx.document.update({
      where: { id: queue.documentId },
      data: { status: DocumentStatus.COMPLETED }
    })

    await tx.auditLog.create({
      data: {
        entityType: 'DOCUMENT',
        entityId: queue.documentId,
        action: 'REVIEW_COMPLETED',
        performedBy: queue.assignedTo || 'UNKNOWN',
        details: reviewSummary
      }
    })
  })
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  byPath: Record<ProcessingPath, number>
  byStatus: Record<QueueStatus, number>
  averageWaitTime: number
}> {
  const queues = await prisma.processingQueue.groupBy({
    by: ['processingPath', 'status'],
    _count: true
  })

  const byPath: Record<string, number> = {}
  const byStatus: Record<string, number> = {}

  for (const item of queues) {
    byPath[item.processingPath] = (byPath[item.processingPath] || 0) + item._count
    byStatus[item.status] = (byStatus[item.status] || 0) + item._count
  }

  // Calculate average wait time for pending items
  const pendingItems = await prisma.processingQueue.findMany({
    where: { status: 'PENDING' },
    select: { enteredAt: true }
  })

  const now = Date.now()
  const totalWaitTime = pendingItems.reduce((sum, item) => {
    return sum + (now - item.enteredAt.getTime())
  }, 0)

  const averageWaitTime = pendingItems.length > 0
    ? totalWaitTime / pendingItems.length / (1000 * 60)  // minutes
    : 0

  return {
    byPath: byPath as Record<ProcessingPath, number>,
    byStatus: byStatus as Record<QueueStatus, number>,
    averageWaitTime: Math.round(averageWaitTime)
  }
}
```

---

### Phase 5: Routing API Endpoints (15 min)

#### Step 5.1: Route Document API

Create `src/app/api/routing/route.ts`:

```typescript
/**
 * POST /api/routing
 * Route a document to processing path
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { routeDocument } from '@/services/routing.service'
import { z } from 'zod'

const requestSchema = z.object({
  documentId: z.string().uuid()
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validation = requestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const decision = await routeDocument(validation.data.documentId)

    return NextResponse.json({
      success: true,
      data: decision
    })

  } catch (error) {
    console.error('Routing error:', error)

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

#### Step 5.2: Processing Queue API

Create `src/app/api/routing/queue/route.ts`:

```typescript
/**
 * GET /api/routing/queue
 * Get processing queue
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getProcessingQueue, getQueueStats } from '@/services/routing.service'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const path = searchParams.get('path') as any
    const status = searchParams.get('status') as any
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const [queue, stats] = await Promise.all([
      getProcessingQueue(path, status || 'PENDING', limit),
      getQueueStats()
    ])

    return NextResponse.json({
      success: true,
      data: queue,
      stats,
      count: queue.length
    })

  } catch (error) {
    console.error('Get queue error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

#### Step 5.3: Queue Assignment API

Create `src/app/api/routing/queue/[id]/assign/route.ts`:

```typescript
/**
 * POST /api/routing/queue/[id]/assign
 * Assign queue item to reviewer
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { assignToReviewer } from '@/services/routing.service'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const reviewerId = body.reviewerId || session.user.id

    await assignToReviewer(id, reviewerId)

    return NextResponse.json({
      success: true,
      message: 'Assigned successfully'
    })

  } catch (error) {
    console.error('Assignment error:', error)

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
      if (error.message.includes('not pending')) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

---

## Testing Guide

### Unit Tests

```typescript
import { describe, it, expect } from 'vitest'
import { determineProcessingPath } from '../router'

describe('determineProcessingPath', () => {
  it('should return AUTO_APPROVE for >= 95% confidence', () => {
    const result = determineProcessingPath({
      overallScore: 96,
      level: 'high',
      color: '#22c55e',
      fieldScores: {},
      stats: {
        totalFields: 10,
        highConfidence: 10,
        mediumConfidence: 0,
        lowConfidence: 0,
        averageScore: 96,
        minScore: 92,
        maxScore: 100
      },
      recommendation: 'auto_approve'
    })

    expect(result.path).toBe('AUTO_APPROVE')
  })

  it('should return QUICK_REVIEW for 80-94% confidence', () => {
    const result = determineProcessingPath({
      overallScore: 85,
      level: 'medium',
      color: '#eab308',
      fieldScores: {},
      stats: {
        totalFields: 10,
        highConfidence: 5,
        mediumConfidence: 5,
        lowConfidence: 0,
        averageScore: 85,
        minScore: 75,
        maxScore: 95
      },
      recommendation: 'quick_review'
    })

    expect(result.path).toBe('QUICK_REVIEW')
  })

  it('should return FULL_REVIEW for < 80% confidence', () => {
    const result = determineProcessingPath({
      overallScore: 65,
      level: 'low',
      color: '#ef4444',
      fieldScores: {},
      stats: {
        totalFields: 10,
        highConfidence: 2,
        mediumConfidence: 3,
        lowConfidence: 5,
        averageScore: 65,
        minScore: 40,
        maxScore: 92
      },
      recommendation: 'full_review'
    })

    expect(result.path).toBe('FULL_REVIEW')
  })
})
```

---

## Verification Checklist

| Item | Expected Result | Status |
|------|-----------------|--------|
| Prisma migration runs | ProcessingQueue table created | [ ] |
| ≥95% confidence | Routes to AUTO_APPROVE | [ ] |
| 80-94% confidence | Routes to QUICK_REVIEW | [ ] |
| <80% confidence | Routes to FULL_REVIEW | [ ] |
| Auto-approve completes | Document status = COMPLETED | [ ] |
| Queue entry created | For QUICK/FULL_REVIEW paths | [ ] |
| Routing decision saved | JSON stored in document | [ ] |
| Priority calculated | Higher for FULL_REVIEW | [ ] |
| Audit log created | ROUTED action logged | [ ] |

---

## Processing Path Reference

| Path | Threshold | Review Scope | Priority |
|------|-----------|--------------|----------|
| AUTO_APPROVE | ≥95% | None | N/A |
| QUICK_REVIEW | 80-94% | Low-confidence fields | Normal |
| FULL_REVIEW | <80% | All fields | High |
| MANUAL_REQUIRED | Special | All fields | Urgent |

---

## Related Documentation

- [Story 2.6 User Story](./stories/2-6-processing-path-auto-routing.md)
- [Story 2.5 Tech Spec](./tech-spec-story-2-5.md) (Prerequisite)
- [Routing Configuration](../src/lib/routing/config.ts)

---

*Tech Spec Version: 1.0*
*Last Updated: 2025-12-16*
