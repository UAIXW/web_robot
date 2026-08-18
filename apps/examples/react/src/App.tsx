import { useRef, useState } from 'react'
import WebRobot, { type WebRobotHandle } from './WebRobot'
import { useWebRobot } from './useWebRobot'
import './app.css'

// 宿主侧注入本地降级业务（SDK 本身零业务逻辑）
const TOOL_LABELS = { query_order: '查询订单', cancel_order: '取消订单' }

async function mockFallback(text: string): Promise<string> {
  await new Promise((r) => setTimeout(r, 600))
  if (/订单|order/i.test(text)) return '本地模式：你有 2 个在途订单，预计明天送达。'
  return `（本地降级回复）你说的是：「${text}」。后端可用时由 AI 接管。`
}

function App() {
  const componentRobotRef = useRef<WebRobotHandle>(null)

  const { isOpen, session, lastError, open, close, send, clearHistory } = useWebRobot({
    appId: 'shop',
    server: 'http://localhost:8787',
    name: 'React 小助手',
    greeting: '你好！我是 React Hook 集成的 WebRobot 🎉',
    suggestions: ['查订单', '退换货政策', '联系客服'],
    theme: { primary: '#0ea5e9', mode: 'dark' },
    on: {
      open: () => console.log('[hook] panel opened'),
      close: () => console.log('[hook] panel closed'),
      'tool:call': ({ name }) => console.log('[hook] tool called:', name),
      'message:received': ({ text }) => console.log('[hook] received:', text),
    },
  })

  const [text, setText] = useState('')

  const handleSend = () => {
    if (text.trim()) {
      void send(text)
      setText('')
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>WebRobot · React 集成示例</h1>
        <p>同一页面两种接入方式：声明式组件 + 编程式 Hook，多实例互不干扰</p>
      </header>

      <main className="main">
        <section className="card">
          <div className="card-head">
            <span className="badge badge-blue">方式一</span>
            <h2>声明式组件</h2>
          </div>
          <p className="desc">
            使用 <code>&lt;WebRobot /&gt;</code> 组件，props 配置 + 回调事件，ref 暴露命令式方法。
          </p>
          <pre className="code">{`<WebRobot
  ref={robotRef}
  appId="default"
  server="http://localhost:8787"
  name="组件助手"
  suggestions={['查订单', '退换货']}
  fallback={localReply}
  toolLabels={TOOL_LABELS}
  primaryColor="#41e58f"
  onMessageReceived={({ text }) => console.log(text)}
/>

robotRef.current?.open()`}</pre>
          <button className="btn" onClick={() => componentRobotRef.current?.open()}>
            打开组件机器人
          </button>
          <WebRobot
            ref={componentRobotRef}
            appId="default"
            server="http://localhost:8787"
            name="组件助手"
            suggestions={['查订单', '退换货']}
            fallback={mockFallback}
            toolLabels={TOOL_LABELS}
            primaryColor="#41e58f"
            themeMode="dark"
            onOpen={() => console.log('[component] opened')}
            onToolCall={({ name }) => console.log('[component] tool:', name)}
          />
        </section>

        <section className="card">
          <div className="card-head">
            <span className="badge badge-green">方式二</span>
            <h2>编程式 Hook</h2>
          </div>
          <p className="desc">
            使用 <code>useWebRobot()</code>，返回响应式状态 + 控制方法，卸载时自动销毁。
          </p>
          <pre className="code">{`const { isOpen, session, open, send, clearHistory } = useWebRobot({
  appId: 'shop',
  server: 'http://localhost:8787',
  theme: { primary: '#0ea5e9' },
})`}</pre>

          <div className="controls">
            <div className="status-row">
              <span className={`dot ${isOpen ? 'on' : ''}`} />
              <span>{isOpen ? '面板已打开' : '面板已收起'}</span>
              <span className="divider">|</span>
              <span>{session ? `已登录 · ${session.user.email}` : '未登录'}</span>
              {lastError && <span className="error">{lastError}</span>}
            </div>

            <div className="btn-row">
              <button className="btn" onClick={open}>
                打开面板
              </button>
              <button className="btn" onClick={close}>
                收起面板
              </button>
              <button className="btn" onClick={() => void clearHistory()}>
                清空本地历史
              </button>
            </div>

            <div className="input-row">
              <input
                className="input"
                value={text}
                placeholder="输入消息，回车发送..."
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
              />
              <button className="btn btn-primary" onClick={handleSend}>
                发送
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>两个机器人同时运行 — 右下角（组件，绿色）和左侧偏移（Hook，蓝色），互不干扰</p>
      </footer>
    </div>
  )
}

export default App
