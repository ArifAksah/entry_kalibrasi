import { NextRequest, NextResponse } from 'next/server'
import { generateCertificateResultsOpenApiDocument } from '../../../../lib/openapi/certificate-results'
import { requireAdmin } from '../../../../lib/api-auth'

export async function GET(request: NextRequest) {
  const gate = await requireAdmin(request)
  if (gate instanceof NextResponse) return gate

  try {
    const document = generateCertificateResultsOpenApiDocument()
    return NextResponse.json(document, {
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return NextResponse.json(
      {
        error: 'Failed to generate OpenAPI document',
      },
      { status: 500 }
    )
  }
}
