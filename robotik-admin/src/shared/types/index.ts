export interface SiteConfig {
  id: string
  app_id: string
  site_domain: string
  robot_name: string
  welcome_text: string
  allowed_tools: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  app_id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
}

export interface Message {
  id: number
  conversation_id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  tool_name: string | null
  created_at: string
}

export interface UsageLog {
  id: number
  app_id: string
  conversation_id: string | null
  user_id: string | null
  model: string
  input_tokens: number
  output_tokens: number
  tool_calls: number
  latency_ms: number
  status: string
  error_message: string | null
  created_at: string
}

export interface StatsOverview {
  apps_total: number
  apps_active_today: number
  conversations_total: number
  conversations_today: number
  messages_total: number
  messages_today: number
  tool_calls_total: number
  active_users_today: number
  tokens_input_total: number
  tokens_output_total: number
  avg_latency_ms: number
  error_rate: number
}

export interface AdminUser {
  user_id: string
  role: string
  email: string
  created_at: string
}
