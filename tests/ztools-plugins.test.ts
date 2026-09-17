import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  EXCLUDED_PLUGIN_NAMES,
  commandAppPath,
  listTextCmds,
  scanZtoolsCommands,
} from '../src/services/scanner/ztoolsPlugins'

describe('ztoolsCommands', () => {
  it('listTextCmds skips manage cmds, exclude set, and group: features', () => {
    expect(
      listTextCmds([
        { code: 'manage', cmds: ['批量启动', '颜色助手'] },
        { code: 'group:abc', cmds: ['startWork'] },
        { cmds: ['colors', 'skip-me'] },
      ], { excludeCmds: new Set(['skip-me']) }),
    ).toEqual(['颜色助手', 'colors'])
  })

  it('scanZtoolsCommands skips batch-start plugin and excluded cmds', async () => {
    const root = path.join('mock-ztools', 'plugins')
    const files: Record<string, string> = {
      [path.join(root, 'colors', 'plugin.json')]: JSON.stringify({
        name: 'colors',
        title: '调色板',
        logo: 'logo.png',
        features: [
          { code: 'a', cmds: ['颜色助手', 'colors', 'startWork'] },
          { code: 'group:x', cmds: ['should-skip'] },
        ],
      }),
      [path.join(root, 'batch-start', 'plugin.json')]: JSON.stringify({
        name: 'batch-start',
        title: '批量启动',
        features: [{ cmds: ['批量启动', '应用启动组'] }],
      }),
      [path.join(root, 'setting', 'plugin.json')]: JSON.stringify({
        name: 'setting',
        title: '设置',
        features: [{ cmds: ['设置'] }],
      }),
    }

    const scanned = await scanZtoolsCommands('win32', {
      pluginsRoot: root,
      excludeCmds: new Set(['startWork']),
      readDir: async () => ['colors', 'batch-start', 'setting'],
      readFile: async (file) => {
        if (!(file in files)) throw new Error(`missing ${file}`)
        return files[file]
      },
      access: async (file) => {
        if (!file.endsWith('logo.png')) throw new Error('missing')
      },
    })

    expect(scanned.map((s) => s.name)).toEqual(['颜色助手', 'colors'])
    expect(scanned[0].path).toBe(commandAppPath('colors', '颜色助手'))
    expect(EXCLUDED_PLUGIN_NAMES.has('system')).toBe(true)
  })
})
