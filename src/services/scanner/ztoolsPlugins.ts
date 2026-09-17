import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Platform } from '../../types'
import type { ScannedApp } from './types'

/** One list item per divertible text command */
export const CMD_URI_PREFIX = 'ztools-cmd://'
/** Legacy per-plugin URI from 0.1.1 — treated as stale */
export const LEGACY_PLUGIN_URI_PREFIX = 'ztools-plugin://'

export const EXCLUDED_PLUGIN_NAMES = new Set(['setting', 'system', 'batch-start'])

/** Static manage cmds declared in batch-start plugin.json */
export const BATCH_START_MANAGE_CMDS = new Set(['批量启动', '应用启动组'])

/** Skip setting/system, batch-start (and variants), and title「批量启动」 */
export function shouldSkipPlugin(pluginName: string, pluginTitle?: string): boolean {
  const name = pluginName.trim().toLowerCase()
  if (name === 'setting' || name === 'system') return true
  if (name === 'batch-start' || name.startsWith('batch-start')) return true
  if (EXCLUDED_PLUGIN_NAMES.has(name)) return true
  if (pluginTitle?.trim() === '批量启动') return true
  return false
}

/** @deprecated use shouldSkipPlugin */
export function isExcludedBatchStartPlugin(pluginName: string, pluginTitle?: string): boolean {
  return shouldSkipPlugin(pluginName, pluginTitle)
}

export function commandAppPath(pluginName: string, cmd: string): string {
  return `${CMD_URI_PREFIX}${pluginName}/${encodeURIComponent(cmd)}`
}

export function isZtoolsCommandPath(appPath: string): boolean {
  const lower = appPath.toLowerCase()
  return lower.startsWith(CMD_URI_PREFIX) || lower.startsWith(LEGACY_PLUGIN_URI_PREFIX)
}

/** @deprecated use commandAppPath */
export function pluginAppPath(pluginName: string): string {
  return `${LEGACY_PLUGIN_URI_PREFIX}${pluginName}`
}

/** @deprecated use isZtoolsCommandPath */
export function isPluginAppPath(appPath: string): boolean {
  return isZtoolsCommandPath(appPath)
}

export type ListTextCmdsOptions = {
  /** Extra cmd strings to skip (e.g. launch-group cmds registered by this plugin) */
  excludeCmds?: Set<string> | ReadonlySet<string>
  /** Skip features whose code starts with group: (dynamic launch-group features) */
  skipGroupFeatures?: boolean
}

export function listTextCmds(features: unknown, options: ListTextCmdsOptions = {}): string[] {
  if (!Array.isArray(features)) return []
  const exclude = options.excludeCmds
  const skipGroup = options.skipGroupFeatures !== false
  const seen = new Set<string>()
  const cmds: string[] = []
  for (const feature of features) {
    const code = (feature as { code?: unknown })?.code
    if (skipGroup && typeof code === 'string' && code.startsWith('group:')) continue
    const list = (feature as { cmds?: unknown })?.cmds
    if (!Array.isArray(list)) continue
    for (const cmd of list) {
      if (typeof cmd !== 'string') continue
      const text = cmd.trim()
      if (!text || seen.has(text)) continue
      if (BATCH_START_MANAGE_CMDS.has(text)) continue
      if (exclude?.has(text)) continue
      seen.add(text)
      cmds.push(text)
    }
  }
  return cmds
}

/** @deprecated use listTextCmds()[0] */
export function pickFirstLaunchCmd(features: unknown): string | null {
  return listTextCmds(features)[0] ?? null
}

type PluginJson = {
  name?: string
  title?: string
  logo?: string
  features?: unknown
}

export type ScanZtoolsCommandsDeps = {
  pluginsRoot?: string
  readDir?: (dir: string) => Promise<string[]>
  readFile?: (file: string, encoding: 'utf-8') => Promise<string>
  access?: (file: string) => Promise<void>
  /** Cmds to exclude (batch-start manage cmds + registered launch-group cmds) */
  excludeCmds?: Set<string> | ReadonlySet<string>
}

async function resolveLogoIcon(
  pluginDir: string,
  logo: string | undefined,
  access: (file: string) => Promise<void>,
): Promise<string | null> {
  if (!logo || logo.includes('://')) return null
  const logoPath = path.isAbsolute(logo) ? logo : path.join(pluginDir, logo)
  try {
    await access(logoPath)
    return pathToFileURL(logoPath).href
  } catch {
    return null
  }
}

function stableCmdId(pluginName: string, cmd: string): string {
  // encodeURIComponent keeps Unicode cmds path-safe for _id suffix
  return `cmd:${pluginName}:${encodeURIComponent(cmd)}`
}

/**
 * Discover ZTools text commands from each installed plugin.json features list.
 * One ScannedApp per divertible string cmd (not one per plugin).
 */
export async function scanZtoolsCommands(
  platform: Platform,
  deps: ScanZtoolsCommandsDeps = {},
): Promise<ScannedApp[]> {
  const pluginsRoot = deps.pluginsRoot ?? path.join(os.homedir(), '.ztools', 'plugins')
  const readDir = deps.readDir ?? ((dir) => fs.readdir(dir))
  const readFile = deps.readFile ?? ((file, enc) => fs.readFile(file, enc))
  const access = deps.access ?? ((file) => fs.access(file))

  let entries: string[]
  try {
    entries = await readDir(pluginsRoot)
  } catch {
    return []
  }

  const results: ScannedApp[] = []

  for (const entry of entries) {
    const pluginDir = path.join(pluginsRoot, entry)
    const manifestPath = path.join(pluginDir, 'plugin.json')
    let raw: string
    try {
      raw = await readFile(manifestPath, 'utf-8')
    } catch {
      continue
    }

    let json: PluginJson
    try {
      json = JSON.parse(raw) as PluginJson
    } catch {
      continue
    }

    const pluginName = typeof json.name === 'string' ? json.name.trim() : ''
    const title =
      typeof json.title === 'string' && json.title.trim() ? json.title.trim() : pluginName
    if (!pluginName || shouldSkipPlugin(pluginName, title)) continue

    const cmds = listTextCmds(json.features, {
      excludeCmds: deps.excludeCmds,
      skipGroupFeatures: true,
    })
    if (cmds.length === 0) continue

    const icon = await resolveLogoIcon(
      pluginDir,
      typeof json.logo === 'string' ? json.logo : undefined,
      access,
    )

    for (const cmd of cmds) {
      results.push({
        name: cmd,
        path: commandAppPath(pluginName, cmd),
        platform,
        icon,
        source: 'ztools',
        pluginName,
        pluginTitle: title,
        launchCmd: cmd,
        stableIdHint: stableCmdId(pluginName, cmd),
      })
    }
  }

  return results
}

/** @deprecated alias */
export const scanZtoolsPlugins = scanZtoolsCommands
export type ScanZtoolsPluginsDeps = ScanZtoolsCommandsDeps
