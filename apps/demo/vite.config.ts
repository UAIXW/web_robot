import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@robotik/sdk': resolve(__dirname, '../../robotik-sdk/src/index.ts'),
    },
  },
  server: {
    port: 4000,
    proxy: {
      '/v1': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
