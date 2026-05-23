import { AssistantApp } from "@/components/assistant-app"
import { getPortalConfig } from "@/lib/server"

export default function Page() {
  const initialConfig = getPortalConfig()

  return <AssistantApp initialConfig={initialConfig} />
}

