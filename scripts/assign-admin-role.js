/**
 * Script to assign System Admin + Super User + Auditor roles to a user
 * Usage: node scripts/assign-admin-role.js
 *
 * Requires: DATABASE_URL environment variable (loaded from .env)
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const TARGET_EMAIL = 'chris.lai@rapo.com.hk';

async function main() {
  // 1. Find the user
  const user = await prisma.user.findUnique({
    where: { email: TARGET_EMAIL },
    include: { roles: { include: { role: true } } }
  });

  if (!user) {
    console.log(`ERROR: User ${TARGET_EMAIL} not found in database`);
    return;
  }

  console.log('Found user:', user.id, user.name, user.email);
  console.log('Current roles:', user.roles.map(r => r.role.name).join(', ') || '(none)');

  // 2. Find all key roles
  const roles = await prisma.role.findMany({
    where: {
      name: { in: ['System Admin', 'Super User', 'Auditor'] }
    }
  });

  console.log('\nRoles to assign:', roles.map(r => `${r.name} (${r.id})`).join(', '));

  // 3. Assign missing roles
  const existingRoleNames = user.roles.map(r => r.role.name);

  for (const role of roles) {
    if (existingRoleNames.includes(role.name)) {
      console.log(`  - ${role.name}: already assigned`);
      continue;
    }

    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id,
      }
    });
    console.log(`  + ${role.name}: ASSIGNED`);
  }

  // 4. Verify final state
  const updated = await prisma.user.findUnique({
    where: { email: TARGET_EMAIL },
    include: { roles: { include: { role: true } } }
  });

  console.log('\nFinal roles:', updated.roles.map(r => r.role.name).join(', '));
  console.log('\nDone! Please log out and log back in for changes to take effect.');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
