/**
 * dsh-plugin-install-guard
 *
 * Denies agent tool calls that would install a DSH plugin (or an npm package
 * that looks like one) until the package is listed in the user's allowlist.
 * The check runs before dispatch, so it also applies in Full access sessions.
 *
 * Environment:
 *   DSH_INSTALL_GUARD_SCOPE   both (default) | cli | manager
 *   DSH_INSTALL_GUARD_ALLOW   allowlist path (default: $DSH_HOME/plugin-install-allow.txt)
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const name = 'plugin-install-guard'
export const inject = ['tools']

function home() {
  return process.env.DSH_HOME || join(homedir(), '.dsh')
}

function scope() {
  const value = String(process.env.DSH_INSTALL_GUARD_SCOPE || 'both').toLowerCase()
  return value === 'cli' || value === 'manager' ? value : 'both'
}

export function allowFile() {
  return process.env.DSH_INSTALL_GUARD_ALLOW || join(home(), 'plugin-install-allow.txt')
}

/** dsh plugin ... add/install/update */
const DSH_CLI_INSTALL = /\bdsh(?:\.cmd)?\s+plugin\b[\s\S]*\b(?:add|install|update)\b/i
/** pnpm/npm/yarn/bun add|i|install ... <dsh-ish package> */
const PKG_INSTALL = /\b(?:pnpm|npm|yarn|bun)\b[\s\S]*\b(?:add|i|install)\b[\s\S]*\b(?:@deepseek-ai\/dsh-|dsh-)/i
/** the package spec after add/install */
const SPEC = /\b(?:add|install)\s+((?:@[\w.-]+\/)?[\w.-]+)/i

export function readAllowlist(file = allowFile()) {
  try {
    return readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'))
  } catch {
    return []
  }
}

function specFrom(command) {
  const match = command.match(SPEC)
  return match ? match[1] : ''
}

function isAllowed(needles, allowlist) {
  if (allowlist.includes('*')) return true
  return allowlist.some((entry) =>
    needles.some((needle) => needle.length >= 4 && needle.toLowerCase().includes(entry.toLowerCase())),
  )
}

function deny(reason) {
  return [
    '插件安装已被 plugin-install-guard 拦截。',
    reason,
    '先运行 plugin-safety-audit 审查这个插件，把“能不能装 / 要关哪些设置”的结论告诉用户；',
    `用户确认要装后，把包名写入 ${allowFile()}（一行一个），再重试。`,
    '不要绕过本拦截，也不要用 --ignore-scripts 之类的办法规避审查。',
  ].join('\n')
}

export function check(execution, allowlist = readAllowlist()) {
  const tool = execution?.name
  const args = execution?.arguments ?? {}
  const mode = scope()

  if (tool === 'plugin_manager') {
    if (mode === 'cli') return undefined
    const action = String(args.action ?? '')
    if (action !== 'install_bundle') return undefined
    const target = String(args.target ?? '')
    if (isAllowed([target], allowlist)) return undefined
    return deny(`要安装的插件：${target || '（未提供 target）'}`)
  }

  if (tool !== 'pwsh' && tool !== 'bash') return undefined
  if (mode === 'manager') return undefined

  const command = String(args.command ?? '')
  if (!command) return undefined
  if (!DSH_CLI_INSTALL.test(command) && !PKG_INSTALL.test(command)) return undefined

  const spec = specFrom(command)
  const needles = [spec, command].filter(Boolean)
  if (isAllowed(needles, allowlist)) return undefined
  return deny(`命中的命令：${command.trim().slice(0, 300)}`)
}

export function apply(ctx) {
  ctx.effect(() => ctx.tools.guard((execution) => check(execution)))
}
