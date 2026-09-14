import { mergeScannedApps } from '../appLibrary'
import { getSettings, type ZtoolsDb } from '../db'
import { createLinuxScanner } from './linux'
import { createMacScanner } from './mac'
import type { PlatformScanner, ScannedApp } from './types'
import { createWinScanner } from './win'

export type { PlatformScanner, ScannedApp } from './types'
export { createWinScanner } from './win'
export { createMacScanner } from './mac'
export { createLinuxScanner } from './linux'

export function getScanner(platform: string = process.platform): PlatformScanner {
  switch (platform) {
    case 'darwin':
      return createMacScanner()
    case 'linux':
      return createLinuxScanner()
    case 'win32':
    default:
      return createWinScanner()
  }
}

export type RunFullScanDeps = {
  scanner?: PlatformScanner
  now?: () => number
}

export async function runFullScan(
  db: ZtoolsDb,
  platform: string = process.platform,
  deps: RunFullScanDeps = {},
): Promise<Awaited<ReturnType<typeof mergeScannedApps>>> {
  const scanner = deps.scanner ?? getScanner(platform)
  const settings = await getSettings(db)

  const scanned: ScannedApp[] = [...(await scanner.scanSystem())]
  for (const dir of settings.customScanDirs) {
    scanned.push(...(await scanner.scanCustomDir(dir)))
  }

  const apps = await mergeScannedApps(db, scanned)
  const lastScanAt = deps.now?.() ?? Date.now()
  await db.put({ ...settings, lastScanAt })
  return apps
}
