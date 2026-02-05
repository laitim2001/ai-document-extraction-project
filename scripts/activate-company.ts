/**
 * 激活測試公司
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  const companyId = '694528e7-8106-4601-9c8c-1bc396d445ef'

  const updated = await prisma.company.update({
    where: { id: companyId },
    data: { status: 'ACTIVE' },
    select: { id: true, name: true, status: true }
  })

  console.log('✅ Updated:', JSON.stringify(updated, null, 2))

  await pool.end()
  process.exit(0)
}

main().catch(e => {
  console.error('Error:', e)
  process.exit(1)
})
