import { supabase, env } from './supabase'

export async function schemaFetch(
  schema: string,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token ?? ''

  const headers: Record<string, string> = {
    'apikey': env.supabaseAnonKey,
    'Content-Type': 'application/json',
    'Accept-Profile': schema,
    ...(options.body ? { 'Content-Profile': schema } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers as Record<string, string>,
  }

  return fetch(`${env.supabaseUrl}/rest/v1${path}`, { ...options, headers })
}

export async function schemaRpc<T>(
  schema: string,
  fn: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const res = await schemaFetch(schema, `/rpc/${fn}`, {
    method: 'POST',
    body: JSON.stringify(args),
  })
  if (!res.ok) throw new Error(`RPC ${fn} failed: ${res.status}`)
  return res.json()
}

export async function schemaSelect<T>(
  schema: string,
  table: string,
  query: string,
  params?: Record<string, string>,
): Promise<T[]> {
  let path = `/${table}?select=${encodeURIComponent(query)}`
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      path += `&${k}=${encodeURIComponent(v)}`
    }
  }
  const res = await schemaFetch(schema, path)
  if (!res.ok) throw new Error(`Select ${table} failed: ${res.status}`)
  return res.json()
}
