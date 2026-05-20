/**
 * Template auto-registration index.
 *
 * Imports all 13 template configurations and registers them with the
 * default template registry. Call `initializeTemplates()` to perform
 * registration (idempotent — safe to call multiple times).
 */

import { defaultRegistry } from '../template-registry'

// ─── Template Imports ────────────────────────────────────────────────────────

import { fcTemplate } from './fc'
import { lcTemplate } from './lc'
import { fcBalai1Template } from './fc-balai-1'
import { fcBalai2Template } from './fc-balai-2'
import { fcBalai3Template } from './fc-balai-3'
import { fcBalai4Template } from './fc-balai-4'
import { fcBalai5Template } from './fc-balai-5'
import { lcBalai1Template } from './lc-balai-1'
import { lcBalai2Template } from './lc-balai-2'
import { lcBalai3Template } from './lc-balai-3'
import { lcBalai4Template } from './lc-balai-4'
import { lcBalai5Template } from './lc-balai-5'
import { standarTemplate } from './standar'

// ─── All Templates ───────────────────────────────────────────────────────────

const ALL_TEMPLATES = [
  fcTemplate,
  lcTemplate,
  fcBalai1Template,
  fcBalai2Template,
  fcBalai3Template,
  fcBalai4Template,
  fcBalai5Template,
  lcBalai1Template,
  lcBalai2Template,
  lcBalai3Template,
  lcBalai4Template,
  lcBalai5Template,
  standarTemplate,
] as const

// ─── Registration ────────────────────────────────────────────────────────────

let initialized = false

/**
 * Registers all 13 template configurations with the default registry.
 *
 * This function is idempotent — calling it multiple times has no effect
 * after the first successful registration.
 */
export function initializeTemplates(): void {
  if (initialized) {
    return
  }

  for (const template of ALL_TEMPLATES) {
    defaultRegistry.register(template.type, template)
  }

  initialized = true
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export {
  fcTemplate,
  lcTemplate,
  fcBalai1Template,
  fcBalai2Template,
  fcBalai3Template,
  fcBalai4Template,
  fcBalai5Template,
  lcBalai1Template,
  lcBalai2Template,
  lcBalai3Template,
  lcBalai4Template,
  lcBalai5Template,
  standarTemplate,
}
