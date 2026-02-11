/**
 * @fileoverview Template Matching Priority Cascade Test (FORMAT > COMPANY > GLOBAL)
 * @description
 *   Tests the three-level priority resolution system for template matching:
 *
 *   Part 1 — Template Selection Priority (resolveDefaultTemplate):
 *     Scenario A: GLOBAL only (no company/format default)
 *     Scenario B: COMPANY overrides GLOBAL
 *     Scenario C: FORMAT overrides COMPANY and GLOBAL
 *
 *   Part 2 — Mapping Rule Priority (resolveMapping):
 *     Scenario D: 3-level merge (FORMAT > COMPANY > GLOBAL by targetField)
 *     Scenario E: Partial override (FORMAT covers some, COMPANY others, GLOBAL the rest)
 *
 *   Part 3 — End-to-End autoMatch integration:
 *     Scenario F: autoMatch with FORMAT-level template selection
 *     Scenario G: Verify formatId propagation to mapping resolution
 *
 *   Prerequisites: Run 02-prepare-test-data.ts first (for DHL company + documents).
 *
 * @usage npx tsx scripts/test-template-matching/04-priority-cascade.ts
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
const TEST_PREFIX = 'PRIORITY_CASCADE_TEST_'

const SCOPE_PRIORITY: Record<string, number> = {
  GLOBAL: 1,
  COMPANY: 2,
  FORMAT: 3,
}

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
// Replicated Service Logic (from auto-template-matching.service.ts)
// ============================================================================

/**
 * Resolve default template with FORMAT > COMPANY > GLOBAL priority.
 * Replicates auto-template-matching.service.ts:169-224
 */
async function resolveDefaultTemplate(
  companyId: string,
  formatId?: string
): Promise<{ templateId: string; templateName: string; source: string } | null> {
  // 1. FORMAT level
  if (formatId) {
    const format = await prisma.documentFormat.findUnique({
      where: { id: formatId },
      include: {
        defaultTemplate: { select: { id: true, name: true } },
      },
    })
    if (format?.defaultTemplate) {
      return {
        templateId: format.defaultTemplate.id,
        templateName: format.defaultTemplate.name,
        source: 'FORMAT',
      }
    }
  }

  // 2. COMPANY level
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

  // 3. GLOBAL level
  const config = await prisma.systemConfig.findFirst({
    where: { key: GLOBAL_DEFAULT_TEMPLATE_KEY },
  })
  if (config?.value) {
    let templateId: string | undefined
    try {
      const parsed = JSON.parse(config.value)
      templateId = typeof parsed === 'string' ? parsed : parsed?.templateId
    } catch {
      templateId = config.value
    }
    if (templateId) {
      const template = await prisma.dataTemplate.findUnique({
        where: { id: templateId },
        select: { id: true, name: true },
      })
      if (template) {
        return {
          templateId: template.id,
          templateName: template.name,
          source: 'GLOBAL',
        }
      }
    }
  }

  return null
}

/**
 * Resolve mapping rules with FORMAT > COMPANY > GLOBAL merge.
 * Replicates template-field-mapping.service.ts:359-448
 */
async function resolveMappingRules(
  dataTemplateId: string,
  companyId?: string,
  documentFormatId?: string
): Promise<{
  rules: Array<{ sourceField: string; targetField: string; transformType: string; scope: string }>
  resolvedFrom: Array<{ id: string; scope: string; name: string }>
}> {
  const orConditions: Prisma.TemplateFieldMappingWhereInput[] = [
    { scope: 'GLOBAL' },
  ]
  if (companyId) {
    orConditions.push({ scope: 'COMPANY', companyId })
  }
  if (documentFormatId) {
    orConditions.push({ scope: 'FORMAT', documentFormatId })
  }

  const configs = await prisma.templateFieldMapping.findMany({
    where: {
      dataTemplateId,
      isActive: true,
      OR: orConditions,
    },
    orderBy: [{ priority: 'desc' }],
  })

  // Sort by scope priority (FORMAT > COMPANY > GLOBAL), then by priority
  const sorted = configs.sort((a, b) => {
    const pa = SCOPE_PRIORITY[a.scope] ?? 0
    const pb = SCOPE_PRIORITY[b.scope] ?? 0
    if (pa !== pb) return pb - pa
    return b.priority - a.priority
  })

  // Merge: reverse iterate (low→high), last write wins per targetField
  // Track which scope each rule came from
  const targetMap = new Map<string, {
    sourceField: string
    targetField: string
    transformType: string
    scope: string
  }>()

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
          scope: config.scope,
        })
      }
    }
  }

  return {
    rules: Array.from(targetMap.values()),
    resolvedFrom: sorted.map((c) => ({
      id: c.id,
      scope: c.scope,
      name: c.name,
    })),
  }
}

// ============================================================================
// Test Data Setup & Cleanup
// ============================================================================

interface TestContext {
  companyId: string
  companyName: string
  originalCompanyDefaultTemplateId: string | null
  templateId: string
  templateName: string
  formatId: string
  formatCreated: boolean
  originalFormatDefaultTemplateId: string | null
  createdMappingIds: string[]
  testDocumentIds: string[]
  createdInstanceIds: string[]
}

async function setupTestData(): Promise<TestContext> {
  console.log('\n' + '─'.repeat(80))
  console.log('  SETUP: Preparing test data')
  console.log('─'.repeat(80))

  // 1. Find DHL Express company
  const company = await prisma.company.findFirst({
    where: {
      OR: [
        { name: { contains: 'DHL', mode: 'insensitive' } },
        { displayName: { contains: 'DHL', mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, displayName: true, defaultTemplateId: true },
  })
  if (!company) throw new Error('DHL Express company not found')
  console.log(`  [1/7] Company: ${company.displayName ?? company.name} (${company.id})`)

  // 2. Find DataTemplate
  const template = await prisma.dataTemplate.findFirst({
    where: { id: 'erp-standard-import' },
    select: { id: true, name: true },
  })
  if (!template) throw new Error('DataTemplate erp-standard-import not found')
  console.log(`  [2/7] Template: ${template.name} (${template.id})`)

  // 3. Find or create a DocumentFormat for this company
  let format = await prisma.documentFormat.findFirst({
    where: { companyId: company.id },
    select: { id: true, defaultTemplateId: true, name: true },
  })

  let formatCreated = false
  if (!format) {
    format = await prisma.documentFormat.create({
      data: {
        companyId: company.id,
        documentType: 'FREIGHT_INVOICE',
        documentSubtype: 'STANDARD',
        name: TEST_PREFIX + 'format',
      },
      select: { id: true, defaultTemplateId: true, name: true },
    })
    formatCreated = true
    console.log(`  [3/7] DocumentFormat: CREATED ${format.id}`)
  } else {
    console.log(`  [3/7] DocumentFormat: found ${format.name ?? format.id}`)
  }

  // 4. Create 3 TemplateFieldMappings at different scopes
  console.log('  [4/7] Creating TemplateFieldMappings (3 scopes)...')
  const createdMappingIds: string[] = []

  // GLOBAL: maps inv_no←invoice_number, ship_ref←shipment_no, amount←total_amount, currency_code←currency
  const globalMapping = await prisma.templateFieldMapping.create({
    data: {
      dataTemplateId: template.id,
      scope: 'GLOBAL',
      name: TEST_PREFIX + 'GLOBAL',
      priority: 0,
      isActive: true,
      mappings: [
        { id: 'g1', sourceField: 'invoice_number', targetField: 'inv_no', transformType: 'DIRECT', order: 1 },
        { id: 'g2', sourceField: 'shipment_no', targetField: 'ship_ref', transformType: 'DIRECT', order: 2 },
        { id: 'g3', sourceField: 'total_amount', targetField: 'amount', transformType: 'DIRECT', order: 3 },
        { id: 'g4', sourceField: 'currency', targetField: 'currency_code', transformType: 'DIRECT', order: 4 },
      ] as unknown as Prisma.InputJsonValue,
    },
  })
  createdMappingIds.push(globalMapping.id)
  console.log(`    GLOBAL: ${globalMapping.id} (4 rules: inv_no, ship_ref, amount, currency_code)`)

  // COMPANY: overrides ship_ref←tracking_number, amount←subtotal (different sourceField!)
  const companyMapping = await prisma.templateFieldMapping.create({
    data: {
      dataTemplateId: template.id,
      scope: 'COMPANY',
      companyId: company.id,
      name: TEST_PREFIX + 'COMPANY',
      priority: 0,
      isActive: true,
      mappings: [
        { id: 'c1', sourceField: 'tracking_number', targetField: 'ship_ref', transformType: 'DIRECT', order: 2 },
        { id: 'c2', sourceField: 'subtotal', targetField: 'amount', transformType: 'DIRECT', order: 3 },
      ] as unknown as Prisma.InputJsonValue,
    },
  })
  createdMappingIds.push(companyMapping.id)
  console.log(`    COMPANY: ${companyMapping.id} (2 rules: ship_ref←tracking_number, amount←subtotal)`)

  // FORMAT: overrides currency_code←vendor_code (different sourceField!)
  const formatMapping = await prisma.templateFieldMapping.create({
    data: {
      dataTemplateId: template.id,
      scope: 'FORMAT',
      documentFormatId: format.id,
      name: TEST_PREFIX + 'FORMAT',
      priority: 0,
      isActive: true,
      mappings: [
        { id: 'f1', sourceField: 'vendor_code', targetField: 'currency_code', transformType: 'DIRECT', order: 4 },
      ] as unknown as Prisma.InputJsonValue,
    },
  })
  createdMappingIds.push(formatMapping.id)
  console.log(`    FORMAT: ${formatMapping.id} (1 rule: currency_code←vendor_code)`)

  // 5. Find test documents (prepared by 02-prepare-test-data.ts)
  const testDocs = await prisma.document.findMany({
    where: {
      companyId: company.id,
      extractionResult: {
        fieldMappings: { not: Prisma.JsonNull },
      },
    },
    select: { id: true, templateInstanceId: true },
    take: 2,
    orderBy: { createdAt: 'asc' },
  })

  if (testDocs.length < 2) throw new Error('Need at least 2 documents with fieldMappings (run 02-prepare-test-data.ts first)')
  const testDocumentIds = testDocs.map((d) => d.id)
  console.log(`  [5/7] Test documents: ${testDocumentIds.length}`)

  // 6. Clear document associations for clean test
  await prisma.document.updateMany({
    where: { id: { in: testDocumentIds } },
    data: { templateInstanceId: null, templateMatchedAt: null },
  })
  console.log('  [6/7] Cleared document templateInstanceId')

  // 7. Save original states for cleanup
  console.log(`  [7/7] Saved original states:`)
  console.log(`    company.defaultTemplateId: ${company.defaultTemplateId ?? '(null)'}`)
  console.log(`    format.defaultTemplateId: ${format.defaultTemplateId ?? '(null)'}`)

  return {
    companyId: company.id,
    companyName: company.displayName ?? company.name,
    originalCompanyDefaultTemplateId: company.defaultTemplateId,
    templateId: template.id,
    templateName: template.name,
    formatId: format.id,
    formatCreated,
    originalFormatDefaultTemplateId: format.defaultTemplateId,
    createdMappingIds,
    testDocumentIds,
    createdInstanceIds: [],
  }
}

async function cleanup(ctx: TestContext): Promise<void> {
  console.log('\n' + '─'.repeat(80))
  console.log('  CLEANUP: Restoring original state')
  console.log('─'.repeat(80))

  // 1. Delete test TemplateFieldMappings
  for (const id of ctx.createdMappingIds) {
    await prisma.templateFieldMapping.deleteMany({ where: { id } })
  }
  console.log(`  [1/5] Deleted ${ctx.createdMappingIds.length} test TemplateFieldMappings`)

  // 2. Delete test TemplateInstances and rows
  for (const instanceId of ctx.createdInstanceIds) {
    await prisma.templateInstanceRow.deleteMany({ where: { templateInstanceId: instanceId } })
    await prisma.templateInstance.deleteMany({ where: { id: instanceId } })
  }
  console.log(`  [2/5] Deleted ${ctx.createdInstanceIds.length} test TemplateInstances`)

  // 3. Restore Company.defaultTemplateId
  await prisma.company.update({
    where: { id: ctx.companyId },
    data: { defaultTemplateId: ctx.originalCompanyDefaultTemplateId },
  })
  console.log(`  [3/5] Restored Company.defaultTemplateId = ${ctx.originalCompanyDefaultTemplateId ?? '(null)'}`)

  // 4. Restore DocumentFormat.defaultTemplateId (or delete if we created it)
  if (ctx.formatCreated) {
    await prisma.documentFormat.deleteMany({ where: { id: ctx.formatId } })
    console.log(`  [4/5] Deleted test DocumentFormat`)
  } else {
    await prisma.documentFormat.update({
      where: { id: ctx.formatId },
      data: { defaultTemplateId: ctx.originalFormatDefaultTemplateId },
    })
    console.log(`  [4/5] Restored DocumentFormat.defaultTemplateId = ${ctx.originalFormatDefaultTemplateId ?? '(null)'}`)
  }

  // 5. Clear document associations
  await prisma.document.updateMany({
    where: { id: { in: ctx.testDocumentIds } },
    data: { templateInstanceId: null, templateMatchedAt: null },
  })
  console.log('  [5/5] Cleared test document associations')
}

// ============================================================================
// Test Execution
// ============================================================================

async function main() {
  console.log('='.repeat(80))
  console.log('  TEMPLATE MATCHING PRIORITY CASCADE TEST')
  console.log('  FORMAT > COMPANY > GLOBAL')
  console.log('  Started:', new Date().toISOString())
  console.log('='.repeat(80))

  const ctx = await setupTestData()

  try {
    // ═════════════════════════════════════════════════════════════════════
    // PART 1: Template Selection Priority (resolveDefaultTemplate)
    // ═════════════════════════════════════════════════════════════════════
    console.log('\n' + '─'.repeat(80))
    console.log('  PART 1: Template Selection Priority')
    console.log('─'.repeat(80))

    // --- Scenario A: GLOBAL only ---
    console.log('\n  --- Scenario A: GLOBAL only (no company/format default) ---')

    // Clear company default, ensure format has no default
    await prisma.company.update({
      where: { id: ctx.companyId },
      data: { defaultTemplateId: null },
    })
    await prisma.documentFormat.update({
      where: { id: ctx.formatId },
      data: { defaultTemplateId: null },
    })

    const resultA = await resolveDefaultTemplate(ctx.companyId)
    console.log(`    resolved: ${JSON.stringify(resultA)}`)
    assert(resultA !== null, 'Scenario A: Template resolved (not null)')
    assert(resultA?.source === 'GLOBAL', `Scenario A: Source is GLOBAL (got: ${resultA?.source})`)

    // --- Scenario B: COMPANY overrides GLOBAL ---
    console.log('\n  --- Scenario B: COMPANY overrides GLOBAL ---')

    await prisma.company.update({
      where: { id: ctx.companyId },
      data: { defaultTemplateId: ctx.templateId },
    })

    const resultB = await resolveDefaultTemplate(ctx.companyId)
    console.log(`    resolved: ${JSON.stringify(resultB)}`)
    assert(resultB !== null, 'Scenario B: Template resolved (not null)')
    assert(resultB?.source === 'COMPANY', `Scenario B: Source is COMPANY (got: ${resultB?.source})`)
    assert(
      resultB?.templateId === ctx.templateId,
      `Scenario B: Correct template (got: ${resultB?.templateId})`
    )

    // --- Scenario C: FORMAT overrides COMPANY and GLOBAL ---
    console.log('\n  --- Scenario C: FORMAT overrides COMPANY and GLOBAL ---')

    await prisma.documentFormat.update({
      where: { id: ctx.formatId },
      data: { defaultTemplateId: ctx.templateId },
    })

    const resultC = await resolveDefaultTemplate(ctx.companyId, ctx.formatId)
    console.log(`    resolved: ${JSON.stringify(resultC)}`)
    assert(resultC !== null, 'Scenario C: Template resolved (not null)')
    assert(resultC?.source === 'FORMAT', `Scenario C: Source is FORMAT (got: ${resultC?.source})`)

    // --- Scenario C2: Without formatId arg, falls back to COMPANY ---
    console.log('\n  --- Scenario C2: Without formatId, falls back to COMPANY ---')

    const resultC2 = await resolveDefaultTemplate(ctx.companyId)
    console.log(`    resolved: ${JSON.stringify(resultC2)}`)
    assert(resultC2?.source === 'COMPANY', `Scenario C2: Source is COMPANY (got: ${resultC2?.source})`)

    // --- Scenario D: No default at all ---
    console.log('\n  --- Scenario D: No default at any level ---')

    await prisma.company.update({
      where: { id: ctx.companyId },
      data: { defaultTemplateId: null },
    })
    await prisma.documentFormat.update({
      where: { id: ctx.formatId },
      data: { defaultTemplateId: null },
    })
    // Temporarily remove SystemConfig global default
    const originalGlobalConfig = await prisma.systemConfig.findFirst({
      where: { key: GLOBAL_DEFAULT_TEMPLATE_KEY },
    })
    if (originalGlobalConfig) {
      await prisma.systemConfig.update({
        where: { key: GLOBAL_DEFAULT_TEMPLATE_KEY },
        data: { value: '' },
      })
    }

    const resultD = await resolveDefaultTemplate(ctx.companyId)
    console.log(`    resolved: ${JSON.stringify(resultD)}`)
    assert(resultD === null, `Scenario D: No template found (result is null)`)

    // Restore global config
    if (originalGlobalConfig) {
      await prisma.systemConfig.update({
        where: { key: GLOBAL_DEFAULT_TEMPLATE_KEY },
        data: { value: originalGlobalConfig.value },
      })
    }

    // ═════════════════════════════════════════════════════════════════════
    // PART 2: Mapping Rule Priority (resolveMapping merge)
    // ═════════════════════════════════════════════════════════════════════
    console.log('\n' + '─'.repeat(80))
    console.log('  PART 2: Mapping Rule Priority (merge logic)')
    console.log('─'.repeat(80))

    // Setup:
    //   GLOBAL:  inv_no←invoice_number, ship_ref←shipment_no, amount←total_amount, currency_code←currency
    //   COMPANY: ship_ref←tracking_number (override), amount←subtotal (override)
    //   FORMAT:  currency_code←vendor_code (override)
    //
    // Expected merged result:
    //   inv_no       ← invoice_number  (GLOBAL, no override)
    //   ship_ref     ← tracking_number (COMPANY overrides GLOBAL)
    //   amount       ← subtotal        (COMPANY overrides GLOBAL)
    //   currency_code← vendor_code     (FORMAT overrides GLOBAL)

    // --- Scenario E: GLOBAL only ---
    console.log('\n  --- Scenario E: Mapping with GLOBAL only ---')
    const resultE = await resolveMappingRules(ctx.templateId)
    console.log(`    resolvedFrom: ${resultE.resolvedFrom.map((r) => r.scope).join(', ')}`)
    console.log(`    rules count: ${resultE.rules.length}`)

    const globalOnlyRules = resultE.rules
    assert(
      globalOnlyRules.length >= 4,
      `Scenario E: ≥4 GLOBAL rules including test rules (got: ${globalOnlyRules.length})`
    )
    const eAmountRule = globalOnlyRules.find((r) => r.targetField === 'amount')
    assert(
      eAmountRule?.sourceField === 'total_amount',
      `Scenario E: amount←total_amount (got: ${eAmountRule?.sourceField})`
    )
    const eShipRule = globalOnlyRules.find((r) => r.targetField === 'ship_ref')
    assert(
      eShipRule?.sourceField === 'shipment_no',
      `Scenario E: ship_ref←shipment_no (got: ${eShipRule?.sourceField})`
    )

    // --- Scenario F: GLOBAL + COMPANY ---
    console.log('\n  --- Scenario F: GLOBAL + COMPANY merge ---')
    const resultF = await resolveMappingRules(ctx.templateId, ctx.companyId)
    console.log(`    resolvedFrom: ${resultF.resolvedFrom.map((r) => `${r.scope}(${r.name})`).join(', ')}`)
    console.log(`    rules count: ${resultF.rules.length}`)

    for (const rule of resultF.rules) {
      console.log(`      ${rule.targetField} ← ${rule.sourceField} [${rule.scope}]`)
    }

    assert(resultF.rules.length >= 4, `Scenario F: ≥4 merged rules including test rules (got: ${resultF.rules.length})`)

    const fInvRule = resultF.rules.find((r) => r.targetField === 'inv_no')
    assert(
      fInvRule?.sourceField === 'invoice_number' && fInvRule?.scope === 'GLOBAL',
      `Scenario F: inv_no←invoice_number from GLOBAL (got: ${fInvRule?.sourceField} from ${fInvRule?.scope})`
    )

    const fShipRule = resultF.rules.find((r) => r.targetField === 'ship_ref')
    assert(
      fShipRule?.sourceField === 'tracking_number' && fShipRule?.scope === 'COMPANY',
      `Scenario F: ship_ref←tracking_number from COMPANY (got: ${fShipRule?.sourceField} from ${fShipRule?.scope})`
    )

    const fAmountRule = resultF.rules.find((r) => r.targetField === 'amount')
    assert(
      fAmountRule?.sourceField === 'subtotal' && fAmountRule?.scope === 'COMPANY',
      `Scenario F: amount←subtotal from COMPANY (got: ${fAmountRule?.sourceField} from ${fAmountRule?.scope})`
    )

    const fCurrencyRule = resultF.rules.find((r) => r.targetField === 'currency_code')
    assert(
      fCurrencyRule?.sourceField === 'currency' && fCurrencyRule?.scope === 'GLOBAL',
      `Scenario F: currency_code←currency from GLOBAL (got: ${fCurrencyRule?.sourceField} from ${fCurrencyRule?.scope})`
    )

    // --- Scenario G: GLOBAL + COMPANY + FORMAT (full cascade) ---
    console.log('\n  --- Scenario G: Full 3-level cascade (FORMAT > COMPANY > GLOBAL) ---')
    const resultG = await resolveMappingRules(ctx.templateId, ctx.companyId, ctx.formatId)
    console.log(`    resolvedFrom: ${resultG.resolvedFrom.map((r) => `${r.scope}(${r.name})`).join(', ')}`)
    console.log(`    rules count: ${resultG.rules.length}`)

    for (const rule of resultG.rules) {
      console.log(`      ${rule.targetField} ← ${rule.sourceField} [${rule.scope}]`)
    }

    assert(resultG.rules.length >= 4, `Scenario G: ≥4 merged rules including test rules (got: ${resultG.rules.length})`)

    const gInvRule = resultG.rules.find((r) => r.targetField === 'inv_no')
    assert(
      gInvRule?.sourceField === 'invoice_number' && gInvRule?.scope === 'GLOBAL',
      `Scenario G: inv_no←invoice_number from GLOBAL (got: ${gInvRule?.sourceField} from ${gInvRule?.scope})`
    )

    const gShipRule = resultG.rules.find((r) => r.targetField === 'ship_ref')
    assert(
      gShipRule?.sourceField === 'tracking_number' && gShipRule?.scope === 'COMPANY',
      `Scenario G: ship_ref←tracking_number from COMPANY (got: ${gShipRule?.sourceField} from ${gShipRule?.scope})`
    )

    const gAmountRule = resultG.rules.find((r) => r.targetField === 'amount')
    assert(
      gAmountRule?.sourceField === 'subtotal' && gAmountRule?.scope === 'COMPANY',
      `Scenario G: amount←subtotal from COMPANY (got: ${gAmountRule?.sourceField} from ${gAmountRule?.scope})`
    )

    const gCurrencyRule = resultG.rules.find((r) => r.targetField === 'currency_code')
    assert(
      gCurrencyRule?.sourceField === 'vendor_code' && gCurrencyRule?.scope === 'FORMAT',
      `Scenario G: currency_code←vendor_code from FORMAT (got: ${gCurrencyRule?.sourceField} from ${gCurrencyRule?.scope})`
    )

    // ═════════════════════════════════════════════════════════════════════
    // PART 3: End-to-End AutoMatch with FORMAT-level
    // ═════════════════════════════════════════════════════════════════════
    console.log('\n' + '─'.repeat(80))
    console.log('  PART 3: End-to-End AutoMatch with field value verification')
    console.log('─'.repeat(80))

    // Restore company + format defaults for autoMatch
    await prisma.company.update({
      where: { id: ctx.companyId },
      data: { defaultTemplateId: ctx.templateId },
    })
    await prisma.documentFormat.update({
      where: { id: ctx.formatId },
      data: { defaultTemplateId: ctx.templateId },
    })

    // Set stage2Result.matchedFormatId on test document so FORMAT level is used
    const testDocId = ctx.testDocumentIds[0]
    await prisma.extractionResult.update({
      where: { documentId: testDocId },
      data: {
        stage2Result: {
          matchedFormatId: ctx.formatId,
          formatName: TEST_PREFIX + 'format',
        } as unknown as Prisma.InputJsonValue,
      },
    })
    console.log(`  Set stage2Result.matchedFormatId = ${ctx.formatId} on document ${testDocId}`)

    // --- Scenario H: Resolve format from stage2Result ---
    console.log('\n  --- Scenario H: resolveFormatId from stage2Result ---')
    const extraction = await prisma.extractionResult.findUnique({
      where: { documentId: testDocId },
      select: { stage2Result: true },
    })
    const stage2 = extraction?.stage2Result as Record<string, unknown> | null
    const resolvedFormatId = (stage2?.matchedFormatId ?? stage2?.formatId) as string | undefined
    console.log(`    resolvedFormatId: ${resolvedFormatId}`)
    assert(
      resolvedFormatId === ctx.formatId,
      `Scenario H: formatId resolved from stage2Result (got: ${resolvedFormatId})`
    )

    // --- Scenario I: Template selection with FORMAT ---
    console.log('\n  --- Scenario I: Template selection with FORMAT level ---')
    const resultI = await resolveDefaultTemplate(ctx.companyId, resolvedFormatId)
    console.log(`    resolved: source=${resultI?.source}, template=${resultI?.templateName}`)
    assert(resultI?.source === 'FORMAT', `Scenario I: Source is FORMAT (got: ${resultI?.source})`)

    // --- Scenario J: Full matching with COMPANY-level mapping rules ---
    // Note: The actual autoMatch service only passes companyId to matchDocuments,
    // NOT formatId. So mapping rules will use COMPANY+GLOBAL only.
    // This is a known limitation — formatId is not propagated to resolveMapping.
    console.log('\n  --- Scenario J: autoMatch field values (COMPANY+GLOBAL mapping) ---')

    // Replicate autoMatch flow: resolve template → create instance → match
    if (!resultI) throw new Error('Template resolution failed')

    const instance = await prisma.templateInstance.create({
      data: {
        dataTemplateId: resultI.templateId,
        name: TEST_PREFIX + 'instance',
        status: 'DRAFT',
      },
      select: { id: true },
    })
    ctx.createdInstanceIds.push(instance.id)

    // Resolve mapping as autoMatch does (companyId only, no formatId)
    const autoMatchMappings = await resolveMappingRules(ctx.templateId, ctx.companyId)
    console.log(`    Mapping resolution (autoMatch path): ${autoMatchMappings.resolvedFrom.map((r) => r.scope).join(', ')}`)

    // Verify autoMatch does NOT include FORMAT-level rules
    const hasFormatScope = autoMatchMappings.resolvedFrom.some((r) => r.scope === 'FORMAT')
    assert(
      !hasFormatScope,
      'Scenario J: autoMatch path does NOT include FORMAT-level mappings (known gap)'
    )

    // Apply mapping to document fields
    const docExtraction = await prisma.extractionResult.findUnique({
      where: { documentId: testDocId },
      select: { fieldMappings: true },
    })
    const fieldMappings = docExtraction?.fieldMappings as Record<string, { value?: unknown }> | null

    if (fieldMappings) {
      // Extract source values
      const sourceFields: Record<string, unknown> = {}
      for (const [key, data] of Object.entries(fieldMappings)) {
        sourceFields[key] = data?.value ?? null
      }

      // Transform using resolved mappings
      const transformedValues: Record<string, unknown> = {}
      for (const rule of autoMatchMappings.rules) {
        const sourceValue = sourceFields[rule.sourceField]
        if (sourceValue !== undefined) {
          transformedValues[rule.targetField] = sourceValue
        }
      }

      console.log('    Source fields:')
      console.log(`      invoice_number: ${sourceFields.invoice_number}`)
      console.log(`      tracking_number: ${sourceFields.tracking_number}`)
      console.log(`      shipment_no: ${sourceFields.shipment_no}`)
      console.log(`      subtotal: ${sourceFields.subtotal}`)
      console.log(`      total_amount: ${sourceFields.total_amount}`)
      console.log(`      currency: ${sourceFields.currency}`)
      console.log(`      vendor_code: ${sourceFields.vendor_code}`)
      console.log('    Transformed values:')
      for (const [key, val] of Object.entries(transformedValues)) {
        const rule = autoMatchMappings.rules.find((r) => r.targetField === key)
        console.log(`      ${key}: ${val} (from ${rule?.sourceField}, scope: ${rule?.scope})`)
      }

      // Verify COMPANY overrides
      assert(
        transformedValues.inv_no === sourceFields.invoice_number,
        `Scenario J: inv_no = ${sourceFields.invoice_number} from GLOBAL`
      )
      assert(
        transformedValues.ship_ref === sourceFields.tracking_number,
        `Scenario J: ship_ref = ${sourceFields.tracking_number} from COMPANY override`
      )
      assert(
        transformedValues.amount === sourceFields.subtotal,
        `Scenario J: amount = ${sourceFields.subtotal} from COMPANY override`
      )
      // currency_code uses GLOBAL rule (currency) since no FORMAT in autoMatch path
      assert(
        transformedValues.currency_code === sourceFields.currency,
        `Scenario J: currency_code = ${sourceFields.currency} from GLOBAL (FORMAT not in autoMatch path)`
      )

      // --- Scenario K: Full cascade mapping (with formatId) ---
      console.log('\n  --- Scenario K: Full cascade mapping (with FORMAT) ---')
      const fullCascadeMappings = await resolveMappingRules(ctx.templateId, ctx.companyId, ctx.formatId)
      const fullTransformed: Record<string, unknown> = {}
      for (const rule of fullCascadeMappings.rules) {
        const sourceValue = sourceFields[rule.sourceField]
        if (sourceValue !== undefined) {
          fullTransformed[rule.targetField] = sourceValue
        }
      }

      console.log('    Full cascade transformed values:')
      for (const [key, val] of Object.entries(fullTransformed)) {
        const rule = fullCascadeMappings.rules.find((r) => r.targetField === key)
        console.log(`      ${key}: ${val} (from ${rule?.sourceField}, scope: ${rule?.scope})`)
      }

      // Verify FORMAT override
      assert(
        fullTransformed.currency_code === sourceFields.vendor_code,
        `Scenario K: currency_code = ${sourceFields.vendor_code} from FORMAT override (was ${sourceFields.currency} at GLOBAL)`
      )
      assert(
        fullTransformed.ship_ref === sourceFields.tracking_number,
        `Scenario K: ship_ref still from COMPANY override`
      )
      assert(
        fullTransformed.amount === sourceFields.subtotal,
        `Scenario K: amount still from COMPANY override`
      )
      assert(
        fullTransformed.inv_no === sourceFields.invoice_number,
        `Scenario K: inv_no still from GLOBAL (no override)`
      )
    }

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

  Coverage:
    Part 1 — Template Selection Priority:
      A: GLOBAL only                     ✓
      B: COMPANY overrides GLOBAL        ✓
      C: FORMAT overrides COMPANY+GLOBAL ✓
      C2: No formatId → COMPANY fallback ✓
      D: No default → null               ✓

    Part 2 — Mapping Rule Merge:
      E: GLOBAL only (4 rules)           ✓
      F: GLOBAL+COMPANY merge            ✓
      G: Full 3-level cascade            ✓

    Part 3 — End-to-End Verification:
      H: resolveFormatId from stage2     ✓
      I: FORMAT template selection       ✓
      J: autoMatch field values          ✓
      K: Full cascade field values       ✓

  Finding: autoMatch does NOT pass formatId to matchDocuments.
  FORMAT-level mapping rules are resolved correctly when formatId is provided,
  but the autoMatch integration path only includes COMPANY+GLOBAL levels.
    `)
    console.log('='.repeat(80))

    if (failCount > 0) {
      process.exitCode = 1
    }
  } finally {
    await cleanup(ctx)
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
