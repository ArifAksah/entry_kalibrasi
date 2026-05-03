import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'
import {
  CalibrationSetupSchema,
  CertificateResultsV1Schema,
  EnvironmentConditionSchema,
  ResultImageSchema,
  ResultTableRowSchema,
  ResultTableSchema,
  SensorDisplaySchema,
  SensorLinksSchema,
  SensorResultV1Schema,
  SensorSnapshotSchema,
  StandardInstrumentRefSchema,
} from '../validators/certificate-results'

function buildRegistry() {
  const registry = new OpenAPIRegistry()

  const ResultTableRow = registry.register('ResultTableRow', ResultTableRowSchema)
  const ResultTable = registry.register('ResultTable', ResultTableSchema)
  const ResultImage = registry.register('ResultImage', ResultImageSchema)
  const EnvironmentCondition = registry.register('EnvironmentCondition', EnvironmentConditionSchema)
  const StandardInstrumentRef = registry.register('StandardInstrumentRef', StandardInstrumentRefSchema)
  const SensorLinks = registry.register('SensorLinks', SensorLinksSchema)
  const SensorSnapshot = registry.register('SensorSnapshot', SensorSnapshotSchema)
  const CalibrationSetup = registry.register('CalibrationSetup', CalibrationSetupSchema)
  const SensorDisplay = registry.register('SensorDisplay', SensorDisplaySchema)
  const SensorResultV1 = registry.register('SensorResultV1', SensorResultV1Schema)
  const CertificateResultsV1 = registry.register('CertificateResultsV1', CertificateResultsV1Schema)

  registry.registerPath({
    method: 'get',
    path: '/api/openapi/certificate-results',
    summary: 'Ambil dokumen OpenAPI untuk kontrak certificate.results',
    description:
      'Dokumen ini digenerate langsung dari Zod schema yang dipakai aplikasi, sehingga perubahan kontrak results otomatis tercermin di sini.',
    tags: ['Certificate Results'],
    responses: {
      200: {
        description: 'Dokumen OpenAPI 3.1 untuk certificate.results',
        content: {
          'application/json': {
            schema: z.object({
              openapi: z.string(),
              info: z.object({
                title: z.string(),
                version: z.string(),
              }),
              paths: z.record(z.string(), z.unknown()),
              components: z.object({
                schemas: z.record(z.string(), z.unknown()),
              }),
            }),
          },
        },
      },
    },
  })

  return {
    registry,
    schemas: {
      ResultTableRow,
      ResultTable,
      ResultImage,
      EnvironmentCondition,
      StandardInstrumentRef,
      SensorLinks,
      SensorSnapshot,
      CalibrationSetup,
      SensorDisplay,
      SensorResultV1,
      CertificateResultsV1,
    },
  }
}

export function generateCertificateResultsOpenApiDocument() {
  const { registry } = buildRegistry()
  const generator = new OpenApiGeneratorV31(registry.definitions)

  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'SIMKAL Certificate Results Contract',
      version: '1.0.0',
      description:
        'Kontrak machine-readable untuk field JSONB certificate.results. Sumber tunggalnya adalah Zod schema V1 di lib/validators/certificate-results.ts.',
    },
    tags: [
      {
        name: 'Certificate Results',
        description: 'Schema hasil kalibrasi sertifikat yang dipakai untuk PDF, LHKS, dan integrasi sistem lain.',
      },
    ],
  })
}
