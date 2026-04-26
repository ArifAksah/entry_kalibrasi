import { NextResponse } from 'next/server'
import { generateCertificateResultsOpenApiDocument } from '../../../../lib/openapi/certificate-results'

export async function GET() {
  try {
    const document = generateCertificateResultsOpenApiDocument()
    return NextResponse.json(document, {
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to generate OpenAPI document',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

