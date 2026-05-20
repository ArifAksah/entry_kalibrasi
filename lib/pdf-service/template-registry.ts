/**
 * Template Registry for the Flexible Certificate PDF Service.
 *
 * Manages registration and lookup of certificate template configurations.
 * Each certificate type has exactly one TemplateConfig that defines all
 * visual and structural elements for rendering.
 */

import type { CertificateType, TemplateConfig } from './types'

// ─── Deep Copy Utility ───────────────────────────────────────────────────────

/**
 * Deep copies an object using structuredClone when available,
 * falling back to JSON parse/stringify for environments without it.
 */
function deepCopy<T>(obj: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(obj)
  }
  return JSON.parse(JSON.stringify(obj))
}

// ─── Required Fields ─────────────────────────────────────────────────────────

const REQUIRED_CONFIG_FIELDS: (keyof TemplateConfig)[] = [
  'header',
  'coverPage',
  'resultsPage',
  'footer',
  'styling',
]

// ─── Registry Interface ──────────────────────────────────────────────────────

export interface TemplateRegistry {
  register(type: CertificateType, config: TemplateConfig): void
  get(type: CertificateType): TemplateConfig
  has(type: CertificateType): boolean
  listTypes(): CertificateType[]
}

// ─── Registry Implementation ─────────────────────────────────────────────────

class TemplateRegistryImpl implements TemplateRegistry {
  private templates: Map<CertificateType, TemplateConfig> = new Map()

  /**
   * Register a template config for a given certificate type.
   *
   * Validates that the config has all required fields (header, coverPage,
   * resultsPage, footer, styling). If any are missing, throws an error
   * listing ALL missing field names.
   *
   * If the type is already registered, throws an error indicating the
   * type is already registered.
   *
   * Stores a deep copy of the config to ensure isolation between templates.
   */
  register(type: CertificateType, config: TemplateConfig): void {
    // Validate required fields
    const missingFields = REQUIRED_CONFIG_FIELDS.filter(
      (field) => config[field] === undefined || config[field] === null
    )

    if (missingFields.length > 0) {
      throw new Error(
        `Invalid template config for type "${type}": missing required fields: ${missingFields.join(', ')}`
      )
    }

    // Check for duplicate registration
    if (this.templates.has(type)) {
      throw new Error(
        `Template type "${type}" is already registered`
      )
    }

    // Store a deep copy to ensure isolation
    this.templates.set(type, deepCopy(config))
  }

  /**
   * Get the template config for a given certificate type.
   *
   * If the type is not registered, throws an error containing the
   * requested type name AND the complete list of currently registered types.
   *
   * Returns a deep copy to prevent external mutation.
   */
  get(type: CertificateType): TemplateConfig {
    const config = this.templates.get(type)

    if (!config) {
      const registeredTypes = this.listTypes()
      const availableList =
        registeredTypes.length > 0
          ? registeredTypes.join(', ')
          : '(none)'

      throw new Error(
        `Template type "${type}" is not registered. Available types: ${availableList}`
      )
    }

    // Return a deep copy to prevent external mutation
    return deepCopy(config)
  }

  /**
   * Check if a certificate type is registered.
   */
  has(type: CertificateType): boolean {
    return this.templates.has(type)
  }

  /**
   * List all registered certificate types.
   */
  listTypes(): CertificateType[] {
    return Array.from(this.templates.keys())
  }
}

// ─── Factory and Singleton ───────────────────────────────────────────────────

/**
 * Creates a new, empty TemplateRegistry instance.
 */
export function createTemplateRegistry(): TemplateRegistry {
  return new TemplateRegistryImpl()
}

/**
 * Default singleton registry instance.
 * Initially empty — templates are registered by the templates/index.ts module.
 */
export const defaultRegistry: TemplateRegistry = createTemplateRegistry()
