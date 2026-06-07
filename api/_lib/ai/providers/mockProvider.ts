import type {
  AIProviderName,
  AnalyzeAnswerRequest,
  AnalyzeAnswerSuccess,
  GenerateFollowUpRequest,
  GenerateFollowUpSuccess,
  GenerateInterviewReportRequest,
  GenerateInterviewReportSuccess,
  GenerateJobPackRequest,
  GenerateJobPackSuccess,
  GenerateMockInterviewRequest,
  GenerateMockInterviewSuccess,
} from '../../../../src/lib/ai/types.js'
import { normalizeFollowUp, normalizeInterviewReport, normalizeJobPack, normalizeMockInterviewQuestions, normalizeModelFeedback } from '../response.js'

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

export function generateJobPackWithMock(
  input: GenerateJobPackRequest,
  provider: Extract<AIProviderName, 'mock' | 'mock_fallback'> = 'mock',
  note?: string,
): GenerateJobPackSuccess {
  const job = input.selectedJob
  const company = job.companyName || '目标公司'
  const role = job.jobTitle || '目标岗位'
  const business = job.companyBusiness || job.mainTrack || job.businessDirection || '相关业务'
  const requirements = job.jobRequirements || '岗位要求未在表格中详细填写'
  const content = job.jobContent || '岗位日常未在表格中详细填写'
  const feedbackTasks = (input.aiFeedbackRecords || [])
    .flatMap((feedback) => feedback.nextTasks || [])
    .slice(0, 3)

  return normalizeJobPack({
    companySummary: `${company}在本次岗位表中体现的业务重点是${business}。准备时要先讲清公司做什么，再说明你的 AI、产品和项目经验如何服务这个方向。`,
    productAndBusiness: `核心准备方向：${business}。如果面试官追问业务理解，应结合岗位内容说明用户、场景、产品价值和可能的商业目标。`,
    jobRequirementBreakdown: [
      `岗位名称：${role}，优先拆成业务理解、产品判断、跨团队沟通和结果表达。`,
      `岗位内容：${content}`,
      `岗位要求：${requirements}`,
      '回答时要把经历连接到岗位要求，不要只讲个人背景。',
    ],
    workContentPrediction: [
      '整理用户场景和业务问题，形成需求或方案判断。',
      '与产品、研发、设计或业务团队沟通，推动 MVP 或功能验证。',
      '输出 PRD、原型说明、竞品/用户分析或项目复盘材料。',
    ],
    candidateFit: [
      'AI 学习经历可以证明你理解 AI 能力边界和落地方式。',
      'Miro 项目适合证明需求拆解、协作流程和 MVP 取舍。',
      '工业设计或体验背景适合转化为用户洞察、原型表达和场景敏感度。',
      ...(feedbackTasks.length ? [`已有训练反馈提示：${feedbackTasks.join('；')}`] : []),
    ],
    riskPoints: [
      '如果岗位偏技术，需要避免只讲概念，应说明你如何和研发/算法协作。',
      '如果岗位偏业务，需要避免只讲工具，应说明业务目标和用户价值。',
      '不要让回答像背稿，要用公司和岗位关键词自然收尾。',
    ],
    selfIntroductionStrategy: `自我介绍开头直接说正在申请${company}的${role}，中段用 AI 学习、Miro 项目和产品体验证明匹配，结尾回到${business}。`,
    miroProjectStrategy: `Miro 项目要贴合${role}讲：先讲协作或用户场景，再讲你如何拆问题、做 MVP 取舍、验证结果，最后说明这和${company}的${business}有关。`,
    likelyQuestions: [
      { question: `为什么选择${company}的${role}？`, whyItMatters: '考察动机、公司理解和岗位匹配。', framework: '结论-公司业务-个人证据-岗位贡献' },
      { question: `你如何理解${business}？`, whyItMatters: '考察业务理解是否真实。', framework: '用户-场景-产品价值-商业/效率目标' },
      { question: '请讲一个最能证明你产品能力的项目。', whyItMatters: '考察项目表达和结果意识。', framework: '项目七步法' },
      { question: 'Miro 项目里你做了什么关键决策？', whyItMatters: '考察个人贡献而不是团队流水账。', framework: '背景-冲突-取舍-结果' },
      { question: '如果入职第一个月，你会怎么上手？', whyItMatters: '考察岗位日常理解。', framework: '了解业务-梳理用户-对齐团队-交付小结果' },
      { question: '你没有完全相关经验怎么办？', whyItMatters: '考察迁移能力和风险认知。', framework: '承认差距-迁移证据-补齐计划' },
      { question: '你如何和研发、设计或业务协作？', whyItMatters: '考察跨团队推进。', framework: '目标-角色-沟通机制-产出' },
      { question: '你如何验证一个 AI 产品方案有效？', whyItMatters: '考察 AI 落地和指标意识。', framework: '假设-指标-MVP-反馈迭代' },
    ],
    fullScoreAnswerFrameworks: [
      {
        question: `为什么选择${company}的${role}？`,
        frameworkName: '宝洁八大问：动机 + 匹配',
        answerStructure: ['一句话动机', '公司业务理解', '个人项目证据', '能贡献什么', '结尾回到岗位'],
        candidateEvidence: ['AI 学习', 'Miro 项目', '产品体验/设计背景'],
        pitfalls: ['只说喜欢 AI', '不提公司业务', '不提岗位产出'],
      },
      {
        question: '请讲一个最能证明你产品能力的项目。',
        frameworkName: '项目七步法',
        answerStructure: ['用户是谁', '问题是什么', '目标是什么', '你做了什么', 'MVP 取舍', '结果证据', '岗位关系'],
        candidateEvidence: ['Miro 项目', '小米/硬件项目', '环保科技项目'],
        pitfalls: ['讲成作品介绍', '没有你的个人决策', '没有结果'],
      },
    ],
    preparationTasks: [
      `准备 90 秒版本：为什么是${company}的${role}。`,
      '用项目七步法重讲 Miro 项目。',
      `整理 3 个和${business}相关的岗位关键词。`,
      '准备一个承认短板但能迁移的回答。',
      '把自我介绍最后 20 秒改成岗位匹配总结。',
    ],
  }, provider, 'mock-job-pack-v1', note)
}

export function generateMockInterviewWithMock(
  input: GenerateMockInterviewRequest,
  provider: Extract<AIProviderName, 'mock' | 'mock_fallback'> = 'mock',
  note?: string,
): GenerateMockInterviewSuccess {
  const job = input.selectedJob
  const company = job.companyName || '目标公司'
  const role = job.jobTitle || '目标岗位'
  const business = job.companyBusiness || job.mainTrack || job.businessDirection || '相关业务'
  const fromPack = (input.jobPack?.likelyQuestions || [])
    .slice(0, 3)
    .map((item, index) => ({
      id: `pack-${index + 1}`,
      type: index === 0 ? 'role_fit' : 'technical_basic',
      question: item?.question || `你如何理解${business}？`,
      source: 'jobPack',
      expectedFocus: item?.whyItMatters || '结合准备包方向和个人经历作答。',
      followUpPolicy: item?.framework || '如果回答空泛，追问项目证据。',
    }))
  const questions = [
    { id: 'q-1', type: 'self_intro', question: `请用中文做一个 90 秒自我介绍，并说明你为什么适合${company}的${role}。`, source: 'selectedJob', expectedFocus: '背景、AI 学习、项目证据、岗位匹配。', followUpPolicy: '追问最能证明岗位匹配的一段经历。' },
    { id: 'q-2', type: 'role_fit', question: `你为什么选择${company}和${role}？`, source: 'selectedJob', expectedFocus: `公司业务 ${business}、岗位动机、个人贡献。`, followUpPolicy: '追问公司业务与项目经历的关系。' },
    { id: 'q-3', type: 'project', question: '请讲一下 Miro 项目，你负责了什么关键决策？', source: 'miroProject', expectedFocus: '用户、场景、AI 作用、MVP 取舍、结果。', followUpPolicy: '追问具体用户和验证证据。' },
    ...fromPack,
    { id: 'q-4', type: 'role_fit', question: '你从设计背景转向 AI 产品，优势和短板分别是什么？', source: 'selectedJob', expectedFocus: '迁移能力、风险认知、补齐计划。', followUpPolicy: '追问短板如何在入职后补齐。' },
    { id: 'q-5', type: 'technical_basic', question: '如果要验证一个 AI 产品功能是否有效，你会看哪些指标？', source: 'selectedJob', expectedFocus: '假设、指标、MVP、反馈闭环。', followUpPolicy: '追问具体指标和实验设计。' },
    { id: 'q-6', type: input.interviewType === 'pressure_mock' ? 'pressure' : 'english', question: input.interviewType === 'pressure_mock' ? '如果面试官认为你经验不够，你会怎么回应？' : 'Please briefly explain why you are a good fit for this role.', source: 'mockProvider', expectedFocus: '承认差距、迁移证据、学习计划。', followUpPolicy: '追问最强证据。' },
  ].slice(0, 8)
  return normalizeMockInterviewQuestions({ questions }, provider, 'mock-interview-v1', note)
}

export function generateFollowUpWithMock(
  input: GenerateFollowUpRequest,
  provider: Extract<AIProviderName, 'mock' | 'mock_fallback'> = 'mock',
  note?: string,
): GenerateFollowUpSuccess {
  const problems = (input.aiFeedback?.problems || []).join(' ')
  const role = input.selectedJob.jobTitle || '这个岗位'
  let question = `你能不能用一个更具体的项目例子，说明自己为什么适合${role}？`
  if (/过短|太短/.test(problems) || input.transcript.length < 80) question = '你刚才回答偏短，能不能补充一个具体行动和结果？'
  else if (/具体|项目/.test(problems)) question = '你刚才讲到项目时，用户是谁、场景是什么、你做了哪一个关键取舍？'
  else if (/岗位|匹配/.test(problems)) question = `你能不能把这段经历和${role}的日常工作直接连起来？`
  else if (/逻辑|结构/.test(problems)) question = '请按“背景、行动、结果、岗位关系”重新补充一遍。'
  return normalizeFollowUp({ followUpQuestion: question }, provider, 'mock-follow-up-v1', note)
}

export function generateInterviewReportWithMock(
  input: GenerateInterviewReportRequest,
  provider: Extract<AIProviderName, 'mock' | 'mock_fallback'> = 'mock',
  note?: string,
): GenerateInterviewReportSuccess {
  const scores = input.answers.map((answer) => answer.aiFeedback?.score).filter((score): score is number => typeof score === 'number')
  const average = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 70
  const company = input.selectedJob.companyName || '目标公司'
  const role = input.selectedJob.jobTitle || '目标岗位'
  const problems = input.answers.flatMap((answer) => answer.aiFeedback?.problems || []).slice(0, 6)
  return normalizeInterviewReport({
    overallScore: average,
    summary: `本场模拟面试围绕${company}的${role}展开，已完成 ${input.answers.length}/${input.questions.length} 个问题。下一步重点是把岗位关键词、项目证据和回答结构讲得更直接。`,
    strongestAnswer: input.answers[0]?.question || '自我介绍题',
    weakestAnswer: input.answers.find((answer) => (answer.aiFeedback?.score || 100) < average)?.question || input.questions[2]?.question || '项目讲解题',
    recurringProblems: problems.length ? problems : ['岗位匹配表达不够直接', '项目证据还可以更具体'],
    roleFitAssessment: `回答需要持续回到${company}、${role}和公司业务，不要只讲个人背景。`,
    communicationAssessment: '表达已能完成一问一答，但建议减少铺垫，优先给结论。',
    projectDepthAssessment: 'Miro 项目需要讲清用户、场景、AI 作用、MVP 取舍和验证结果。',
    englishAssessment: '英文回答先保证短句清楚，再补充岗位关键词。',
    nextTrainingPlan: ['重练 90 秒中文自我介绍', '用项目七步法重讲 Miro 项目', '准备“为什么选择公司和岗位”', '补一版英文 60 秒回答'],
  }, provider, 'mock-interview-report-v1', note)
}
