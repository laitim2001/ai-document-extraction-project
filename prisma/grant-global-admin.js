/**
 * @fileoverview 一次性授予 Global Admin（運維修補）。
 *   `User.isGlobalAdmin` 是 auth 判定全域權限的欄位（`auth.ts` 的 jwt callback
 *   讀 `dbUser.isGlobalAdmin` 寫入 token；`withCityFilter` 對非 globalAdmin 且無
 *   城市權限的用戶回 403）。但 admin 後台的 `PATCH /api/admin/users/[id]` 只能改
 *   name/roleIds/cityId、**改不了 is_global_admin** → 設真 globalAdmin 只能改 DB。
 *
 *   本 script 把 `GRANT_GLOBAL_ADMIN_EMAIL` 指定的帳號 `is_global_admin` 設為 true。
 *   只用 `pg`、冪等（只更新 is_global_admin=false 者）、非致命；用參數化查詢避免注入。
 *
 *   由 docker-entrypoint.sh 在 `GRANT_GLOBAL_ADMIN_EMAIL` 有值時觸發；
 *   執行後把該 env 清空/移除。被授權者需重新登入，session 才會帶新權限。
 *
 * @module prisma/grant-global-admin
 * @since 2026-06-23
 * @lastModified 2026-06-23
 */
const { Client } = require('pg')

function resolveSsl() {
  const url = process.env.DATABASE_URL || ''
  if (/sslmode=require/i.test(url) || /\.postgres\.database\.azure\.com/i.test(url)) {
    return { rejectUnauthorized: false }
  }
  return false
}

async function main() {
  const email = (process.env.GRANT_GLOBAL_ADMIN_EMAIL || '').toLowerCase().trim()
  if (!email) {
    console.log('[grant-global-admin] GRANT_GLOBAL_ADMIN_EMAIL not set — skip')
    return
  }
  if (!process.env.DATABASE_URL) {
    console.error('[grant-global-admin] DATABASE_URL not set — cannot continue')
    process.exit(1)
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolveSsl(),
    connectionTimeoutMillis: 30000,
  })

  await client.connect()
  try {
    // 參數化查詢防注入；只更新尚未是 globalAdmin 者（冪等）。
    const res = await client.query(
      `update users set is_global_admin = true
       where lower(email) = $1 and is_global_admin = false`,
      [email]
    )
    console.log(
      `[grant-global-admin] done — ${res.rowCount} account(s) granted global admin for ${email}`
    )
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error('[grant-global-admin] FAILED:', e.message)
  process.exit(1)
})
