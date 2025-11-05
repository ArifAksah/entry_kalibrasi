import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Enumerate available API resources dynamically from folder structure under app/api
// Returns top-level directory names as resource identifiers, excluding utility endpoints
export async function GET() {
  try {
    const projectRoot = process.cwd()
    const apiDir = path.join(projectRoot, 'app', 'api')

    if (!fs.existsSync(apiDir)) {
      return NextResponse.json([], { status: 200 })
    }

    const dirents = fs.readdirSync(apiDir, { withFileTypes: true })
    // Consider only directories (each directory is one resource namespace)
    let resources = dirents
      .filter((d) => d.isDirectory())
      .map((d) => d.name)

    // Exclude internal/utility endpoints that shouldn't appear as resources
    const EXCLUDE = new Set<string>([
      'resources',
      'role-permissions',
      'auth',
      '_next',
    ])

    resources = resources.filter((name) => !EXCLUDE.has(name))

    // Also, flatten directories that contain only route files without nested resources
    // We keep the top-level names; nested subroutes can be represented as the same resource
    return NextResponse.json(resources.sort())
  } catch (e) {
    return NextResponse.json({ error: 'Failed to enumerate resources' }, { status: 500 })
  }
}
