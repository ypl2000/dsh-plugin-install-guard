import test from 'node:test'
import assert from 'node:assert/strict'
import { check } from '../index.js'

const exec = (name, args) => ({ name, arguments: args })

test('denies dsh plugin add', () => {
  const reason = check(exec('pwsh', { command: 'dsh plugin --profile desktop add dsh-context' }), [])
  assert.equal(typeof reason, 'string')
  assert.match(reason, /拦截/)
})

test('denies pnpm add of a dsh- package', () => {
  assert.equal(typeof check(exec('pwsh', { command: 'pnpm add dsh-context@0.83.1' }), []), 'string')
  assert.equal(typeof check(exec('pwsh', { command: 'npm i @deepseek-ai/dsh-foo' }), []), 'string')
})

test('allows ordinary project installs', () => {
  assert.equal(check(exec('pwsh', { command: 'npm install react' }), []), undefined)
  assert.equal(check(exec('pwsh', { command: 'pnpm add react' }), []), undefined)
  assert.equal(check(exec('pwsh', { command: 'echo ok' }), []), undefined)
})

test('allows non-install dsh commands', () => {
  assert.equal(check(exec('pwsh', { command: 'dsh plugin --help' }), []), undefined)
  assert.equal(check(exec('pwsh', { command: 'dsh plugin list' }), []), undefined)
})

test('denies plugin_manager install_bundle', () => {
  const reason = check(exec('plugin_manager', { action: 'install_bundle', target: 'dsh-context' }), [])
  assert.equal(typeof reason, 'string')
})

test('allows other plugin_manager actions', () => {
  assert.equal(check(exec('plugin_manager', { action: 'list_bundles' }), []), undefined)
  assert.equal(check(exec('plugin_manager', { action: 'remove_bundle', target: 'x' }), []), undefined)
})

test('allowlist lets the named package through', () => {
  assert.equal(check(exec('pwsh', { command: 'dsh plugin add dsh-context' }), ['dsh-context']), undefined)
  assert.equal(check(exec('plugin_manager', { action: 'install_bundle', target: 'dsh-context' }), ['dsh-context']), undefined)
})

test('wildcard allowlist allows everything', () => {
  assert.equal(check(exec('plugin_manager', { action: 'install_bundle', target: 'x' }), ['*']), undefined)
})

test('scope=cli ignores plugin_manager', () => {
  process.env.DSH_INSTALL_GUARD_SCOPE = 'cli'
  try {
    assert.equal(check(exec('plugin_manager', { action: 'install_bundle', target: 'x' }), []), undefined)
    assert.equal(typeof check(exec('pwsh', { command: 'dsh plugin add x' }), []), 'string')
  } finally {
    delete process.env.DSH_INSTALL_GUARD_SCOPE
  }
})

test('scope=manager ignores shell commands', () => {
  process.env.DSH_INSTALL_GUARD_SCOPE = 'manager'
  try {
    assert.equal(check(exec('pwsh', { command: 'dsh plugin add x' }), []), undefined)
    assert.equal(typeof check(exec('plugin_manager', { action: 'install_bundle', target: 'x' }), []), 'string')
  } finally {
    delete process.env.DSH_INSTALL_GUARD_SCOPE
  }
})

test('unrelated tools pass', () => {
  assert.equal(check(exec('read', { path: 'x' }), []), undefined)
  assert.equal(check(exec('bash', { command: 'echo hi' }), []), undefined)
})
