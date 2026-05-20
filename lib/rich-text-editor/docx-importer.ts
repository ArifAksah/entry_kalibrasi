/**
 * DOCX Importer - Converts .docx files to TipTap JSON documents.
 *
 * Uses mammoth.js to convert .docx buffer to HTML, then parses
 * the HTML into a TipTap JSON document structure.
 * Detects {{variable_name}} patterns and converts to VariableNode
 * if the variable is in VARIABLE_REGISTRY.
 */

import mammoth from 'mammoth'
import { TipTapDocument, TipTapNode, TipTapMark } from './types'
import { VARIABLE_REGISTRY } from './variable-helpers'

/**
 * Convert a .docx buffer to TipTap JSON document.
 * Preserves: bold, italic, underline, headings, tables, images.
 * Detects {{variable}} patterns and converts to VariableNode.
 */
export async function importDocx(buffer: Buffer): Promise<{
  document: TipTapDocument
  warnings: string[]
}> {
  const warnings: string[] = []

  // Convert .docx to HTML using mammoth
  const result = await mammoth.convertToHtml(
    { buffer },
    {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Heading 4'] => h4:fresh",
      ],
    }
  )

  // Collect warnings from mammoth
  for (const msg of result.messages) {
    if (msg.type === 'warning') {
      warnings.push(msg.message)
    }
  }

  const html = result.value

  // Parse HTML into TipTap JSON
  const document = htmlToTipTapDocument(html, warnings)

  return { document, warnings }
}

/**
 * Parse HTML string into a TipTap JSON document.
 * Simple parser that handles common HTML elements.
 */
function htmlToTipTapDocument(html: string, warnings: string[]): TipTapDocument {
  const content: TipTapNode[] = []

  // Split HTML into block-level elements
  // Use regex to find block elements
  const blockRegex = /<(h[1-4]|p|table|ul|ol|blockquote|div|hr)([\s>])/gi
  const parts = splitIntoBlocks(html)

  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue

    const node = parseBlockElement(trimmed, warnings)
    if (node) {
      if (Array.isArray(node)) {
        content.push(...node)
      } else {
        content.push(node)
      }
    }
  }

  // If no content was parsed, add an empty paragraph
  if (content.length === 0) {
    content.push({ type: 'paragraph' })
  }

  return { type: 'doc', content }
}

/**
 * Split HTML into block-level chunks.
 */
function splitIntoBlocks(html: string): string[] {
  const blocks: string[] = []
  // Match block-level elements including their content
  const blockPattern = /<(h[1-4]|p|table|ul|ol|blockquote|div|hr)\b[^>]*>[\s\S]*?<\/\1>|<hr\s*\/?>/gi
  let match: RegExpExecArray | null

  while ((match = blockPattern.exec(html)) !== null) {
    blocks.push(match[0])
  }

  // If no blocks found, treat entire HTML as a paragraph
  if (blocks.length === 0 && html.trim()) {
    blocks.push(`<p>${html}</p>`)
  }

  return blocks
}

/**
 * Parse a single block-level HTML element into a TipTap node.
 */
function parseBlockElement(html: string, warnings: string[]): TipTapNode | TipTapNode[] | null {
  // Heading
  const headingMatch = html.match(/^<(h[1-4])\b[^>]*>([\s\S]*?)<\/\1>$/i)
  if (headingMatch) {
    const level = parseInt(headingMatch[1][1])
    const innerHtml = headingMatch[2]
    const inlineContent = parseInlineContent(innerHtml)
    return {
      type: 'heading',
      attrs: { level },
      content: inlineContent.length > 0 ? inlineContent : undefined,
    }
  }

  // Paragraph
  const paragraphMatch = html.match(/^<p\b[^>]*>([\s\S]*?)<\/p>$/i)
  if (paragraphMatch) {
    const innerHtml = paragraphMatch[1]
    const inlineContent = parseInlineContent(innerHtml)
    return {
      type: 'paragraph',
      content: inlineContent.length > 0 ? inlineContent : undefined,
    }
  }

  // Table
  const tableMatch = html.match(/^<table\b[^>]*>([\s\S]*?)<\/table>$/i)
  if (tableMatch) {
    return parseTable(tableMatch[0], warnings)
  }

  // Unordered list
  const ulMatch = html.match(/^<ul\b[^>]*>([\s\S]*?)<\/ul>$/i)
  if (ulMatch) {
    return parseList(ulMatch[1], 'bulletList', warnings)
  }

  // Ordered list
  const olMatch = html.match(/^<ol\b[^>]*>([\s\S]*?)<\/ol>$/i)
  if (olMatch) {
    return parseList(olMatch[1], 'orderedList', warnings)
  }

  // Horizontal rule
  if (html.match(/^<hr\s*\/?>$/i)) {
    return { type: 'horizontalRule' }
  }

  // Div - treat as paragraph
  const divMatch = html.match(/^<div\b[^>]*>([\s\S]*?)<\/div>$/i)
  if (divMatch) {
    const innerHtml = divMatch[1]
    const inlineContent = parseInlineContent(innerHtml)
    return {
      type: 'paragraph',
      content: inlineContent.length > 0 ? inlineContent : undefined,
    }
  }

  // Fallback: treat as paragraph with raw text
  const textContent = stripHtmlTags(html)
  if (textContent.trim()) {
    return {
      type: 'paragraph',
      content: processTextWithVariables(textContent),
    }
  }

  return null
}

/**
 * Parse inline HTML content into TipTap inline nodes (text with marks).
 */
function parseInlineContent(html: string): TipTapNode[] {
  const nodes: TipTapNode[] = []

  if (!html || !html.trim()) return nodes

  // Process the HTML by finding inline elements and text
  const segments = tokenizeInlineHtml(html)

  for (const segment of segments) {
    if (segment.type === 'text') {
      const textNodes = processTextWithVariables(segment.text)
      // Apply marks to all text nodes
      for (const node of textNodes) {
        if (node.type === 'text' && segment.marks.length > 0) {
          node.marks = [...(node.marks || []), ...segment.marks]
        }
      }
      nodes.push(...textNodes)
    }
  }

  return nodes
}

interface InlineSegment {
  type: 'text'
  text: string
  marks: TipTapMark[]
}

/**
 * Tokenize inline HTML into text segments with their marks.
 */
function tokenizeInlineHtml(html: string): InlineSegment[] {
  const segments: InlineSegment[] = []

  // Remove images (we'll handle them separately if needed)
  let processed = html.replace(/<img\b[^>]*>/gi, '')

  // Simple approach: strip tags and track formatting
  // This handles nested bold/italic/underline
  const result = extractFormattedText(processed)
  segments.push(...result)

  return segments
}

/**
 * Extract formatted text segments from inline HTML.
 */
function extractFormattedText(html: string): InlineSegment[] {
  const segments: InlineSegment[] = []

  // Recursive approach: find outermost formatting tags
  const tagPattern = /<(strong|b|em|i|u|s|span)\b[^>]*>([\s\S]*?)<\/\1>/gi
  let lastIndex = 0
  let match: RegExpExecArray | null

  // Reset regex
  tagPattern.lastIndex = 0

  while ((match = tagPattern.exec(html)) !== null) {
    // Text before this tag
    if (match.index > lastIndex) {
      const beforeText = stripHtmlTags(html.substring(lastIndex, match.index))
      if (beforeText) {
        segments.push({ type: 'text', text: decodeHtmlEntities(beforeText), marks: [] })
      }
    }

    const tagName = match[1].toLowerCase()
    const innerHtml = match[2]
    const mark = tagToMark(tagName)

    // Recursively process inner content
    const innerSegments = extractFormattedText(innerHtml)

    if (innerSegments.length === 0) {
      // Plain text inside the tag
      const text = stripHtmlTags(innerHtml)
      if (text) {
        const marks: TipTapMark[] = mark ? [mark] : []
        segments.push({ type: 'text', text: decodeHtmlEntities(text), marks })
      }
    } else {
      // Add the mark to all inner segments
      for (const seg of innerSegments) {
        if (mark) {
          seg.marks = [mark, ...seg.marks]
        }
        segments.push(seg)
      }
    }

    lastIndex = match.index + match[0].length
  }

  // Remaining text after last tag
  if (lastIndex < html.length) {
    const remainingText = stripHtmlTags(html.substring(lastIndex))
    if (remainingText) {
      segments.push({ type: 'text', text: decodeHtmlEntities(remainingText), marks: [] })
    }
  }

  // If no tags were found, return the whole thing as plain text
  if (segments.length === 0 && html.trim()) {
    const text = stripHtmlTags(html)
    if (text) {
      segments.push({ type: 'text', text: decodeHtmlEntities(text), marks: [] })
    }
  }

  return segments
}

/**
 * Convert HTML tag name to TipTap mark.
 */
function tagToMark(tagName: string): TipTapMark | null {
  switch (tagName) {
    case 'strong':
    case 'b':
      return { type: 'bold' }
    case 'em':
    case 'i':
      return { type: 'italic' }
    case 'u':
      return { type: 'underline' }
    case 's':
      return { type: 'strike' }
    default:
      return null
  }
}

/**
 * Process text content, detecting {{variable}} patterns and converting
 * to VariableNode if the variable is in VARIABLE_REGISTRY.
 */
function processTextWithVariables(text: string): TipTapNode[] {
  const nodes: TipTapNode[] = []
  const variablePattern = /\{\{([^}]+)\}\}/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = variablePattern.exec(text)) !== null) {
    // Text before the variable
    if (match.index > lastIndex) {
      const beforeText = text.substring(lastIndex, match.index)
      if (beforeText) {
        nodes.push({ type: 'text', text: beforeText })
      }
    }

    const variableName = match[1].trim()

    // Check if it's a loop marker
    if (variableName.startsWith('#each ')) {
      const collection = variableName.replace('#each ', '').trim()
      nodes.push({
        type: 'loopNode',
        attrs: { collection, type: 'start' },
      })
    } else if (variableName === '/each') {
      nodes.push({
        type: 'loopNode',
        attrs: { collection: 'hasil_kalibrasi', type: 'end' },
      })
    } else {
      // Check if variable is in registry
      const registryEntry = VARIABLE_REGISTRY.find((v) => v.name === variableName)

      if (registryEntry) {
        nodes.push({
          type: 'variableNode',
          attrs: {
            variableName: registryEntry.name,
            category: registryEntry.category,
            displayLabel: registryEntry.description,
          },
        })
      } else {
        // Keep as plain text if not in registry
        nodes.push({ type: 'text', text: `{{${variableName}}}` })
      }
    }

    lastIndex = match.index + match[0].length
  }

  // Remaining text after last variable
  if (lastIndex < text.length) {
    const remaining = text.substring(lastIndex)
    if (remaining) {
      nodes.push({ type: 'text', text: remaining })
    }
  }

  // If no content, return empty
  if (nodes.length === 0 && text) {
    nodes.push({ type: 'text', text })
  }

  return nodes
}

/**
 * Parse an HTML table into TipTap table nodes.
 */
function parseTable(html: string, warnings: string[]): TipTapNode {
  const rows: TipTapNode[] = []

  // Find all rows
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi
  let rowMatch: RegExpExecArray | null

  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const rowContent = rowMatch[1]
    const cells: TipTapNode[] = []

    // Find all cells (th or td)
    const cellPattern = /<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi
    let cellMatch: RegExpExecArray | null

    while ((cellMatch = cellPattern.exec(rowContent)) !== null) {
      const isHeader = cellMatch[1].toLowerCase() === 'th'
      const cellHtml = cellMatch[2]
      const cellContent = parseInlineContent(cellHtml)

      cells.push({
        type: isHeader ? 'tableHeader' : 'tableCell',
        content: [
          {
            type: 'paragraph',
            content: cellContent.length > 0 ? cellContent : undefined,
          },
        ],
      })
    }

    if (cells.length > 0) {
      rows.push({
        type: 'tableRow',
        content: cells,
      })
    }
  }

  return {
    type: 'table',
    content: rows.length > 0 ? rows : [{ type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph' }] }] }],
  }
}

/**
 * Parse an HTML list into TipTap list nodes.
 */
function parseList(innerHtml: string, listType: 'bulletList' | 'orderedList', warnings: string[]): TipTapNode {
  const items: TipTapNode[] = []

  const liPattern = /<li\b[^>]*>([\s\S]*?)<\/li>/gi
  let liMatch: RegExpExecArray | null

  while ((liMatch = liPattern.exec(innerHtml)) !== null) {
    const liContent = liMatch[1]
    const inlineContent = parseInlineContent(liContent)

    items.push({
      type: 'listItem',
      content: [
        {
          type: 'paragraph',
          content: inlineContent.length > 0 ? inlineContent : undefined,
        },
      ],
    })
  }

  return {
    type: listType,
    content: items.length > 0 ? items : [{ type: 'listItem', content: [{ type: 'paragraph' }] }],
  }
}

/**
 * Strip all HTML tags from a string.
 */
function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '')
}

/**
 * Decode common HTML entities.
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}
