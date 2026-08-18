import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      // 全局名不能叫 WebRobot —— 会与 init() 挂载的 window.WebRobot API 冲突
      name: 'WebRobotSDK',
      // UMD：一份产物同时兼容 <script> 标签、AMD、CommonJS require
      // ESM：现代 bundler / import
      formats: ['umd', 'es'],
      fileName: (format) => (format === 'umd' ? 'robot.js' : 'robot.mjs'),
    },
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'esbuild',
    // 生产分发不生成 sourcemap：map 体积约是产物的 3 倍，且 SDK 源码本就在仓库内可查
    sourcemap: false,
  },
})
