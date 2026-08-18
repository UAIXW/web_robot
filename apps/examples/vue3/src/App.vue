<script setup lang="ts">
import { ref, computed } from 'vue'
import WebRobot from './WebRobot.vue'
import { useWebRobot } from './useWebRobot'
import type { Session } from '@robotik/sdk'

// === 声明式用法 ===
const robotRef = ref<InstanceType<typeof WebRobot> | null>(null)

// 宿主侧注入本地降级业务（SDK 本身零业务逻辑）
const TOOL_LABELS = { query_order: '查询订单', cancel_order: '取消订单' }

async function mockFallback(text: string): Promise<string> {
  await new Promise((r) => setTimeout(r, 600))
  if (/订单|order/i.test(text)) return '本地模式：你有 2 个在途订单，预计明天送达。'
  return `（本地降级回复）你说的是：「${text}」。后端可用时由 AI 接管。`
}

// === 编程式用法（composable）===
const { isOpen, session, lastError, open, close, send } = useWebRobot({
  appId: 'shop',
  server: 'http://localhost:8787',
  name: 'Vue 小助手',
  greeting: '你好！我是 Vue 3 集成的 WebRobot 🎉',
  suggestions: ['查订单', '退换货政策', '联系客服'],
  theme: {
    primary: '#6366f1',
    mode: 'dark',
  },
  on: {
    open: () => console.log('[composable] panel opened'),
    close: () => console.log('[composable] panel closed'),
    'tool:call': ({ name }) => console.log('[composable] tool called:', name),
    'message:received': ({ text }) => console.log('[composable] received:', text),
  },
})

// === 控制面板 ===
const customText = ref('')
const themeColor = ref('#6366f1')
const themeMode = ref<'dark' | 'light' | 'auto'>('dark')

function handleSend(): void {
  if (customText.value.trim()) {
    send(customText.value)
    customText.value = ''
  }
}

function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

const statusText = computed(() => {
  if (!session.value) return '未登录'
  return `已登录 · ${session.value.user.email}`
})
</script>

<template>
  <div class="app">
    <header class="header">
      <h1>WebRobot · Vue 3 集成示例</h1>
      <p>展示 SDK 在 Vue 3 项目中的两种接入方式</p>
    </header>

    <main class="main">
      <!-- 方式一：声明式组件 -->
      <section class="card">
        <div class="card-head">
          <span class="badge badge-blue">方式一</span>
          <h2>声明式组件</h2>
        </div>
        <p class="desc">
          使用 <code>&lt;WebRobot&gt;</code> 组件，通过 props 配置，事件绑定回调。
        </p>
        <pre class="code">{{ `<WebRobot
  app-id="default"
  server="http://localhost:8787"
  name="客服小助手"
  greeting="你好！有什么可以帮你的？"
  :suggestions="['查订单', '退换货']"
  :fallback="localReply"
  :tool-labels="TOOL_LABELS"
  primary-color="#41e58f"
  theme-mode="dark"
  @open="onOpen"
  @message:received="onMessage"
/>` }}</pre>

        <!-- 实际挂载声明式组件 -->
        <WebRobot
          ref="robotRef"
          app-id="default"
          server="http://localhost:8787"
          name="声明式助手"
          greeting="我是通过 &lt;WebRobot&gt; 组件挂载的机器人"
          :suggestions="['查订单', '退换货']"
          :fallback="mockFallback"
          :tool-labels="TOOL_LABELS"
          primary-color="#41e58f"
          theme-mode="dark"
          @open="() => console.log('[component] opened')"
          @close="() => console.log('[component] closed')"
          @tool:call="(p) => console.log('[component] tool:', p.name)"
          @message:received="(p) => console.log('[component] reply:', p.text)"
        />
      </section>

      <!-- 方式二：编程式 composable -->
      <section class="card">
        <div class="card-head">
          <span class="badge badge-green">方式二</span>
          <h2>编程式 Composable</h2>
        </div>
        <p class="desc">
          使用 <code>useWebRobot()</code> composable，在 JS 中完全控制机器人。
        </p>
        <pre class="code">{{ `const { isOpen, session, open, send } = useWebRobot({
  appId: 'shop',
  server: 'http://localhost:8787',
  name: 'Vue 小助手',
  theme: { primary: '#6366f1', mode: 'dark' },
  on: {
    'message:received': ({ text }) => console.log(text),
  },
})` }}</pre>

        <!-- 控制面板 -->
        <div class="controls">
          <div class="status-row">
            <span class="status-dot" :class="{ active: isOpen }"></span>
            <span>{{ isOpen ? '面板已打开' : '面板已收起' }}</span>
            <span class="divider">|</span>
            <span>{{ statusText }}</span>
            <span v-if="lastError" class="error-text">{{ lastError }}</span>
          </div>

          <div class="btn-row">
            <button class="btn" @click="open">打开面板</button>
            <button class="btn" @click="close">收起面板</button>
          </div>

          <div class="input-row">
            <input
              v-model="customText"
              class="input"
              placeholder="输入消息，回车发送..."
              @keydown="handleKeydown"
            />
            <button class="btn btn-primary" @click="handleSend">发送</button>
          </div>

          <div class="theme-row">
            <label>主题色</label>
            <input v-model="themeColor" type="color" />
            <label>模式</label>
            <select v-model="themeMode">
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="auto">Auto</option>
            </select>
          </div>
        </div>
      </section>
    </main>

    <footer class="footer">
      <p>两个机器人同时运行 — 左下角（声明式）和右下角（编程式）</p>
    </footer>
  </div>
</template>

<style scoped>
.app {
  font-family: 'PingFang SC', system-ui, -apple-system, sans-serif;
  max-width: 920px;
  margin: 0 auto;
  padding: 32px 24px 80px;
  color: #1e293b;
}

.header h1 {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 4px;
}

.header p {
  font-size: 14px;
  color: #64748b;
}

.main {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 32px;
}

.card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 24px;
}

.card-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.card-head h2 {
  font-size: 18px;
  font-weight: 600;
}

.badge {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 999px;
}

.badge-blue {
  background: #dbeafe;
  color: #1e40af;
}

.badge-green {
  background: #dcfce7;
  color: #166534;
}

.desc {
  font-size: 14px;
  color: #475569;
  line-height: 1.6;
  margin-bottom: 12px;
}

.desc code {
  background: #e2e8f0;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 13px;
  font-family: ui-monospace, monospace;
}

.code {
  background: #0f172a;
  color: #e2e8f0;
  padding: 16px;
  border-radius: 8px;
  font-size: 12px;
  font-family: ui-monospace, 'SF Mono', monospace;
  overflow-x: auto;
  line-height: 1.6;
  margin: 12px 0;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 16px;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #475569;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #cbd5e1;
}

.status-dot.active {
  background: #6366f1;
  box-shadow: 0 0 6px rgba(99, 102, 241, 0.5);
}

.divider {
  color: #cbd5e1;
}

.error-text {
  color: #ef4444;
  font-size: 12px;
}

.btn-row {
  display: flex;
  gap: 8px;
}

.input-row {
  display: flex;
  gap: 8px;
}

.input {
  flex: 1;
  padding: 9px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  font-family: inherit;
}

.input:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

.btn {
  padding: 8px 16px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}

.btn:hover {
  border-color: #6366f1;
  color: #6366f1;
}

.btn-primary {
  background: #6366f1;
  color: #fff;
  border-color: #6366f1;
}

.btn-primary:hover {
  background: #4f46e5;
  color: #fff;
}

.theme-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #475569;
}

.theme-row input[type='color'] {
  width: 40px;
  height: 32px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  cursor: pointer;
}

.theme-row select {
  padding: 6px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
  outline: none;
}

.footer {
  margin-top: 40px;
  text-align: center;
  font-size: 13px;
  color: #94a3b8;
}
</style>
