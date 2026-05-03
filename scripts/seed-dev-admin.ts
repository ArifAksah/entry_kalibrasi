import { config as loadEnv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

type AdminRole = 'admin'

interface AdminSeedConfig {
  email: string
  password: string
  name: string
  nip: string
  nik: string
  phone: string
  role: AdminRole
  dryRun: boolean
}

function parseArgs(argv: string[]) {
  const flags = new Set(argv)

  return {
    dryRun: flags.has('--dry-run'),
  }
}

function loadDevelopmentEnv() {
  loadEnv({ path: '.env' })
  loadEnv({ path: '.env.local', override: true })
}

function readConfig(): AdminSeedConfig {
  const args = parseArgs(process.argv.slice(2))

  return {
    email: process.env.DEV_ADMIN_EMAIL || 'admin.dev@local.test',
    password: process.env.DEV_ADMIN_PASSWORD || 'Admin123!',
    name: process.env.DEV_ADMIN_NAME || 'Development Admin',
    nip: process.env.DEV_ADMIN_NIP || '',
    nik: process.env.DEV_ADMIN_NIK || '',
    phone: process.env.DEV_ADMIN_PHONE || '',
    role: 'admin',
    dryRun: args.dryRun,
  }
}

function requireEnv(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

async function findAuthUserByEmail(
  supabaseAdmin: ReturnType<typeof createClient>,
  email: string
) {
  let page = 1

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 200,
    })

    if (error) {
      throw new Error(`Failed to list auth users: ${error.message}`)
    }

    const users = data.users || []
    const matchedUser = users.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase()
    )

    if (matchedUser) {
      return matchedUser
    }

    if (users.length < 200) {
      return null
    }

    page += 1
  }
}

async function main() {
  loadDevelopmentEnv()

  const cfg = readConfig()
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  console.log(`[seed-dev-admin] env source priority: .env.local > .env`)
  console.log(`[seed-dev-admin] target url: ${supabaseUrl}`)
  console.log(`[seed-dev-admin] target email: ${cfg.email}`)
  console.log(`[seed-dev-admin] dry run: ${cfg.dryRun}`)

  const existingAuthUser = await findAuthUserByEmail(supabaseAdmin, cfg.email)
  const { data: existingPersonel, error: personelLookupError } = await supabaseAdmin
    .from('personel')
    .select('id, email, name')
    .eq('email', cfg.email)
    .maybeSingle()

  if (personelLookupError) {
    throw new Error(`Failed to lookup personel: ${personelLookupError.message}`)
  }

  if (
    existingAuthUser &&
    existingPersonel &&
    existingPersonel.id !== existingAuthUser.id
  ) {
    throw new Error(
      `Email ${cfg.email} already exists but auth user and personel row have different ids`
    )
  }

  if (cfg.dryRun) {
    console.log(
      `[seed-dev-admin] auth user: ${existingAuthUser ? existingAuthUser.id : 'missing'}`
    )
    console.log(
      `[seed-dev-admin] personel row: ${existingPersonel ? existingPersonel.id : 'missing'}`
    )
    console.log(`[seed-dev-admin] role to enforce: ${cfg.role}`)
    return
  }

  let userId = existingAuthUser?.id || existingPersonel?.id || null

  if (!existingAuthUser) {
    const { data: createdUser, error: createUserError } =
      await supabaseAdmin.auth.admin.createUser({
        email: cfg.email,
        password: cfg.password,
        email_confirm: true,
        user_metadata: {
          name: cfg.name,
          phone: cfg.phone,
          nip: cfg.nip,
          nik: cfg.nik,
        },
      })

    if (createUserError || !createdUser.user) {
      throw new Error(createUserError?.message || 'Failed to create auth user')
    }

    userId = createdUser.user.id
    console.log(`[seed-dev-admin] created auth user: ${userId}`)
  } else {
    console.log(`[seed-dev-admin] auth user already exists: ${existingAuthUser.id}`)
  }

  if (!userId) {
    throw new Error('Could not determine user id for admin seed')
  }

  const { error: personelUpsertError } = await supabaseAdmin.from('personel').upsert(
    {
      id: userId,
      name: cfg.name,
      nip: cfg.nip,
      nik: cfg.nik || null,
      nik_index: null,
      phone: cfg.phone,
      email: cfg.email,
    },
    { onConflict: 'id' }
  )

  if (personelUpsertError) {
    throw new Error(`Failed to upsert personel: ${personelUpsertError.message}`)
  }

  const { error: roleUpsertError } = await supabaseAdmin.from('user_roles').upsert(
    {
      user_id: userId,
      role: cfg.role,
      station_id: null,
    },
    { onConflict: 'user_id' }
  )

  if (roleUpsertError) {
    throw new Error(`Failed to upsert user role: ${roleUpsertError.message}`)
  }

  console.log(`[seed-dev-admin] personel and role synced for user: ${userId}`)
  console.log('[seed-dev-admin] admin seed completed')
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[seed-dev-admin] failed: ${message}`)
  process.exit(1)
})
