import { generateHTML } from '@tiptap/html'
import StarterKit from '@tiptap/starter-kit'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import Color from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import FontFamily from '@tiptap/extension-font-family'
import { Node, mergeAttributes } from '@tiptap/core'

import { TipTapDocument, CertificateData, PageSettings } from './types'
import { replaceVariables } from './variable-engine'
import { PageBreak } from './extensions/page-break'

// --- Render Options ---

export interface RenderOptions {
  pageSettings?: PageSettings
  includePageWrapper?: boolean
}

// --- Server-side Custom Extensions ---

/**
 * Server-side VariableNode extension for HTML serialization.
 * Renders as: <span data-variable="variableName" class="variable-badge">{{variableName}}</span>
 */
const ServerVariableNode = Node.create({
  name: 'variableNode',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      variableName: { default: '' },
      category: { default: '' },
      displayLabel: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-variable]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes({
        'data-variable': HTMLAttributes.variableName,
        'data-category': HTMLAttributes.category,
        class: 'variable-badge',
      }),
      `{{${HTMLAttributes.variableName}}}`,
    ]
  },
})

/**
 * Server-side LoopNode extension for HTML serialization.
 * Renders as: <div data-loop="collection" data-loop-type="start|end">{{#each collection}}</div>
 * or <div data-loop="collection" data-loop-type="end">{{/each}}</div>
 */
const ServerLoopNode = Node.create({
  name: 'loopNode',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      collection: { default: 'hasil_kalibrasi' },
      type: { default: 'start' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-loop]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const marker =
      HTMLAttributes.type === 'start'
        ? `{{#each ${HTMLAttributes.collection}}}`
        : `{{/each}}`

    return [
      'div',
      mergeAttributes({
        'data-loop': HTMLAttributes.collection,
        'data-loop-type': HTMLAttributes.type,
        class: 'loop-marker',
      }),
      marker,
    ]
  },
})

// --- Extension Registry ---

/**
 * All extensions registered for server-side HTML generation.
 * Includes StarterKit (paragraphs, headings, bold, italic, underline, etc.),
 * Table extensions, Image, TextAlign, Color, TextStyle, FontFamily,
 * and custom VariableNode/LoopNode.
 * Note: Underline is included in StarterKit v3, so no separate import needed.
 */
function getServerExtensions() {
  return [
    StarterKit,
    Table.configure({ resizable: false }),
    TableRow,
    TableCell,
    TableHeader,
    Image,
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    Color,
    TextStyle,
    FontFamily,
    ServerVariableNode,
    ServerLoopNode,
    PageBreak,
  ]
}

// --- Public API ---

/**
 * Convert TipTap JSON document to HTML string.
 * Uses @tiptap/html's generateHTML with all registered extensions.
 */
export function tiptapToHtml(doc: TipTapDocument, options?: RenderOptions): string {
  const extensions = getServerExtensions()
  const html = generateHTML(doc as any, extensions)
  return html
}

/**
 * Generate complete HTML page for PDF rendering via Playwright.
 * Converts TipTap document to HTML, replaces variables with actual data,
 * and wraps in a full HTML page with CSS for page layout.
 */
export function generatePdfHtml(
  doc: TipTapDocument,
  data: CertificateData,
  pageSettings: PageSettings
): string {
  // Step 1: Convert TipTap JSON to HTML
  const rawHtml = tiptapToHtml(doc)

  // Step 2: Replace variables with actual data
  const contentHtml = replaceVariables(rawHtml, data)

  // Step 3: Compute page dimensions
  const pageDimensions = getPageDimensions(pageSettings)

  // Step 4: Wrap in full HTML page with CSS
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

  /* Variable badge (hidden in PDF - just shows the value) */
  .variable-badge {
    /* No special styling in PDF output - variables are already replaced */
  }

  /* Loop markers (hidden in PDF - content is already expanded) */
  .loop-marker {
    display: none;
  }

  /* Page break */
  .page-break {
    page-break-after: always;
    break-after: page;
    height: 0;
    margin: 0;
    padding: 0;
    border: none;
  }

  /* Text alignment */
  [style*="text-align: center"] { text-align: center; }
  [style*="text-align: right"] { text-align: right; }
  [style*="text-align: justify"] { text-align: justify; }
</style>
</head>
<body>
${contentHtml}
</body>
</html>`

  return fullHtml
}

// --- Helper Functions ---

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
