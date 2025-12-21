/**
 * @fileoverview Prisma 資料庫種子數據腳本
 * @description
 *   創建系統預設角色、區域、城市、Forwarder、映射規則和初始數據。
 *   使用 upsert 確保可重複執行。
 *
 *   預定義角色：
 *   1. System Admin - 擁有所有權限
 *   2. Super User - 規則和 Forwarder 管理
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
 *   預定義 Forwarder：
 *   - Express: DHL, FedEx, UPS, TNT
 *   - Ocean: Maersk, MSC, CMA CGM, Hapag-Lloyd, Evergreen, COSCO, ONE, Yang Ming
 *   - Regional: SF Express, Kerry Logistics
 *   - Unknown: 用於無法識別的文件
 *
 *   映射規則：
 *   - Universal Rules (Tier 1): 通用映射規則
 *   - Forwarder-Specific Rules (Tier 2): DHL, FedEx, UPS, Maersk 特定規則
 *
 * @module prisma/seed
 * @author Development Team
 * @since Epic 1 - Story 1.2 (User Database & Role Foundation)
 * @lastModified 2025-12-19
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
  // Seed Forwarders
  // ===========================================
  console.log('\n📦 Creating forwarders...\n')

  let forwarderCreatedCount = 0
  let forwarderUpdatedCount = 0

  for (const forwarder of FORWARDER_SEED_DATA) {
    const existingForwarder = await prisma.forwarder.findUnique({
      where: { code: forwarder.code },
    })

    const result = await prisma.forwarder.upsert({
      where: { code: forwarder.code },
      update: {
        name: forwarder.name,
        displayName: forwarder.displayName,
        identificationPatterns:
          forwarder.identificationPatterns as unknown as Prisma.InputJsonValue,
        priority: forwarder.priority,
      },
      create: {
        code: forwarder.code,
        name: forwarder.name,
        displayName: forwarder.displayName,
        identificationPatterns:
          forwarder.identificationPatterns as unknown as Prisma.InputJsonValue,
        priority: forwarder.priority,
        isActive: true,
      },
    })

    if (existingForwarder) {
      forwarderUpdatedCount++
      console.log(`  🔄 Updated: ${result.displayName} (${result.code})`)
    } else {
      forwarderCreatedCount++
      console.log(`  ✅ Created: ${result.displayName} (${result.code})`)
    }
  }

  // ===========================================
  // Seed Mapping Rules
  // ===========================================
  console.log('\n📋 Creating mapping rules...\n')

  // 取得 Forwarder ID 對照表
  const forwarders = await prisma.forwarder.findMany({
    select: { id: true, code: true },
  })
  const forwarderIdMap = forwarders.reduce(
    (acc, f) => {
      acc[f.code] = f.id
      return acc
    },
    {} as Record<string, string>
  )

  // 取得所有映射規則
  const allMappingRules = getAllMappingRules(forwarderIdMap)

  let ruleCreatedCount = 0
  let ruleUpdatedCount = 0

  for (const rule of allMappingRules) {
    // 檢查是否已存在相同組合（使用 findFirst 處理 null forwarderId）
    const existingRule = await prisma.mappingRule.findFirst({
      where: {
        forwarderId: rule.forwarderId,
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
          `  🔄 Updated: ${rule.fieldName} (${rule.forwarderId ? 'Forwarder-specific' : 'Universal'})`
        )
      }
    } else {
      // 創建新規則
      await prisma.mappingRule.create({
        data: {
          forwarderId: rule.forwarderId,
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
          `  ✅ Created: ${rule.fieldName} (${rule.forwarderId ? 'Forwarder-specific' : 'Universal'})`
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
  // Summary
  // ===========================================
  const roleCount = await prisma.role.count()
  const userCount = await prisma.user.count()
  const regionCount = await prisma.region.count()
  const cityCount = await prisma.city.count()
  const forwarderCount = await prisma.forwarder.count()
  const mappingRuleCount = await prisma.mappingRule.count()
  const systemConfigCount = await prisma.systemConfig.count()

  console.log('\n========================================')
  console.log('✨ Seed completed successfully!')
  console.log('========================================')
  console.log(`  Roles created: ${createdCount}`)
  console.log(`  Roles updated: ${updatedCount}`)
  console.log(`  Regions created: ${regionCreatedCount}`)
  console.log(`  Regions updated: ${regionUpdatedCount}`)
  console.log(`  Cities created: ${cityCreatedCount}`)
  console.log(`  Cities updated: ${cityUpdatedCount}`)
  console.log(`  Forwarders created: ${forwarderCreatedCount}`)
  console.log(`  Forwarders updated: ${forwarderUpdatedCount}`)
  console.log(`  Mapping rules created: ${ruleCreatedCount}`)
  console.log(`  Mapping rules updated: ${ruleUpdatedCount}`)
  console.log(`  System configs created: ${configCreatedCount}`)
  console.log(`  System configs updated: ${configUpdatedCount}`)
  console.log('----------------------------------------')
  console.log(`  Total roles: ${roleCount}`)
  console.log(`  Total regions: ${regionCount}`)
  console.log(`  Total cities: ${cityCount}`)
  console.log(`  Total forwarders: ${forwarderCount}`)
  console.log(`  Total mapping rules: ${mappingRuleCount}`)
  console.log(`  Total system configs: ${systemConfigCount}`)
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
