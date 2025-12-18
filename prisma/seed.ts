/**
 * @fileoverview Prisma 資料庫種子數據腳本
 * @description
 *   創建系統預設角色和初始數據。
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
 * @module prisma/seed
 * @author Development Team
 * @since Epic 1 - Story 1.2 (User Database & Role Foundation)
 * @lastModified 2025-12-18
 *
 * @usage
 *   npx prisma db seed
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import {
  ROLE_NAMES,
  ROLE_PERMISSIONS,
  ROLE_DESCRIPTIONS,
} from '../src/types/role-permissions'

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
  // Summary
  // ===========================================
  const roleCount = await prisma.role.count()
  const userCount = await prisma.user.count()

  console.log('\n========================================')
  console.log('✨ Seed completed successfully!')
  console.log('========================================')
  console.log(`  Roles created: ${createdCount}`)
  console.log(`  Roles updated: ${updatedCount}`)
  console.log(`  Total roles: ${roleCount}`)
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
