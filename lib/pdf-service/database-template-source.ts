/**
 * DatabaseTemplateSource — Fetches template configuration for PDF generation.
 *
 * Supports two template formats:
 * 1. Rich text templates (TipTap JSON in `content` column) — uses HTML renderer directly
 * 2. Hardcoded templates (TemplateRegistry fallback) — for certificate types without DB templates
 *
 * Resolution order for rich text:
 * 1. Database lookup for template with non-null `content`
 * 2. Hardcoded TemplateRegistry fallback
 *
 * The old block-based pipeline (BlockConverter) has been removed.
 * Templates that only have cover_blocks/results_blocks will fall through
 * to the hardcoded registry.
 */

import type { CertificateType, TemplateConfig } from './types'
import { defaultRegistry } from './template-registry'
import { getActiveRichTextTemplate, getRichTextTemplateByVersion } from '../rich-text-editor/storage-service'
import { generatePdfHtml } from '../rich-text-editor/html-renderer'
import { generateWordPdfHtml, generateWordPdfRenderData, generateTwoTemplatePdfHtml, combineWordPages, replaceWordVariables } from '../rich-text-editor/word-template-processor'
import type { CertificateData, PageSettings, WordPdfRenderData } from '../rich-text-editor/types'
import { DEFAULT_PAGE_SETTINGS } from '../rich-text-editor/types'
import { supabaseAdmin } from '../supabase'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TemplateConfigResult {
  config: TemplateConfig
  /** The version number used, or null if hardcoded fallback was used */
  version: number | null
  /** Where the config was sourced from */
  source: 'cache' | 'database' | 'registry'
}

// ─── Simple In-Memory Cache ──────────────────────────────────────────────────

const configCache = new Map<string, { config: TemplateConfig; timestamp: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

function getCacheKey(certificateType: string, version?: number | null): string {
  return version != null ? `${certificateType}:v${version}` : certificateType
}

/** Clear the in-memory config cache. Useful for testing. */
export function clearConfigCache(): void {
  configCache.clear()
}

function getCached(certificateType: string, version?: number | null): TemplateConfig | null {
  const key = getCacheKey(certificateType, version)
  const entry = configCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    configCache.delete(key)
    return null
  }
  return entry.config
}

function setCache(certificateType: string, config: TemplateConfig, version?: number | null): void {
  const key = getCacheKey(certificateType, version)
  configCache.set(key, { config, timestamp: Date.now() })
}

// ─── DatabaseTemplateSource Interface ────────────────────────────────────────

export interface DatabaseTemplateSource {
  /**
   * Get a TemplateConfig for the given certificate type.
   * Falls back to hardcoded registry if no database template exists.
   */
  getTemplateConfig(
    certificateType: CertificateType,
    templateVersion?: number | null
  ): Promise<TemplateConfigResult>

  /**
   * Get the final PDF HTML string for a rich text template.
   * Returns null if no rich text template exists (caller should fall back to block-based).
   */
  getRichTextPdfHtml(
    certificateType: string,
    certificateData: CertificateData,
    templateVersion?: number | null
  ): Promise<string | null>

  /**
   * Get the full PDF render data including body HTML and optional header/footer templates.
   * Returns null if no rich text template exists.
   * Use this method when you need Playwright header/footer support.
   */
  getRichTextPdfRenderData(
    certificateType: string,
    certificateData: CertificateData,
    templateVersion?: number | null
  ): Promise<WordPdfRenderData | null>
}

// ─── Implementation ──────────────────────────────────────────────────────────

/**
 * Creates a DatabaseTemplateSource instance.
 */
export function createDatabaseTemplateSource(): DatabaseTemplateSource {
  return {
    async getTemplateConfig(
      certificateType: CertificateType,
      templateVersion?: number | null
    ): Promise<TemplateConfigResult> {
      // ─── Step 1: Check cache ─────────────────────────────────────────
      const cached = getCached(certificateType, templateVersion)
      if (cached) {
        return {
          config: cached,
          version: templateVersion ?? null,
          source: 'cache',
        }
      }

      // ─── Step 2: Try database for rich text template ─────────────────
      try {
        let templateRecord

        if (templateVersion != null) {
          templateRecord = await getRichTextTemplateByVersion(certificateType, templateVersion)
          if (!templateRecord) {
            // Fall back to active
            console.warn(
              `[DatabaseTemplateSource] Template version ${templateVersion} not found for type "${certificateType}". ` +
              `Falling back to latest active version.`
            )
            templateRecord = await getActiveRichTextTemplate(certificateType)
          }
        } else {
          templateRecord = await getActiveRichTextTemplate(certificateType)
        }

        if (templateRecord && (templateRecord.content || templateRecord.cover_html)) {
          // Rich text or Word template found — create a config that signals rich text mode
          const config: TemplateConfig = {
            certificateType,
            isRichText: true,
            richTextContent: templateRecord.content,
            richTextPageSettings: templateRecord.page_settings || DEFAULT_PAGE_SETTINGS,
          } as any

          setCache(certificateType, config, templateVersion)
          return { config, version: templateRecord.version, source: 'database' }
        }
      } catch (dbError: any) {
        console.warn(
          `[DatabaseTemplateSource] Database lookup failed for type "${certificateType}": ${dbError.message}. ` +
          `Falling back to hardcoded template.`
        )
      }

      // ─── Step 3: Fall back to hardcoded registry ─────────────────────
      console.warn(
        `[DatabaseTemplateSource] No rich text template found for type "${certificateType}". ` +
        `Using hardcoded template from TemplateRegistry.`
      )

      const fallbackConfig = defaultRegistry.get(certificateType)
      setCache(certificateType, fallbackConfig, templateVersion)

      return { config: fallbackConfig, version: null, source: 'registry' }
    },

    async getRichTextPdfHtml(
      certificateType: string,
      certificateData: CertificateData,
      templateVersion?: number | null
    ): Promise<string | null> {
      try {
        let template

        if (templateVersion != null) {
          template = await getRichTextTemplateByVersion(certificateType, templateVersion)
        }

        if (!template) {
          template = await getActiveRichTextTemplate(certificateType)
        }

        if (!template) {
          return null
        }

        const pageSettings: PageSettings = template.page_settings || DEFAULT_PAGE_SETTINGS

        // Priority 1: Word template (cover_html present)
        if (template.cover_html) {
          // 2-file mode: cover + results per sensor
          if (template.results_html && !template.end_html) {
            const html = generateTwoTemplatePdfHtml(
              template.cover_html,
              template.results_html,
              certificateData,
              pageSettings
            )
            return html
          }

          // Single-file mode: only cover_html, no results_html/end_html
          // Page breaks from Word are preserved in the HTML by mammoth.js
          if (!template.results_html && !template.end_html) {
            const html = generateWordPdfHtml(
              template.cover_html,
              certificateData,
              pageSettings
            )
            return html
          }

          // Legacy 3-file mode: backward compatibility (has end_html)
          const html = combineWordPages(
            template.cover_html || '',
            template.results_html || '',
            template.end_html || '',
            certificateData,
            pageSettings
          )
          return html
        }

        // Priority 2: TipTap content
        if (template.content) {
          const html = generatePdfHtml(template.content, certificateData, pageSettings)
          return html
        }

        // No usable template content
        return null
      } catch (error: any) {
        console.warn(
          `[DatabaseTemplateSource] Rich text PDF generation failed for type "${certificateType}": ${error.message}. ` +
          `Caller should fall back to block-based rendering.`
        )
        return null
      }
    },

    async getRichTextPdfRenderData(
      certificateType: string,
      certificateData: CertificateData,
      templateVersion?: number | null
    ): Promise<WordPdfRenderData | null> {
      try {
        let template

        if (templateVersion != null) {
          template = await getRichTextTemplateByVersion(certificateType, templateVersion)
        }

        if (!template) {
          template = await getActiveRichTextTemplate(certificateType)
        }

        if (!template) {
          return null
        }

        const pageSettings: PageSettings = template.page_settings || DEFAULT_PAGE_SETTINGS

        // Priority 1: Word template (cover_html present)
        if (template.cover_html) {
          const repeatingHeader = (template as any).repeating_header || null
          const repeatingFooter = (template as any).repeating_footer || null

          // 2-file mode: cover + results per sensor (with header/footer support)
          if (template.results_html && !template.end_html) {
            const bodyHtml = generateTwoTemplatePdfHtml(
              template.cover_html,
              template.results_html,
              certificateData,
              pageSettings
            )

            // Process header/footer templates
            const headerTemplate = repeatingHeader
              ? replaceWordVariables(repeatingHeader, certificateData)
              : null
            const footerTemplate = repeatingFooter
              ? replaceWordVariables(repeatingFooter, certificateData)
              : null

            return {
              bodyHtml,
              headerTemplate,
              footerTemplate,
              displayHeaderFooter: !!(headerTemplate || footerTemplate),
            }
          }

          // Single-file mode: use generateWordPdfRenderData for header/footer support
          if (!template.results_html && !template.end_html) {
            return generateWordPdfRenderData(
              template.cover_html,
              certificateData,
              pageSettings,
              repeatingHeader,
              repeatingFooter
            )
          }

          // Legacy 3-file mode: backward compatibility (has end_html)
          const html = combineWordPages(
            template.cover_html || '',
            template.results_html || '',
            template.end_html || '',
            certificateData,
            pageSettings
          )
          return {
            bodyHtml: html,
            headerTemplate: null,
            footerTemplate: null,
            displayHeaderFooter: false,
          }
        }

        // Priority 2: TipTap content (no header/footer support for TipTap)
        if (template.content) {
          const html = generatePdfHtml(template.content, certificateData, pageSettings)
          return {
            bodyHtml: html,
            headerTemplate: null,
            footerTemplate: null,
            displayHeaderFooter: false,
          }
        }

        return null
      } catch (error: any) {
        console.warn(
          `[DatabaseTemplateSource] Rich text PDF render data failed for type "${certificateType}": ${error.message}. ` +
          `Caller should fall back to block-based rendering.`
        )
        return null
      }
    },
  }
}

// ─── Singleton Export ────────────────────────────────────────────────────────

/** Default singleton instance of the DatabaseTemplateSource */
export const databaseTemplateSource: DatabaseTemplateSource = createDatabaseTemplateSource()
