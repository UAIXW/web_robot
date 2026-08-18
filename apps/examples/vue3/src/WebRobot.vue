<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import {
  init,
  type WebRobotAPI,
  type InitConfig,
  type Session,
} from '@robotik/sdk'

const props = withDefaults(
  defineProps<{
    appId: string
    server?: string
    name?: string
    greeting?: string
    suggestions?: string[]
    /** 本地降级回复（后端不可用时接管，业务逻辑由宿主注入） */
    fallback?: (text: string) => Promise<string>
    /** 工具名 → 展示标签 */
    toolLabels?: Record<string, string>
    primaryColor?: string
    themeMode?: 'dark' | 'light' | 'auto'
  }>(),
  {
    server: '',
    primaryColor: '#41e58f',
    themeMode: 'dark' as 'dark' | 'light' | 'auto',
  },
)

const emit = defineEmits<{
  open: []
  close: []
  'message:send': [payload: { text: string }]
  'message:received': [payload: { text: string; role: string }]
  'tool:call': [payload: { name: string; args?: Record<string, unknown> }]
  'tool:result': [payload: { name: string; ok: boolean; summary?: string }]
  'session:change': [payload: { session: Session | null }]
  error: [payload: { error: Error }]
}>()

const api = ref<WebRobotAPI | null>(null)

function buildConfig(): InitConfig {
  return {
    appId: props.appId,
    server: props.server || undefined,
    name: props.name,
    greeting: props.greeting,
    suggestions: props.suggestions,
    fallback: props.fallback,
    toolLabels: props.toolLabels,
    theme: {
      primary: props.primaryColor,
      mode: props.themeMode,
    },
    on: {
      open: () => emit('open'),
      close: () => emit('close'),
      'message:send': (p) => emit('message:send', p),
      'message:received': (p) => emit('message:received', p),
      'tool:call': (p) => emit('tool:call', p),
      'tool:result': (p) => emit('tool:result', p),
      'session:change': (p) => emit('session:change', p),
      error: (p) => emit('error', p),
    },
  }
}

onMounted(() => {
  api.value = init(buildConfig()) || null
})

onUnmounted(() => {
  api.value?.destroy()
  api.value = null
})

watch(
  () => [props.primaryColor, props.themeMode],
  ([color, mode]) => {
    api.value?.setTheme({
      primary: color as string,
      mode: mode as 'dark' | 'light' | 'auto',
    })
  },
)

defineExpose({
  open: () => api.value?.open(),
  close: () => api.value?.close(),
  send: (text: string) => api.value?.send(text),
  destroy: () => api.value?.destroy(),
})
</script>

<template>
  <!-- SDK renders into document.body via Shadow DOM; no template needed -->
</template>
