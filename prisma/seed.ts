/**
 * @fileoverview Prisma 資料庫種子數據腳本
 * @description
 *   創建系統預設角色、區域、城市、Company（含 Forwarder）、映射規則和初始數據。
 *   使用 upsert 確保可重複執行。
 *
 *   預定義角色：
 *   1. System Admin - 擁有所有權限
 *   2. Super User - 規則和 Company 管理
 *   3. Data Processor - 基礎發票處理（預設角色）
 *   4. City Manager - 城市級別管理
 *   5. Regional Manager - 多城市管理
 *   6. Auditor - 只讀審計存取
 *
 *   預定義區域 (Story 6.1):
 *   - APAC: Asia Pacific (UTC+8 default)
 *   - EMEA: Europe, Middle East, Africa (UTC+0 default)
 *   - AMER: Americas (UTC-5 default)
 *
 *   預定義城市：
 *   - APAC: Taipei, Hong Kong, Singapore, Tokyo, Shanghai, Sydney
 *   - EMEA: London, Frankfurt
 *   - AMER: New York, Los Angeles
 *
 *   預定義 Company（Forwarder 類型）：
 *   - Express: DHL, FedEx, UPS, TNT
 *   - Ocean: Maersk, MSC, CMA CGM, Hapag-Lloyd, Evergreen, COSCO, ONE, Yang Ming
 *   - Regional: SF Express, Kerry Logistics
 *   - Unknown: 用於無法識別的文件
 *
 *   映射規則：
 *   - Universal Rules (Tier 1): 通用映射規則
 *   - Company-Specific Rules (Tier 2): DHL, FedEx, UPS, Maersk 特定規則
 *
 * @module prisma/seed
 * @author Development Team
 * @since Epic 1 - Story 1.2 (User Database & Role Foundation)
 * @lastModified 2025-12-22
 * @refactor REFACTOR-001 (Forwarder → Company)
 *
 * @usage
 *   npx prisma db seed
 */

import 'dotenv/config'
import { Prisma, PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import {
  ROLE_NAMES,
  ROLE_PERMISSIONS,
  ROLE_DESCRIPTIONS,
} from '../src/types/role-permissions'
import { FORWARDER_SEED_DATA } from './seed-data/forwarders'
import { getAllMappingRules } from './seed-data/mapping-rules'
import { CONFIG_SEED_DATA } from './seed-data/config-seeds'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

/**
 * 主要種子函數
 */
async function main() {
  console.log('========================================')
  console.log('Starting database seed...')
  console.log('========================================\n')

  // ===========================================
  // Seed System Roles
  // ===========================================
  console.log('📦 Creating system roles...\n')

  const roleData = Object.values(ROLE_NAMES).map((name) => ({
    name,
    description: ROLE_DESCRIPTIONS[name],
    permissions: [...ROLE_PERMISSIONS[name]],
    isSystem: true,
  }))

  let createdCount = 0
  let updatedCount = 0

  for (const role of roleData) {
    const existingRole = await prisma.role.findUnique({
      where: { name: role.name },
    })

    const result = await prisma.role.upsert({
      where: { name: role.name },
      update: {
        description: role.description,
        permissions: role.permissions,
      },
      create: {
        name: role.name,
        description: role.description,
        permissions: role.permissions,
        isSystem: role.isSystem,
      },
    })

    if (existingRole) {
      updatedCount++
      console.log(`  🔄 Updated: ${result.name} (${role.permissions.length} permissions)`)
    } else {
      createdCount++
      console.log(`  ✅ Created: ${result.name} (${role.permissions.length} permissions)`)
    }
  }

  // ===========================================
  // Seed Regions (Story 6.1)
  // ===========================================
  console.log('\n🌍 Creating regions...\n')

  const regionData = [
    { code: 'APAC', name: 'Asia Pacific', timezone: 'Asia/Hong_Kong' },
    { code: 'EMEA', name: 'Europe, Middle East & Africa', timezone: 'Europe/London' },
    { code: 'AMER', name: 'Americas', timezone: 'America/New_York' },
  ]

  const regionIdMap: Record<string, string> = {}
  let regionCreatedCount = 0
  let regionUpdatedCount = 0

  for (const region of regionData) {
    const existingRegion = await prisma.region.findUnique({
      where: { code: region.code },
    })

    const result = await prisma.region.upsert({
      where: { code: region.code },
      update: {
        name: region.name,
        timezone: region.timezone,
      },
      create: {
        code: region.code,
        name: region.name,
        timezone: region.timezone,
        status: 'ACTIVE',
      },
    })

    regionIdMap[region.code] = result.id

    if (existingRegion) {
      regionUpdatedCount++
      console.log(`  🔄 Updated: ${result.name} (${result.code})`)
    } else {
      regionCreatedCount++
      console.log(`  ✅ Created: ${result.name} (${result.code})`)
    }
  }

  // ===========================================
  // Seed Cities (Updated for Story 6.1)
  // ===========================================
  console.log('\n🏙️ Creating cities...\n')

  interface CityData {
    code: string
    name: string
    regionCode: string
    timezone: string
    currency: string
    locale: string
  }

  const cityData: CityData[] = [
    // APAC Cities
    { code: 'TPE', name: 'Taipei', regionCode: 'APAC', timezone: 'Asia/Taipei', currency: 'TWD', locale: 'zh-TW' },
    { code: 'HKG', name: 'Hong Kong', regionCode: 'APAC', timezone: 'Asia/Hong_Kong', currency: 'HKD', locale: 'zh-HK' },
    { code: 'SGP', name: 'Singapore', regionCode: 'APAC', timezone: 'Asia/Singapore', currency: 'SGD', locale: 'en-SG' },
    { code: 'TYO', name: 'Tokyo', regionCode: 'APAC', timezone: 'Asia/Tokyo', currency: 'JPY', locale: 'ja-JP' },
    { code: 'SHA', name: 'Shanghai', regionCode: 'APAC', timezone: 'Asia/Shanghai', currency: 'CNY', locale: 'zh-CN' },
    { code: 'SYD', name: 'Sydney', regionCode: 'APAC', timezone: 'Australia/Sydney', currency: 'AUD', locale: 'en-AU' },
    // EMEA Cities
    { code: 'LON', name: 'London', regionCode: 'EMEA', timezone: 'Europe/London', currency: 'GBP', locale: 'en-GB' },
    { code: 'FRA', name: 'Frankfurt', regionCode: 'EMEA', timezone: 'Europe/Berlin', currency: 'EUR', locale: 'de-DE' },
    // AMER Cities
    { code: 'NYC', name: 'New York', regionCode: 'AMER', timezone: 'America/New_York', currency: 'USD', locale: 'en-US' },
    { code: 'LAX', name: 'Los Angeles', regionCode: 'AMER', timezone: 'America/Los_Angeles', currency: 'USD', locale: 'en-US' },
  ]

  let cityCreatedCount = 0
  let cityUpdatedCount = 0

  for (const city of cityData) {
    const regionId = regionIdMap[city.regionCode]
    if (!regionId) {
      console.log(`  ⚠️ Skipped: ${city.name} - Region ${city.regionCode} not found`)
      continue
    }

    const existingCity = await prisma.city.findUnique({
      where: { code: city.code },
    })

    const result = await prisma.city.upsert({
      where: { code: city.code },
      update: {
        name: city.name,
        regionId: regionId,
        timezone: city.timezone,
        currency: city.currency,
        locale: city.locale,
      },
      create: {
        code: city.code,
        name: city.name,
        regionId: regionId,
        timezone: city.timezone,
        currency: city.currency,
        locale: city.locale,
        status: 'ACTIVE',
      },
    })

    if (existingCity) {
      cityUpdatedCount++
      console.log(`  🔄 Updated: ${result.name} (${result.code}) - ${city.regionCode}`)
    } else {
      cityCreatedCount++
      console.log(`  ✅ Created: ${result.name} (${result.code}) - ${city.regionCode}`)
    }
  }

  // ===========================================
  // Create System User for seeding
  // REFACTOR-001: Required as Company creator
  // ===========================================
  console.log('\n👤 Creating system user...\n')

  // Get the System Admin role
  const systemAdminRole = await prisma.role.findUnique({
    where: { name: 'System Admin' },
  })

  if (!systemAdminRole) {
    throw new Error('System Admin role not found. Roles must be seeded first.')
  }

  // Create or update system user
  const systemUser = await prisma.user.upsert({
    where: { email: 'system@ai-document-extraction.internal' },
    update: {
      name: 'System',
      status: 'ACTIVE',
    },
    create: {
      email: 'system@ai-document-extraction.internal',
      name: 'System',
      status: 'ACTIVE',
      // REFACTOR-001: 透過 UserRole 關聯建立角色（非直接 roleId）
      roles: {
        create: {
          roleId: systemAdminRole.id,
        },
      },
    },
  })

  console.log(`  ✅ System user ready: ${systemUser.email}`)

  // ===========================================
  // Seed Companies (Forwarder Type)
  // REFACTOR-001: Changed from Forwarder to Company model
  // ===========================================
  console.log('\n📦 Creating companies (forwarders)...\n')

  let companyCreatedCount = 0
  let companyUpdatedCount = 0

  for (const forwarder of FORWARDER_SEED_DATA) {
    const existingCompany = await prisma.company.findUnique({
      where: { code: forwarder.code },
    })

    // REFACTOR-001: Convert ForwarderIdentificationPatterns to string[] for Company model
    const patternsAsJson = [JSON.stringify(forwarder.identificationPatterns)]

    const result = await prisma.company.upsert({
      where: { code: forwarder.code },
      update: {
        name: forwarder.name,
        displayName: forwarder.displayName,
        identificationPatterns: patternsAsJson,
        priority: forwarder.priority,
      },
      create: {
        code: forwarder.code,
        name: forwarder.name,
        displayName: forwarder.displayName,
        type: 'FORWARDER', // REFACTOR-001: Specify company type
        identificationPatterns: patternsAsJson,
        priority: forwarder.priority,
        status: 'ACTIVE',
        creator: { connect: { id: systemUser.id } }, // REFACTOR-001: Required creator
      },
    })

    if (existingCompany) {
      companyUpdatedCount++
      console.log(`  🔄 Updated: ${result.displayName} (${result.code})`)
    } else {
      companyCreatedCount++
      console.log(`  ✅ Created: ${result.displayName} (${result.code})`)
    }
  }

  // ===========================================
  // Seed Mapping Rules
  // REFACTOR-001: Changed forwarderId to companyId
  // ===========================================
  console.log('\n📋 Creating mapping rules...\n')

  // 取得 Company ID 對照表
  const companies = await prisma.company.findMany({
    select: { id: true, code: true },
  })
  const companyIdMap = companies.reduce(
    (acc: Record<string, string>, c: { id: string; code: string | null }) => {
      if (c.code) {
        acc[c.code] = c.id
      }
      return acc
    },
    {} as Record<string, string>
  )

  // 取得所有映射規則（仍使用舊的 forwarderIdMap 參數名，因為 seed-data 尚未更新）
  const allMappingRules = getAllMappingRules(companyIdMap)

  let ruleCreatedCount = 0
  let ruleUpdatedCount = 0

  for (const rule of allMappingRules) {
    // 檢查是否已存在相同組合（使用 findFirst 處理 null companyId）
    // 注意：rule.forwarderId 實際上是 companyId（來自 seed-data）
    const existingRule = await prisma.mappingRule.findFirst({
      where: {
        companyId: rule.forwarderId, // seed-data 仍使用 forwarderId 名稱
        fieldName: rule.fieldName,
      },
    })

    // 由於同一欄位可能有多個規則（不同優先級），我們需要特殊處理
    if (existingRule) {
      // 如果已存在，更新它
      await prisma.mappingRule.update({
        where: { id: existingRule.id },
        data: {
          fieldLabel: rule.fieldLabel,
          extractionPattern: rule.extractionPattern as unknown as Prisma.InputJsonValue,
          priority: rule.priority,
          isRequired: rule.isRequired,
          validationPattern: rule.validationPattern || null,
          defaultValue: rule.defaultValue || null,
          category: rule.category,
          description: rule.description || null,
        },
      })
      ruleUpdatedCount++
      if (ruleUpdatedCount <= 5) {
        console.log(
          `  🔄 Updated: ${rule.fieldName} (${rule.forwarderId ? 'Company-specific' : 'Universal'})`
        )
      }
    } else {
      // 創建新規則
      await prisma.mappingRule.create({
        data: {
          companyId: rule.forwarderId, // seed-data 仍使用 forwarderId 名稱
          fieldName: rule.fieldName,
          fieldLabel: rule.fieldLabel,
          extractionPattern: rule.extractionPattern as unknown as Prisma.InputJsonValue,
          priority: rule.priority,
          isRequired: rule.isRequired,
          validationPattern: rule.validationPattern || null,
          defaultValue: rule.defaultValue || null,
          category: rule.category,
          description: rule.description || null,
          isActive: true,
        },
      })
      ruleCreatedCount++
      if (ruleCreatedCount <= 5) {
        console.log(
          `  ✅ Created: ${rule.fieldName} (${rule.forwarderId ? 'Company-specific' : 'Universal'})`
        )
      }
    }
  }

  if (ruleCreatedCount > 5) {
    console.log(`  ... and ${ruleCreatedCount - 5} more rules created`)
  }
  if (ruleUpdatedCount > 5) {
    console.log(`  ... and ${ruleUpdatedCount - 5} more rules updated`)
  }

  // ===========================================
  // Seed System Configs (Story 12-4)
  // ===========================================
  console.log('\n⚙️ Creating system configs...\n')

  let configCreatedCount = 0
  let configUpdatedCount = 0

  for (const config of CONFIG_SEED_DATA) {
    const existingConfig = await prisma.systemConfig.findUnique({
      where: { key: config.key },
    })

    if (existingConfig) {
      // 只更新元資料，不更新值
      await prisma.systemConfig.update({
        where: { key: config.key },
        data: {
          name: config.name,
          description: config.description,
          impactNote: config.impactNote || null,
          validation: config.validation
            ? (config.validation as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          effectType: config.effectType,
          sortOrder: config.sortOrder,
        },
      })
      configUpdatedCount++
      if (configUpdatedCount <= 5) {
        console.log(`  🔄 Updated: ${config.name} (${config.key})`)
      }
    } else {
      await prisma.systemConfig.create({
        data: {
          key: config.key,
          value: config.defaultValue,
          defaultValue: config.defaultValue,
          category: config.category,
          valueType: config.valueType,
          effectType: config.effectType,
          name: config.name,
          description: config.description,
          impactNote: config.impactNote || null,
          validation: config.validation
            ? (config.validation as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          isEncrypted: config.isEncrypted ?? false,
          isReadOnly: config.isReadOnly ?? false,
          sortOrder: config.sortOrder,
        },
      })
      configCreatedCount++
      if (configCreatedCount <= 5) {
        console.log(`  ✅ Created: ${config.name} (${config.key})`)
      }
    }
  }

  if (configCreatedCount > 5) {
    console.log(`  ... and ${configCreatedCount - 5} more configs created`)
  }
  if (configUpdatedCount > 5) {
    console.log(`  ... and ${configUpdatedCount - 5} more configs updated`)
  }

  // ===========================================
  // Seed Data Templates (Story 16-7)
  // ===========================================
  console.log('\n📋 Creating data templates...\n')

  interface DataTemplateField {
    name: string
    label: string
    dataType: 'string' | 'number' | 'date' | 'currency' | 'boolean' | 'array'
    isRequired: boolean
    order: number
    description?: string
  }

  interface DataTemplateSeed {
    id: string
    name: string
    description: string
    scope: 'GLOBAL' | 'COMPANY'
    isSystem: boolean
    fields: DataTemplateField[]
  }

  const dataTemplateSeedData: DataTemplateSeed[] = [
    {
      id: 'erp-standard-import',
      name: 'ERP 標準匯入格式',
      description: '適用於大多數 ERP 系統的標準發票匯入格式',
      scope: 'GLOBAL',
      isSystem: true,
      fields: [
        { name: 'invoice_number', label: '發票號碼', dataType: 'string', isRequired: true, order: 1 },
        { name: 'invoice_date', label: '發票日期', dataType: 'date', isRequired: true, order: 2 },
        { name: 'vendor_code', label: '供應商代碼', dataType: 'string', isRequired: true, order: 3 },
        { name: 'vendor_name', label: '供應商名稱', dataType: 'string', isRequired: false, order: 4 },
        { name: 'currency', label: '幣別', dataType: 'string', isRequired: true, order: 5 },
        { name: 'subtotal', label: '小計', dataType: 'currency', isRequired: false, order: 6 },
        { name: 'tax_amount', label: '稅額', dataType: 'currency', isRequired: false, order: 7 },
        { name: 'total_amount', label: '總金額', dataType: 'currency', isRequired: true, order: 8 },
        { name: 'due_date', label: '付款到期日', dataType: 'date', isRequired: false, order: 9 },
        { name: 'po_number', label: '採購單號', dataType: 'string', isRequired: false, order: 10 },
        { name: 'tracking_number', label: '追蹤號碼', dataType: 'string', isRequired: false, order: 11 },
        { name: 'description', label: '說明', dataType: 'string', isRequired: false, order: 12 },
      ],
    },
    {
      id: 'expense-report-format',
      name: '費用報表格式',
      description: '用於管理報表匯出的精簡格式',
      scope: 'GLOBAL',
      isSystem: true,
      fields: [
        { name: 'invoice_number', label: '發票號碼', dataType: 'string', isRequired: true, order: 1 },
        { name: 'invoice_date', label: '發票日期', dataType: 'date', isRequired: true, order: 2 },
        { name: 'vendor_name', label: '供應商', dataType: 'string', isRequired: true, order: 3 },
        { name: 'category', label: '費用類別', dataType: 'string', isRequired: false, order: 4 },
        { name: 'currency', label: '幣別', dataType: 'string', isRequired: true, order: 5 },
        { name: 'amount', label: '金額', dataType: 'currency', isRequired: true, order: 6 },
        { name: 'department', label: '部門', dataType: 'string', isRequired: false, order: 7 },
        { name: 'cost_center', label: '成本中心', dataType: 'string', isRequired: false, order: 8 },
      ],
    },
    {
      id: 'logistics-tracking-format',
      name: '物流追蹤格式',
      description: '專為物流發票設計的追蹤格式',
      scope: 'GLOBAL',
      isSystem: true,
      fields: [
        { name: 'tracking_number', label: '追蹤號碼', dataType: 'string', isRequired: true, order: 1 },
        { name: 'invoice_number', label: '發票號碼', dataType: 'string', isRequired: true, order: 2 },
        { name: 'ship_date', label: '發貨日期', dataType: 'date', isRequired: false, order: 3 },
        { name: 'delivery_date', label: '交付日期', dataType: 'date', isRequired: false, order: 4 },
        { name: 'origin', label: '起運地', dataType: 'string', isRequired: false, order: 5 },
        { name: 'destination', label: '目的地', dataType: 'string', isRequired: false, order: 6 },
        { name: 'carrier', label: '承運商', dataType: 'string', isRequired: true, order: 7 },
        { name: 'service_type', label: '服務類型', dataType: 'string', isRequired: false, order: 8 },
        { name: 'weight', label: '重量', dataType: 'number', isRequired: false, order: 9 },
        { name: 'freight_charge', label: '運費', dataType: 'currency', isRequired: true, order: 10 },
        { name: 'total_amount', label: '總金額', dataType: 'currency', isRequired: true, order: 11 },
      ],
    },
  ]

  let templateCreatedCount = 0
  let templateUpdatedCount = 0

  for (const template of dataTemplateSeedData) {
    const existingTemplate = await prisma.dataTemplate.findUnique({
      where: { id: template.id },
    })

    if (existingTemplate) {
      await prisma.dataTemplate.update({
        where: { id: template.id },
        data: {
          name: template.name,
          description: template.description,
          fields: template.fields as unknown as Prisma.InputJsonValue,
        },
      })
      templateUpdatedCount++
      console.log(`  🔄 Updated: ${template.name}`)
    } else {
      await prisma.dataTemplate.create({
        data: {
          id: template.id,
          name: template.name,
          description: template.description,
          scope: template.scope,
          isSystem: template.isSystem,
          isActive: true,
          fields: template.fields as unknown as Prisma.InputJsonValue,
        },
      })
      templateCreatedCount++
      console.log(`  ✅ Created: ${template.name}`)
    }
  }

  // ===========================================
  // Summary
  // ===========================================
  const roleCount = await prisma.role.count()
  const userCount = await prisma.user.count()
  const regionCount = await prisma.region.count()
  const cityCount = await prisma.city.count()
  const companyCount = await prisma.company.count()
  const mappingRuleCount = await prisma.mappingRule.count()
  const systemConfigCount = await prisma.systemConfig.count()
  const dataTemplateCount = await prisma.dataTemplate.count()

  console.log('\n========================================')
  console.log('✨ Seed completed successfully!')
  console.log('========================================')
  console.log(`  Roles created: ${createdCount}`)
  console.log(`  Roles updated: ${updatedCount}`)
  console.log(`  Regions created: ${regionCreatedCount}`)
  console.log(`  Regions updated: ${regionUpdatedCount}`)
  console.log(`  Cities created: ${cityCreatedCount}`)
  console.log(`  Cities updated: ${cityUpdatedCount}`)
  console.log(`  Companies created: ${companyCreatedCount}`)
  console.log(`  Companies updated: ${companyUpdatedCount}`)
  console.log(`  Mapping rules created: ${ruleCreatedCount}`)
  console.log(`  Mapping rules updated: ${ruleUpdatedCount}`)
  console.log(`  System configs created: ${configCreatedCount}`)
  console.log(`  System configs updated: ${configUpdatedCount}`)
  console.log(`  Data templates created: ${templateCreatedCount}`)
  console.log(`  Data templates updated: ${templateUpdatedCount}`)
  console.log('----------------------------------------')
  console.log(`  Total roles: ${roleCount}`)
  console.log(`  Total regions: ${regionCount}`)
  console.log(`  Total cities: ${cityCount}`)
  console.log(`  Total companies: ${companyCount}`)
  console.log(`  Total mapping rules: ${mappingRuleCount}`)
  console.log(`  Total system configs: ${systemConfigCount}`)
  console.log(`  Total data templates: ${dataTemplateCount}`)
  console.log(`  Total users: ${userCount}`)
  console.log('========================================\n')
}

main()
  .then(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
  .catch(async (e) => {
    console.error('\n❌ Seed failed:', e)
    await prisma.$disconnect()
    await pool.end()
    process.exit(1)
  })
