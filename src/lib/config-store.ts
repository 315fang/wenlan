import fs from "fs"
import path from "path"

import type { AppSettings } from "@/types/settings"

const CONFIG_DIR = path.join(process.cwd(), "data")
const CONFIG_FILE = path.join(CONFIG_DIR, "portal-config.json")

const defaults: AppSettings = {
  appName: "问兰智能体系统",
  assistantName: "问小兰",
  assistantSubtitle: "面向客户咨询和商务联系的问兰智能体平台",
  assistantHeadline: "客户咨询与商务服务智能体系统",
  starterPrompts: [
    "进入商务中心，告诉我最新联系方式 and 合作流程",
    "问小兰，请问问兰系列的产品特色是什么？",
    "如何加盟代理问兰项目？",
  ],
  onboardingGuide: [
    { title: "先问一个问题", description: "直接输入产品、政策、活动或使用问题，问兰会优先依据后台最新资料回答。" },
    { title: "进入商务中心", description: "需要合作、咨询或联系时，直接查询后台资料里的最新电话、联系人和对接方式。" },
    { title: "切换阅读模式", description: "时尚版更清爽，效率版字号更大、按钮更醒目，适合快速查看 and 转发。" },
  ],
  insightCards: [
    { title: "商务中心", description: "集中提供合作咨询、联系电话、对接方式和商务流程。" },
    { title: "高风险复核", description: "涉及资金、退款、权限、删除、封禁、批量修改时，默认提示人工复核。" },
  ],
  knowledgeOutline: [
    "产品介绍",
    "使用指南",
    "代理政策",
    "活动说明",
    "商务联系",
    "常见问题",
  ],
  defaultSystemPrompt: [
    '你是\u201c问小兰\u201d，服务对象是问兰项目客户和代理商。',
    '',
    '你的职责是基于后台上传的文章和表格资料，回答客户咨询，并解答商务合作与联系信息。',
    '',
    '回答要求：',
    '1. 优先基于知识库内容回答，不得凭空编造产品信息、政策信息或商务合作细节。',
    '2. 同类信息发生冲突时，以后台最后上传的资料为最终答案。',
    '3. 输出必须分段、有条理，优先用编号列表（1. 2. 3.）或项目符号（-）组织内容。每段内容精炼，不宜过长。',
    '4. 用户要商务联系信息时，先一句话说明，然后用编号列出最新电话、联系人、微信、地址或合作流程。',
    '5. 涉及财务、退款、结算、代理等级、权限、删除、封禁、批量修改等高风险信息，必须提示人工复核。',
    '6. 不要声称自己已经在后台执行了操作，除非系统明确接入了后台工具。',
    '7. 不要添加\u201c如果您还有其他问题\u201d\u201c欢迎继续提问\u201d这类收尾话。',
    '8. 不要使用\u201c后台没有\u201d\u201c资料库没有\u201d\u201c当前资料未覆盖\u201d\u201c没有搜索到\u201d这类生硬说法。',
    '9. 如果用户的问题太宽泛、对象不明确、范围太大，先回复：\u201c你可以提问的再具体一些，便于我回答。\u201d',
    '10. 如果根据现有信息仍然不能给出准确结论，统一回复：\u201c我们品牌方会尽快明确政策，给您答复反馈。\u201d',
    '11. 如果只能回答一部分，就先回答已经明确的部分，再用一句话引导用户把剩余问题问得更具体。',
    '12. 整体语气要自然、稳重、像品牌客服，始终用第一人称\u201c我\u201d回答，不要用第三人称描述自己。',
    '13. 不要输出 `<think>`、`</think>` 或任何思考过程内容。',
  ].join('\n'),
  emptyStateCopy: "你好，我是问小兰。你可以直接提问，也可以进入商务中心查询联系方式与合作事宜。",
  defaultDifyDatasetId: "a296cee7-e802-4e30-b348-719c459136ba",
  defaultDifyBaseUrl: "http://119.45.182.109:8888",
  businessContacts: [],
  businessPriceTiers: [],
  materialItems: [],
}

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true })
  }
}

export function readSettings(): AppSettings {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, "utf-8")
      const parsed = JSON.parse(raw) as Partial<AppSettings>
      return { ...defaults, ...parsed }
    }
  } catch {
    // Fall through to defaults
  }
  return { ...defaults }
}

export function writeSettings(partial: Partial<AppSettings>): AppSettings {
  const current = readSettings()
  const updated = { ...current, ...partial }
  ensureConfigDir()
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), "utf-8")
  return updated
}
