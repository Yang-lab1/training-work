import type {
  AnalyzeAnswerRequest,
  AnalyzeAnswerSuccess,
  GenerateCompanyKnowledgePackRequest,
  GenerateCompanyKnowledgePackSuccess,
} from '../../../../src/lib/ai/types.js'
import { serverEnv } from '../env.js'
import type { AnalyzeAnswerProvider } from '../provider.js'
import { normalizeCompanyKnowledgePack, normalizeModelFeedback, parseModelJson } from '../response.js'

const ANALYZE_ANSWER_PROMPT = `你是一个严格的中文 AI 面试教练。请根据训练类型、目标公司、目标岗位、回答文本、时长、CV 文本和参考稿，生成结构化面试反馈。只输出合法 JSON，不要输出 Markdown。
JSON 字段必须包含：score, summary, strengths, problems, roleFitFeedback, structureFeedback, expressionFeedback, timingFeedback, fluencyFeedback, memorizationRisk, specificityFeedback, improvedShortVersion, improvedLongVersion, nextTasks。
要求：反馈必须具体、可执行；必须结合 selectedJob；不要空泛鼓励；不要编造候选人没有提供的经历；不确定时写“需要你补充”。`

const COMPANY_KNOWLEDGE_PROMPT = `你是公司资料研究与岗位面试知识包生成器。请根据 selectedJob、jobPack、companySources、cvText、realInterviewReviews 生成可追溯的 companyKnowledgePack。只输出合法 JSON，不要输出 Markdown。
JSON 字段必须包含：sourceSummary, companyCoreBusiness, productLines, recentSignals, roleContext, interviewFocusPrediction, risksAndUnknowns, evidenceMap, recommendedQuestions, howToUseInInterview。
evidenceMap 每项必须包含 claim, sourceId, sourceName, confidence。不要编造无法由资料来源支持的事实；如果资料不足，把不确定点写入 risksAndUnknowns。`

function agnesModel() {
  return serverEnv.AGNES_MODEL?.trim() || 'agnes-chat'
}

function agnesBaseUrl() {
  return (serverEnv.AGNES_BASE_URL?.trim() || '').replace(/\/$/, '')
}

function agnesChatPath() {
  const value = serverEnv.AGNES_CHAT_PATH?.trim() || '/chat/completions'
  return value.startsWith('/') ? value : `/${value}`
}

function extractContent(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return undefined
  const input = payload as Record<string, unknown>
  const choices = input.choices
  if (Array.isArray(choices)) {
    const first = choices[0]
    if (first && typeof first === 'object') {
      const message = (first as Record<string, unknown>).message
      if (message && typeof message === 'object') {
        const content = (message as Record<string, unknown>).content
        if (content) return content
      }
      const text = (first as Record<string, unknown>).text
      if (text) return text
    }
  }
  if (typeof input.output_text === 'string') return input.output_text
  if (typeof input.text === 'string') return input.text
  if (input.data && typeof input.data === 'object') {
    const data = input.data as Record<string, unknown>
    if (typeof data.content === 'string') return data.content
    if (typeof data.text === 'string') return data.text
  }
  return payload
}

function parseAgnesPayload(payload: unknown) {
  const content = extractContent(payload)
  if (!content) throw new Error('AGNES returned empty content')
  if (typeof content === 'string') return parseModelJson(content)
  if (typeof content === 'object') return content
  throw new Error('AGNES returned unsupported content')
}

export function getAgnesProviderStatus() {
  const configured = Boolean(serverEnv.AGNES_API_KEY?.trim() && agnesBaseUrl())
  return {
    configured,
    implemented: true,
    model: agnesModel(),
    note: configured
      ? 'AGNES Provider 已配置，将用于公司资料增强和文本反馈。'
      : '未配置 AGNES_API_KEY 或 AGNES_BASE_URL，会回退到 Mock。',
  }
}

export function createAgnesProvider(apiKey: string): AnalyzeAnswerProvider {
  const model = agnesModel()
  const baseUrl = agnesBaseUrl()
  const chatPath = agnesChatPath()

  async function completeJson(systemPrompt: string, userPayload: unknown, maxTokens = 3200) {
    if (!baseUrl) throw new Error('AGNES_BASE_URL is required')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 24_000)
    try {
      const response = await fetch(`${baseUrl}${chatPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          response_format: { type: 'json_object' },
          temperature: 0.25,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `请基于以下 JSON 输入生成结果：\n${JSON.stringify(userPayload)}` },
          ],
        }),
      })
      if (!response.ok) throw new Error(`AGNES request failed: ${response.status}`)
      return parseAgnesPayload(await response.json())
    } finally {
      clearTimeout(timeout)
    }
  }

  return {
    name: 'agnes',
    model,
    async analyzeAnswer(input: AnalyzeAnswerRequest): Promise<AnalyzeAnswerSuccess> {
      return normalizeModelFeedback(await completeJson(ANALYZE_ANSWER_PROMPT, input, 2600), 'agnes', model)
    },
    async generateCompanyKnowledgePack(
      input: GenerateCompanyKnowledgePackRequest,
    ): Promise<GenerateCompanyKnowledgePackSuccess> {
      return normalizeCompanyKnowledgePack(await completeJson(COMPANY_KNOWLEDGE_PROMPT, input, 3600), 'agnes', model)
    },
  }
}
