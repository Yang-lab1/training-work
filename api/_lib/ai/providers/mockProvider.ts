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
    return `I am applying for the ${role} role at ${company}. My background combines AI learning, product thinking, and hands-on project work. I can connect user needs with practical delivery and explain decisions with clear evidence.`
  }
  if (input.trainingType === 'miroProject') {
    return `在 Miro 项目中，我先确认用户协作场景和核心痛点，再把需求拆成可验证的功能优先级，完成 MVP 并用反馈迭代。这个过程能证明我与${company}${role}所需能力的匹配。`
  }
  return `我正在应聘${company}的${role}。我的优势是把 AI 学习、产品思维和设计实践结合起来，并能用具体项目说明自己如何理解用户、推进方案和验证结果。`
}

function longVersion(input: AnalyzeAnswerRequest) {
  const company = input.selectedJob?.companyName || '目标公司'
  const role = input.selectedJob?.jobTitle || '目标岗位'
  const direction = input.selectedJob?.companyBusiness
    || input.selectedJob?.mainTrack
    || input.selectedJob?.businessDirection
    || '相关业务'
  if (input.trainingType === 'englishIntro') {
    return `I am applying for the ${role} role at ${company}. My background combines AI study, product experience, and industrial design. In my projects, I learned to start from user evidence, define the core problem, work across functions, and turn an idea into a testable MVP. For ${direction}, I would bring structured product thinking, clear communication, and the ability to connect AI capabilities with a practical user scenario.`
  }
  if (input.trainingType === 'miroProject') {
    return `这个 Miro 项目源于一个明确的协作问题：用户在多人讨论中难以快速整理信息并形成下一步行动。我负责梳理场景、判断优先级并设计可验证的 MVP。方案不是简单增加功能，而是围绕用户、场景、AI 在流程中的作用以及关键取舍展开。完成原型后，我根据反馈调整信息结构和交互路径。这个项目与${company}${role}的关联在于，我能够把模糊需求转成可执行方案，并推动跨团队验证。`
  }
  return `我正在应聘${company}的${role}。我的背景结合了 AI 学习、产品体验与工业设计，这让我既关注用户和业务问题，也重视方案是否能够真正落地。在 Miro、小米及其他项目中，我负责过需求拆解、用户场景分析、原型验证和跨团队沟通。针对${direction}，我能把 AI 能力放进具体流程，用清晰指标验证效果。希望把这种复合能力用于${company}，为${role}带来更扎实的用户理解和产品执行。`
}

export function analyzeWithMock(
  input: AnalyzeAnswerRequest,
  provider: Extract<AIProviderName, 'mock' | 'mock_fallback'> = 'mock',
  note?: string,
): AnalyzeAnswerSuccess {
  const tags = input.review.issueTags
  const overtime = input.durationSeconds > input.targetSeconds || tags.includes('超时')
  const tooShort = input.durationSeconds > 0 && input.durationSeconds < input.targetSeconds * 0.55
  const company = input.selectedJob?.companyName || '目标公司'
  const role = input.selectedJob?.jobTitle || '目标岗位'
  const problems: string[] = []
  const strengths = ['已经完成回答并保留了可复盘文本。']
  let score = 78

  if (input.selectedJob) strengths.push(`回答可以围绕${company}的${role}继续深化。`)
  if (input.review.selfScore && input.review.selfScore >= 4) strengths.push('自评显示本次表达状态相对稳定。')
  if (overtime) {
    score -= 8
    problems.push('回答超时，需要压缩背景信息和重复句。')
  }
  if (tooShort) {
    score -= 5
    problems.push('回答偏短，需要补充行动、结果和岗位关系。')
  }
  if (tags.includes('逻辑混乱')) {
    score -= 8
    problems.push('结构跳跃，听众不容易抓住主线。')
  }
  if (tags.includes('岗位匹配弱')) {
    score -= 7
    problems.push('岗位关键词和匹配证据出现得不够明确。')
  }
  if (tags.includes('太像背稿')) {
    score -= 5
    problems.push('表达可能过于接近逐字背稿。')
  }
  if (input.trainingType === 'miroProject') {
    problems.push('项目讲解要具体到用户、场景、AI 作用和 MVP 取舍。')
  }
  if (!problems.length) problems.push('可以加入一个更具体的结果或验证证据。')

  const roleFitFeedback = input.selectedJob
    ? tags.includes('岗位匹配弱')
      ? `开头和结尾都要明确提到${company}的${role}，并把项目证据与岗位要求逐一连接。`
      : `继续围绕${company}的${role}补充岗位关键词，并说明你的经历如何支持该业务。`
    : '先选择目标岗位，再补充岗位关键词和直接匹配证据。'

  return normalizeModelFeedback({
    score,
    summary: `回答已有基础内容，但还需要把结构、岗位证据和具体结果讲得更集中。`,
    strengths,
    problems,
    roleFitFeedback,
    structureFeedback: tags.includes('逻辑混乱')
      ? '按“背景-行动-结果-岗位关系”重讲，每一段只回答一个问题。'
      : '保持“定位-证据-结果-岗位关系”的顺序，先说结论再补细节。',
    expressionFeedback: input.trainingType === 'englishIntro'
      ? '英文表达优先保证自然和简洁，使用短句，减少复杂从句和逐字翻译。'
      : tags.includes('太像背稿')
        ? '关闭全文，只看关键词复述一次，让语气更自然。'
        : '减少重复连接词，用更短的句子突出行动和结果。',
    timingFeedback: overtime
      ? `本次超过 ${input.targetSeconds} 秒目标，先删除重复背景，再保留一个核心项目证据。`
      : tooShort
        ? `本次明显短于 ${input.targetSeconds} 秒目标，补充具体行动和结果。`
        : `本次时长接近 ${input.targetSeconds} 秒目标，继续保持并优化信息密度。`,
    improvedShortVersion: shortVersion(input),
    improvedLongVersion: longVersion(input),
    nextTasks: [
      tags.includes('逻辑混乱') ? '只看四段骨架重讲一次。' : '录一遍 30 秒压缩版。',
      tags.includes('岗位匹配弱') ? `在开头和结尾加入“${role}”关键词。` : '补充一个可验证的结果或指标。',
      input.trainingType === 'englishIntro' ? '慢速朗读优化版 3 遍后再录。' : '关闭参考稿，用关键词再讲一次。',
    ],
  }, provider, 'mock-v1', note)
}
