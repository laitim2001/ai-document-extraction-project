/**
 * @fileoverview Boundary Conditions Test (rowKey, merge, re-match cleanup)
 * @description
 *   Phase 3 of template matching integration tests.
 *
 *   Part 1 — rowKeyField Handling (pure logic):
 *     A: Normal extraction → string value
 *     B: null value → auto-generated key
 *     C: Empty string → auto-generated key
 *     D: Missing field → auto-generated key
 *     E: Numeric value → stringified
 *     F: Multiple missing → each gets unique auto key
 *
 *   Part 2 — mergeFieldValues Logic (pure logic):
 *     G: null → value (overwrite)
 *     H: empty string → value (overwrite)
 *     I: undefined → value (overwrite)
 *     J: value → value (keep existing)
 *     K: Zero value edge case (0 is NOT null/undefined/'')
 *     L: Boolean false edge case
 *     M: Multi-field mixed merge
 *     N: New key in newValues (add to result)
 *
 *   Part 3 — Re-matching & Row Cleanup (DB operations):
 *     O: Create row in instance A with 1 document
 *     P: Cleanup row from A → row deleted (sole document)
 *     Q: Create row in instance A with 2 documents
 *     R: Cleanup 1 doc → row kept with remaining doc
 *     S: Statistics update after cleanup
 *
 *   Prerequisites: Run 02-prepare-test-data.ts first.
 *
 * @usage npx tsx scripts/test-template-matching/06-boundary-conditions.ts
 */

import { PrismaClient, Prisma } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const TEST_PREFIX = 'BOUNDARY_TEST_'

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
// Replicated Logic: extractRowKey
// (from template-matching-engine.service.ts:640-652)
// ============================================================================

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

// ============================================================================
// Replicated Logic: mergeFieldValues
// (from template-matching-engine.service.ts:538-556)
// ============================================================================

function mergeFieldValues(
  existing: Record<string, unknown>,
  newValues: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...existing }

  for (const [key, value] of Object.entries(newValues)) {
    if (
      result[key] === undefined ||
      result[key] === null ||
      result[key] === ''
    ) {
      result[key] = value
    }
  }

  return result
}

// ============================================================================
// Replicated Logic: cleanupRowsForDocument
// (from auto-template-matching.service.ts:699-728)
// ============================================================================

async function cleanupRowsForDocument(
  instanceId: string,
  documentId: string
): Promise<{ deletedRows: number; updatedRows: number }> {
  const rows = await prisma.templateInstanceRow.findMany({
    where: {
      templateInstanceId: instanceId,
      sourceDocumentIds: { has: documentId },
    },
  })

  let deletedRows = 0
  let updatedRows = 0

  for (const row of rows) {
    const updatedIds = row.sourceDocumentIds.filter((id) => id !== documentId)

    if (updatedIds.length === 0) {
      await prisma.templateInstanceRow.delete({ where: { id: row.id } })
      deletedRows++
    } else {
      await prisma.templateInstanceRow.update({
        where: { id: row.id },
        data: { sourceDocumentIds: updatedIds },
      })
      updatedRows++
    }
  }

  return { deletedRows, updatedRows }
}

// ============================================================================
// Test Execution
// ============================================================================

async function main() {
  console.log('='.repeat(80))
  console.log('  BOUNDARY CONDITIONS TEST')
  console.log('  rowKey Handling + Merge Logic + Re-match Cleanup')
  console.log('  Started:', new Date().toISOString())
  console.log('='.repeat(80))

  // ═════════════════════════════════════════════════════════════════════════
  // PART 1: rowKeyField Handling (pure logic)
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n' + '─'.repeat(80))
  console.log('  PART 1: rowKeyField Handling')
  console.log('─'.repeat(80))

  // --- A: Normal extraction ---
  console.log('\n  --- A: Normal rowKey extraction ---')
  const keyA = extractRowKey(
    { shipment_no: 'SHIP-001', invoice_number: 'INV-001' },
    'shipment_no'
  )
  assert(keyA === 'SHIP-001', `A: rowKey = "SHIP-001" (got: "${keyA}")`)

  // --- B: null value ---
  console.log('\n  --- B: null value → auto-generated ---')
  const keyB = extractRowKey(
    { shipment_no: null, invoice_number: 'INV-001' },
    'shipment_no'
  )
  assert(keyB.startsWith('auto_'), `B: starts with "auto_" (got: "${keyB}")`)

  // --- C: Empty string ---
  console.log('\n  --- C: Empty string → auto-generated ---')
  const keyC = extractRowKey(
    { shipment_no: '', invoice_number: 'INV-001' },
    'shipment_no'
  )
  assert(keyC.startsWith('auto_'), `C: starts with "auto_" (got: "${keyC}")`)

  // --- D: Missing field ---
  console.log('\n  --- D: Missing field → auto-generated ---')
  const keyD = extractRowKey(
    { invoice_number: 'INV-001' },
    'shipment_no'
  )
  assert(keyD.startsWith('auto_'), `D: starts with "auto_" (got: "${keyD}")`)

  // --- E: Numeric value → stringified ---
  console.log('\n  --- E: Numeric value → stringified ---')
  const keyE = extractRowKey(
    { order_number: 12345 },
    'order_number'
  )
  assert(keyE === '12345', `E: numeric 12345 → "12345" (got: "${keyE}")`)

  // --- F: Multiple missing → unique keys ---
  console.log('\n  --- F: Multiple missing → unique auto keys ---')
  const keyF1 = extractRowKey({ shipment_no: null }, 'shipment_no')
  const keyF2 = extractRowKey({ shipment_no: undefined }, 'shipment_no')
  assert(
    keyF1 !== keyF2,
    `F: Two auto keys are unique ("${keyF1}" !== "${keyF2}")`
  )

  // ═════════════════════════════════════════════════════════════════════════
  // PART 2: mergeFieldValues Logic (pure logic)
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n' + '─'.repeat(80))
  console.log('  PART 2: mergeFieldValues Logic')
  console.log('─'.repeat(80))

  // --- G: null → value (overwrite) ---
  console.log('\n  --- G: null → value (overwrite) ---')
  const resultG = mergeFieldValues(
    { amount: null, inv_no: 'INV-001' },
    { amount: 1250 }
  )
  assert(resultG.amount === 1250, `G: null overwritten by 1250 (got: ${resultG.amount})`)
  assert(resultG.inv_no === 'INV-001', `G: existing inv_no preserved (got: ${resultG.inv_no})`)

  // --- H: empty string → value (overwrite) ---
  console.log('\n  --- H: empty string → value (overwrite) ---')
  const resultH = mergeFieldValues(
    { currency: '' },
    { currency: 'USD' }
  )
  assert(resultH.currency === 'USD', `H: empty string overwritten (got: ${resultH.currency})`)

  // --- I: undefined → value (overwrite) ---
  console.log('\n  --- I: undefined → value (overwrite) ---')
  const resultI = mergeFieldValues(
    { tracking: undefined },
    { tracking: 'SHIP-001' }
  )
  assert(resultI.tracking === 'SHIP-001', `I: undefined overwritten (got: ${resultI.tracking})`)

  // --- J: value → value (keep existing) ---
  console.log('\n  --- J: value → value (keep existing) ---')
  const resultJ = mergeFieldValues(
    { amount: 1000 },
    { amount: 2000 }
  )
  assert(resultJ.amount === 1000, `J: existing 1000 kept, not overwritten by 2000 (got: ${resultJ.amount})`)

  // --- K: Zero value edge case ---
  console.log('\n  --- K: Zero value edge case ---')
  const resultK = mergeFieldValues(
    { amount: 0 },
    { amount: 500 }
  )
  // NOTE: 0 is NOT undefined/null/'', so it should be KEPT
  // The actual implementation checks: result[key] === undefined || result[key] === null || result[key] === ''
  // 0 does NOT match any of these, so existing 0 is preserved
  assert(
    resultK.amount === 0,
    `K: Zero (0) is preserved, not overwritten (got: ${resultK.amount})`
  )

  // --- L: Boolean false edge case ---
  console.log('\n  --- L: Boolean false edge case ---')
  const resultL = mergeFieldValues(
    { active: false },
    { active: true }
  )
  // false is NOT undefined/null/'', so it should be KEPT
  assert(
    resultL.active === false,
    `L: false is preserved, not overwritten (got: ${resultL.active})`
  )

  // --- M: Multi-field mixed merge ---
  console.log('\n  --- M: Multi-field mixed merge ---')
  const resultM = mergeFieldValues(
    {
      inv_no: 'INV-001',      // has value → keep
      amount: null,            // null → overwrite
      currency: '',            // empty → overwrite
      vendor: 'DHL',           // has value → keep
      tracking: undefined,     // undefined → overwrite
    },
    {
      inv_no: 'INV-002',      // would overwrite, but existing has value
      amount: 1500,            // overwrites null
      currency: 'USD',         // overwrites empty
      vendor: 'FedEx',         // would overwrite, but existing has value
      tracking: 'SHIP-001',    // overwrites undefined
    }
  )
  assert(resultM.inv_no === 'INV-001', `M: inv_no kept as INV-001`)
  assert(resultM.amount === 1500, `M: amount overwritten to 1500`)
  assert(resultM.currency === 'USD', `M: currency overwritten to USD`)
  assert(resultM.vendor === 'DHL', `M: vendor kept as DHL`)
  assert(resultM.tracking === 'SHIP-001', `M: tracking overwritten to SHIP-001`)

  // --- N: New key in newValues (add to result) ---
  console.log('\n  --- N: New key in newValues ---')
  const resultN = mergeFieldValues(
    { inv_no: 'INV-001' },
    { inv_no: 'INV-002', new_field: 'hello' }
  )
  assert(resultN.inv_no === 'INV-001', `N: existing key preserved`)
  assert(resultN.new_field === 'hello', `N: new key added (got: ${resultN.new_field})`)

  // ═════════════════════════════════════════════════════════════════════════
  // PART 3: Re-matching & Row Cleanup (DB operations)
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n' + '─'.repeat(80))
  console.log('  PART 3: Re-matching & Row Cleanup (DB)')
  console.log('─'.repeat(80))

  // Setup: find template and create test instances
  const template = await prisma.dataTemplate.findFirst({
    where: { id: 'erp-standard-import' },
    select: { id: true },
  })
  if (!template) throw new Error('DataTemplate erp-standard-import not found')

  const testDocs = await prisma.document.findMany({
    where: {
      extractionResult: { fieldMappings: { not: Prisma.JsonNull } },
    },
    select: { id: true },
    take: 2,
    orderBy: { createdAt: 'asc' },
  })
  if (testDocs.length < 2) throw new Error('Need at least 2 documents (run 02-prepare-test-data.ts first)')

  const docId1 = testDocs[0].id
  const docId2 = testDocs[1].id
  console.log(`  Setup: doc1=${docId1}, doc2=${docId2}`)

  // Create test instances
  const instanceA = await prisma.templateInstance.create({
    data: {
      dataTemplateId: template.id,
      name: TEST_PREFIX + 'instance_A',
      status: 'DRAFT',
    },
  })
  const instanceB = await prisma.templateInstance.create({
    data: {
      dataTemplateId: template.id,
      name: TEST_PREFIX + 'instance_B',
      status: 'DRAFT',
    },
  })
  console.log(`  Created instance A: ${instanceA.id}`)
  console.log(`  Created instance B: ${instanceB.id}`)

  try {
    // --- O: Create row in A with 1 document ---
    console.log('\n  --- O: Create row in instance A (1 document) ---')
    const rowO = await prisma.templateInstanceRow.create({
      data: {
        templateInstanceId: instanceA.id,
        rowKey: 'TEST-ROW-001',
        rowIndex: 0,
        fieldValues: { inv_no: 'INV-001', amount: 1000 } as unknown as Prisma.InputJsonValue,
        sourceDocumentIds: [docId1],
        status: 'VALID',
      },
    })
    assert(rowO.sourceDocumentIds.length === 1, `O: Row created with 1 document`)

    // --- P: Cleanup → row deleted (sole document) ---
    console.log('\n  --- P: Cleanup sole document → row deleted ---')
    const cleanupP = await cleanupRowsForDocument(instanceA.id, docId1)
    assert(cleanupP.deletedRows === 1, `P: 1 row deleted (got: ${cleanupP.deletedRows})`)
    assert(cleanupP.updatedRows === 0, `P: 0 rows updated (got: ${cleanupP.updatedRows})`)

    const remainingP = await prisma.templateInstanceRow.count({
      where: { templateInstanceId: instanceA.id },
    })
    assert(remainingP === 0, `P: Instance A has 0 rows after cleanup (got: ${remainingP})`)

    // --- Q: Create row with 2 documents ---
    console.log('\n  --- Q: Create row in instance A (2 documents, shared row) ---')
    const rowQ = await prisma.templateInstanceRow.create({
      data: {
        templateInstanceId: instanceA.id,
        rowKey: 'TEST-ROW-002',
        rowIndex: 0,
        fieldValues: {
          inv_no: 'INV-002',
          amount: 2000,
          currency: 'USD',
        } as unknown as Prisma.InputJsonValue,
        sourceDocumentIds: [docId1, docId2],
        status: 'VALID',
      },
    })
    assert(rowQ.sourceDocumentIds.length === 2, `Q: Row created with 2 documents`)

    // --- R: Cleanup 1 doc → row kept with remaining doc ---
    console.log('\n  --- R: Cleanup 1 of 2 documents → row updated ---')
    const cleanupR = await cleanupRowsForDocument(instanceA.id, docId1)
    assert(cleanupR.deletedRows === 0, `R: 0 rows deleted (got: ${cleanupR.deletedRows})`)
    assert(cleanupR.updatedRows === 1, `R: 1 row updated (got: ${cleanupR.updatedRows})`)

    const updatedRowR = await prisma.templateInstanceRow.findFirst({
      where: { templateInstanceId: instanceA.id, rowKey: 'TEST-ROW-002' },
    })
    assert(
      updatedRowR !== null && updatedRowR.sourceDocumentIds.length === 1,
      `R: Row has 1 remaining document (got: ${updatedRowR?.sourceDocumentIds.length})`
    )
    assert(
      updatedRowR?.sourceDocumentIds[0] === docId2,
      `R: Remaining document is doc2 (got: ${updatedRowR?.sourceDocumentIds[0]})`
    )

    // --- S: Statistics verification ---
    console.log('\n  --- S: Statistics after cleanup ---')
    // Count rows for instance A
    const statsA = await prisma.templateInstanceRow.count({
      where: { templateInstanceId: instanceA.id },
    })
    assert(statsA === 1, `S: Instance A has 1 row remaining (got: ${statsA})`)

    // Count rows for instance B (should be 0, untouched)
    const statsB = await prisma.templateInstanceRow.count({
      where: { templateInstanceId: instanceB.id },
    })
    assert(statsB === 0, `S: Instance B has 0 rows (got: ${statsB})`)
  } finally {
    // Cleanup
    console.log('\n' + '─'.repeat(80))
    console.log('  CLEANUP')
    console.log('─'.repeat(80))

    await prisma.templateInstanceRow.deleteMany({
      where: { templateInstanceId: { in: [instanceA.id, instanceB.id] } },
    })
    await prisma.templateInstance.deleteMany({
      where: { id: { in: [instanceA.id, instanceB.id] } },
    })
    console.log('  Deleted test instances and rows')
  }

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
    Part 1 — rowKeyField Handling:
      A: Normal extraction               ✓
      B: null → auto key                 ✓
      C: Empty string → auto key         ✓
      D: Missing field → auto key        ✓
      E: Numeric → stringified           ✓
      F: Unique auto keys                ✓

    Part 2 — mergeFieldValues:
      G: null → value (overwrite)        ✓
      H: empty → value (overwrite)       ✓
      I: undefined → value (overwrite)   ✓
      J: value → value (keep existing)   ✓
      K: Zero preserved (not overwritten)✓
      L: false preserved                 ✓
      M: Multi-field mixed merge         ✓
      N: New key addition                ✓

    Part 3 — Re-match Cleanup (DB):
      O: Create row (1 doc)              ✓
      P: Cleanup sole doc → delete row   ✓
      Q: Create row (2 docs)             ✓
      R: Cleanup 1/2 → update row        ✓
      S: Statistics verification         ✓
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
