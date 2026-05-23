export type KnowledgeKind = "article" | "table" | "image"

export type KnowledgeStatus = "active" | "archived" | "deleted" | "indexing"

export interface KnowledgeItem {
  id: string
  documentId: string
  kind: KnowledgeKind
  knowledgeKey: string
  title: string
  version: number
  sourceUrl?: string
  fileName?: string
  status: KnowledgeStatus
  createdAt: string
  updatedAt: string
  summary?: string
}

export interface KnowledgeUploadPayload {
  kind: KnowledgeKind
  title: string
  knowledgeKey: string
  version?: number
  sourceUrl?: string
  description?: string
}
