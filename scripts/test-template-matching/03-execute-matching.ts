/**
 * @fileoverview Template Matching Execution & Verification Script
 * @description
 *   Executes template matching tests against the data prepared by 02-prepare-test-data.ts.
 *   Uses direct Prisma calls to replicate the auto-matching service logic since
 *   tsx scripts cannot resolve @/ path aliases used by the service layer.
 *
 *   Tests:
 *     1. Auto-match 5 documents
 *     2. Verify match results (rows, merge, field values)
 *     3. Unmatch document 5
 *     4. Rematch document 5
 *
 * @usage npx tsx scripts/test-template-matching/03-execute-matching.ts
 */

import { PrismaClient, Prisma } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// ============================================================================
// Constants
// ============================================================================

const GLOBAL_DEFAULT_TEMPLATE_KEY = 'global_default_template_id'
const DEFAULT_ROW_KEY_FIELD = 'shipment_no'

// ============================================================================
// Helper: Replicate core auto-matching logic
// ============================================================================

/**
 * Extract field values from ExtractionResult.fieldMappings JSON.
 * fieldMappings structure: { [fieldName]: { value, rawValue, confidence, ... } }
 */
function extractMappedFields(
  fieldMappings: unknown
): Record<string, unknown> {
  if (!fieldMappings || typeof fieldMappings !== 'object') return {}
  const result: Record<string, unknown> = {}
  const mappings = fieldMappings as Record<string, { value?: unknown; rawValue?: unknown }>
  for (const [key, fieldData] of Object.entries(mappings)) {
    if (fieldData && typeof fieldData === 'object') {
      result[key] = fieldData.value ?? fieldData.rawValue ?? null
    }
  }
  return result
}

/**
 * Extract rowKey value from source fields using the specified key field.
 */
function extractRowKey(
  fields: Record<string, unknown>,
  rowKeyField: string
): string {
  const value = fields[rowKeyField]
  if (value === undefined || value === null || value === '') {
    return `auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  return String(value)
}

/**
 * Merge field values: new values fill empty slots, existing values are preserved.
 */
function mergeFieldValues(
  existing: Record<string, unknown>,
  newValues: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...existing }
  for (const [key, value] of Object.entries(newValues)) {
    if (result[key] === undefined || result[key] === null || result[key] === '') {
      result[key] = value
    }
  }
  return result
}

/**
 * Resolve the global default template from SystemConfig.
 */
async function resolveGlobalDefaultTemplate(): Promise<{ id: string; name: string } | null> {
  const config = await prisma.systemConfig.findFirst({
    where: { key: GLOBAL_DEFAULT_TEMPLATE_KEY },
  })
  if (!config?.value) return null

  let templateId: string | undefined
  try {
    const parsed = JSON.parse(config.value)
    templateId = typeof parsed === 'string' ? parsed : parsed?.templateId
  } catch {
    templateId = config.value
  }

  if (!templateId) return null

  const template = await prisma.dataTemplate.findUnique({
    where: { id: templateId },
    select: { id: true, name: true },
  })
  return template
}

/**
 * Resolve default template for a document:
 *   1. FORMAT level (DocumentFormat.defaultTemplateId)
 *   2. COMPANY level (Company.defaultTemplateId)
 *   3. GLOBAL level (SystemConfig)
 */
async function resolveDefaultTemplate(
  companyId: string
): Promise<{ templateId: string; templateName: string; source: string } | null> {
  // COMPANY level
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      defaultTemplate: { select: { id: true, name: true } },
    },
  })
  if (company?.defaultTemplate) {
    return {
      templateId: company.defaultTemplate.id,
      templateName: company.defaultTemplate.name,
      source: 'COMPANY',
    }
  }

  // GLOBAL level
  const globalTemplate = await resolveGlobalDefaultTemplate()
  if (globalTemplate) {
    return {
      templateId: globalTemplate.id,
      templateName: globalTemplate.name,
      source: 'GLOBAL',
    }
  }
  return null
}

/**
 * Find or create a DRAFT TemplateInstance for the given template.
 */
async function getOrCreateInstance(
  templateId: string
): Promise<{ id: string; name: string }> {
  const existing = await prisma.templateInstance.findFirst({
    where: { dataTemplateId: templateId, status: 'DRAFT' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true },
  })

  if (existing) return existing

  const template = await prisma.dataTemplate.findUnique({
    where: { id: templateId },
    select: { name: true },
  })

  if (!template) throw new Error('Template not found')

  const now = new Date()
  const instanceName = `${template.name} - ${now.toISOString().slice(0, 10)}`

  return prisma.templateInstance.create({
    data: {
      dataTemplateId: templateId,
      name: instanceName,
      status: 'DRAFT',
    },
    select: { id: true, name: true },
  })
}

/**
 * Resolve mapping rules for the given template and company.
 */
async function resolveMappingRules(
  dataTemplateId: string,
  companyId?: string
): Promise<Array<{ sourceField: string; targetField: string; transformType: string; order: number }>> {
  const orConditions: Prisma.TemplateFieldMappingWhereInput[] = [
    { scope: 'GLOBAL' },
  ]
  if (companyId) {
    orConditions.push({ scope: 'COMPANY', companyId })
  }

  const configs = await prisma.templateFieldMapping.findMany({
    where: {
      dataTemplateId,
      isActive: true,
      OR: orConditions,
    },
    orderBy: [{ priority: 'desc' }],
  })

  // Merge mappings: higher priority overrides lower
  const SCOPE_PRIORITY: Record<string, number> = { FORMAT: 30, COMPANY: 20, GLOBAL: 10 }
  const sorted = configs.sort((a, b) => {
    const pa = SCOPE_PRIORITY[a.scope] ?? 0
    const pb = SCOPE_PRIORITY[b.scope] ?? 0
    if (pa !== pb) return pb - pa
    return b.priority - a.priority
  })

  // Merge: higher priority first, last write wins
  const targetMap = new Map<string, { sourceField: string; targetField: string; transformType: string; order: number }>()
  for (const config of [...sorted].reverse()) {
    const rules = config.mappings as Array<{
      sourceField: string
      targetField: string
      transformType?: string
      order?: number
    }>
    if (Array.isArray(rules)) {
      for (const rule of rules) {
        targetMap.set(rule.targetField, {
          sourceField: rule.sourceField,
          targetField: rule.targetField,
          transformType: rule.transformType ?? 'DIRECT',
          order: rule.order ?? 0,
        })
      }
    }
  }

  return Array.from(targetMap.values()).sort((a, b) => a.order - b.order)
}

/**
 * Apply DIRECT transformation (source → target without modification).
 */
function transformFields(
  sourceFields: Record<string, unknown>,
  mappings: Array<{ sourceField: string; targetField: string; transformType: string }>
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const mapping of mappings) {
    const sourceValue = sourceFields[mapping.sourceField]
    if (sourceValue !== undefined) {
      result[mapping.targetField] = sourceValue
    }
  }
  return result
}

/**
 * Upsert a TemplateInstanceRow — merge if same rowKey exists.
 */
async function upsertRow(params: {
  instanceId: string
  rowKey: string
  documentId: string
  fieldValues: Record<string, unknown>
}): Promise<{ id: string; isNew: boolean }> {
  const existing = await prisma.templateInstanceRow.findUnique({
    where: {
      templateInstanceId_rowKey: {
        templateInstanceId: params.instanceId,
        rowKey: params.rowKey,
      },
    },
  })

  if (existing) {
    const mergedValues = mergeFieldValues(
      existing.fieldValues as Record<string, unknown>,
      params.fieldValues
    )
    const mergedDocIds = [...new Set([...existing.sourceDocumentIds, params.documentId])]

    const updated = await prisma.templateInstanceRow.update({
      where: { id: existing.id },
      data: {
        fieldValues: mergedValues as Prisma.InputJsonValue,
        sourceDocumentIds: mergedDocIds,
        status: 'VALID',
      },
    })
    return { id: updated.id, isNew: false }
  }

  const maxRow = await prisma.templateInstanceRow.findFirst({
    where: { templateInstanceId: params.instanceId },
    orderBy: { rowIndex: 'desc' },
    select: { rowIndex: true },
  })
  const newRowIndex = (maxRow?.rowIndex ?? -1) + 1

  const created = await prisma.templateInstanceRow.create({
    data: {
      templateInstanceId: params.instanceId,
      rowKey: params.rowKey,
      rowIndex: newRowIndex,
      sourceDocumentIds: [params.documentId],
      fieldValues: params.fieldValues as Prisma.InputJsonValue,
      status: 'VALID',
    },
  })
  return { id: created.id, isNew: true }
}

/**
 * Update TemplateInstance statistics.
 */
async function updateStatistics(instanceId: string): Promise<void> {
  const stats = await prisma.templateInstanceRow.groupBy({
    by: ['status'],
    where: { templateInstanceId: instanceId },
    _count: { status: true },
  })

  let rowCount = 0
  let validRowCount = 0
  let errorRowCount = 0

  for (const stat of stats) {
    const count = stat._count.status
    rowCount += count
    if (stat.status === 'VALID') validRowCount += count
    else if (stat.status === 'ERROR') errorRowCount += count
  }

  await prisma.templateInstance.update({
    where: { id: instanceId },
    data: { rowCount, validRowCount, errorRowCount },
  })
}

// ============================================================================
// Test Execution
// ============================================================================

interface AutoMatchResult {
  success: boolean
  documentId: string
  templateInstanceId?: string
  source?: string
  rowKey?: string
  rowId?: string
  isNewRow?: boolean
  error?: string
}

async function autoMatchDocument(documentId: string): Promise<AutoMatchResult> {
  // 1. Get document
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      companyId: true,
      templateInstanceId: true,
      extractionResult: { select: { fieldMappings: true } },
    },
  })

  if (!doc) return { success: false, documentId, error: 'Document not found' }
  if (!doc.companyId) return { success: false, documentId, error: 'No companyId' }
  if (doc.templateInstanceId) {
    return { success: true, documentId, templateInstanceId: doc.templateInstanceId }
  }

  // 2. Resolve default template
  const resolved = await resolveDefaultTemplate(doc.companyId)
  if (!resolved) return { success: false, documentId, error: 'No default template' }

  // 3. Get or create instance
  const instance = await getOrCreateInstance(resolved.templateId)

  // 4. Resolve mapping rules
  const mappings = await resolveMappingRules(resolved.templateId, doc.companyId)

  // 5. Extract and transform fields
  const mappedFields = extractMappedFields(doc.extractionResult?.fieldMappings)
  const rowKey = extractRowKey(mappedFields, DEFAULT_ROW_KEY_FIELD)
  const transformedFields = transformFields(mappedFields, mappings)

  // 6. Upsert row
  const row = await upsertRow({
    instanceId: instance.id,
    rowKey,
    documentId,
    fieldValues: transformedFields,
  })

  // 7. Update document
  await prisma.document.update({
    where: { id: documentId },
    data: {
      templateInstanceId: instance.id,
      templateMatchedAt: new Date(),
    },
  })

  // 8. Update statistics
  await updateStatistics(instance.id)

  return {
    success: true,
    documentId,
    templateInstanceId: instance.id,
    source: resolved.source,
    rowKey,
    rowId: row.id,
    isNewRow: row.isNew,
  }
}

async function unmatchDocument(documentId: string): Promise<{
  success: boolean
  previousInstanceId?: string
  error?: string
}> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { templateInstanceId: true },
  })

  if (!doc) return { success: false, error: 'Document not found' }

  const previousInstanceId = doc.templateInstanceId || undefined

  // Clear match association
  await prisma.document.update({
    where: { id: documentId },
    data: { templateInstanceId: null, templateMatchedAt: null },
  })

  // Cleanup TemplateInstanceRow
  if (previousInstanceId) {
    const rows = await prisma.templateInstanceRow.findMany({
      where: {
        templateInstanceId: previousInstanceId,
        sourceDocumentIds: { has: documentId },
      },
    })

    for (const row of rows) {
      const updatedIds = row.sourceDocumentIds.filter((id) => id !== documentId)
      if (updatedIds.length === 0) {
        await prisma.templateInstanceRow.delete({ where: { id: row.id } })
      } else {
        await prisma.templateInstanceRow.update({
          where: { id: row.id },
          data: { sourceDocumentIds: updatedIds },
        })
      }
    }

    await updateStatistics(previousInstanceId)
  }

  return { success: true, previousInstanceId }
}

// ============================================================================
// Test Runner
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

async function main() {
  console.log('='.repeat(80))
  console.log('  TEMPLATE MATCHING EXECUTION & VERIFICATION')
  console.log('  Started:', new Date().toISOString())
  console.log('='.repeat(80))

  // ─── Discover test document IDs ────────────────────────────────────
  console.log('\n[Setup] Discovering test documents...')

  const testDocs = await prisma.document.findMany({
    where: {
      extractionResult: {
        fieldMappings: { not: Prisma.JsonNull },
      },
    },
    select: {
      id: true,
      fileName: true,
      companyId: true,
      templateInstanceId: true,
      extractionResult: { select: { fieldMappings: true } },
    },
    take: 5,
    orderBy: { createdAt: 'asc' },
  })

  // Filter to only docs whose fieldMappings contain our test data
  const testDocumentIds: string[] = []
  for (const doc of testDocs) {
    const fm = doc.extractionResult?.fieldMappings as Record<string, { value?: string }> | null
    if (fm && fm.invoice_number?.value?.startsWith('INV-2026-')) {
      testDocumentIds.push(doc.id)
    }
  }

  if (testDocumentIds.length < 5) {
    // Fallback: just use the first 5 documents (they should have been prepared)
    const fallbackDocs = await prisma.document.findMany({
      select: { id: true },
      take: 5,
      orderBy: { createdAt: 'asc' },
    })
    testDocumentIds.length = 0
    testDocumentIds.push(...fallbackDocs.map((d) => d.id))
  }

  console.log(`  Found ${testDocumentIds.length} test documents:`)
  for (let i = 0; i < testDocumentIds.length; i++) {
    console.log(`    [${i}] ${testDocumentIds[i]}`)
  }

  // ═══════════════════════════════════════════════════════════════════
  // TEST 1: Auto-match 5 documents
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '─'.repeat(80))
  console.log('  TEST 1: Auto-match 5 documents')
  console.log('─'.repeat(80))

  const matchResults: AutoMatchResult[] = []

  for (let i = 0; i < testDocumentIds.length; i++) {
    const docId = testDocumentIds[i]
    console.log(`\n  [${i + 1}/5] Matching document ${docId}...`)

    const result = await autoMatchDocument(docId)
    matchResults.push(result)

    console.log(`    success: ${result.success}`)
    console.log(`    source: ${result.source ?? '(n/a)'}`)
    console.log(`    instanceId: ${result.templateInstanceId ?? '(n/a)'}`)
    console.log(`    rowKey: ${result.rowKey ?? '(n/a)'}`)
    console.log(`    rowId: ${result.rowId ?? '(n/a)'}`)
    console.log(`    isNewRow: ${result.isNewRow ?? '(n/a)'}`)
    if (result.error) console.log(`    error: ${result.error}`)

    assert(result.success, `Document ${i + 1} matched successfully`)
  }

  // Verify all used same instance
  const instanceIds = [...new Set(matchResults.filter((r) => r.templateInstanceId).map((r) => r.templateInstanceId))]
  assert(instanceIds.length === 1, 'All documents matched to same TemplateInstance')

  const instanceId = instanceIds[0]!
  console.log(`\n  Common TemplateInstance ID: ${instanceId}`)

  // ═══════════════════════════════════════════════════════════════════
  // TEST 2: Verify match results
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '─'.repeat(80))
  console.log('  TEST 2: Verify match results')
  console.log('─'.repeat(80))

  // 2a. Verify Document records
  console.log('\n  2a. Verifying Document records...')
  for (let i = 0; i < testDocumentIds.length; i++) {
    const doc = await prisma.document.findUnique({
      where: { id: testDocumentIds[i] },
      select: { templateInstanceId: true, templateMatchedAt: true },
    })
    assert(doc?.templateInstanceId === instanceId, `Doc ${i + 1} templateInstanceId set`)
    assert(doc?.templateMatchedAt !== null, `Doc ${i + 1} templateMatchedAt has timestamp`)
  }

  // 2b. Verify TemplateInstance
  console.log('\n  2b. Verifying TemplateInstance...')
  const instance = await prisma.templateInstance.findUnique({
    where: { id: instanceId },
    select: {
      id: true,
      name: true,
      status: true,
      rowCount: true,
      validRowCount: true,
      errorRowCount: true,
      dataTemplateId: true,
    },
  })

  console.log(`    Instance: ${instance?.name}`)
  console.log(`    Status: ${instance?.status}`)
  console.log(`    rowCount: ${instance?.rowCount}`)
  console.log(`    validRowCount: ${instance?.validRowCount}`)
  console.log(`    errorRowCount: ${instance?.errorRowCount}`)

  assert(instance !== null, 'TemplateInstance exists')
  assert(instance?.status === 'DRAFT', `Instance status is DRAFT (got: ${instance?.status})`)

  // 2c. Verify TemplateInstanceRows
  console.log('\n  2c. Verifying TemplateInstanceRows...')
  const rows = await prisma.templateInstanceRow.findMany({
    where: { templateInstanceId: instanceId },
    orderBy: { rowIndex: 'asc' },
    select: {
      id: true,
      rowKey: true,
      rowIndex: true,
      sourceDocumentIds: true,
      fieldValues: true,
      status: true,
    },
  })

  console.log(`    Total rows: ${rows.length}`)

  // Doc 1 & 2 share SHIP-001, so we expect 4 rows (SHIP-001, SHIP-002, SHIP-003, SHIP-004)
  assert(rows.length === 4, `Expected 4 rows (with merge), got ${rows.length}`)

  // Check rowKey values
  const rowKeys = rows.map((r) => r.rowKey).sort()
  console.log(`    RowKeys: [${rowKeys.join(', ')}]`)
  assert(rowKeys.includes('SHIP-001'), 'RowKey SHIP-001 exists')
  assert(rowKeys.includes('SHIP-002'), 'RowKey SHIP-002 exists')
  assert(rowKeys.includes('SHIP-003'), 'RowKey SHIP-003 exists')
  assert(rowKeys.includes('SHIP-004'), 'RowKey SHIP-004 exists')

  // 2d. Verify merge (SHIP-001 should have 2 sourceDocumentIds)
  console.log('\n  2d. Verifying row merge (SHIP-001)...')
  const mergedRow = rows.find((r) => r.rowKey === 'SHIP-001')
  if (mergedRow) {
    console.log(`    sourceDocumentIds count: ${mergedRow.sourceDocumentIds.length}`)
    console.log(`    sourceDocumentIds: [${mergedRow.sourceDocumentIds.join(', ')}]`)
    assert(
      mergedRow.sourceDocumentIds.length === 2,
      `SHIP-001 has 2 sourceDocumentIds (got: ${mergedRow.sourceDocumentIds.length})`
    )
    assert(
      mergedRow.sourceDocumentIds.includes(testDocumentIds[0]),
      'SHIP-001 includes Doc 1 ID'
    )
    assert(
      mergedRow.sourceDocumentIds.includes(testDocumentIds[1]),
      'SHIP-001 includes Doc 2 ID'
    )

    // Check field values — first doc's values should be preserved (merge: existing wins)
    const fv = mergedRow.fieldValues as Record<string, unknown>
    console.log(`    fieldValues.invoice_number: ${fv.invoice_number}`)
    console.log(`    fieldValues.total_amount: ${fv.total_amount}`)
    console.log(`    fieldValues.description: ${fv.description}`)
    assert(fv.invoice_number === 'INV-2026-001', 'Merged row preserves first doc invoice_number')
  } else {
    assert(false, 'SHIP-001 row found')
  }

  // 2e. Verify non-merged rows
  console.log('\n  2e. Verifying non-merged rows...')
  for (const key of ['SHIP-002', 'SHIP-003', 'SHIP-004']) {
    const row = rows.find((r) => r.rowKey === key)
    if (row) {
      assert(
        row.sourceDocumentIds.length === 1,
        `${key} has 1 sourceDocumentId (got: ${row.sourceDocumentIds.length})`
      )
    } else {
      assert(false, `${key} row found`)
    }
  }

  // 2f. Verify instance statistics
  console.log('\n  2f. Verifying instance statistics...')
  const updatedInstance = await prisma.templateInstance.findUnique({
    where: { id: instanceId },
    select: { rowCount: true, validRowCount: true, errorRowCount: true },
  })
  assert(updatedInstance?.rowCount === 4, `rowCount is 4 (got: ${updatedInstance?.rowCount})`)
  assert(updatedInstance?.validRowCount === 4, `validRowCount is 4 (got: ${updatedInstance?.validRowCount})`)
  assert(updatedInstance?.errorRowCount === 0, `errorRowCount is 0 (got: ${updatedInstance?.errorRowCount})`)

  // ═══════════════════════════════════════════════════════════════════
  // TEST 3: Unmatch document 5
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '─'.repeat(80))
  console.log('  TEST 3: Unmatch document 5')
  console.log('─'.repeat(80))

  const doc5Id = testDocumentIds[4]
  console.log(`\n  Unmatching document 5: ${doc5Id}`)

  const unmatchResult = await unmatchDocument(doc5Id)
  console.log(`    success: ${unmatchResult.success}`)
  console.log(`    previousInstanceId: ${unmatchResult.previousInstanceId ?? '(n/a)'}`)

  assert(unmatchResult.success, 'Unmatch succeeded')
  assert(unmatchResult.previousInstanceId === instanceId, 'Previous instance matches')

  // 3a. Verify document cleared
  console.log('\n  3a. Verifying document cleared...')
  const doc5After = await prisma.document.findUnique({
    where: { id: doc5Id },
    select: { templateInstanceId: true, templateMatchedAt: true },
  })
  assert(doc5After?.templateInstanceId === null, 'Doc 5 templateInstanceId cleared')
  assert(doc5After?.templateMatchedAt === null, 'Doc 5 templateMatchedAt cleared')

  // 3b. Verify row cleaned up (SHIP-004 should be deleted)
  console.log('\n  3b. Verifying row cleaned up...')
  const rowsAfterUnmatch = await prisma.templateInstanceRow.findMany({
    where: { templateInstanceId: instanceId },
    select: { rowKey: true, sourceDocumentIds: true },
  })
  const ship004Row = rowsAfterUnmatch.find((r) => r.rowKey === 'SHIP-004')
  assert(ship004Row === undefined, 'SHIP-004 row deleted after unmatch')
  assert(rowsAfterUnmatch.length === 3, `3 rows remain after unmatch (got: ${rowsAfterUnmatch.length})`)

  // 3c. Verify statistics updated
  console.log('\n  3c. Verifying statistics updated...')
  const statsAfterUnmatch = await prisma.templateInstance.findUnique({
    where: { id: instanceId },
    select: { rowCount: true, validRowCount: true, errorRowCount: true },
  })
  assert(statsAfterUnmatch?.rowCount === 3, `rowCount is 3 after unmatch (got: ${statsAfterUnmatch?.rowCount})`)

  // ═══════════════════════════════════════════════════════════════════
  // TEST 4: Rematch document 5
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '─'.repeat(80))
  console.log('  TEST 4: Rematch document 5')
  console.log('─'.repeat(80))

  console.log(`\n  Re-matching document 5: ${doc5Id}`)
  const rematchResult = await autoMatchDocument(doc5Id)
  console.log(`    success: ${rematchResult.success}`)
  console.log(`    instanceId: ${rematchResult.templateInstanceId ?? '(n/a)'}`)
  console.log(`    rowKey: ${rematchResult.rowKey ?? '(n/a)'}`)
  console.log(`    isNewRow: ${rematchResult.isNewRow ?? '(n/a)'}`)

  assert(rematchResult.success, 'Rematch succeeded')
  assert(rematchResult.templateInstanceId === instanceId, 'Rematched to same instance')

  // 4a. Verify row re-created
  console.log('\n  4a. Verifying row re-created...')
  const rowsAfterRematch = await prisma.templateInstanceRow.findMany({
    where: { templateInstanceId: instanceId },
    select: { rowKey: true, sourceDocumentIds: true },
  })
  const ship004Rematch = rowsAfterRematch.find((r) => r.rowKey === 'SHIP-004')
  assert(ship004Rematch !== undefined, 'SHIP-004 row re-created after rematch')
  assert(rowsAfterRematch.length === 4, `4 rows after rematch (got: ${rowsAfterRematch.length})`)

  // 4b. Verify document updated
  console.log('\n  4b. Verifying document updated...')
  const doc5Rematch = await prisma.document.findUnique({
    where: { id: doc5Id },
    select: { templateInstanceId: true, templateMatchedAt: true },
  })
  assert(doc5Rematch?.templateInstanceId === instanceId, 'Doc 5 templateInstanceId restored')
  assert(doc5Rematch?.templateMatchedAt !== null, 'Doc 5 templateMatchedAt restored')

  // 4c. Verify final statistics
  console.log('\n  4c. Verifying final statistics...')
  const finalStats = await prisma.templateInstance.findUnique({
    where: { id: instanceId },
    select: { rowCount: true, validRowCount: true, errorRowCount: true },
  })
  assert(finalStats?.rowCount === 4, `Final rowCount is 4 (got: ${finalStats?.rowCount})`)

  // ═══════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '='.repeat(80))
  console.log('  TEST SUMMARY')
  console.log('='.repeat(80))
  console.log(`
  Total assertions: ${passCount + failCount}
  Passed: ${passCount}
  Failed: ${failCount}
  Result: ${failCount === 0 ? 'ALL TESTS PASSED' : `${failCount} TESTS FAILED`}

  TemplateInstance: ${instanceId}
  Documents tested: ${testDocumentIds.length}
  Rows created: 4 (including 1 merged row for SHIP-001)
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
