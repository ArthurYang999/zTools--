import { describe, it, expect } from 'vitest'
import { createMemoryDb } from './mocks/memoryDb'
import { upsertApp, listApps, mergeScannedApps } from '../src/services/appLibrary'
import { makeAppId } from '../src/services/db'

describe('appLibrary', () => {
  it('mergeScannedApps keeps categoryId on path match', async () => {
    const db = createMemoryDb()
    await upsertApp(db, {
      _id: makeAppId('1'),
      name: 'Old',
      path: 'C:/Tool/a.exe',
      source: 'scan',
      categoryId: 'category:x',
      platform: 'win32',
    })
    await mergeScannedApps(db, [
      { name: 'New', path: 'C:/Tool/a.exe', platform: 'win32' },
    ])
    const apps = await listApps(db)
    expect(apps).toHaveLength(1)
    expect(apps[0].categoryId).toBe('category:x')
    expect(apps[0].name).toBe('Old')
  })
})
