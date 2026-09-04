import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
  },
  server: {
    port: 43127,
    strictPort: true,
    host: '127.0.0.1',
    allowedHosts: true,
  },
  build: {
    target: 'esnext',
  },
})
