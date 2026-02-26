/**
 * @fileoverview 授予用戶管理員權限腳本
 * @description
 *   將指定用戶設定為全域管理員，並賦予 System Admin 角色和所有城市存取權限。
 *
 * @usage
 *   npx tsx scripts/grant-admin-access.ts [email]
 *   npx tsx scripts/grant-admin-access.ts chris.lai@rapo.com.hk
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const email = process.argv[2] || 'chris.lai@rapo.com.hk'

  console.log('========================================')
  console.log(`Granting admin access to: ${email}`)
  console.log('========================================\n')

  // 1. 查找用戶
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      roles: { include: { role: true } },
      cityAccesses: { include: { city: true } },
    },
  })

  // 2. 查找 System Admin 角色
  const systemAdminRole = await prisma.role.findUnique({
    where: { name: 'System Admin' },
  })

  if (!systemAdminRole) {
    console.log('❌ System Admin role not found. Please run prisma db seed first.')
    return
  }

  // 3. 查找所有城市
  const allCities = await prisma.city.findMany()
  console.log(`Found ${allCities.length} cities in database.`)

  if (!user) {
    console.log(`❌ User not found: ${email}`)
    console.log('\nCreating new user with admin access...')

    // 建立新用戶
    const newUser = await prisma.user.create({
      data: {
        email,
        name: email.split('@')[0],
        isGlobalAdmin: true,
        status: 'ACTIVE',
        preferredLocale: 'zh-TW',
      },
    })

    // 添加 System Admin 角色
    await prisma.userRole.create({
      data: {
        userId: newUser.id,
        roleId: systemAdminRole.id,
      },
    })

    // 添加所有城市存取權限
    for (const city of allCities) {
      await prisma.userCityAccess.create({
        data: {
          userId: newUser.id,
          cityId: city.id,
          accessLevel: 'FULL',
          isPrimary: city.code === 'HK', // Hong Kong as primary
          grantedBy: newUser.id, // Self-granted (admin)
          reason: 'Admin access granted by system',
        },
      })
    }

    const createdUser = await prisma.user.findUnique({
      where: { id: newUser.id },
      include: {
        roles: { include: { role: true } },
        cityAccesses: { include: { city: true } },
      },
    })

    console.log(`\n✅ Created new admin user: ${createdUser?.email}`)
    console.log(`   - isGlobalAdmin: ${createdUser?.isGlobalAdmin}`)
    console.log(`   - Roles: ${createdUser?.roles.map(r => r.role.name).join(', ')}`)
    console.log(`   - Cities: ${createdUser?.cityAccesses.map(c => c.city.name).join(', ')}`)
    return
  }

  console.log(`Found user: ${user.name} (${user.email})`)
  console.log(`Current status:`)
  console.log(`  - isGlobalAdmin: ${user.isGlobalAdmin}`)
  console.log(`  - Roles: ${user.roles.map(r => r.role.name).join(', ') || 'None'}`)
  console.log(`  - Cities: ${user.cityAccesses.map(c => c.city.name).join(', ') || 'None'}\n`)

  // 4. 更新用戶為全域管理員
  await prisma.user.update({
    where: { id: user.id },
    data: {
      isGlobalAdmin: true,
      status: 'ACTIVE',
    },
  })

  // 5. 刪除現有角色並添加 System Admin
  await prisma.userRole.deleteMany({
    where: { userId: user.id },
  })

  await prisma.userRole.create({
    data: {
      userId: user.id,
      roleId: systemAdminRole.id,
    },
  })

  // 6. 刪除現有城市存取權限並添加所有城市
  await prisma.userCityAccess.deleteMany({
    where: { userId: user.id },
  })

  for (const city of allCities) {
    await prisma.userCityAccess.create({
      data: {
        userId: user.id,
        cityId: city.id,
        accessLevel: 'FULL',
        isPrimary: city.code === 'HK', // Hong Kong as primary
        grantedBy: user.id, // Self-granted (admin)
        reason: 'Admin access granted by system',
      },
    })
  }

  // 7. 查詢更新後的用戶
  const updatedUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      roles: { include: { role: true } },
      cityAccesses: { include: { city: true } },
    },
  })

  console.log('✅ User updated successfully!')
  console.log(`New status:`)
  console.log(`  - isGlobalAdmin: ${updatedUser?.isGlobalAdmin}`)
  console.log(`  - Roles: ${updatedUser?.roles.map(r => r.role.name).join(', ')}`)
  console.log(`  - Cities: ${updatedUser?.cityAccesses.map(c => c.city.name).join(', ')}`)
  console.log(`  - Status: ${updatedUser?.status}`)
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
