const ALLOWED_TAGS = new Set([
  'P',
  'BR',
  'STRONG',
  'B',
  'EM',
  'I',
  'U',
  'UL',
  'OL',
  'LI',
  'A',
  'DIV',
])

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const hasHtmlMarkup = (value: string) => /<\/?[a-z][\s\S]*>/i.test(value)

const normalizePlainTextToHtml = (value: string) => {
  const escaped = escapeHtml(value).replace(/\r\n/g, '\n')
  const paragraphs = escaped.split(/\n{2,}/).map(part => part.trim()).filter(Boolean)

  if (!paragraphs.length) {
    return escaped.replace(/\n/g, '<br />')
  }

  return paragraphs
    .map(part => `<p>${part.replace(/\n/g, '<br />')}</p>`)
    .join('')
}

const sanitizeNode = (node: Node) => {
  if (node.nodeType === Node.TEXT_NODE) return

  if (node.nodeType !== Node.ELEMENT_NODE) {
    node.parentNode?.removeChild(node)
    return
  }

  const element = node as HTMLElement
  const tagName = element.tagName.toUpperCase()

  if (!ALLOWED_TAGS.has(tagName)) {
    const parent = element.parentNode
    while (element.firstChild) {
      parent?.insertBefore(element.firstChild, element)
    }
    parent?.removeChild(element)
    return
  }

  Array.from(element.attributes).forEach(attr => {
    const attrName = attr.name.toLowerCase()
    if (tagName === 'A' && attrName === 'href') {
      const href = element.getAttribute('href') || ''
      if (/^(https?:|mailto:|tel:)/i.test(href)) {
        element.setAttribute('target', '_blank')
        element.setAttribute('rel', 'noopener noreferrer')
      } else {
        element.removeAttribute('href')
      }
      return
    }

    element.removeAttribute(attr.name)
  })

  Array.from(element.childNodes).forEach(sanitizeNode)
}

export const normalizeRichTextValue = (value: string | null | undefined) => {
  const input = (value || '').trim()
  if (!input) return ''

  if (!hasHtmlMarkup(input)) {
    return normalizePlainTextToHtml(input)
  }

  if (typeof window === 'undefined') {
    return input
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${input}</div>`, 'text/html')
  const root = doc.body.firstElementChild as HTMLElement | null
  if (!root) return ''

  Array.from(root.childNodes).forEach(sanitizeNode)
  return root.innerHTML.trim()
}

export const isRichTextEmpty = (value: string | null | undefined) => {
  const html = normalizeRichTextValue(value)
  if (!html) return true

  if (typeof window === 'undefined') {
    return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim().length === 0
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html')
  const text = doc.body.textContent?.replace(/\u00a0/g, ' ').trim() || ''
  return text.length === 0
}

export const richTextContentClassName =
  '[&_p]:my-0 [&_p+*]:mt-1 [&_ul]:my-0 [&_ol]:my-0 [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:my-0.5 [&_a]:text-blue-700 [&_a]:underline'

export const DEFAULT_NOTES_OTHERS_HTML = [
  '<p><strong>Penunjukan nilai sebenarnya didapat dari penunjukan alat ditambah koreksi.</strong></p>',
  '<p><em>The true value is determined from the instrument reading added by its correction.</em></p>',
  '<p><strong>Sertifikat ini hanya berlaku untuk peralatan dengan identitas yang dinyatakan di atas.</strong></p>',
  '<p><em>This certificate only applies to equipment with the identity stated above.</em></p>',
  '<p><strong>Ketidakpastian pengukuran dinyatakan pada tingkat kepercayaan tidak kurang dari 95 % dengan faktor cakupan k = 2</strong></p>',
  '<p><em>Uncertainty of measurement is expressed at a confidence level of no less than 95 % with coverage factor k = 2</em></p>',
].join('')

export const isDefaultNotesOthersValue = (value: string | null | undefined) =>
  normalizeRichTextValue(value) === normalizeRichTextValue(DEFAULT_NOTES_OTHERS_HTML)
