export interface OnboardingStep {
  title: string
  description: string
}

export interface InsightCard {
  title: string
  description: string
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
}
