import type { Metadata } from "next"

import { KnowledgeAdminPanel } from "@/components/knowledge-admin"

export const metadata: Metadata = {
  title: "问兰知识库管理",
  description: "上传、删除和维护问兰知识库资料",
}

export default function KnowledgePage() {
  return <KnowledgeAdminPanel />
}
