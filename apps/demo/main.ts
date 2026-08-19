import { init } from '@robotik/sdk'

// 日常开发调试入口：走 ESM 源码（vite alias），改 robotik-sdk/src 即热更新。
// 声明式 <script> 独有的自动 init / data-* 解析，用根目录 demo.html 单独冒烟验证。
init({
  appId: 'default',
  server: 'http://localhost:8787',
  name: '调试助手',
  greeting: '你好，这是 ESM 调试页 🤖',
  suggestions: ['现在几点', 'echo 你好', '计算 1+2'],
  markdown: true,
})
