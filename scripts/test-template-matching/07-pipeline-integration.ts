/**
 * @fileoverview Pipeline Integration Test (Exchange Rate, Reference Number, Auto-Complete)
 * @description
 *   Phase 4 of template matching integration tests.
 *
 *   Part 1 — Exchange Rate Conversion (pure logic):
 *     A: Basic conversion math (USD→TWD)
 *     B: Same currency → no conversion needed
 *     C: Zero amount → zero result
 *     D: Precision rounding (2 decimals)
 *     E: Multiple amounts with cached rate
 *     F: Config disabled → skip
 *
 *   Part 2 — Reference Number Matching (pure logic):
 *     G: Exact match in filename
 *     H: Substring match (filename contains ref number)
 *     I: Longest match priority
 *     J: No match → empty results
 *     K: Multiple matches → sorted by length desc
 *     L: Config disabled → skip
 *     M: Enabled + no match → abort signal
 *
 *   Part 3 — Auto-Complete Workflow (DB operations):
 *     N: All rows VALID → DRAFT→COMPLETED
 *     O: Some rows INVALID → stays DRAFT
 *     P: No rows → stays DRAFT
 *     Q: Status transition validation
 *
 *   Prerequisites: Run 02-prepare-test-data.ts first (for Part 3).
 *
 * @usage npx tsx scripts/test-template-matching/07-pipeline-integration.ts
 */

import { PrismaClient, Prisma } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const TEST_PREFIX = 'PIPELINE_INT_TEST_'

// ============================================================================
// Test Runner Infrastructure
// ============================================================================

let passCount = 0
let failCount = 0

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    passCount++
    console.log(`    [PASS] ${label}`)
  } else {
    failCount++
    console.log(`    [FAIL] ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

// ============================================================================
// Replicated Logic: Exchange Rate Conversion
// (from exchange-rate-converter.service.ts)
// ============================================================================

interface FxConversionItem {
  field: string
  originalAmount: number
  originalCurrency: string
  convertedAmount: number
  targetCurrency: string
  rate: number
  path: string
}

interface FxConversionConfig {
  enabled: boolean
  targetCurrency: string
  roundingPrecision: number
}

interface FxConversionResult {
  enabled: boolean
  conversions: FxConversionItem[]
  sourceCurrency: string
  targetCurrency: string
  warnings: string[]
}

function convertAmount(
  amount: number,
  rate: number,
  precision: number
): number {
  return Number((amount * rate).toFixed(precision))
}

function processExchangeRateConversion(
  config: FxConversionConfig,
  sourceCurrency: string,
  amounts: Array<{ field: string; amount: number; path: string }>,
  rateTable: Record<string, number>
): FxConversionResult {
  if (!config.enabled) {
    return {
      enabled: false,
      conversions: [],
      sourceCurrency,
      targetCurrency: config.targetCurrency,
      warnings: [],
    }
  }

  const warnings: string[] = []
  const conversions: FxConversionItem[] = []

  if (!config.targetCurrency) {
    warnings.push('Target currency not configured')
    return {
      enabled: true,
      conversions: [],
      sourceCurrency,
      targetCurrency: '',
      warnings,
    }
  }

  // Same currency → no conversion
  if (sourceCurrency === config.targetCurrency) {
    return {
      enabled: true,
      conversions: [],
      sourceCurrency,
      targetCurrency: config.targetCurrency,
      warnings: ['Source and target currency are the same, no conversion needed'],
    }
  }

  const rateKey = `${sourceCurrency}_${config.targetCurrency}`
  const rate = rateTable[rateKey]

  if (!rate) {
    warnings.push(`Exchange rate not found: ${rateKey}`)
    return {
      enabled: true,
      conversions: [],
      sourceCurrency,
      targetCurrency: config.targetCurrency,
      warnings,
    }
  }

  for (const item of amounts) {
    if (item.amount === 0 || item.amount === null || item.amount === undefined) {
      continue
    }
    conversions.push({
      field: item.field,
      originalAmount: item.amount,
      originalCurrency: sourceCurrency,
      convertedAmount: convertAmount(item.amount, rate, config.roundingPrecision),
      targetCurrency: config.targetCurrency,
      rate,
      path: item.path,
    })
  }

  return {
    enabled: true,
    conversions,
    sourceCurrency,
    targetCurrency: config.targetCurrency,
    warnings,
  }
}

// ============================================================================
// Replicated Logic: Reference Number Matching
// (from reference-number-matcher.service.ts)
// ============================================================================

interface ReferenceNumberRecord {
  id: string
  number: string
  type: string
}

interface RefMatchConfig {
  enabled: boolean
  types: string[]
  maxResults: number
}

interface RefMatchResult {
  enabled: boolean
  matches: Array<{
    candidate: string
    referenceNumberId: string
    referenceNumber: string
    type: string
    confidence: number
  }>
  shouldAbortPipeline: boolean
}

function matchReferenceNumbers(
  fileName: string,
  config: RefMatchConfig,
  referenceNumbers: ReferenceNumberRecord[]
): RefMatchResult {
  if (!config.enabled) {
    return {
      enabled: false,
      matches: [],
      shouldAbortPipeline: false,
    }
  }

  // Strip extension
  const nameWithoutExt = fileName.replace(/\.[^.]+$/, '')

  // Filter by type and substring match (case-insensitive)
  const matches = referenceNumbers
    .filter((ref) => config.types.includes(ref.type))
    .filter((ref) =>
      nameWithoutExt.toLowerCase().includes(ref.number.toLowerCase())
    )
    .sort((a, b) => b.number.length - a.number.length)
    .slice(0, config.maxResults)
    .map((ref) => ({
      candidate: nameWithoutExt,
      referenceNumberId: ref.id,
      referenceNumber: ref.number,
      type: ref.type,
      confidence: 100,
    }))

  return {
    enabled: true,
    matches,
    shouldAbortPipeline: config.enabled && matches.length === 0,
  }
}

// ============================================================================
// Replicated Logic: Auto-Complete / Validation
// (from auto-template-matching.service.ts:673-685)
// ============================================================================

interface DataTemplateField {
  name: string
  label: string
  dataType: 'string' | 'number' | 'date' | 'currency' | 'boolean' | 'array'
  isRequired: boolean
  validation?: {
    pattern?: string
    min?: number
    max?: number
    maxLength?: number
    minLength?: number
    allowedValues?: string[]
  }
  order: number
}

interface ValidationResult {
  isValid: boolean
  errors?: Record<string, string>
}

function validateRowData(
  fieldValues: Record<string, unknown>,
  templateFields: DataTemplateField[]
): ValidationResult {
  const errors: Record<string, string> = {}
  for (const field of templateFields) {
    const value = fieldValues[field.name]
    if (field.isRequired && (value === undefined || value === null || value === '')) {
      errors[field.name] = '此欄位為必填'
      continue
    }
    if (value !== undefined && value !== null && value !== '') {
      if (field.dataType === 'number' || field.dataType === 'currency') {
        if (typeof value !== 'number' && isNaN(Number(value))) {
          errors[field.name] = '值必須為數字'
        }
      }
    }
  }
  return {
    isValid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  }
}

const STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['PROCESSING', 'COMPLETED'],
  PROCESSING: ['COMPLETED', 'ERROR'],
  COMPLETED: ['EXPORTED'],
  EXPORTED: [],
  ERROR: ['PROCESSING'],
}

function canTransition(from: string, to: string): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

// ============================================================================
// Test Execution
// ============================================================================

async function main() {
  console.log('='.repeat(80))
  console.log('  PIPELINE INTEGRATION TEST')
  console.log('  Exchange Rate + Reference Number + Auto-Complete')
  console.log('  Started:', new Date().toISOString())
  console.log('='.repeat(80))

  // ═════════════════════════════════════════════════════════════════════════
  // PART 1: Exchange Rate Conversion (pure logic)
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n' + '─'.repeat(80))
  console.log('  PART 1: Exchange Rate Conversion')
  console.log('─'.repeat(80))

  const rateTable: Record<string, number> = {
    'USD_TWD': 31.5,
    'USD_CNY': 7.25,
    'EUR_USD': 1.08,
    'GBP_TWD': 39.8,
  }

  // --- A: Basic conversion ---
  console.log('\n  --- A: Basic conversion (USD→TWD) ---')
  const resultA = processExchangeRateConversion(
    { enabled: true, targetCurrency: 'TWD', roundingPrecision: 2 },
    'USD',
    [
      { field: 'totalAmount', amount: 1000, path: 'standardFields.totalAmount' },
      { field: 'subtotal', amount: 900, path: 'standardFields.subtotal' },
    ],
    rateTable
  )
  assert(resultA.enabled, 'A: conversion enabled')
  assert(resultA.conversions.length === 2, `A: 2 conversions (got: ${resultA.conversions.length})`)
  assert(
    resultA.conversions[0].convertedAmount === 31500,
    `A: 1000 USD × 31.5 = 31500 TWD (got: ${resultA.conversions[0]?.convertedAmount})`
  )
  assert(
    resultA.conversions[1].convertedAmount === 28350,
    `A: 900 USD × 31.5 = 28350 TWD (got: ${resultA.conversions[1]?.convertedAmount})`
  )
  assert(resultA.conversions[0].rate === 31.5, `A: rate = 31.5`)

  // --- B: Same currency → no conversion ---
  console.log('\n  --- B: Same currency (USD→USD) ---')
  const resultB = processExchangeRateConversion(
    { enabled: true, targetCurrency: 'USD', roundingPrecision: 2 },
    'USD',
    [{ field: 'totalAmount', amount: 1000, path: 'standardFields.totalAmount' }],
    rateTable
  )
  assert(resultB.conversions.length === 0, `B: 0 conversions (same currency)`)
  assert(
    resultB.warnings.some((w) => w.includes('same')),
    `B: Warning about same currency`
  )

  // --- C: Zero amount → skipped ---
  console.log('\n  --- C: Zero amount → skipped ---')
  const resultC = processExchangeRateConversion(
    { enabled: true, targetCurrency: 'TWD', roundingPrecision: 2 },
    'USD',
    [
      { field: 'totalAmount', amount: 0, path: 'standardFields.totalAmount' },
      { field: 'subtotal', amount: 500, path: 'standardFields.subtotal' },
    ],
    rateTable
  )
  assert(resultC.conversions.length === 1, `C: Only non-zero amount converted (got: ${resultC.conversions.length})`)
  assert(resultC.conversions[0].field === 'subtotal', `C: subtotal converted, totalAmount skipped`)

  // --- D: Precision rounding ---
  console.log('\n  --- D: Precision rounding ---')
  const resultD = processExchangeRateConversion(
    { enabled: true, targetCurrency: 'USD', roundingPrecision: 2 },
    'EUR',
    [{ field: 'totalAmount', amount: 99.99, path: 'standardFields.totalAmount' }],
    rateTable
  )
  assert(
    resultD.conversions[0].convertedAmount === 107.99,
    `D: 99.99 × 1.08 = 107.9892 → rounded to 107.99 (got: ${resultD.conversions[0]?.convertedAmount})`
  )

  // --- E: Multiple amounts same rate (cache simulation) ---
  console.log('\n  --- E: Multiple amounts with same rate ---')
  const amounts5 = Array.from({ length: 5 }, (_, i) => ({
    field: `lineItem_${i}`,
    amount: (i + 1) * 100,
    path: `lineItems[${i}].amount`,
  }))
  const resultE = processExchangeRateConversion(
    { enabled: true, targetCurrency: 'CNY', roundingPrecision: 2 },
    'USD',
    amounts5,
    rateTable
  )
  assert(resultE.conversions.length === 5, `E: All 5 line items converted`)
  assert(
    resultE.conversions[0].convertedAmount === 725,
    `E: 100 USD × 7.25 = 725 CNY (got: ${resultE.conversions[0]?.convertedAmount})`
  )
  assert(
    resultE.conversions[4].convertedAmount === 3625,
    `E: 500 USD × 7.25 = 3625 CNY (got: ${resultE.conversions[4]?.convertedAmount})`
  )

  // --- F: Config disabled ---
  console.log('\n  --- F: Config disabled → skip ---')
  const resultF = processExchangeRateConversion(
    { enabled: false, targetCurrency: 'TWD', roundingPrecision: 2 },
    'USD',
    [{ field: 'totalAmount', amount: 1000, path: 'standardFields.totalAmount' }],
    rateTable
  )
  assert(!resultF.enabled, 'F: conversion not enabled')
  assert(resultF.conversions.length === 0, `F: 0 conversions`)

  // ═════════════════════════════════════════════════════════════════════════
  // PART 2: Reference Number Matching (pure logic)
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n' + '─'.repeat(80))
  console.log('  PART 2: Reference Number Matching')
  console.log('─'.repeat(80))

  const refNumbers: ReferenceNumberRecord[] = [
    { id: 'ref-1', number: 'INV-2026-001', type: 'INVOICE' },
    { id: 'ref-2', number: 'SHIP-2026-001', type: 'SHIPMENT' },
    { id: 'ref-3', number: 'BL-HK-2026-001', type: 'BL' },
    { id: 'ref-4', number: 'INV', type: 'INVOICE' },
    { id: 'ref-5', number: 'PO-2026-100', type: 'PO' },
  ]

  // --- G: Exact match ---
  console.log('\n  --- G: Exact match in filename ---')
  const resultG = matchReferenceNumbers(
    'INV-2026-001.pdf',
    { enabled: true, types: ['INVOICE', 'SHIPMENT', 'BL'], maxResults: 10 },
    refNumbers
  )
  assert(resultG.enabled, 'G: matching enabled')
  assert(resultG.matches.length >= 1, `G: At least 1 match (got: ${resultG.matches.length})`)
  assert(
    resultG.matches[0].referenceNumber === 'INV-2026-001',
    `G: First match is INV-2026-001 (got: ${resultG.matches[0]?.referenceNumber})`
  )
  assert(!resultG.shouldAbortPipeline, 'G: Should not abort (has matches)')

  // --- H: Substring match ---
  console.log('\n  --- H: Substring match ---')
  const resultH = matchReferenceNumbers(
    'Invoice_INV-2026-001_DHL_Express.pdf',
    { enabled: true, types: ['INVOICE', 'SHIPMENT', 'BL'], maxResults: 10 },
    refNumbers
  )
  assert(resultH.matches.length >= 1, `H: Substring match found (got: ${resultH.matches.length})`)
  assert(
    resultH.matches[0].referenceNumber === 'INV-2026-001',
    `H: Longest match first: INV-2026-001 (got: ${resultH.matches[0]?.referenceNumber})`
  )

  // --- I: Longest match priority ---
  console.log('\n  --- I: Longest match priority ---')
  // "INV-2026-001" (12 chars) should come before "INV" (3 chars)
  const resultI = matchReferenceNumbers(
    'INV-2026-001-summary.pdf',
    { enabled: true, types: ['INVOICE'], maxResults: 10 },
    refNumbers
  )
  assert(resultI.matches.length === 2, `I: 2 INVOICE matches (got: ${resultI.matches.length})`)
  assert(
    resultI.matches[0].referenceNumber === 'INV-2026-001',
    `I: Longer match first (got: ${resultI.matches[0]?.referenceNumber})`
  )
  assert(
    resultI.matches[1].referenceNumber === 'INV',
    `I: Shorter match second (got: ${resultI.matches[1]?.referenceNumber})`
  )

  // --- J: No match ---
  console.log('\n  --- J: No match → empty results ---')
  const resultJ = matchReferenceNumbers(
    'random-document-name.pdf',
    { enabled: true, types: ['INVOICE', 'SHIPMENT'], maxResults: 10 },
    refNumbers
  )
  assert(resultJ.matches.length === 0, `J: 0 matches`)

  // --- K: Multiple matches sorted ---
  console.log('\n  --- K: Multiple matches sorted by length ---')
  const resultK = matchReferenceNumbers(
    'BL-HK-2026-001_SHIP-2026-001_INV-2026-001.pdf',
    { enabled: true, types: ['INVOICE', 'SHIPMENT', 'BL'], maxResults: 10 },
    refNumbers
  )
  assert(resultK.matches.length >= 3, `K: At least 3 matches (got: ${resultK.matches.length})`)
  // BL-HK-2026-001 (14 chars) > SHIP-2026-001 (13) > INV-2026-001 (12)
  assert(
    resultK.matches[0].referenceNumber === 'BL-HK-2026-001',
    `K: Longest first: BL-HK-2026-001 (got: ${resultK.matches[0]?.referenceNumber})`
  )

  // --- L: Config disabled ---
  console.log('\n  --- L: Config disabled → skip ---')
  const resultL = matchReferenceNumbers(
    'INV-2026-001.pdf',
    { enabled: false, types: ['INVOICE'], maxResults: 10 },
    refNumbers
  )
  assert(!resultL.enabled, 'L: matching not enabled')
  assert(resultL.matches.length === 0, 'L: 0 matches when disabled')
  assert(!resultL.shouldAbortPipeline, 'L: Should not abort when disabled')

  // --- M: Enabled + no match → abort signal ---
  console.log('\n  --- M: Enabled + no match → abort pipeline ---')
  const resultM = matchReferenceNumbers(
    'unknown-file.pdf',
    { enabled: true, types: ['INVOICE'], maxResults: 10 },
    refNumbers
  )
  assert(resultM.shouldAbortPipeline, 'M: shouldAbortPipeline = true (enabled but no match)')

  // ═════════════════════════════════════════════════════════════════════════
  // PART 3: Auto-Complete Workflow (DB operations)
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n' + '─'.repeat(80))
  console.log('  PART 3: Auto-Complete Workflow (DB)')
  console.log('─'.repeat(80))

  const template = await prisma.dataTemplate.findFirst({
    where: { id: 'erp-standard-import' },
    select: { id: true },
  })
  if (!template) throw new Error('DataTemplate erp-standard-import not found')

  const templateFields: DataTemplateField[] = [
    { name: 'inv_no', label: 'Invoice Number', dataType: 'string', isRequired: true, order: 1 },
    { name: 'amount', label: 'Amount', dataType: 'number', isRequired: true, order: 2 },
    { name: 'currency', label: 'Currency', dataType: 'string', isRequired: false, order: 3 },
  ]

  // Find test documents for sourceDocumentIds
  const testDocs = await prisma.document.findMany({
    select: { id: true },
    take: 3,
    orderBy: { createdAt: 'asc' },
  })
  const docIds = testDocs.map((d) => d.id)

  // --- N: All rows VALID → COMPLETED ---
  console.log('\n  --- N: All rows VALID → auto-complete to COMPLETED ---')
  const instanceN = await prisma.templateInstance.create({
    data: {
      dataTemplateId: template.id,
      name: TEST_PREFIX + 'auto_complete_valid',
      status: 'DRAFT',
    },
  })

  try {
    // Create 2 valid rows
    await prisma.templateInstanceRow.createMany({
      data: [
        {
          templateInstanceId: instanceN.id,
          rowKey: 'ROW-N1',
          rowIndex: 0,
          fieldValues: { inv_no: 'INV-001', amount: 1000, currency: 'USD' } as unknown as Prisma.InputJsonValue,
          sourceDocumentIds: docIds.slice(0, 1),
          status: 'PENDING',
        },
        {
          templateInstanceId: instanceN.id,
          rowKey: 'ROW-N2',
          rowIndex: 1,
          fieldValues: { inv_no: 'INV-002', amount: 2000, currency: 'TWD' } as unknown as Prisma.InputJsonValue,
          sourceDocumentIds: docIds.slice(1, 2),
          status: 'PENDING',
        },
      ],
    })

    // Validate all rows
    const rows = await prisma.templateInstanceRow.findMany({
      where: { templateInstanceId: instanceN.id },
    })

    let invalidCount = 0
    for (const row of rows) {
      const fieldValues = row.fieldValues as Record<string, unknown>
      const validation = validateRowData(fieldValues, templateFields)

      await prisma.templateInstanceRow.update({
        where: { id: row.id },
        data: {
          status: validation.isValid ? 'VALID' : 'INVALID',
          validationErrors: validation.errors
            ? (validation.errors as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
      })

      if (!validation.isValid) invalidCount++
    }

    assert(invalidCount === 0, `N: All rows valid (invalid: ${invalidCount})`)

    // Auto-complete: check if should transition
    const shouldComplete = invalidCount === 0 && rows.length > 0
    assert(shouldComplete, 'N: Auto-complete condition met (invalid=0, total>0)')

    if (shouldComplete) {
      assert(canTransition('DRAFT', 'COMPLETED'), 'N: DRAFT→COMPLETED transition allowed')
      await prisma.templateInstance.update({
        where: { id: instanceN.id },
        data: { status: 'COMPLETED' },
      })
    }

    const updatedN = await prisma.templateInstance.findUnique({
      where: { id: instanceN.id },
      select: { status: true },
    })
    assert(updatedN?.status === 'COMPLETED', `N: Status is COMPLETED (got: ${updatedN?.status})`)
  } finally {
    await prisma.templateInstanceRow.deleteMany({ where: { templateInstanceId: instanceN.id } })
    await prisma.templateInstance.deleteMany({ where: { id: instanceN.id } })
  }

  // --- O: Some rows INVALID → stays DRAFT ---
  console.log('\n  --- O: Some rows INVALID → stays DRAFT ---')
  const instanceO = await prisma.templateInstance.create({
    data: {
      dataTemplateId: template.id,
      name: TEST_PREFIX + 'auto_complete_invalid',
      status: 'DRAFT',
    },
  })

  try {
    // Create 1 valid + 1 invalid row
    await prisma.templateInstanceRow.createMany({
      data: [
        {
          templateInstanceId: instanceO.id,
          rowKey: 'ROW-O1',
          rowIndex: 0,
          fieldValues: { inv_no: 'INV-001', amount: 1000 } as unknown as Prisma.InputJsonValue,
          sourceDocumentIds: docIds.slice(0, 1),
          status: 'PENDING',
        },
        {
          templateInstanceId: instanceO.id,
          rowKey: 'ROW-O2',
          rowIndex: 1,
          // Missing required 'inv_no' and 'amount' is not a number
          fieldValues: { inv_no: '', amount: 'not-a-number' } as unknown as Prisma.InputJsonValue,
          sourceDocumentIds: docIds.slice(1, 2),
          status: 'PENDING',
        },
      ],
    })

    const rowsO = await prisma.templateInstanceRow.findMany({
      where: { templateInstanceId: instanceO.id },
    })

    let invalidCountO = 0
    for (const row of rowsO) {
      const fieldValues = row.fieldValues as Record<string, unknown>
      const validation = validateRowData(fieldValues, templateFields)

      await prisma.templateInstanceRow.update({
        where: { id: row.id },
        data: {
          status: validation.isValid ? 'VALID' : 'INVALID',
          validationErrors: validation.errors
            ? (validation.errors as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
      })

      if (!validation.isValid) invalidCountO++
    }

    assert(invalidCountO > 0, `O: Has invalid rows (count: ${invalidCountO})`)

    // Auto-complete check: should NOT transition
    const shouldCompleteO = invalidCountO === 0 && rowsO.length > 0
    assert(!shouldCompleteO, 'O: Auto-complete condition NOT met')

    // Verify status unchanged
    const updatedO = await prisma.templateInstance.findUnique({
      where: { id: instanceO.id },
      select: { status: true },
    })
    assert(updatedO?.status === 'DRAFT', `O: Status stays DRAFT (got: ${updatedO?.status})`)
  } finally {
    await prisma.templateInstanceRow.deleteMany({ where: { templateInstanceId: instanceO.id } })
    await prisma.templateInstance.deleteMany({ where: { id: instanceO.id } })
  }

  // --- P: No rows → stays DRAFT ---
  console.log('\n  --- P: No rows → stays DRAFT ---')
  const instanceP = await prisma.templateInstance.create({
    data: {
      dataTemplateId: template.id,
      name: TEST_PREFIX + 'auto_complete_empty',
      status: 'DRAFT',
    },
  })

  try {
    const rowCountP = await prisma.templateInstanceRow.count({
      where: { templateInstanceId: instanceP.id },
    })

    assert(rowCountP === 0, `P: Instance has 0 rows`)

    const shouldCompleteP = 0 === 0 && rowCountP > 0 // invalid=0 but total=0
    assert(!shouldCompleteP, 'P: Auto-complete NOT triggered (total=0)')

    const updatedP = await prisma.templateInstance.findUnique({
      where: { id: instanceP.id },
      select: { status: true },
    })
    assert(updatedP?.status === 'DRAFT', `P: Status stays DRAFT (got: ${updatedP?.status})`)
  } finally {
    await prisma.templateInstance.deleteMany({ where: { id: instanceP.id } })
  }

  // --- Q: Status transition validation ---
  console.log('\n  --- Q: Status transition rules ---')
  assert(canTransition('DRAFT', 'COMPLETED'), 'Q: DRAFT→COMPLETED allowed')
  assert(canTransition('DRAFT', 'PROCESSING'), 'Q: DRAFT→PROCESSING allowed')
  assert(!canTransition('DRAFT', 'EXPORTED'), 'Q: DRAFT→EXPORTED not allowed')
  assert(canTransition('COMPLETED', 'EXPORTED'), 'Q: COMPLETED→EXPORTED allowed')
  assert(!canTransition('COMPLETED', 'DRAFT'), 'Q: COMPLETED→DRAFT not allowed')
  assert(!canTransition('EXPORTED', 'DRAFT'), 'Q: EXPORTED→DRAFT not allowed')
  assert(canTransition('ERROR', 'PROCESSING'), 'Q: ERROR→PROCESSING allowed (retry)')
  assert(!canTransition('ERROR', 'COMPLETED'), 'Q: ERROR→COMPLETED not allowed')

  // ═══════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n' + '='.repeat(80))
  console.log('  TEST SUMMARY')
  console.log('='.repeat(80))
  console.log(`
  Total assertions: ${passCount + failCount}
  Passed: ${passCount}
  Failed: ${failCount}
  Result: ${failCount === 0 ? 'ALL TESTS PASSED' : `${failCount} TESTS FAILED`}

  Coverage:
    Part 1 — Exchange Rate Conversion:
      A: Basic conversion (USD→TWD)      ✓
      B: Same currency → no conversion   ✓
      C: Zero amount → skipped           ✓
      D: Precision rounding              ✓
      E: Multiple amounts, same rate     ✓
      F: Config disabled → skip          ✓

    Part 2 — Reference Number Matching:
      G: Exact match                     ✓
      H: Substring match                 ✓
      I: Longest match priority          ✓
      J: No match → empty               ✓
      K: Multiple matches sorted         ✓
      L: Config disabled → skip          ✓
      M: Enabled + no match → abort      ✓

    Part 3 — Auto-Complete Workflow:
      N: All VALID → COMPLETED           ✓
      O: Some INVALID → stays DRAFT      ✓
      P: No rows → stays DRAFT           ✓
      Q: Status transition rules         ✓
  `)
  console.log('='.repeat(80))

  if (failCount > 0) {
    process.exitCode = 1
  }
}

main()
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
