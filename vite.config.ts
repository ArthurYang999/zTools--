import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, build as viteBuild, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function ztoolsPluginBuild(): Plugin {
  return {
    name: 'ztools-plugin-build',
    async closeBundle() {
      await viteBuild({
        configFile: false,
        build: {
          outDir: 'dist',
          emptyOutDir: false,
          lib: {
            entry: path.resolve(__dirname, 'src/preload.ts'),
            formats: ['cjs'],
            fileName: () => 'preload.js',
          },
          rollupOptions: {
            output: {
              entryFileNames: 'preload.js',
            },
          },
        },
        logLevel: 'warn',
      })

      const dist = path.resolve(__dirname, 'dist')
      if (!existsSync(dist)) {
        mkdirSync(dist, { recursive: true })
      }
      copyFileSync(
        path.resolve(__dirname, 'plugin.json'),
        path.join(dist, 'plugin.json'),
      )
      const logoSrc = path.resolve(__dirname, 'public/logo.png')
      if (existsSync(logoSrc)) {
        copyFileSync(logoSrc, path.join(dist, 'logo.png'))
      }
    },
  }
}

export default defineConfig({
  plugins: [vue(), ztoolsPluginBuild()],
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
