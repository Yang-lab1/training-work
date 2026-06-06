import type {
  AIProviderName,
  AnalyzeAnswerRequest,
  AnalyzeAnswerSuccess,
} from '../../../../src/lib/ai/types.js'
import { normalizeModelFeedback } from '../response.js'

function shortVersion(input: AnalyzeAnswerRequest) {
  const company = input.selectedJob?.companyName || '目标公司'
  const role = input.selectedJob?.jobTitle || '目标岗位'
  if (input.trainingType === 'englishIntro') {
    return `I am applying for the ${role} role at ${company}. My background combines AI learning, product thinking, and hands-on project work. I connect user needs with practical delivery and explain decisions with clear evidence.`
  }
  if (input.trainingType === 'miroProject') {
    return `在 Miro 项目中，我从用户协作场景出发，确认核心问题，完成需求拆解、MVP 设计和反馈验证。这段经历证明我具备${company}${role}需要的用户理解、产品判断和推进能力。`
  }
  return `我正在申请${company}的${role}。我的优势是把 AI 学习、产品思维和设计实践结合起来，并用具体项目说明自己如何理解用户、推进方案和验证结果。`
}

function longVersion(input: AnalyzeAnswerRequest) {
  const company = input.selectedJob?.companyName || '目标公司'
  const role = input.selectedJob?.jobTitle || '目标岗位'
  const direction = input.selectedJob?.companyBusiness
    || input.selectedJob?.mainTrack
    || input.selectedJob?.businessDirection
    || '相关业务'
  if (input.trainingType === 'englishIntro') {
    return `I am applying for the ${role} role at ${company}. My background combines AI study, product experience, and industrial design. In my projects, I start from user evidence, define the core problem, work across functions, and turn ideas into testable MVPs. For ${direction}, I can connect AI capabilities with practical user scenarios and explain product decisions with clear evidence.`
  }
  if (input.trainingType === 'miroProject') {
    return `Miro 项目源于多人协作中信息分散、讨论难以形成行动的问题。我负责梳理用户场景、判断功能优先级并设计可验证的 MVP。方案明确了用户、场景、AI 在流程中的作用以及关键取舍。完成原型后，我根据反馈调整信息结构和交互路径。这段经历与${company}${role}的关联在于，我能把模糊需求转成可执行方案，并推动跨团队验证。`
  }
  return `我正在申请${company}的${role}。我的背景结合了 AI 学习、产品体验与工业设计，使我既关注用户和业务问题，也重视方案是否能够落地。在 Miro、小米及其他项目中，我参与过需求拆解、用户场景分析、原型验证和跨团队沟通。针对${direction}，我能把 AI 能力放入具体流程，并用清晰指标验证效果。希望把这种复合能力用于${company}，为${role}带来扎实的用户理解和产品执行。`
}

function includesAny(text: string, terms: string[]) {
  const normalized = text.toLowerCase()
  return terms.some((term) => normalized.includes(term.toLowerCase()))
}

export function analyzeWithMock(
  input: AnalyzeAnswerRequest,
  provider: Extract<AIProviderName, 'mock' | 'mock_fallback'> = 'mock',
  note?: string,
): AnalyzeAnswerSuccess {
  const transcript = input.transcript.trim()
  const overtime = input.durationSeconds > input.targetSeconds
  const tooShortByTime = input.durationSeconds > 0 && input.durationSeconds < input.targetSeconds * 0.55
  const tooShortByText = transcript.length < (input.trainingType === 'miroProject' ? 180 : 100)
  const company = input.selectedJob?.companyName || '目标公司'
  const role = input.selectedJob?.jobTitle || '目标岗位'
  const problems: string[] = []
  const strengths = ['已形成可复盘的完整回答文本。']
  let score = 78

  if (input.selectedJob) strengths.push(`回答可以继续围绕${company}的${role}深化。`)
  if (includesAny(transcript, ['结果', '提升', '验证', '反馈', 'result', 'improved', 'validated'])) {
    strengths.push('回答包含结果或验证意识。')
    score += 4
  }
  if (overtime) {
    score -= 10
    problems.push('回答超时，需要压缩背景信息和重复句。')
  }
  if (tooShortByTime || tooShortByText) {
    score -= 8
    problems.push('回答内容偏短，需要补充行动、结果和岗位关系。')
  }
  if (input.selectedJob && !includesAny(transcript, [company, role])) {
    score -= 7
    problems.push('岗位匹配证据不够直接，回答没有明确点出目标公司或岗位。')
  }
  if (input.trainingType === 'chineseIntro' && !includesAny(transcript, ['AI', '项目', '岗位'])) {
    score -= 6
    problems.push('中文自我介绍还没有完整覆盖 AI 学习、项目证据和岗位匹配。')
  }
  if (input.trainingType === 'miroProject') {
    problems.push('项目讲解需要具体到用户、场景、AI 作用和 MVP 取舍。')
  }
  if (!problems.length) problems.push('可以再加入一个更具体的结果或验证证据。')

  const roleFitFeedback = input.selectedJob
    ? `面向${company}的${role}，开头应直接定位岗位，结尾要用项目证据回应岗位要求。`
    : '请先选择目标岗位，再补充岗位关键词和直接匹配证据。'

  const specificityFeedback = input.trainingType === 'miroProject'
    ? '补充具体用户是谁、发生在什么场景、AI 解决了哪一步、MVP 舍弃了什么，以及验证结果。'
    : '至少加入一个具体项目行动和一个可验证结果，避免只描述能力标签。'

  const tasks = [
    overtime ? `把回答压缩到 ${input.targetSeconds} 秒以内。` : '录一遍 30 秒压缩版。',
    input.selectedJob ? `在开头和结尾明确加入“${role}”及岗位证据。` : '选择目标岗位后重讲一次。',
    input.trainingType === 'miroProject' ? '补充用户、场景、AI 作用和 MVP 取舍。' : '补充一个可验证的项目结果。',
  ]

  return normalizeModelFeedback({
    score,
    summary: '回答已有基础内容，下一步应集中改善岗位证据、结构密度和具体结果。',
    strengths,
    problems,
    roleFitFeedback,
    structureFeedback: '按“结论-证据-结果-岗位关系”组织回答，每一段只承担一个信息任务。',
    expressionFeedback: input.trainingType === 'englishIntro'
      ? '英文表达优先保证自然和简洁，使用短句，减少复杂从句和逐字翻译。'
      : '减少重复连接词，用更短的句子突出行动和结果。',
    timingFeedback: overtime
      ? `本次超过 ${input.targetSeconds} 秒目标，先删掉重复背景，再保留一个核心项目证据。`
      : tooShortByTime
        ? `本次明显短于 ${input.targetSeconds} 秒目标，需要补充具体行动和结果。`
        : `本次时长接近 ${input.targetSeconds} 秒目标，继续优化信息密度。`,
    fluencyFeedback: '当前 Mock 仅基于文本和时长判断，真实停顿、卡顿与语速需要 ASR 时间戳或音频模型。',
    memorizationRisk: input.scriptText && transcript === input.scriptText.trim()
      ? '回答与参考稿完全一致，背稿风险较高；建议只看关键词重新表达。'
      : '仅凭文本不能准确判断背稿风险，后续需结合语音节奏和停顿分析。',
    specificityFeedback,
    improvedShortVersion: shortVersion(input),
    improvedLongVersion: longVersion(input),
    nextTasks: tasks,
  }, provider, 'mock-v2', note)
}
