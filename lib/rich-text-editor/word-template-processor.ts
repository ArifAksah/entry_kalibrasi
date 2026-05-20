/**
 * Word Template Processor
 *
 * Handles conversion of Word (.docx) files to HTML and variable replacement
 * using ${variable_name} syntax (dollar sign + curly braces).
 *
 * This is separate from the TipTap-based template system which uses {{variable}} syntax.
 */

import mammoth from 'mammoth'
import { CertificateData, PageSettings, WordPdfRenderData } from './types'
import { VARIABLE_REGISTRY, getValueByPath } from './variable-helpers'

// ─── DOCX to HTML Conversion ─────────────────────────────────────────────────

/**
 * Convert a Word (.docx) buffer to HTML string.
 * Preserves formatting: bold, italic, tables, images, alignment.
 */
export async function convertDocxToHtml(buffer: Buffer): Promise<{ html: string; warnings: string[] }> {
  const warnings: string[] = []

  const result = await mammoth.convertToHtml(
    { buffer },
    {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Heading 4'] => h4:fresh",
        "p[style-name='Title'] => h1.title:fresh",
        "p[style-name='Subtitle'] => h2.subtitle:fresh",
      ],
      convertImage: mammoth.images.imgElement(function (image) {
        return image.read('base64').then(function (imageBuffer) {
          return {
            src: `data:${image.contentType};base64,${imageBuffer}`,
          }
        })
      }),
    }
  )

  for (const msg of result.messages) {
    if (msg.type === 'warning') {
      warnings.push(msg.message)
    }
  }

  return { html: result.value, warnings }
}

// ─── Variable Replacement (${} syntax) ───────────────────────────────────────

/**
 * Replace ${variable} tags in HTML with actual data.
 * Uses dollar-sign syntax: ${nama_alat}, ${nomor_sertifikat}, etc.
 * For loops: ${#each hasil_kalibrasi}...${/each}
 */
export function replaceWordVariables(html: string, data: CertificateData): string {
  // Step 1: Expand loops first
  const afterLoops = expandWordLoops(html, data)

  // Step 2: Replace simple variables
  const afterVariables = replaceSimpleWordVariables(afterLoops, data)

  return afterVariables
}

/**
 * Replace simple (non-loop) ${variable_name} patterns with actual values.
 */
function replaceSimpleWordVariables(text: string, data: CertificateData): string {
  // Match ${variable_name} patterns (not loop syntax like ${#each} or ${/each})
  return text.replace(/\$\{([^#/}][^}]*?)\}/g, (match, variableName) => {
    const trimmedName = variableName.trim()

    // Look up the variable in the registry
    const variableDef = VARIABLE_REGISTRY.find((v) => v.name === trimmedName)

    if (!variableDef) {
      // Variable not found in registry — replace with empty string
      console.warn(`[word-template] Variable "\${${trimmedName}}" not found in registry`)
      return ''
    }

    // Skip loop variables (results category) outside of loops
    if (variableDef.category === 'results') {
      return match
    }

    // Special handling for qr_code — output as <img> tag
    if (trimmedName === 'qr_code') {
      const qrValue = getValueByPath(data, variableDef.dataKey)
      if (!qrValue) return ''
      // If already an <img> tag, return as-is; otherwise wrap in img tag
      if (qrValue.startsWith('<img')) return qrValue
      if (qrValue.startsWith('data:')) return `<img src="${qrValue}" style="width: 80px; height: 80px;" alt="QR Code" />`
      return qrValue
    }

    // Resolve the value using the dataKey path
    const value = getValueByPath(data, variableDef.dataKey)

    if (value == null) {
      console.warn(
        `[word-template] Variable "\${${trimmedName}}" resolved to null/undefined (path: ${variableDef.dataKey})`
      )
      return ''
    }

    return value
  })
}

/**
 * Expand ${#each hasil_kalibrasi}...${/each} blocks in the HTML.
 * For each record in data.results array, duplicates the inner content
 * and replaces loop-scoped variables with values from each record.
 */
function expandWordLoops(html: string, data: CertificateData): string {
  // Match ${#each hasil_kalibrasi}...${/each} blocks (supports multiline)
  const loopRegex = /\$\{#each\s+hasil_kalibrasi\s*\}([\s\S]*?)\$\{\/each\}/g

  return html.replace(loopRegex, (_match, innerContent: string) => {
    const results = data.results

    // If results is empty or not an array, remove the entire loop block
    if (!Array.isArray(results) || results.length === 0) {
      return ''
    }

    // Loop-scoped variable names
    const loopVariables = ['no_urut', 'titik_ukur', 'pembacaan', 'koreksi', 'ketidakpastian']

    // For each record, duplicate the inner content and replace loop-scoped variables
    const expandedRows = results.map((record) => {
      let rowContent = innerContent

      for (const varName of loopVariables) {
        const pattern = new RegExp(`\\$\\{${varName}\\}`, 'g')
        const value = record[varName as keyof typeof record]

        if (value == null) {
          rowContent = rowContent.replace(pattern, '')
        } else {
          rowContent = rowContent.replace(pattern, String(value))
        }
      }

      return rowContent
    })

    return expandedRows.join('')
  })
}

// ─── Single-File PDF Generation ──────────────────────────────────────────────

/**
 * Generate PDF-ready HTML from a single Word template HTML.
 * Replaces ${variable} tags with actual data and wraps in full HTML page.
 * Page breaks from the original Word document are preserved (mammoth.js converts
 * Word page breaks to CSS page-break-before/after styles).
 */
export function generateWordPdfHtml(
  templateHtml: string,
  data: CertificateData,
  pageSettings: PageSettings
): string {
  // Replace all ${variable} tags with actual data
  const processedHtml = replaceWordVariables(templateHtml, data)

  // Compute page dimensions
  const pageDimensions = getPageDimensions(pageSettings)

  // Wrap in full HTML document with @page CSS
  const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page {
    size: ${pageDimensions.width}mm ${pageDimensions.height}mm;
    margin: ${pageSettings.margins.top}mm ${pageSettings.margins.right}mm ${pageSettings.margins.bottom}mm ${pageSettings.margins.left}mm;
  }

  * {
    box-sizing: border-box;
  }

  html, body {
    margin: 0;
    padding: 0;
    font-family: Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #000;
  }

  body {
    padding: ${pageSettings.margins.top}mm ${pageSettings.margins.right}mm ${pageSettings.margins.bottom}mm ${pageSettings.margins.left}mm;
  }

  /* Table styling */
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 8px 0;
  }

  th, td {
    border: 1px solid #000;
    padding: 4px 8px;
    text-align: left;
    vertical-align: top;
  }

  th {
    font-weight: bold;
    background-color: #f5f5f5;
  }

  /* Image styling */
  img {
    max-width: 100%;
    height: auto;
  }

  /* Heading styles */
  h1 { font-size: 18pt; margin: 12px 0 8px 0; }
  h2 { font-size: 16pt; margin: 10px 0 6px 0; }
  h3 { font-size: 14pt; margin: 8px 0 4px 0; }
  h4 { font-size: 12pt; margin: 6px 0 4px 0; }

  /* Paragraph */
  p { margin: 4px 0; }

  /* List styling */
  ul, ol { margin: 4px 0; padding-left: 24px; }

  /* Text alignment */
  [style*="text-align: center"] { text-align: center; }
  [style*="text-align: right"] { text-align: right; }
  [style*="text-align: justify"] { text-align: justify; }
</style>
</head>
<body>
${processedHtml}
</body>
</html>`

  return fullHtml
}

// ─── Two-Template PDF Generation (Cover + Results per Sensor) ────────────────

/**
 * Generate PDF HTML from separate cover and results templates.
 * Cover is rendered once. Results template is rendered per sensor.
 * Page breaks are inserted between cover and first sensor, and between sensors.
 *
 * If the data model has sensor-level results (data.results_sensors), each sensor
 * gets its own results page. Otherwise, the results template is rendered once
 * with the standard ${#each hasil_kalibrasi} loop handling the per-row repetition.
 */
export function generateTwoTemplatePdfHtml(
  coverHtml: string,
  resultsHtml: string,
  data: CertificateData,
  pageSettings: PageSettings
): string {
  // Replace variables in cover (simple variables + any loops in cover)
  const processedCover = replaceWordVariables(coverHtml, data)

  // For results: replace variables per sensor if sensor data is available,
  // otherwise render once with standard loop expansion
  const resultsSections: string[] = []

  // Check if data has per-sensor results (results_sensors array)
  const sensors = (data as any).results_sensors as Array<any> | undefined

  if (sensors && Array.isArray(sensors) && sensors.length > 0) {
    // Multi-sensor mode: render results template once per sensor
    for (const sensor of sensors) {
      // Strip ${#each sensors} and ${/each} markers (we're looping programmatically)
      let sensorResultsHtml = resultsHtml
        .replace(/\$\{#each\s+sensors\s*\}/g, '')
        .replace(/\$\{\/each\}/g, '')

      // Replace sensor-specific variables directly (these are skipped by replaceSimpleWordVariables)
      const sensorVarMap: Record<string, string> = {
        sensor_nama: sensor.sensor_nama || sensor.name || '',
        sensor_merk: sensor.sensor_merk || sensor.merk || '',
        sensor_tipe: sensor.sensor_tipe || sensor.tipe || '',
        sensor_no_seri: sensor.sensor_no_seri || sensor.no_seri || '',
      }

      for (const [varName, value] of Object.entries(sensorVarMap)) {
        sensorResultsHtml = sensorResultsHtml.replace(
          new RegExp(`\\$\\{${varName}\\}`, 'g'),
          value
        )
      }

      // Create a merged data object with this sensor's results for ${#each hasil_kalibrasi} expansion
      const sensorData: CertificateData = {
        ...data,
        // Override results with this sensor's calibration results
        results: sensor.hasil_kalibrasi || sensor.results || [],
      }

      // Now process remaining variables and loops (${#each hasil_kalibrasi} etc.)
      const processedResults = replaceWordVariables(sensorResultsHtml, sensorData)
      resultsSections.push(processedResults)
    }
  } else {
    // Single render mode: strip ${#each sensors}/${/each} markers and use standard loop expansion
    let cleanedResults = resultsHtml
      .replace(/\$\{#each\s+sensors\s*\}/g, '')
      .replace(/\$\{\/each\}/g, '')

    const processedResults = replaceWordVariables(cleanedResults, data)
    resultsSections.push(processedResults)
  }

  // Compute page dimensions
  const pageDimensions = getPageDimensions(pageSettings)

  // Build sections with page breaks: cover + page break + results[0] + page break + results[1] + ...
  const sections: string[] = []
  sections.push(`<div class="word-section word-cover">${processedCover}</div>`)

  for (let i = 0; i < resultsSections.length; i++) {
    sections.push('<div style="page-break-before: always;"></div>')
    sections.push(`<div class="word-section word-results">${resultsSections[i]}</div>`)
  }

  const bodyContent = sections.join('\n')

  // Wrap in full HTML document with @page CSS
  const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page {
    size: ${pageDimensions.width}mm ${pageDimensions.height}mm;
    margin: ${pageSettings.margins.top}mm ${pageSettings.margins.right}mm ${pageSettings.margins.bottom}mm ${pageSettings.margins.left}mm;
  }

  * {
    box-sizing: border-box;
  }

  html, body {
    margin: 0;
    padding: 0;
    font-family: Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #000;
  }

  body {
    padding: ${pageSettings.margins.top}mm ${pageSettings.margins.right}mm ${pageSettings.margins.bottom}mm ${pageSettings.margins.left}mm;
  }

  /* Table styling */
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 8px 0;
  }

  th, td {
    border: 1px solid #000;
    padding: 4px 8px;
    text-align: left;
    vertical-align: top;
  }

  th {
    font-weight: bold;
    background-color: #f5f5f5;
  }

  /* Image styling */
  img {
    max-width: 100%;
    height: auto;
  }

  /* Heading styles */
  h1 { font-size: 18pt; margin: 12px 0 8px 0; }
  h2 { font-size: 16pt; margin: 10px 0 6px 0; }
  h3 { font-size: 14pt; margin: 8px 0 4px 0; }
  h4 { font-size: 12pt; margin: 6px 0 4px 0; }

  /* Paragraph */
  p { margin: 4px 0; }

  /* List styling */
  ul, ol { margin: 4px 0; padding-left: 24px; }

  /* Word section styling */
  .word-section {
    /* Each section is a logical page */
  }

  /* Text alignment */
  [style*="text-align: center"] { text-align: center; }
  [style*="text-align: right"] { text-align: right; }
  [style*="text-align: justify"] { text-align: justify; }
</style>
</head>
<body>
${bodyContent}
</body>
</html>`

  return fullHtml
}

// ─── PDF Render Data (with Header/Footer) ────────────────────────────────────

/**
 * Generate complete PDF render data including body HTML and optional
 * repeating header/footer templates for Playwright PDF generation.
 *
 * The headerTemplate and footerTemplate follow Playwright's format:
 * - Must be valid HTML with inline styles
 * - Can use special classes: pageNumber, totalPages, date, title, url
 * - ${variable} tags in header/footer are replaced with actual data
 */
export function generateWordPdfRenderData(
  templateHtml: string,
  data: CertificateData,
  pageSettings: PageSettings,
  repeatingHeader: string | null,
  repeatingFooter: string | null
): WordPdfRenderData {
  // Generate the main body HTML
  const bodyHtml = generateWordPdfHtml(templateHtml, data, pageSettings)

  // Process header/footer templates — replace ${variable} tags with data
  const headerTemplate = repeatingHeader
    ? replaceSimpleWordVariablesPublic(repeatingHeader, data)
    : null

  const footerTemplate = repeatingFooter
    ? replaceSimpleWordVariablesPublic(repeatingFooter, data)
    : null

  const displayHeaderFooter = !!(headerTemplate || footerTemplate)

  return {
    bodyHtml,
    headerTemplate,
    footerTemplate,
    displayHeaderFooter,
  }
}

/**
 * Public wrapper for replaceSimpleWordVariables — used for header/footer processing.
 * Replaces ${variable} tags with actual data values.
 */
function replaceSimpleWordVariablesPublic(text: string, data: CertificateData): string {
  return replaceSimpleWordVariables(text, data)
}

// ─── Page Combination (Legacy — kept for backward compatibility) ──────────────

/**
 * Combine cover, results, and end page HTML into a single PDF-ready HTML document.
 * Inserts page breaks between each section.
 *
 * @deprecated Use generateWordPdfHtml() for new single-file Word templates.
 * This function is kept for backward compatibility with templates that have
 * separate cover_html, results_html, and end_html.
 */
export function combineWordPages(
  coverHtml: string,
  resultsHtml: string,
  endHtml: string,
  data: CertificateData,
  pageSettings: PageSettings
): string {
  // Replace variables in each section
  const processedCover = coverHtml ? replaceWordVariables(coverHtml, data) : ''
  const processedResults = resultsHtml ? replaceWordVariables(resultsHtml, data) : ''
  const processedEnd = endHtml ? replaceWordVariables(endHtml, data) : ''

  // Compute page dimensions
  const pageDimensions = getPageDimensions(pageSettings)

  // Build sections with page breaks
  const sections: string[] = []

  if (processedCover) {
    sections.push(`<div class="word-section word-cover">${processedCover}</div>`)
  }

  if (processedResults) {
    if (sections.length > 0) {
      sections.push('<div style="page-break-after: always;"></div>')
    }
    sections.push(`<div class="word-section word-results">${processedResults}</div>`)
  }

  if (processedEnd) {
    if (sections.length > 0) {
      sections.push('<div style="page-break-after: always;"></div>')
    }
    sections.push(`<div class="word-section word-end">${processedEnd}</div>`)
  }

  const bodyContent = sections.join('\n')

  // Wrap in full HTML document
  const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page {
    size: ${pageDimensions.width}mm ${pageDimensions.height}mm;
    margin: ${pageSettings.margins.top}mm ${pageSettings.margins.right}mm ${pageSettings.margins.bottom}mm ${pageSettings.margins.left}mm;
  }

  * {
    box-sizing: border-box;
  }

  html, body {
    margin: 0;
    padding: 0;
    font-family: Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #000;
  }

  body {
    padding: ${pageSettings.margins.top}mm ${pageSettings.margins.right}mm ${pageSettings.margins.bottom}mm ${pageSettings.margins.left}mm;
  }

  /* Table styling */
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 8px 0;
  }

  th, td {
    border: 1px solid #000;
    padding: 4px 8px;
    text-align: left;
    vertical-align: top;
  }

  th {
    font-weight: bold;
    background-color: #f5f5f5;
  }

  /* Image styling */
  img {
    max-width: 100%;
    height: auto;
  }

  /* Heading styles */
  h1 { font-size: 18pt; margin: 12px 0 8px 0; }
  h2 { font-size: 16pt; margin: 10px 0 6px 0; }
  h3 { font-size: 14pt; margin: 8px 0 4px 0; }
  h4 { font-size: 12pt; margin: 6px 0 4px 0; }

  /* Paragraph */
  p { margin: 4px 0; }

  /* List styling */
  ul, ol { margin: 4px 0; padding-left: 24px; }

  /* Word section styling */
  .word-section {
    /* Each section is a logical page */
  }

  /* Text alignment */
  [style*="text-align: center"] { text-align: center; }
  [style*="text-align: right"] { text-align: right; }
  [style*="text-align: justify"] { text-align: justify; }
</style>
</head>
<body>
${bodyContent}
</body>
</html>`

  return fullHtml
}

// ─── Supported Tags ──────────────────────────────────────────────────────────

/**
 * Get list of all supported ${variable} tags for display to admin.
 */
export function getSupportedTags(): Array<{ tag: string; description: string; category: string }> {
  const tags = VARIABLE_REGISTRY.map((v) => ({
    tag: `\${${v.name}}`,
    description: v.description,
    category: v.category,
  }))

  // Add loop syntax
  tags.push({
    tag: '${#each hasil_kalibrasi}',
    description: 'Awal loop untuk baris hasil kalibrasi',
    category: 'loop',
  })
  tags.push({
    tag: '${/each}',
    description: 'Akhir loop hasil kalibrasi',
    category: 'loop',
  })

  return tags
}

/**
 * Detect all ${...} tags found in an HTML string.
 */
export function detectTags(html: string): string[] {
  const tags: string[] = []
  const pattern = /\$\{([^}]+)\}/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(html)) !== null) {
    const tag = `\${${match[1]}}`
    if (!tags.includes(tag)) {
      tags.push(tag)
    }
  }

  return tags
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Get page dimensions in mm based on paper size and orientation.
 */
function getPageDimensions(pageSettings: PageSettings): { width: number; height: number } {
  const sizes: Record<string, { width: number; height: number }> = {
    A4: { width: 210, height: 297 },
    Letter: { width: 216, height: 279 },
    Legal: { width: 216, height: 356 },
  }

  const size = sizes[pageSettings.paperSize] || sizes.A4

  if (pageSettings.orientation === 'landscape') {
    return { width: size.height, height: size.width }
  }

  return size
}
