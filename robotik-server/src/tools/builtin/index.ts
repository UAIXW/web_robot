import type { ToolDef } from '../tools.service'

export const BUILTIN_TOOLS: ToolDef[] = [
  {
    name: 'get_time',
    description: '获取当前服务器时间',
    parameters: { type: 'object', properties: {}, required: [] },
    async execute() {
      const now = new Date()
      const text = `当前时间是 ${now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}（北京时间）。`
      return { text, data: { time: now.toISOString() } }
    },
  },
  {
    name: 'echo',
    description: '原样返回输入文本，用于测试工具调用链路是否正常',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '要回显的文本' },
      },
      required: ['text'],
    },
    async execute(_ctx, args) {
      const text = String(args.text ?? '')
      return { text: `收到：${text}`, data: { echo: text } }
    },
  },
  {
    name: 'calculate',
    description: '执行简单数学运算（加减乘除）',
    parameters: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: '数学表达式，如 "1+2*3"' },
      },
      required: ['expression'],
    },
    async execute(_ctx, args) {
      const expr = String(args.expression ?? '').trim()
      if (!expr) return { text: '请提供数学表达式。' }
      if (!/^[\d+\-*/().\s]+$/.test(expr)) {
        return { text: '表达式只能包含数字和 + - * / ( ) 运算符。' }
      }
      try {
        const result = Function(`"use strict"; return (${expr})`)()
        const text = `${expr} = ${result}`
        return { text, data: { expression: expr, result } }
      } catch {
        return { text: `表达式 "${expr}" 无法计算。` }
      }
    },
  },
]
