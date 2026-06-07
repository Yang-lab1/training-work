import type {
  AIProviderName,
  AnalyzeAnswerSuccess,
  GenerateFollowUpSuccess,
  GenerateInterviewReportSuccess,
  GenerateJobPackSuccess,
  GenerateMockInterviewSuccess,
  InterviewFinalReport,
  JobPackAnswerFramework,
  JobPackQuestion,
  MockInterviewQuestion,
} from '../../../src/lib/ai/types.js'

type ModelFeedback = Omit<
  AnalyzeAnswerSuccess,
  'success' | 'provider' | 'model' | 'generatedAt' | 'rawProviderNote'
>

function text(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function list(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback
  const items = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8)
  return items.length ? items : fallback
}

function objectList<T>(
  value: unknown,
  fallback: T[],
  normalizer: (item: Record<string, unknown>) => T,
) {
  if (!Array.isArray(value)) return fallback
  const items = value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map(normalizer)
    .slice(0, 12)
  return items.length ? items : fallback
}

export function normalizeModelFeedback(
  value: unknown,
  provider: AIProviderName,
  model: string,
  rawProviderNote?: string,
): AnalyzeAnswerSuccess {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const rawScore = typeof input.score === 'number' ? input.score : Number(input.score)
  const score = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : 70

  return {
    success: true,
    provider,
    model,
    generatedAt: new Date().toISOString(),
    score,
    summary: text(input.summary, '已完成本次回答分析。'),
    strengths: list(input.strengths, ['回答已形成可复盘的完整文本。']),
    problems: list(input.problems, ['还可以进一步增加岗位证据和具体结果。']),
    roleFitFeedback: text(input.roleFitFeedback, '补充与目标岗位直接相关的经历和关键词。'),
    structureFeedback: text(input.structureFeedback, '按背景、行动、结果和岗位关系组织回答。'),
    expressionFeedback: text(input.expressionFeedback, '减少重复表达，让句子更短、更自然。'),
    timingFeedback: text(input.timingFeedback, '继续按目标时长练习，并保留必要信息。'),
    fluencyFeedback: text(input.fluencyFeedback, '减少无意义停顿，用短句保持表达连续。'),
    memorizationRisk: text(input.memorizationRisk, '仅根据文本无法完整判断背稿风险，建议结合后续语音特征分析。'),
    specificityFeedback: text(input.specificityFeedback, '补充具体用户、场景、行动和可验证结果。'),
    improvedShortVersion: text(input.improvedShortVersion, '请根据反馈压缩为 30 秒版本。'),
    improvedLongVersion: text(input.improvedLongVersion, '请根据反馈重写为 90 秒版本。'),
    nextTasks: list(input.nextTasks, ['只看回答骨架重讲一次。']).slice(0, 3),
    rawProviderNote,
  }
}

export function parseModelJson(content: string) {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  try {
    return JSON.parse(cleaned) as ModelFeedback
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as ModelFeedback
    }
    throw new Error('Model output is not valid JSON')
  }
}

function normalizeQuestion(item: Record<string, unknown>): JobPackQuestion {
  return {
    question: text(item.question, '请介绍一下你为什么适合这个岗位。'),
    whyItMatters: text(item.whyItMatters, '考察候选人是否理解岗位和公司业务。'),
    framework: text(item.framework, '先给结论，再用项目证据说明匹配。'),
  }
}

function normalizeAnswerFramework(item: Record<string, unknown>): JobPackAnswerFramework {
  return {
    question: text(item.question, '请介绍一下你为什么适合这个岗位。'),
    frameworkName: text(item.frameworkName, 'STAR'),
    answerStructure: list(item.answerStructure, ['背景', '行动', '结果', '岗位关系']).slice(0, 8),
    candidateEvidence: list(item.candidateEvidence, ['AI 学习、产品项目、Miro 项目']).slice(0, 8),
    pitfalls: list(item.pitfalls, ['不要只背概念，要讲具体行动和结果。']).slice(0, 8),
  }
}

function normalizeMockQuestion(item: Record<string, unknown>, index: number): MockInterviewQuestion {
  const type = text(item.type, index === 0 ? 'self_intro' : index === 2 ? 'project' : index === 5 ? 'pressure' : 'role_fit') as MockInterviewQuestion['type']
  const source = text(item.source, 'mockProvider') as MockInterviewQuestion['source']
  return {
    id: text(item.id, `q-${index + 1}`),
    type: ['self_intro', 'project', 'role_fit', 'technical_basic', 'pressure', 'english', 'follow_up'].includes(type) ? type : 'role_fit',
    question: text(item.question, '请介绍一下你为什么适合这个岗位。'),
    source: ['jobPack', 'selectedJob', 'miroProject', 'mockProvider'].includes(source) ? source : 'mockProvider',
    expectedFocus: text(item.expectedFocus, '回答需要结合公司业务、岗位要求和自己的项目证据。'),
    followUpPolicy: text(item.followUpPolicy, '如果回答空泛，继续追问具体项目、行动和结果。'),
  }
}

export function normalizeJobPack(
  value: unknown,
  provider: AIProviderName,
  model: string,
  rawProviderNote?: string,
): GenerateJobPackSuccess {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const fallbackQuestions = [
    { question: '你为什么申请这个岗位？', whyItMatters: '考察岗位动机和业务理解。', framework: '结论-公司业务-个人项目-岗位贡献' },
    { question: '请讲一个最能证明你产品能力的项目。', whyItMatters: '考察项目表达和结果意识。', framework: '项目七步法' },
    { question: '你如何理解这个岗位的日常工作？', whyItMatters: '考察岗位真实理解。', framework: '职责拆解-协作对象-产出物-风险' },
  ]
  return {
    success: true,
    provider,
    model,
    generatedAt: new Date().toISOString(),
    jobPack: {
      companySummary: text(input.companySummary, '根据岗位信息整理公司核心业务。'),
      productAndBusiness: text(input.productAndBusiness, '围绕公司产品、业务方向和行业位置进行准备。'),
      jobRequirementBreakdown: list(input.jobRequirementBreakdown, ['理解岗位要求，拆成业务理解、产品判断、项目表达和协作能力。']),
      workContentPrediction: list(input.workContentPrediction, ['日常可能包括需求拆解、竞品/用户分析、方案推进、原型或文档输出。']),
      candidateFit: list(input.candidateFit, ['用 AI 学习、产品体验、Miro 项目和设计背景建立匹配点。']),
      riskPoints: list(input.riskPoints, ['避免只讲转型意愿，需要用项目证据证明岗位能力。']),
      selfIntroductionStrategy: text(input.selfIntroductionStrategy, '开头直接定位目标岗位，中段讲项目证据，结尾回到公司业务。'),
      miroProjectStrategy: text(input.miroProjectStrategy, 'Miro 项目要讲清用户场景、AI 作用、MVP 取舍和验证结果。'),
      likelyQuestions: objectList(input.likelyQuestions, fallbackQuestions, normalizeQuestion).slice(0, 8),
      fullScoreAnswerFrameworks: objectList(input.fullScoreAnswerFrameworks, fallbackQuestions.map((question) => ({
        question: question.question,
        frameworkName: 'STAR / 项目七步法',
        answerStructure: ['一句话结论', '项目背景', '关键行动', '结果证据', '岗位关系'],
        candidateEvidence: ['AI 学习', 'Miro 项目', '产品体验'],
        pitfalls: ['不要背准备包原文', '不要忽略公司业务', '不要缺少结果'],
      })), normalizeAnswerFramework).slice(0, 8),
      preparationTasks: list(input.preparationTasks, ['用 90 秒讲一遍自我介绍。', '用项目七步法重讲 Miro 项目。', '准备 3 个岗位相关追问。']).slice(0, 5),
    },
    rawProviderNote,
  }
}

export function normalizeMockInterviewQuestions(
  value: unknown,
  provider: AIProviderName,
  model: string,
  rawProviderNote?: string,
): GenerateMockInterviewSuccess {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const fallback = [
    { id: 'q-1', type: 'self_intro', question: '请用中文做一个 90 秒自我介绍，并说明你和这个岗位的匹配点。', source: 'mockProvider', expectedFocus: '背景、AI 学习、项目证据、岗位匹配。', followUpPolicy: '追问最能证明岗位匹配的一段经历。' },
    { id: 'q-2', type: 'role_fit', question: '你为什么选择这家公司和这个岗位？', source: 'selectedJob', expectedFocus: '公司业务理解、岗位动机、个人贡献。', followUpPolicy: '追问公司业务与你项目的关系。' },
    { id: 'q-3', type: 'project', question: '请讲一下 Miro 项目，你负责了什么关键决策？', source: 'miroProject', expectedFocus: '用户、场景、MVP 取舍、结果。', followUpPolicy: '追问具体用户和验证证据。' },
    { id: 'q-4', type: 'role_fit', question: '你从设计背景转向 AI 产品，优势和短板分别是什么？', source: 'selectedJob', expectedFocus: '迁移能力、风险认知、补齐计划。', followUpPolicy: '追问短板如何在入职后补齐。' },
    { id: 'q-5', type: 'technical_basic', question: '如果要验证一个 AI 产品功能是否有效，你会看哪些指标？', source: 'selectedJob', expectedFocus: '假设、指标、MVP、反馈闭环。', followUpPolicy: '追问具体指标和实验设计。' },
    { id: 'q-6', type: 'pressure', question: '如果面试官认为你经验不够，你会怎么回应？', source: 'mockProvider', expectedFocus: '承认差距、迁移证据、学习计划。', followUpPolicy: '追问最强证据。' },
  ]
  const rawQuestions = Array.isArray(input.questions) ? input.questions : Array.isArray(value) ? value : fallback
  const questions = rawQuestions
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map(normalizeMockQuestion)
    .slice(0, 10)
  return {
    success: true,
    provider,
    model,
    generatedAt: new Date().toISOString(),
    questions: questions.length >= 6 ? questions : fallback.map(normalizeMockQuestion),
    rawProviderNote,
  }
}

export function normalizeFollowUp(
  value: unknown,
  provider: AIProviderName,
  model: string,
  rawProviderNote?: string,
): GenerateFollowUpSuccess {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    success: true,
    provider,
    model,
    generatedAt: new Date().toISOString(),
    followUpQuestion: normalizeMockQuestion({
      id: text(input.id, `follow-up-${Date.now()}`),
      type: 'follow_up',
      question: text(input.followUpQuestion || input.question, '你刚才提到的项目结果能不能再具体一点？'),
      source: 'mockProvider',
      expectedFocus: text(input.expectedFocus, '补充具体用户、行动、结果和岗位关系。'),
      followUpPolicy: text(input.followUpPolicy, '继续追问可验证证据。'),
    }, 0),
    rawProviderNote,
  }
}

export function normalizeInterviewReport(
  value: unknown,
  provider: AIProviderName,
  model: string,
  rawProviderNote?: string,
): GenerateInterviewReportSuccess {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const rawScore = typeof input.overallScore === 'number' ? input.overallScore : Number(input.overallScore)
  const finalReport: InterviewFinalReport = {
    overallScore: Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : 72,
    summary: text(input.summary, '本场模拟面试已完成，下一步重点是提高岗位证据密度和项目具体性。'),
    strongestAnswer: text(input.strongestAnswer, '自我介绍已形成基本结构。'),
    weakestAnswer: text(input.weakestAnswer, '项目回答需要更具体的用户、行动和结果。'),
    recurringProblems: list(input.recurringProblems, ['岗位关键词不够直接', '项目结果还不够具体']).slice(0, 6),
    roleFitAssessment: text(input.roleFitAssessment, '岗位匹配需要在开头和结尾更明确地连接公司业务。'),
    communicationAssessment: text(input.communicationAssessment, '表达整体可理解，建议减少铺垫和重复。'),
    projectDepthAssessment: text(input.projectDepthAssessment, '项目深度需要补充决策过程、MVP 取舍和验证证据。'),
    englishAssessment: text(input.englishAssessment, '英文问题可先用短句保证清晰度。'),
    nextTrainingPlan: list(input.nextTrainingPlan, ['重练 90 秒自我介绍', '用项目七步法重讲 Miro 项目', '准备为什么选择公司和岗位']).slice(0, 6),
  }
  return {
    success: true,
    provider,
    model,
    generatedAt: new Date().toISOString(),
    finalReport,
    rawProviderNote,
  }
}
