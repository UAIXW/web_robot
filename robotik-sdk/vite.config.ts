import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig(({ mode }) => ({
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
    // 开发态（--mode development，即 npm run dev）生成 sourcemap，
    // 便于声明式 <script> 调试时把 dist 报错映射回源码；
    // 生产态（npm run build）不生成，避免发布包体积膨胀。
    sourcemap: mode === 'development',
  },
}))
