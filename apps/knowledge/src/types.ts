export interface KnowledgeDocument {
  id: string
  app_id: string
  title: string
  content: string
  category: string
  status: string
  created_by: string | null
  created_at: string
  updated_at: string
}
