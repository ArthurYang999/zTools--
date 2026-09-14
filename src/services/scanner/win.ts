import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import type { PlatformScanner, ScannedApp } from './types'

const execFileAsync = promisify(execFile)

const CUSTOM_MAX_DEPTH = 4
const LAUNCH_EXTS = new Set(['.exe', '.bat', '.cmd', '.lnk'])

export type WinStatLike = {
  isFile(): boolean
  isDirectory(): boolean
}

export type WinScannerDeps = {
  readdir?: (dir: string) => Promise<string[]>
  stat?: (filePath: string) => Promise<WinStatLike>
  resolveLnk?: (lnkPath: string) => Promise<{ name: string; target: string } | null>
  env?: NodeJS.ProcessEnv
  join?: (...parts: string[]) => string
}

function displayName(filePath: string): string {
  return path.basename(filePath, path.extname(filePath))
}

function isMissingError(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'ENOENT')
}

async function defaultResolveLnk(lnkPath: string): Promise<{ name: string; target: string } | null> {
  const script = [
    '$ErrorActionPreference = "Stop"',
    `$s = (New-Object -ComObject WScript.Shell).CreateShortcut(${JSON.stringify(lnkPath)})`,
    '$name = [System.IO.Path]::GetFileNameWithoutExtension($s.FullName)',
    'Write-Output (($name + "`n" + $s.TargetPath))',
  ].join('; ')

  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { windowsHide: true, encoding: 'utf8' },
    )
    const lines = String(stdout)
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    const name = lines[0]
    const target = lines[1]
    if (!name || !target) return null
    return { name, target }
  } catch {
    return null
  }
}

export function createWinScanner(deps: WinScannerDeps = {}): PlatformScanner {
  const readdir = deps.readdir ?? ((dir) => fs.readdir(dir))
  const stat = deps.stat ?? ((filePath) => fs.stat(filePath))
  const resolveLnk = deps.resolveLnk ?? defaultResolveLnk
  const env = deps.env ?? process.env
  const join = deps.join ?? path.join

  async function collectFromDir(
    dir: string,
    options: { maxDepth: number; lnkOnly: boolean },
  ): Promise<ScannedApp[]> {
    const out: ScannedApp[] = []

    async function walk(current: string, depth: number): Promise<void> {
      if (depth > options.maxDepth) return

      let entries: string[]
      try {
        entries = await readdir(current)
      } catch (err) {
        if (isMissingError(err)) return
        throw err
      }

      for (const entry of entries) {
        const full = join(current, entry)
        let st: WinStatLike
        try {
          st = await stat(full)
        } catch (err) {
          if (isMissingError(err)) continue
          throw err
        }

        if (st.isDirectory()) {
          await walk(full, depth + 1)
          continue
        }

        if (!st.isFile()) continue

        const ext = path.extname(entry).toLowerCase()
        if (options.lnkOnly) {
          if (ext !== '.lnk') continue
        } else if (!LAUNCH_EXTS.has(ext)) {
          continue
        }

        if (ext === '.lnk') {
          const resolved = await resolveLnk(full)
          if (!resolved?.target) continue
          out.push({
            name: resolved.name || displayName(full),
            path: resolved.target,
            platform: 'win32',
          })
        } else {
          out.push({
            name: displayName(entry),
            path: full,
            platform: 'win32',
          })
        }
      }
    }

    await walk(dir, 0)
    return out
  }

  return {
    async scanSystem() {
      const roots: string[] = []
      if (env.APPDATA) {
        roots.push(join(env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs'))
      }
      const programData = env.ProgramData ?? env.PROGRAMDATA
      if (programData) {
        roots.push(join(programData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'))
      }

      const apps: ScannedApp[] = []
      for (const root of roots) {
        apps.push(...(await collectFromDir(root, { maxDepth: Number.POSITIVE_INFINITY, lnkOnly: true })))
      }
      return apps
    },

    async scanCustomDir(dir: string) {
      try {
        return await collectFromDir(dir, { maxDepth: CUSTOM_MAX_DEPTH, lnkOnly: false })
      } catch (err) {
        if (isMissingError(err)) return []
        throw err
      }
    },
  }
}
