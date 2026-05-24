export interface OnboardingStep {
  title: string
  description: string
}

export interface InsightCard {
  title: string
  description: string
}

export interface ContactInfo {
  id: string
  label: string
  value: string
}

export interface PriceTier {
  name: string
  range: string
  note: string
}

export interface MaterialItem {
  id: string
  cat: string
  title: string
  meta: string
  copy?: string
  download?: string
  hue: string
}

export interface AppSettings {
  appName: string
  assistantName: string
  assistantSubtitle: string
  assistantHeadline: string
  starterPrompts: string[]
  onboardingGuide: OnboardingStep[]
  insightCards: InsightCard[]
  knowledgeOutline: string[]
  defaultSystemPrompt: string
  emptyStateCopy: string
  defaultDifyDatasetId: string
  defaultDifyBaseUrl: string
  businessContacts: ContactInfo[]
  businessPriceTiers: PriceTier[]
  materialItems: MaterialItem[]
}
