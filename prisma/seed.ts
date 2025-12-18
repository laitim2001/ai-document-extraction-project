/**
 * @fileoverview Prisma 資料庫種子數據腳本
 * @description
 *   創建系統預設角色、城市、Forwarder、映射規則和初始數據。
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
 * @lastModified 2025-12-18
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
  // Seed Cities
  // ===========================================
  console.log('\n🏙️ Creating cities...\n')

  const cityData = [
    { code: 'TPE', name: 'Taipei', region: 'APAC' },
    { code: 'HKG', name: 'Hong Kong', region: 'APAC' },
    { code: 'SGP', name: 'Singapore', region: 'APAC' },
    { code: 'TYO', name: 'Tokyo', region: 'APAC' },
    { code: 'SHA', name: 'Shanghai', region: 'APAC' },
    { code: 'SYD', name: 'Sydney', region: 'APAC' },
    { code: 'LON', name: 'London', region: 'EMEA' },
    { code: 'FRA', name: 'Frankfurt', region: 'EMEA' },
    { code: 'NYC', name: 'New York', region: 'AMER' },
    { code: 'LAX', name: 'Los Angeles', region: 'AMER' },
  ]

  let cityCreatedCount = 0
  let cityUpdatedCount = 0

  for (const city of cityData) {
    const existingCity = await prisma.city.findUnique({
      where: { code: city.code },
    })

    const result = await prisma.city.upsert({
      where: { code: city.code },
      update: {
        name: city.name,
        region: city.region,
      },
      create: {
        code: city.code,
        name: city.name,
        region: city.region,
        isActive: true,
      },
    })

    if (existingCity) {
      cityUpdatedCount++
      console.log(`  🔄 Updated: ${result.name} (${result.code})`)
    } else {
      cityCreatedCount++
      console.log(`  ✅ Created: ${result.name} (${result.code})`)
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
  // Summary
  // ===========================================
  const roleCount = await prisma.role.count()
  const userCount = await prisma.user.count()
  const cityCount = await prisma.city.count()
  const forwarderCount = await prisma.forwarder.count()
  const mappingRuleCount = await prisma.mappingRule.count()

  console.log('\n========================================')
  console.log('✨ Seed completed successfully!')
  console.log('========================================')
  console.log(`  Roles created: ${createdCount}`)
  console.log(`  Roles updated: ${updatedCount}`)
  console.log(`  Cities created: ${cityCreatedCount}`)
  console.log(`  Cities updated: ${cityUpdatedCount}`)
  console.log(`  Forwarders created: ${forwarderCreatedCount}`)
  console.log(`  Forwarders updated: ${forwarderUpdatedCount}`)
  console.log(`  Mapping rules created: ${ruleCreatedCount}`)
  console.log(`  Mapping rules updated: ${ruleUpdatedCount}`)
  console.log('----------------------------------------')
  console.log(`  Total roles: ${roleCount}`)
  console.log(`  Total cities: ${cityCount}`)
  console.log(`  Total forwarders: ${forwarderCount}`)
  console.log(`  Total mapping rules: ${mappingRuleCount}`)
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
