import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src'),
      '@core': resolve(__dirname, 'src/core'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  test: {
    include: ['src/core/**/*.test.ts', 'src/renderer/src/**/*.test.ts', 'src/main/**/*.test.ts'],
    environment: 'node'
  }
})
