import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: resolve(process.cwd(), 'out/harness'),
      rollupOptions: {
        input: resolve(process.cwd(), 'src/main/win-diag-entry.ts'),
        output: {
          entryFileNames: 'win-diag-entry.js'
        }
      }
    }
  }
})
