import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function walk(dir: string, acc: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, acc)
    else if (e.isFile() && e.name === 'route.ts') acc.push(full)
  }
  return acc
}

function toApiPath(file: string, apiRoot: string): string {
  const rel = path.relative(apiRoot, path.dirname(file))
  const segs = rel.split(path.sep).filter(Boolean)
  const mapped = segs.map(s => s.replace(/^\[(.+)\]$/, ':$1'))
  return '/api' + (mapped.length ? '/' + mapped.join('/') : '')
}

function sniffMethods(file: string): string[] {
  try {
    const txt = fs.readFileSync(file, 'utf8')
    const methods = Array.from(txt.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|DELETE)/g)).map(m => m[1])
    return Array.from(new Set(methods))
  } catch {
    return []
  }
}

export async function POST(request: NextRequest) {
  try {
    const apiRoot = path.join(process.cwd(), 'app', 'api')
    if (!fs.existsSync(apiRoot)) return NextResponse.json({ error: 'api folder not found' }, { status: 400 })

    const files = walk(apiRoot)
    const endpoints: Array<{ resource: string; method: string; path: string; description: string; enabled: boolean }> = []

    for (const f of files) {
      const methods = sniffMethods(f)
      const p = toApiPath(f, apiRoot)
      const resource = p.replace(/^\/api\/?/, '').split('/')[0] || 'misc'
      for (const m of methods) {
        endpoints.push({ resource, method: m, path: p, description: 'auto-scanned', enabled: true })
      }
    }

    if (endpoints.length === 0) return NextResponse.json({ message: 'No endpoints found' })

    let count = 0
    const results: any[] = []
    for (const r of endpoints) {
      const { data: upd, error: updErr } = await supabaseAdmin
        .from('endpoint_catalog')
        .update({ resource: r.resource, description: r.description, enabled: r.enabled })
        .eq('method', r.method)
        .eq('path', r.path)
        .select()
      if (!updErr && upd && upd.length) { count += upd.length; results.push(...upd); continue }

      const { data: ins, error: insErr } = await supabaseAdmin
        .from('endpoint_catalog')
        .insert(r)
        .select()
        .single()
      if (!insErr && ins) { count += 1; results.push(ins) }
    }
    return NextResponse.json({ count, data: results })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to scan endpoints' }, { status: 500 })
  }
}



