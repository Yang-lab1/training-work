import type {
  AnalyzeAnswerRequest,
  AnalyzeAnswerSuccess,
  GenerateCompanyKnowledgePackRequest,
  GenerateCompanyKnowledgePackSuccess,
  GenerateFollowUpRequest,
  GenerateFollowUpSuccess,
  GenerateInterviewReportRequest,
  GenerateInterviewReportSuccess,
  GenerateJobPackRequest,
  GenerateJobPackSuccess,
  GenerateMockInterviewRequest,
  GenerateMockInterviewSuccess,
  ReviewRealInterviewRequest,
  ReviewRealInterviewSuccess,
} from '../../../../src/lib/ai/types.js'
import { serverEnv } from '../env.js'
import type { AnalyzeAnswerProvider } from '../provider.js'
import { normalizeCompanyKnowledgePack, normalizeFollowUp, normalizeInterviewReport, normalizeJobPack, normalizeMockInterviewQuestions, normalizeModelFeedback, normalizeRealInterviewReview, parseModelJson } from '../response.js'

const SYSTEM_PROMPT = `你是一名严格的中文面试教练。请分析候选人的一次训练回答，并只输出合法 JSON。
必须具体结合训练类型、目标公司、目标岗位、回答文本和时长。
禁止空泛鼓励，必须指出可执行修改。
JSON 字段必须为：
score, summary, strengths, problems, roleFitFeedback, structureFeedback,
expressionFeedback, timingFeedback, fluencyFeedback, memorizationRisk,
specificityFeedback, improvedShortVersion, improvedLongVersion, nextTasks。
score 为 0-100 数字；strengths、problems、nextTasks 为字符串数组；其余字段为字符串。
分析维度：是否回答问题、岗位贴合、结构、表达、时长、AI/项目能力、具体证据，以及 30 秒和 90 秒修改稿。`

const JOB_PACK_SYSTEM_PROMPT = `你是一名严格的中文 AI 面试准备教练。请基于岗位、CV、训练记录和 AI 反馈生成岗位准备包，并只输出合法 JSON。
准备包是学习资料和高概率方向，不是固定题库。不要让候选人背题。
JSON 字段必须为：
companySummary, productAndBusiness, jobRequirementBreakdown, workContentPrediction,
candidateFit, riskPoints, selfIntroductionStrategy, miroProjectStrategy,
likelyQuestions, fullScoreAnswerFrameworks, preparationTasks。
jobRequirementBreakdown、workContentPrediction、candidateFit、riskPoints、preparationTasks 为字符串数组。
likelyQuestions 至少 8 个，每项包含 question, whyItMatters, framework。
fullScoreAnswerFrameworks 每项包含 question, frameworkName, answerStructure, candidateEvidence, pitfalls。
必须结合 selectedJob 的公司、岗位、公司业务、岗位内容、岗位要求，并结合 CV 和已有训练反馈。`

const MOCK_INTERVIEW_PROMPT = `你是一名真实但克制的中文面试官。请基于岗位、岗位准备包、CV 和训练记录生成一轮岗位定向模拟面试问题，并只输出合法 JSON。
JSON 字段必须为 questions。questions 至少 6 个，每项包含 id, type, question, source, expectedFocus, followUpPolicy。
type 只能为 self_intro, project, role_fit, technical_basic, pressure, english, follow_up。
source 只能为 jobPack, selectedJob, miroProject, mockProvider。
问题不能是固定背题剧本，必须能灵活考察公司业务、岗位要求、用户项目、岗位匹配和临场反应。`

const FOLLOW_UP_PROMPT = `你是一名中文面试官。请基于当前问题、候选人回答和 AI 反馈生成一个自然追问，并只输出合法 JSON。
JSON 字段必须为 followUpQuestion, expectedFocus, followUpPolicy。
追问必须与当前岗位、公司业务、问题和候选人回答相关，不能跑偏。`

const INTERVIEW_REPORT_PROMPT = `你是一名严格的 AI 面试复盘教练。请基于整场模拟面试的问题、回答转写和单题反馈生成整场复盘，并只输出合法 JSON。
JSON 字段必须为 overallScore, summary, strongestAnswer, weakestAnswer, recurringProblems, roleFitAssessment, communicationAssessment, projectDepthAssessment, englishAssessment, nextTrainingPlan。
recurringProblems 和 nextTrainingPlan 为字符串数组。必须给出可执行的下一轮训练计划。`

const REAL_INTERVIEW_REVIEW_PROMPT = `你是严格的中文真实面试复盘教练。请根据真实面试转写、目标岗位、岗位准备包和训练记录，提取面试官问题、候选人回答、准备命中情况、遗漏问题、弱项和下一轮训练任务。只输出合法 JSON。JSON 必须包含 extractedQuestions, extractedAnswers, comparison, reviewReport。extractedQuestions 每项包含 id, question, category, confidence, sourceSpan。category 只能是 self_intro, project, role_fit, technical_basic, pressure, english, behavior, unknown。extractedAnswers 每项包含 questionId, answerText, durationEstimate, qualityNote。comparison 包含 predictedByMockInterview, predictedByJobPack, missedQuestions, newQuestionPatterns, weakAreas。reviewReport 包含 overallSummary, interviewerFocus, strongestAnswer, weakestAnswer, missedPreparation, unexpectedQuestions, answerQuality, roleFitAssessment, nextTrainingTasks, questionBankUpdates。questionBankUpdates 每项包含 question, category, source, selectedJobId, priority, suggestedPracticeType。必须把真实问题反补到题库和下一轮训练。`

const COMPANY_KNOWLEDGE_PROMPT = `你是公司与岗位研究简报生成器。请根据 selectedJob、岗位准备包、用户上传的公司资料、CV 文本和真实面试复盘，生成可追溯的 companyKnowledgePack。只输出合法 JSON。JSON 必须包含 sourceSummary, companyCoreBusiness, productLines, recentSignals, roleContext, interviewFocusPrediction, risksAndUnknowns, evidenceMap, recommendedQuestions, howToUseInInterview。evidenceMap 每项包含 claim, sourceId, sourceName, confidence。不要编造无法从资料或岗位表支持的事实；不确定时写入 risksAndUnknowns。`

export function createDeepSeekProvider(apiKey: string): AnalyzeAnswerProvider {
  const model = serverEnv.DEEPSEEK_MODEL?.trim() || 'deepseek-chat'
  const baseUrl = (serverEnv.DEEPSEEK_BASE_URL?.trim() || 'https://api.deepseek.com').replace(/\/$/, '')
  async function completeJson(systemPrompt: string, userPayload: unknown, maxTokens = 2400) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 22_000)
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          response_format: { type: 'json_object' },
          temperature: 0.35,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `请基于以下 JSON 输入生成结果：\n${JSON.stringify(userPayload)}` },
          ],
        }),
      })
      if (!response.ok) throw new Error(`DeepSeek request failed: ${response.status}`)
      const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
      const content = payload.choices?.[0]?.message?.content
      if (!content) throw new Error('DeepSeek returned empty content')
      return parseModelJson(content)
    } finally {
      clearTimeout(timeout)
    }
  }
  return {
    name: 'deepseek',
    model,
    async analyzeAnswer(input: AnalyzeAnswerRequest): Promise<AnalyzeAnswerSuccess> {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 18_000)
      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            response_format: { type: 'json_object' },
            temperature: 0.3,
            max_tokens: 2400,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: `请基于以下 JSON 输入生成反馈：\n${JSON.stringify(input)}` },
            ],
          }),
        })
        if (!response.ok) throw new Error(`DeepSeek request failed: ${response.status}`)
        const payload = await response.json() as {
          choices?: Array<{ message?: { content?: string } }>
        }
        const content = payload.choices?.[0]?.message?.content
        if (!content) throw new Error('DeepSeek returned empty content')
        return normalizeModelFeedback(parseModelJson(content), 'deepseek', model)
      } finally {
        clearTimeout(timeout)
      }
    },
    async generateJobPack(input: GenerateJobPackRequest): Promise<GenerateJobPackSuccess> {
      return normalizeJobPack(await completeJson(JOB_PACK_SYSTEM_PROMPT, input, 3600), 'deepseek', model)
    },
    async generateMockInterview(input: GenerateMockInterviewRequest): Promise<GenerateMockInterviewSuccess> {
      return normalizeMockInterviewQuestions(await completeJson(MOCK_INTERVIEW_PROMPT, input, 2600), 'deepseek', model)
    },
    async generateFollowUp(input: GenerateFollowUpRequest): Promise<GenerateFollowUpSuccess> {
      return normalizeFollowUp(await completeJson(FOLLOW_UP_PROMPT, input, 1200), 'deepseek', model)
    },
    async generateInterviewReport(input: GenerateInterviewReportRequest): Promise<GenerateInterviewReportSuccess> {
      return normalizeInterviewReport(await completeJson(INTERVIEW_REPORT_PROMPT, input, 2600), 'deepseek', model)
    },
    async reviewRealInterview(input: ReviewRealInterviewRequest): Promise<ReviewRealInterviewSuccess> {
      return normalizeRealInterviewReview(await completeJson(REAL_INTERVIEW_REVIEW_PROMPT, input, 3200), 'deepseek', model)
    },
    async generateCompanyKnowledgePack(input: GenerateCompanyKnowledgePackRequest): Promise<GenerateCompanyKnowledgePackSuccess> {
      return normalizeCompanyKnowledgePack(await completeJson(COMPANY_KNOWLEDGE_PROMPT, input, 3200), 'deepseek', model)
    },
  }
}
