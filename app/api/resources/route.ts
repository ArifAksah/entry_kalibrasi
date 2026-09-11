import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { requireAdmin } from '../../../lib/api-auth'

// Enumerate available API resources dynamically from folder structure under app/api.
// Returns top-level directory names as resource identifiers, excluding utility endpoints.
// ⚠️ This reveals the full internal API surface, so it is restricted to admins;
// unauthenticated / low-privilege callers should not be able to map every endpoint.
export async function GET(request: NextRequest) {
  const gate = await requireAdmin(request)
  if (gate instanceof NextResponse) return gate

  try {
    const projectRoot = process.cwd()
    const apiDir = path.join(projectRoot, 'app', 'api')

    if (!fs.existsSync(apiDir)) {
      return NextResponse.json([], { status: 200 })
    }

    const dirents = fs.readdirSync(apiDir, { withFileTypes: true })
    let resources = dirents
      .filter((d) => d.isDirectory())
      .map((d) => d.name)

    const EXCLUDE = new Set<string>([
      'resources',
      'role-permissions',
      'auth',
      '_next',
    ])

    resources = resources.filter((name) => !EXCLUDE.has(name))
    return NextResponse.json(resources.sort())
  } catch {
    return NextResponse.json({ error: 'Failed to enumerate resources' }, { status: 500 })
  }
}
