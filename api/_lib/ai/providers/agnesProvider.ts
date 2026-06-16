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

function agnesTimeoutMs() {
  const value = Number(serverEnv.AGNES_TIMEOUT_MS || 40_000)
  return Number.isFinite(value) && value >= 10_000 ? value : 40_000
}

function shortenText(value: unknown, max: number) {
  if (typeof value !== 'string') return ''
  return value.length > max ? `${value.slice(0, max)}…` : value
}

function compactCompanyKnowledgeInput(input: GenerateCompanyKnowledgePackRequest): GenerateCompanyKnowledgePackRequest {
  return {
    taskType: 'generate_company_knowledge_pack',
    selectedJob: {
      id: input.selectedJob?.id,
      companyName: shortenText(input.selectedJob?.companyName, 120),
      jobTitle: shortenText(input.selectedJob?.jobTitle, 120),
      city: shortenText(input.selectedJob?.city, 60),
      jobType: shortenText(input.selectedJob?.jobType, 60),
      priority: shortenText(input.selectedJob?.priority, 60),
      mainTrack: shortenText(input.selectedJob?.mainTrack, 120),
      companyBusiness: shortenText(input.selectedJob?.companyBusiness, 800),
      jobContent: shortenText(input.selectedJob?.jobContent, 1400),
      jobRequirements: shortenText(input.selectedJob?.jobRequirements, 1400),
      businessDirection: shortenText(input.selectedJob?.businessDirection, 500),
    },
    jobPack: input.jobPack ? {
      companySummary: shortenText(input.jobPack.companySummary, 900),
      productAndBusiness: shortenText(input.jobPack.productAndBusiness, 900),
      jobRequirementBreakdown: (input.jobPack.jobRequirementBreakdown || []).slice(0, 6).map((item) => shortenText(item, 220)),
      workContentPrediction: (input.jobPack.workContentPrediction || []).slice(0, 6).map((item) => shortenText(item, 220)),
      candidateFit: (input.jobPack.candidateFit || []).slice(0, 6).map((item) => shortenText(item, 220)),
      riskPoints: (input.jobPack.riskPoints || []).slice(0, 6).map((item) => shortenText(item, 220)),
      selfIntroductionStrategy: shortenText(input.jobPack.selfIntroductionStrategy, 900),
      miroProjectStrategy: shortenText(input.jobPack.miroProjectStrategy, 900),
      likelyQuestions: (input.jobPack.likelyQuestions || []).slice(0, 6).map((item) => ({
        question: shortenText(item.question, 220),
        whyItMatters: shortenText(item.whyItMatters, 220),
        framework: shortenText(item.framework, 120),
      })),
      fullScoreAnswerFrameworks: (input.jobPack.fullScoreAnswerFrameworks || []).slice(0, 4).map((item) => ({
        question: shortenText(item.question, 220),
        frameworkName: shortenText(item.frameworkName, 120),
        answerStructure: (item.answerStructure || []).slice(0, 5).map((entry) => shortenText(entry, 180)),
        candidateEvidence: (item.candidateEvidence || []).slice(0, 5).map((entry) => shortenText(entry, 180)),
        pitfalls: (item.pitfalls || []).slice(0, 4).map((entry) => shortenText(entry, 180)),
      })),
      preparationTasks: (input.jobPack.preparationTasks || []).slice(0, 6).map((item) => shortenText(item, 180)),
    } : undefined,
    companySources: (input.companySources || []).slice(0, 6).map((source) => ({
      ...source,
      title: shortenText(source.title, 120),
      sourceName: shortenText(source.sourceName, 120),
      sourceUrl: source.sourceUrl ? shortenText(source.sourceUrl, 260) : undefined,
      text: shortenText(source.text, 2800),
      wordCount: source.wordCount,
    })),
    cvText: shortenText(input.cvText, 3200),
    realInterviewReviews: (input.realInterviewReviews || []).slice(0, 3).map((review) => ({
      overallSummary: shortenText(review.overallSummary, 360),
      interviewerFocus: (review.interviewerFocus || []).slice(0, 5).map((item) => shortenText(item, 180)),
      strongestAnswer: shortenText(review.strongestAnswer, 240),
      weakestAnswer: shortenText(review.weakestAnswer, 240),
      missedPreparation: (review.missedPreparation || []).slice(0, 5).map((item) => shortenText(item, 180)),
      unexpectedQuestions: (review.unexpectedQuestions || []).slice(0, 5).map((item) => shortenText(item, 180)),
      answerQuality: shortenText(review.answerQuality, 280),
      roleFitAssessment: shortenText(review.roleFitAssessment, 280),
      nextTrainingTasks: (review.nextTrainingTasks || []).slice(0, 5).map((item) => shortenText(item, 180)),
    })),
  }
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
      ? 'AGNES Provider 已配置，将用于公司资料增强和岗位面试知识包。'
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
    const timeout = setTimeout(() => controller.abort(), agnesTimeoutMs())
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
      return normalizeCompanyKnowledgePack(await completeJson(COMPANY_KNOWLEDGE_PROMPT, compactCompanyKnowledgeInput(input), 3200), 'agnes', model)
    },
  }
}
