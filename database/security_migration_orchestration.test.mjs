import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const runner = fileURLToPath(new URL('../scripts/apply-security-migration.mjs', import.meta.url))

function run(args, env = {}) {
  return spawnSync(process.execPath, [runner, ...args, '--dry-run'], {
    encoding: 'utf8',
    env,
  })
}

test('production and all execute migrations 01 through 04 without bootstrap', () => {
  for (const stage of ['production', 'all']) {
    const result = run(['--stage', stage])
    assert.equal(result.status, 0, result.stderr)
    assert.match(
      result.stdout,
      /security_migration_01_preflight\.sql, database\/security_migration_02_lockdown\.sql, database\/security_migration_03_rls_consolidated\.sql, database\/security_migration_04_revoke_rpc\.sql/,
    )
    assert.doesNotMatch(result.stdout, /staging_bootstrap/)
  }
})

test('bootstrap requires an explicit staging target', () => {
  const production = run(['--stage', 'bootstrap'])
  assert.equal(production.status, 1)
  assert.match(production.stderr, /Bootstrap hanya boleh dijalankan/)
})

test('bootstrap refuses to run without ALLOW_STAGING_BOOTSTRAP opt-in', () => {
  const staging = run(['--stage', 'bootstrap', '--target', 'staging'])
  assert.equal(staging.status, 1)
  assert.match(staging.stderr, /ALLOW_STAGING_BOOTSTRAP=1/)
})

test('bootstrap runs only with staging target and explicit opt-in', () => {
  const staging = run(['--stage', 'bootstrap', '--target', 'staging'], {
    ALLOW_STAGING_BOOTSTRAP: '1',
  })
  assert.equal(staging.status, 0, staging.stderr)
  assert.match(staging.stdout, /staging_bootstrap_missing_tables\.sql/)

  const production = run(['--stage', 'bootstrap', '--target', 'production'], {
    ALLOW_STAGING_BOOTSTRAP: '1',
  })
  assert.equal(production.status, 1)
  assert.match(production.stderr, /Bootstrap hanya boleh dijalankan/)
})
