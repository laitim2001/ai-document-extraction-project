/**
 * @fileoverview Template Matching Test Data Preparation
 * @description
 *   Prepares test data for template matching validation:
 *   1. Selects 5 documents and assigns them to DHL Express company
 *   2. Populates ExtractionResult.fieldMappings with simulated data
 *   3. Upserts global_default_template_id in SystemConfig
 *
 * @usage npx tsx scripts/test-template-matching/02-prepare-test-data.ts
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// ============================================================================
// Test Data Definitions
// ============================================================================

interface FieldEntry {
  value: string
  rawValue: string
  confidence: number
  source: string
}

function field(value: string, confidence = 90): FieldEntry {
  return {
    value,
    rawValue: value,
    confidence,
    source: 'gpt',
  }
}

/**
 * Simulated fieldMappings for 5 test documents.
 * Note: `shipment_no` is included alongside `tracking_number` because the
 * matching engine uses `shipment_no` as the default rowKeyField.
 * Doc 1 & Doc 2 share shipment_no="SHIP-001" to test row merging.
 */
const TEST_FIELD_MAPPINGS: Record<string, FieldEntry>[] = [
  // Document 1
  {
    invoice_number: field('INV-2026-001'),
    tracking_number: field('SHIP-001'),
    shipment_no: field('SHIP-001'),
    total_amount: field('1250.00'),
    currency: field('USD'),
    vendor_name: field('DHL Express'),
    invoice_date: field('2026-02-10'),
    vendor_code: field('DHL-001'),
    subtotal: field('1200.00'),
    tax_amount: field('50.00'),
    due_date: field('2026-03-10'),
    po_number: field('PO-2026-001'),
    description: field('Ocean Freight'),
  },
  // Document 2 — same shipment_no as Doc 1 for merge test
  {
    invoice_number: field('INV-2026-002'),
    tracking_number: field('SHIP-001'),
    shipment_no: field('SHIP-001'),
    total_amount: field('800.00'),
    currency: field('USD'),
    vendor_name: field('DHL Express'),
    invoice_date: field('2026-02-10'),
    vendor_code: field('DHL-001'),
    subtotal: field('750.00'),
    tax_amount: field('50.00'),
    due_date: field('2026-03-10'),
    po_number: field('PO-2026-002'),
    description: field('Air Freight'),
  },
  // Document 3
  {
    invoice_number: field('INV-2026-003'),
    tracking_number: field('SHIP-002'),
    shipment_no: field('SHIP-002'),
    total_amount: field('2100.00'),
    currency: field('EUR'),
    vendor_name: field('DHL Express'),
    invoice_date: field('2026-02-11'),
    vendor_code: field('DHL-001'),
    subtotal: field('2000.00'),
    tax_amount: field('100.00'),
    due_date: field('2026-03-11'),
    po_number: field('PO-2026-003'),
    description: field('Ocean Freight LCL'),
  },
  // Document 4
  {
    invoice_number: field('INV-2026-004'),
    tracking_number: field('SHIP-003'),
    shipment_no: field('SHIP-003'),
    total_amount: field('950.00'),
    currency: field('USD'),
    vendor_name: field('DHL Express'),
    invoice_date: field('2026-02-11'),
    vendor_code: field('DHL-001'),
    subtotal: field('900.00'),
    tax_amount: field('50.00'),
    due_date: field('2026-03-11'),
    po_number: field('PO-2026-004'),
    description: field('Customs Brokerage'),
  },
  // Document 5
  {
    invoice_number: field('INV-2026-005'),
    tracking_number: field('SHIP-004'),
    shipment_no: field('SHIP-004'),
    total_amount: field('3200.00'),
    currency: field('USD'),
    vendor_name: field('DHL Express'),
    invoice_date: field('2026-02-12'),
    vendor_code: field('DHL-001'),
    subtotal: field('3000.00'),
    tax_amount: field('200.00'),
    due_date: field('2026-03-12'),
    po_number: field('PO-2026-005'),
    description: field('FCL Container Shipping'),
  },
]

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('='.repeat(80))
  console.log('  TEMPLATE MATCHING TEST DATA PREPARATION')
  console.log('  Started:', new Date().toISOString())
  console.log('='.repeat(80))

  // ─── Step 1: Query 5 document IDs ──────────────────────────────────
  console.log('\n[Step 1] Querying 5 documents...')

  const documents = await prisma.document.findMany({
    select: { id: true, fileName: true, companyId: true },
    take: 5,
    orderBy: { createdAt: 'asc' },
  })

  if (documents.length < 5) {
    console.error(`  ERROR: Only found ${documents.length} documents, need at least 5.`)
    process.exit(1)
  }

  const testDocumentIds = documents.map((d) => d.id)
  console.log('  Selected documents:')
  for (const doc of documents) {
    console.log(`    ${doc.id} — ${doc.fileName} (companyId: ${doc.companyId ?? 'null'})`)
  }

  // ─── Step 2: Query DHL Express companyId ───────────────────────────
  console.log('\n[Step 2] Finding DHL Express company...')

  const dhlCompany = await prisma.company.findFirst({
    where: {
      OR: [
        { name: { contains: 'DHL', mode: 'insensitive' } },
        { displayName: { contains: 'DHL', mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, displayName: true, defaultTemplateId: true },
  })

  if (!dhlCompany) {
    console.error('  ERROR: DHL Express company not found.')
    process.exit(1)
  }

  console.log(`  Found: ${dhlCompany.displayName ?? dhlCompany.name} (id: ${dhlCompany.id})`)
  console.log(`  defaultTemplateId: ${dhlCompany.defaultTemplateId ?? '(null)'}`)

  // ─── Step 3: Update companyId on 5 documents ──────────────────────
  console.log('\n[Step 3] Updating companyId on 5 documents...')

  const updateResult = await prisma.document.updateMany({
    where: { id: { in: testDocumentIds } },
    data: { companyId: dhlCompany.id },
  })

  console.log(`  Updated ${updateResult.count} documents with companyId = ${dhlCompany.id}`)

  // ─── Step 4: Update ExtractionResult.fieldMappings ─────────────────
  console.log('\n[Step 4] Updating ExtractionResult.fieldMappings...')

  // Also need to clear templateInstanceId to avoid "already matched" skip
  await prisma.document.updateMany({
    where: { id: { in: testDocumentIds } },
    data: {
      templateInstanceId: null,
      templateMatchedAt: null,
    },
  })
  console.log('  Cleared templateInstanceId/templateMatchedAt on all 5 documents.')

  for (let i = 0; i < testDocumentIds.length; i++) {
    const docId = testDocumentIds[i]
    const fieldMappings = TEST_FIELD_MAPPINGS[i]

    // Upsert ExtractionResult
    const existing = await prisma.extractionResult.findUnique({
      where: { documentId: docId },
      select: { id: true },
    })

    if (existing) {
      await prisma.extractionResult.update({
        where: { documentId: docId },
        data: {
          fieldMappings: fieldMappings as unknown as Record<string, unknown>,
          status: 'COMPLETED',
        },
      })
      console.log(`  [${i + 1}/5] Updated ExtractionResult for ${docId}`)
    } else {
      await prisma.extractionResult.create({
        data: {
          documentId: docId,
          fieldMappings: fieldMappings as unknown as Record<string, unknown>,
          rawText: 'Test data for template matching',
          status: 'COMPLETED',
          processingTime: 0,
        },
      })
      console.log(`  [${i + 1}/5] Created ExtractionResult for ${docId}`)
    }
  }

  // ─── Step 5: Upsert global_default_template_id ────────────────────
  console.log('\n[Step 5] Upserting global_default_template_id in SystemConfig...')

  const templateId = 'erp-standard-import'

  // Verify the template exists
  const template = await prisma.dataTemplate.findUnique({
    where: { id: templateId },
    select: { id: true, name: true },
  })

  if (!template) {
    console.error(`  ERROR: DataTemplate "${templateId}" not found.`)
    process.exit(1)
  }

  console.log(`  Template found: ${template.name} (id: ${template.id})`)

  await prisma.systemConfig.upsert({
    where: { key: 'global_default_template_id' },
    update: {
      value: JSON.stringify({ templateId }),
      updatedAt: new Date(),
    },
    create: {
      key: 'global_default_template_id',
      value: JSON.stringify({ templateId }),
      category: 'SYSTEM',
      name: 'Global Default Data Template',
      description: 'System-wide default data template ID for auto-matching',
    },
  })

  console.log(`  Upserted SystemConfig: global_default_template_id = ${templateId}`)

  // ─── Step 6: Clean up any existing TemplateInstance DRAFT ──────────
  console.log('\n[Step 6] Cleaning up existing DRAFT TemplateInstances...')

  const existingDrafts = await prisma.templateInstance.findMany({
    where: {
      dataTemplateId: templateId,
      status: 'DRAFT',
    },
    select: { id: true, name: true, _count: { select: { rows: true } } },
  })

  if (existingDrafts.length > 0) {
    for (const draft of existingDrafts) {
      // Delete rows first (cascade should handle this, but be explicit)
      await prisma.templateInstanceRow.deleteMany({
        where: { templateInstanceId: draft.id },
      })
      await prisma.templateInstance.delete({
        where: { id: draft.id },
      })
      console.log(`  Deleted DRAFT instance: ${draft.id} (${draft.name}, ${draft._count.rows} rows)`)
    }
  } else {
    console.log('  No existing DRAFT instances to clean up.')
  }

  // ─── Summary ──────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(80))
  console.log('  PREPARATION COMPLETE')
  console.log('='.repeat(80))
  console.log(`
  Test Document IDs:
    [0] ${testDocumentIds[0]}
    [1] ${testDocumentIds[1]}
    [2] ${testDocumentIds[2]}
    [3] ${testDocumentIds[3]}
    [4] ${testDocumentIds[4]}

  Company: ${dhlCompany.displayName ?? dhlCompany.name} (${dhlCompany.id})
  Template: ${template.name} (${template.id})
  Global Default: ${templateId}

  Field Mappings: 5 documents updated with simulated data
  Merge Test: Doc 0 & Doc 1 share shipment_no="SHIP-001"
  `)

  // Output document IDs as JSON for the next script
  console.log('  [DOCUMENT_IDS_JSON]')
  console.log('  ' + JSON.stringify(testDocumentIds))
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
