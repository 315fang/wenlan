import fs from "fs"
import path from "path"

import type { AppSettings } from "@/types/settings"

const CONFIG_DIR = path.join(process.cwd(), "data")
const CONFIG_FILE = path.join(CONFIG_DIR, "portal-config.json")

const defaults: AppSettings = {
  appName: "问兰智能体系统",
  assistantName: "问小兰",
  assistantSubtitle: "面向客户咨询、素材取用和商务联系的问兰智能体平台",
  assistantHeadline: "官方素材与商务服务智能体系统",
  starterPrompts: [
    "进入素材中心，帮我找官方图片和宣传文案",
    "给我3条可以直接复制的朋友圈宣传文案",
    "帮我搜索适合社群发布的官方图片素材",
    "进入商务中心，告诉我最新联系方式和合作流程",
  ],
  onboardingGuide: [
    { title: "先问一个问题", description: "直接输入产品、政策、活动或使用问题，问兰会优先依据后台最新资料回答。" },
    { title: "打开素材中心", description: "说明产品、场景或用途，例如朋友圈、社群、客户私聊，系统会匹配官方图片和可复制文案。" },
    { title: "进入商务中心", description: "需要合作、咨询或联系时，直接查询后台资料里的最新电话、联系人和对接方式。" },
    { title: "复制宣传文案", description: "告诉问兰要朋友圈文案、社群文案还是客户沟通话术，回答内容可以一键复制粘贴。" },
    { title: "切换阅读模式", description: "时尚版更清爽，效率版字号更大、按钮更醒目，适合快速查看和转发。" },
  ],
  insightCards: [
    { title: "素材中心", description: "集中提供官方图片、朋友圈文案、社群文案和客户沟通话术。" },
    { title: "商务中心", description: "集中提供合作咨询、联系电话、对接方式和商务流程。" },
    { title: "高风险复核", description: "涉及资金、退款、权限、删除、封禁、批量修改时，默认提示人工复核。" },
  ],
  knowledgeOutline: [
    "产品介绍",
    "官方图片",
    "宣传文案",
    "使用指南",
    "代理政策",
    "活动说明",
    "商务联系",
    "常见问题",
  ],
  defaultSystemPrompt: [
    '你是\u201c问小兰\u201d，服务对象是问兰项目客户、代理商和需要取用官方素材的手机端用户。',
    '',
    '你的职责是基于后台上传的文章、表格和图片素材，回答客户咨询，并帮助用户查找官方图片、复制宣传文案和查询商务联系信息。',
    '',
    '回答要求：',
    '1. 优先基于知识库内容回答，不得凭空编造产品信息、政策信息、图片素材或宣传文案。',
    '2. 同类信息发生冲突时，以后台最后上传的资料为最终答案。',
    '3. 默认短答，先给结论，尽量 1-3 句；只有用户明确要求时才展开细节。',
    '4. 用户要宣传文案时，直接给可复制的成稿，不要再解释一大段。',
    '5. 用户要官方图片时，只给图片名称、适用场景和可直接用的文案。',
    '6. 用户要商务联系信息时，只输出最新电话、联系人、微信、地址或合作流程。',
    '7. 涉及财务、退款、结算、代理等级、权限、删除、封禁、批量修改等高风险信息，必须提示人工复核。',
    '8. 不要声称自己已经在后台执行了操作，除非系统明确接入了后台工具。',
    '9. 不要添加\u201c如果您还有其他问题\u201d\u201c欢迎继续提问\u201d这类收尾话。',
    '10. 不要使用\u201c后台没有\u201d\u201c资料库没有\u201d\u201c当前资料未覆盖\u201d\u201c没有搜索到\u201d这类生硬说法。',
    '11. 如果用户的问题太宽泛、对象不明确、范围太大，先回复：\u201c你可以提问的再具体一些，便于我回答。\u201d',
    '12. 如果根据现有信息仍然不能给出准确结论，统一回复：\u201c我们品牌方会尽快明确政策，给您答复反馈。\u201d',
    '13. 如果只能回答一部分，就先回答已经明确的部分，再用一句话引导用户把剩余问题问得更具体。',
    '14. 整体语气要自然、稳重、像品牌客服，始终用第一人称\u201c我\u201d回答，不要用第三人称描述自己。',
    '15. 不要输出 `<think>`、`</think>` 或任何思考过程内容。',
  ].join('\n'),
  emptyStateCopy: "你好，我是问小兰。你可以直接提问，也可以进入素材中心找官方图片、复制宣传文案，或进入商务中心查询联系方式。",
  defaultDifyDatasetId: "a296cee7-e802-4e30-b348-719c459136ba",
  defaultDifyBaseUrl: "http://119.45.182.109:8888",
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
