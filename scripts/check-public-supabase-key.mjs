#!/usr/bin/env node

import nextEnv from '@next/env'

nextEnv.loadEnvConfig(process.cwd())

const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!key) {
  console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY wajib di-set saat build production.')
  process.exit(1)
}

const parts = key.split('.')
if (parts.length !== 3) {
  console.error('Public Supabase key harus berupa JWT anon pada deployment self-hosted ini.')
  process.exit(1)
}

try {
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  if (payload.role !== 'anon') {
    console.error(`NEXT_PUBLIC_SUPABASE_ANON_KEY memiliki role '${payload.role || 'unknown'}', bukan 'anon'.`)
    process.exit(1)
  }
  console.log('Public Supabase key role: anon')
} catch {
  console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY tidak memiliki payload JWT yang valid.')
  process.exit(1)
}
