// lib/api-error.ts — server-only helper to safely return error responses.
//
// Many API routes used to return `{ error: error.message }` directly to the
// client. When the underlying cause is a PostgREST/Postgres error, its
// message can leak internal structure (constraint names, indexes, RLS
// hints) to anyone with a logged-in token — reconnaissance material only a
// developer needs to see server-side.
//
// `reportApiError`:
//   1. Prints the full detail server-side (`console.error`) so debugging
//      is unaffected.
//   2. Returns a generic Indonesian message when the underlying error
//      looks like a Postgres/PostgREST internal one; passes the message
//      through untouched otherwise (so legit validation feedback like
//      "NIK sudah dipakai" still reaches the user).
//
// Use `isUserFacing()` on your validation error class if you build a
// custom one — that makes clientSafeMessage always pass it through.

interface KnownUserError { name?: string; __userFacing?: boolean }
export function isUserFacing(err: unknown): err is KnownUserError & { message: string } {
  if (err && typeof err === 'object') {
    const e = err as KnownUserError & { message?: string }
    return Boolean((e as any).__userFacing) || e.name === 'ResultsValidationError'
  }
  return false
}

const GENERIC = 'Terjadi kesalahan pada server. Silakan coba lagi atau hubungi admin.'

// Patterns that only originate from Postgres/PostgREST internals.
// A legit business validation error rarely matches these.
const INTERNAL_SOURCES = [
  /violates/i,
  /duplicate key value/i,
  /unique constraint/i,
  /foreign key constraint/i,
  /check constraint/i,
  /relation ".*" does not exist/i,
  /column ".*" does not exist/i,
  /permission denied/i,
  /row-level security/i,
  /syntax error/i,
  /function .*\(.*\) does not exist/i,
  /must be owner/i,
  /no password supplied/i,
  /invalid input syntax/i,
  /division by zero/i,
  /canceling statement due to statement timeout/i,
  /new row violates row-level security policy/i,
]
const INTERNAL_RE = new RegExp(INTERNAL_SOURCES.map((s) => s.source).join('|'), 'i')

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message
    return typeof message === 'string' ? message : String(message ?? '')
  }
  return String(err ?? '')
}

export function clientSafeMessage(err: unknown, fallback = GENERIC): string {
  if (isUserFacing(err)) return errorMessage(err)
  const msg = errorMessage(err)
  if (!msg.trim()) return fallback
  if (INTERNAL_RE.test(msg)) return fallback
  return msg
}

export function reportApiError(err: unknown, ctx: { where: string }): string {
  // Server-side: full detail (incl. stacktrace) so developers can debug.
  console.error(`[${ctx.where}]`, err instanceof Error ? err.stack || err.message : err)
  return clientSafeMessage(err)
}
