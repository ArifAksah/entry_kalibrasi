/**
 * Shared styling constants for certificate PDF templates.
 *
 * These values are derived from the existing print page CSS and ensure
 * consistent styling across all certificate types.
 */

import type { StylingConfig } from '../../types'

// ─── Font Constants ──────────────────────────────────────────────────────────

/** Primary font stack used across all certificate templates. */
export const FONT_FAMILY = "Arial, 'Helvetica Neue', Helvetica, sans-serif"

/** Base font size for body text (11pt matches existing print CSS). */
export const BASE_FONT_SIZE = '11pt'

/** Font size for English sub-headings and italic text. */
export const ENGLISH_FONT_SIZE = '9pt'

/** Font size for the main certificate title (Indonesian). */
export const TITLE_FONT_SIZE = '20pt'

// ─── Page Layout Constants ───────────────────────────────────────────────────

/** Internal padding from page edges (0.5cm on all sides). */
export const PAGE_MARGIN = '5mm'

/** A4 page width. */
export const PAGE_WIDTH = '210mm'

/** A4 page height. */
export const PAGE_HEIGHT = '297mm'

// ─── Border & Decoration Constants ──────────────────────────────────────────

/** Header border style for standard BMKG certificates (double line). */
export const HEADER_BORDER_STYLE: StylingConfig['headerBorderStyle'] = 'double'

/** Header border width for double-line style. */
export const HEADER_BORDER_WIDTH = '4px'

/** Header border color. */
export const HEADER_BORDER_COLOR = '#000'

// ─── Line Height Constants ───────────────────────────────────────────────────

/** Default line height for body text. */
export const LINE_HEIGHT = '1.25'

/** Line height for title text. */
export const TITLE_LINE_HEIGHT = '1.15'

/** Line height for English/italic text. */
export const ENGLISH_LINE_HEIGHT = '1.05'

// ─── Table Layout Constants ─────────────────────────────────────────────────

/** Default label column width in cover page tables. */
export const LABEL_COLUMN_WIDTH = '30%'

/** Default value column width in cover page tables. */
export const VALUE_COLUMN_WIDTH = '65%'

// ─── Color Constants ─────────────────────────────────────────────────────────

/** Primary text color for all certificate content. */
export const TEXT_COLOR = '#000'

/** Background color for certificate pages. */
export const BACKGROUND_COLOR = '#fff'

// ─── Composite Defaults ──────────────────────────────────────────────────────

/**
 * Default StylingConfig used by FC and LC templates (BMKG pusat).
 * Balai templates may override specific values.
 */
export const DEFAULT_STYLING: StylingConfig = {
  fontFamily: FONT_FAMILY,
  baseFontSize: BASE_FONT_SIZE,
  headerBorderStyle: HEADER_BORDER_STYLE,
  pageMargin: PAGE_MARGIN,
}
