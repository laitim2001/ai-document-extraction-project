/**
 * @fileoverview 修復用戶權限腳本
 * @description
 *   為指定用戶分配角色和城市訪問權限
 *   用於解決新用戶 403 錯誤問題
 *
 * @usage
 *   npx tsx scripts/fix-user-permissions.ts --email chris.lai@rapo.com.hk
 *
 * @author Development Team
 * @since 2026-01-19
 */

import 'dotenv/config'
import { Prisma, PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// 從命令行獲取 email 參數
const email = process.argv.find(arg => arg.startsWith('--email='))?.split('=')[1]
  || process.argv[process.argv.indexOf('--email') + 1]
  || 'chris.lai@rapo.com.hk'

async function main() {
  console.log('========================================')
  console.log('修復用戶權限')
  console.log(`目標用戶: ${email}`)
  console.log('========================================\n')

  // 1. 查詢用戶
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      roles: { include: { role: true } },
      cityAccesses: { include: { city: true } },
    },
  })

  if (!user) {
    console.log(`❌ 用戶 ${email} 不存在於資料庫`)
    console.log('\n可能原因:')
    console.log('  1. 用戶尚未註冊')
    console.log('  2. 用戶使用開發模式登入（dev-user-1）')
    console.log('\n解決方案:')
    console.log('  1. 先通過註冊頁面創建帳號')
    console.log('  2. 或檢查 .env 中的 Azure AD 配置')
    return
  }

  console.log('✅ 找到用戶:')
  console.log(`   ID: ${user.id}`)
  console.log(`   Email: ${user.email}`)
  console.log(`   Name: ${user.name}`)
  console.log(`   Status: ${user.status}`)
  console.log(`   isGlobalAdmin: ${user.isGlobalAdmin}`)
  console.log(`   Current Roles: ${user.roles.map(r => r.role.name).join(', ') || '無'}`)
  console.log(`   Current Cities: ${user.cityAccesses.map(c => c.city.code).join(', ') || '無'}`)

  // 2. 查詢可用角色
  const superUserRole = await prisma.role.findUnique({
    where: { name: 'Super User' },
  })

  const systemAdminRole = await prisma.role.findUnique({
    where: { name: 'System Admin' },
  })

  if (!superUserRole) {
    console.log('\n❌ Super User 角色不存在，請先執行 npx prisma db seed')
    return
  }

  // 3. 查詢可用城市
  const cities = await prisma.city.findMany({
    select: { id: true, code: true, name: true },
  })

  if (cities.length === 0) {
    console.log('\n❌ 沒有可用城市，請先執行 npx prisma db seed')
    return
  }

  console.log(`\n📍 可用城市: ${cities.map(c => c.code).join(', ')}`)

  // 4. 分配 Super User 角色（如果沒有 Super User 或 System Admin）
  const hasSuperUserRole = user.roles.some(r =>
    r.role.name === 'Super User' || r.role.name === 'System Admin'
  )
  if (!hasSuperUserRole) {
    console.log('\n📋 分配角色: Super User')
    await prisma.userRole.upsert({
      where: {
        userId_roleId: { userId: user.id, roleId: superUserRole.id },
      },
      create: {
        userId: user.id,
        roleId: superUserRole.id,
      },
      update: {},
    })
    console.log('   ✅ Super User 角色已分配')
  } else {
    console.log('\n📋 用戶已有 Super User 或 System Admin 角色，跳過')
  }

  // 5. 分配城市訪問權限（如果沒有）
  const hasCityAccess = user.cityAccesses.length > 0
  if (!hasCityAccess) {
    console.log('\n🏙️ 分配城市訪問權限: 所有城市')

    // 為用戶分配所有城市訪問權限
    const cityAccessData = cities.map((city, index) => ({
      userId: user.id,
      cityId: city.id,
      isPrimary: index === 0, // 第一個城市設為主要城市
      accessLevel: 'FULL' as const,
      grantedBy: user.id, // 自我授權
    }))

    await prisma.userCityAccess.createMany({
      data: cityAccessData,
      skipDuplicates: true,
    })
    console.log(`   ✅ 已分配 ${cities.length} 個城市的訪問權限`)
  } else {
    console.log('\n🏙️ 用戶已有城市訪問權限，跳過')
  }

  // 6. 設置為全域管理員（可選）
  if (!user.isGlobalAdmin) {
    console.log('\n🌍 設置為全域管理員...')
    await prisma.user.update({
      where: { id: user.id },
      data: { isGlobalAdmin: true },
    })
    console.log('   ✅ 已設置為全域管理員')
  }

  // 7. 驗證結果
  const updatedUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      roles: { include: { role: true } },
      cityAccesses: { include: { city: true } },
    },
  })

  console.log('\n========================================')
  console.log('✅ 權限修復完成')
  console.log('========================================')
  console.log(`   角色: ${updatedUser?.roles.map(r => r.role.name).join(', ')}`)
  console.log(`   城市: ${updatedUser?.cityAccesses.map(c => c.city.code).join(', ')}`)
  console.log(`   全域管理員: ${updatedUser?.isGlobalAdmin}`)
  console.log('\n⚠️ 請重新登入以使更改生效')
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
