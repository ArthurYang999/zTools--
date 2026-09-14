import { describe, expect, it } from 'vitest'
import { createWinScanner } from '../src/services/scanner/win'

describe('createWinScanner', () => {
  it('scanCustomDir includes exe bat cmd lnk', async () => {
    const files = ['a.exe', 'b.bat', 'c.cmd', 'd.lnk', 'e.txt']
    const scanner = createWinScanner({
      readdir: async () => files,
      stat: async () => ({ isFile: () => true, isDirectory: () => false }),
      resolveLnk: async (p: string) => ({
        name: 'D',
        target: p.replace(/\.lnk$/i, '.exe'),
      }),
    })
    const apps = await scanner.scanCustomDir('C:/Apps')
    const names = apps.map((a) => a.path.toLowerCase())
    expect(names.some((p) => p.endsWith('a.exe'))).toBe(true)
    expect(names.some((p) => p.endsWith('b.bat'))).toBe(true)
    expect(names.some((p) => p.endsWith('c.cmd'))).toBe(true)
    expect(names.some((p) => p.endsWith('.exe'))).toBe(true)
    expect(names.some((p) => p.endsWith('e.txt'))).toBe(false)
  })

  it('scanCustomDir returns [] when dir is missing', async () => {
    const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    const scanner = createWinScanner({
      readdir: async () => {
        throw err
      },
      stat: async () => ({ isFile: () => true, isDirectory: () => false }),
      resolveLnk: async () => null,
    })
    await expect(scanner.scanCustomDir('C:/Missing')).resolves.toEqual([])
  })

  it('scanCustomDir returns [] when readdir throws EACCES', async () => {
    const err = Object.assign(new Error('EACCES'), { code: 'EACCES' })
    const scanner = createWinScanner({
      readdir: async () => {
        throw err
      },
      stat: async () => ({ isFile: () => true, isDirectory: () => false }),
      resolveLnk: async () => null,
    })
    await expect(scanner.scanCustomDir('C:/Denied')).resolves.toEqual([])
  })
})
