import { generateCertificateResultsOpenApiDocument } from '../../lib/openapi/certificate-results'

describe('generateCertificateResultsOpenApiDocument', () => {
  it('menghasilkan dokumen OpenAPI 3.1 dengan schema utama CertificateResultsV1', () => {
    const doc = generateCertificateResultsOpenApiDocument()

    expect(doc.openapi).toBe('3.1.0')
    expect(doc.info.title).toBe('SIMKAL Certificate Results Contract')
    expect(doc.paths!['/api/openapi/certificate-results']).toBeDefined()
    expect(doc.components!.schemas!.CertificateResultsV1).toBeDefined()
    expect(doc.components!.schemas!.SensorResultV1).toBeDefined()
    expect(doc.components!.schemas!.SensorSnapshot).toBeDefined()
  })
})
