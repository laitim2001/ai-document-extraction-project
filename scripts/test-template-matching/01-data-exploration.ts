/**
 * @fileoverview Template Matching Data Exploration Script
 * @description Queries database for all data relevant to template matching:
 *   - Documents with ExtractionResults
 *   - DataTemplates
 *   - TemplateFieldMappings
 *   - Default template configurations (Company, DocumentFormat, SystemConfig)
 *   - TemplateInstances
 *
 * @usage npx tsx scripts/test-template-matching/01-data-exploration.ts
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('='.repeat(80))
  console.log('  TEMPLATE MATCHING DATA EXPLORATION REPORT')
  console.log('  Generated:', new Date().toISOString())
  console.log('='.repeat(80))

  // ─── 1. Documents with ExtractionResults ─────────────────────────────
  console.log('\n' + '─'.repeat(80))
  console.log('  1. DOCUMENTS WITH EXTRACTION RESULTS (sample 10)')
  console.log('─'.repeat(80))

  const docsWithResults = await prisma.document.findMany({
    where: {
      extractionResult: { isNot: null },
    },
    select: {
      id: true,
      fileName: true,
      status: true,
      companyId: true,
      templateInstanceId: true,
      templateMatchedAt: true,
      extractionResult: {
        select: {
          id: true,
          fieldMappings: true,
          stage2Result: true,
          extractionVersion: true,
          stage2ConfigSource: true,
          averageConfidence: true,
          status: true,
        },
      },
    },
    take: 10,
    orderBy: { createdAt: 'desc' },
  })

  console.log(`\n  Total documents with extraction results: querying count...`)
  const totalDocsWithResults = await prisma.document.count({
    where: { extractionResult: { isNot: null } },
  })
  console.log(`  Total: ${totalDocsWithResults}`)

  if (docsWithResults.length === 0) {
    console.log('\n  [NO DATA] No documents with extraction results found.')
  } else {
    for (const doc of docsWithResults) {
      console.log(`\n  Document: ${doc.id}`)
      console.log(`    fileName: ${doc.fileName}`)
      console.log(`    status: ${doc.status}`)
      console.log(`    companyId: ${doc.companyId ?? '(null)'}`)
      console.log(`    templateInstanceId: ${doc.templateInstanceId ?? '(null)'}`)
      console.log(`    templateMatchedAt: ${doc.templateMatchedAt ?? '(null)'}`)

      if (doc.extractionResult) {
        const er = doc.extractionResult
        console.log(`    extractionResult.id: ${er.id}`)
        console.log(`    extractionResult.status: ${er.status}`)
        console.log(`    extractionResult.extractionVersion: ${er.extractionVersion ?? '(null)'}`)
        console.log(`    extractionResult.averageConfidence: ${er.averageConfidence}`)
        console.log(`    extractionResult.stage2ConfigSource: ${er.stage2ConfigSource ?? '(null)'}`)

        // fieldMappings keys
        const fm = er.fieldMappings as Record<string, unknown> | null
        if (fm && typeof fm === 'object') {
          const keys = Object.keys(fm)
          console.log(`    fieldMappings keys (${keys.length}): [${keys.join(', ')}]`)
        }

        // stage2Result.matchedFormatId
        const s2 = er.stage2Result as Record<string, unknown> | null
        if (s2 && typeof s2 === 'object') {
          console.log(`    stage2Result.matchedFormatId: ${(s2 as Record<string, unknown>).matchedFormatId ?? '(not present)'}`)
          console.log(`    stage2Result keys: [${Object.keys(s2).join(', ')}]`)
        } else {
          console.log(`    stage2Result: (null)`)
        }
      }
    }
  }

  // ─── 2. DataTemplates ────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(80))
  console.log('  2. DATA TEMPLATES')
  console.log('─'.repeat(80))

  const dataTemplates = await prisma.dataTemplate.findMany({
    select: {
      id: true,
      name: true,
      scope: true,
      isActive: true,
      isSystem: true,
      companyId: true,
      fields: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`\n  Total DataTemplates: ${dataTemplates.length}`)

  if (dataTemplates.length === 0) {
    console.log('\n  [NO DATA] No DataTemplates found.')
  } else {
    for (const dt of dataTemplates) {
      console.log(`\n  DataTemplate: ${dt.id}`)
      console.log(`    name: ${dt.name}`)
      console.log(`    scope: ${dt.scope}`)
      console.log(`    isActive: ${dt.isActive}`)
      console.log(`    isSystem: ${dt.isSystem}`)
      console.log(`    companyId: ${dt.companyId ?? '(null)'}`)

      // Extract field names from fields JSON
      const fields = dt.fields as Array<{ name?: string; fieldName?: string; key?: string }> | null
      if (Array.isArray(fields)) {
        const fieldNames = fields.map(
          (f) => f.name || f.fieldName || f.key || JSON.stringify(f)
        )
        console.log(`    fields (${fieldNames.length}): [${fieldNames.join(', ')}]`)
      } else if (fields && typeof fields === 'object') {
        console.log(`    fields (object keys): [${Object.keys(fields).join(', ')}]`)
      } else {
        console.log(`    fields: ${JSON.stringify(fields)}`)
      }
    }
  }

  // ─── 3. TemplateFieldMappings ────────────────────────────────────────
  console.log('\n' + '─'.repeat(80))
  console.log('  3. TEMPLATE FIELD MAPPINGS')
  console.log('─'.repeat(80))

  const tfms = await prisma.templateFieldMapping.findMany({
    select: {
      id: true,
      dataTemplateId: true,
      scope: true,
      companyId: true,
      documentFormatId: true,
      name: true,
      mappings: true,
      isActive: true,
      priority: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`\n  Total TemplateFieldMappings: ${tfms.length}`)

  if (tfms.length === 0) {
    console.log('\n  [NO DATA] No TemplateFieldMappings found.')
  } else {
    for (const tfm of tfms) {
      console.log(`\n  TemplateFieldMapping: ${tfm.id}`)
      console.log(`    name: ${tfm.name}`)
      console.log(`    dataTemplateId: ${tfm.dataTemplateId}`)
      console.log(`    scope: ${tfm.scope}`)
      console.log(`    companyId: ${tfm.companyId ?? '(null)'}`)
      console.log(`    documentFormatId: ${tfm.documentFormatId ?? '(null)'}`)
      console.log(`    isActive: ${tfm.isActive}`)
      console.log(`    priority: ${tfm.priority}`)

      // Extract source→target pairs from mappings
      const mappings = tfm.mappings as Array<{
        sourceField?: string
        targetField?: string
      }> | null
      if (Array.isArray(mappings)) {
        console.log(`    mappings (${mappings.length}):`)
        for (const m of mappings) {
          console.log(`      ${m.sourceField ?? '?'} → ${m.targetField ?? '?'}`)
        }
      } else {
        console.log(`    mappings: ${JSON.stringify(mappings)}`)
      }
    }
  }

  // ─── 4. Default Template Configuration ──────────────────────────────
  console.log('\n' + '─'.repeat(80))
  console.log('  4. DEFAULT TEMPLATE CONFIGURATION')
  console.log('─'.repeat(80))

  // 4a. Companies with defaultTemplateId
  console.log('\n  4a. Companies with defaultTemplateId:')
  const companiesWithDefault = await prisma.company.findMany({
    where: { defaultTemplateId: { not: null } },
    select: {
      id: true,
      name: true,
      displayName: true,
      defaultTemplateId: true,
    },
  })

  if (companiesWithDefault.length === 0) {
    console.log('      [NO DATA] No companies with defaultTemplateId set.')
  } else {
    for (const c of companiesWithDefault) {
      console.log(`      Company: ${c.id}`)
      console.log(`        name: ${c.name}`)
      console.log(`        displayName: ${c.displayName}`)
      console.log(`        defaultTemplateId: ${c.defaultTemplateId}`)
    }
  }

  // 4b. DocumentFormats with defaultTemplateId
  console.log('\n  4b. DocumentFormats with defaultTemplateId:')
  const formatsWithDefault = await prisma.documentFormat.findMany({
    where: { defaultTemplateId: { not: null } },
    select: {
      id: true,
      name: true,
      companyId: true,
      documentType: true,
      documentSubtype: true,
      defaultTemplateId: true,
    },
  })

  if (formatsWithDefault.length === 0) {
    console.log('      [NO DATA] No DocumentFormats with defaultTemplateId set.')
  } else {
    for (const f of formatsWithDefault) {
      console.log(`      DocumentFormat: ${f.id}`)
      console.log(`        name: ${f.name ?? '(null)'}`)
      console.log(`        companyId: ${f.companyId}`)
      console.log(`        documentType: ${f.documentType}`)
      console.log(`        documentSubtype: ${f.documentSubtype}`)
      console.log(`        defaultTemplateId: ${f.defaultTemplateId}`)
    }
  }

  // 4c. SystemConfig global_default_template_id
  console.log('\n  4c. SystemConfig for global_default_template_id:')
  const globalDefaultConfig = await prisma.systemConfig.findUnique({
    where: { key: 'global_default_template_id' },
    select: {
      id: true,
      key: true,
      value: true,
      description: true,
      isActive: true,
    },
  })

  if (!globalDefaultConfig) {
    console.log('      [NO DATA] No SystemConfig with key "global_default_template_id" found.')
  } else {
    console.log(`      id: ${globalDefaultConfig.id}`)
    console.log(`      key: ${globalDefaultConfig.key}`)
    console.log(`      value: ${globalDefaultConfig.value}`)
    console.log(`      description: ${globalDefaultConfig.description}`)
    console.log(`      isActive: ${globalDefaultConfig.isActive}`)
  }

  // ─── 5. TemplateInstances ───────────────────────────────────────────
  console.log('\n' + '─'.repeat(80))
  console.log('  5. TEMPLATE INSTANCES')
  console.log('─'.repeat(80))

  const templateInstances = await prisma.templateInstance.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      rowCount: true,
      validRowCount: true,
      errorRowCount: true,
      dataTemplateId: true,
      createdAt: true,
      _count: {
        select: {
          matchedDocuments: true,
          rows: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  console.log(`\n  Total TemplateInstances: ${templateInstances.length}`)

  if (templateInstances.length === 0) {
    console.log('\n  [NO DATA] No TemplateInstances found.')
  } else {
    for (const ti of templateInstances) {
      console.log(`\n  TemplateInstance: ${ti.id}`)
      console.log(`    name: ${ti.name}`)
      console.log(`    status: ${ti.status}`)
      console.log(`    dataTemplateId: ${ti.dataTemplateId}`)
      console.log(`    rowCount: ${ti.rowCount}`)
      console.log(`    validRowCount: ${ti.validRowCount}`)
      console.log(`    errorRowCount: ${ti.errorRowCount}`)
      console.log(`    matchedDocuments count: ${ti._count.matchedDocuments}`)
      console.log(`    rows count: ${ti._count.rows}`)
      console.log(`    createdAt: ${ti.createdAt.toISOString()}`)
    }
  }

  // ─── 6. Summary Statistics ──────────────────────────────────────────
  console.log('\n' + '─'.repeat(80))
  console.log('  6. SUMMARY STATISTICS')
  console.log('─'.repeat(80))

  const [totalDocs, totalCompanies, totalFormats] = await Promise.all([
    prisma.document.count(),
    prisma.company.count(),
    prisma.documentFormat.count(),
  ])

  console.log(`\n  Total Documents: ${totalDocs}`)
  console.log(`  Total Documents with ExtractionResults: ${totalDocsWithResults}`)
  console.log(`  Total Companies: ${totalCompanies}`)
  console.log(`  Total DocumentFormats: ${totalFormats}`)
  console.log(`  Total DataTemplates: ${dataTemplates.length}`)
  console.log(`  Total TemplateFieldMappings: ${tfms.length}`)
  console.log(`  Total TemplateInstances: ${templateInstances.length}`)
  console.log(`  Companies with defaultTemplateId: ${companiesWithDefault.length}`)
  console.log(`  DocumentFormats with defaultTemplateId: ${formatsWithDefault.length}`)
  console.log(`  Global default template config: ${globalDefaultConfig ? 'EXISTS' : 'NOT SET'}`)

  console.log('\n' + '='.repeat(80))
  console.log('  END OF REPORT')
  console.log('='.repeat(80))
}

main()
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
