import {
  dimensionLabels,
  frameworkTemplates,
  irsWeights,
  practicePrompts,
  roleTemplates,
} from './data'
import type {
  BaselineAssessment,
  DimensionScores,
  FrameworkTemplate,
  CompanyPrepBrief,
  InterviewReviewPackage,
  MockInterview,
  PracticeSession,
  ProjectProfile,
  QuestionBankItem,
  RealInterviewReview,
  TargetCompany,
  TargetJob,
  TrainingDay,
  TrainingPlan,
  UserProfile,
  VoiceTurnResult,
} from './types'

export const dimensionKeys = Object.keys(dimensionLabels) as Array<keyof DimensionScores>

export function calculateIRS(scores: DimensionScores): number {
  const totalWeight = dimensionKeys.reduce((sum, key) => sum + irsWeights[key], 0)
  const weighted = dimensionKeys.reduce((sum, key) => sum + scores[key] * irsWeights[key], 0)
  return Math.round(weighted / totalWeight)
}

export function getReadinessGate(score: number): string {
  if (score >= 88) return '可以冲刺 A 类目标机会'
  if (score >= 80) return '可以进入 B 类主投池'
  if (score >= 70) return '可以安排 C 类练习面试'
  if (score >= 60) return '只适合轻量练习'
  return '暂不建议进入真实面试'
}

export function getDtsRecommendation(score: number): string {
  if (score >= 85) return '保持当前计划，可考虑提前进入模拟面试。'
  if (score >= 75) return '继续执行当前计划。'
  if (score >= 65) return '明天增加复盘，减少新知识输入。'
  if (score >= 50) return '计划延长 1 天，并重复最弱模块。'
  return '暂停新内容，进入恢复日。'
}

export function generateTrainingPlan(
  user: UserProfile,
  assessment: BaselineAssessment,
  dailyMinutes: number,
): TrainingPlan {
  const targetScore = 84
  const totalGap = dimensionKeys.reduce(
    (sum, key) => sum + Math.max(0, targetScore - assessment.dimension_scores[key]),
    0,
  )
  const dailyBlocks = Math.max(1, Math.floor(dailyMinutes / 45))
  const rawDays = Math.ceil(totalGap / (dailyBlocks * 12)) + 3
  const duration = Math.min(10, Math.max(5, rawDays))
  const focusCycle = [
    '摸底修补与证据留存',
    '项目 7 步叙事',
    'AI 知识转岗位应用',
    '英文追问与压力处理',
    '目标岗位模拟面试',
    '真实问题复盘与题库更新',
    'B/A 准备度彩排',
  ]

  const days: TrainingDay[] = Array.from({ length: duration }, (_, index) => {
    const day = index + 1
    const focus = focusCycle[index % focusCycle.length]
    return {
      day,
      focus,
      dts_target: day < duration ? 78 + Math.min(8, day) : 88,
      adjustment_rule:
        day % 3 === 0
          ? '如果缺少复盘证据，减少新内容，增加恢复训练块。'
          : '如果 DTS 低于 65，先重复 Must 任务，再进入下一步。',
      tasks: [
        {
          task_id: `day_${day}_must`,
          title: day === 1 ? '完成摸底修补回答' : `必做：${focus}`,
          category: 'Must',
          minutes: 45,
          evidence_required: '语音回答、模拟转写、框架检查表、下次复练日期',
          framework: day % 2 === 0 ? '项目 7 步' : 'AI 知识五步',
        },
        {
          task_id: `day_${day}_should`,
          title: '费曼复述 + 目标岗位应用',
          category: 'Should',
          minutes: 45,
          evidence_required: '用自己的话解释，并给出岗位场景应用',
          framework: '费曼学习法',
        },
        {
          task_id: `day_${day}_review`,
          title: day % 2 === 0 ? 'R1/R2 艾宾浩斯复习' : '短压力追问',
          category: 'Review',
          minutes: 30,
          evidence_required: '回忆分数和缺失连接',
          framework: day % 2 === 0 ? '艾宾浩斯' : '压力追问',
        },
      ],
    }
  })

  return {
    plan_id: `plan_${dailyMinutes}_${duration}`,
    user_id: user.user_id,
    source_assessment_id: assessment.assessment_id,
    duration_days: duration,
    daily_available_minutes: dailyMinutes,
    target_score: targetScore,
    plan_status: '模拟计划进行中',
    days,
  }
}

export function findFramework(nameOrType: string): FrameworkTemplate {
  const normalized = nameOrType.toLowerCase()
  return (
    frameworkTemplates.find(
      (item) =>
        item.name.toLowerCase() === normalized ||
        item.question_type.toLowerCase() === normalized ||
        item.best_for.some((keyword) => normalized.includes(keyword.toLowerCase())),
    ) ?? frameworkTemplates[0]
  )
}

export function evaluatePracticeAnswer(
  userId: string,
  practiceType: string,
  answerText: string,
  answerQualitySeed = 0,
  durationSeconds = 90,
): PracticeSession {
  const prompt = practicePrompts.find((item) => item.type === practiceType) ?? practicePrompts[0]
  const framework = findFramework(prompt.framework)
  const wordLikeCount = answerText.trim().split(/\s+/).filter(Boolean).length
  const hasEvidence = /result|metric|evidence|decision|impact|user|problem|结果|指标|证据|决策|影响|用户|问题/i.test(
    answerText,
  )
  const hasApplication = /role|job|target|company|AI|RAG|product|岗位|职位|目标|公司|项目|应用|产品/i.test(answerText)
  const passiveLearning = /read|watched|looked|看过|浏览|了解|读过/.test(answerText)
  let score = 52 + Math.min(22, Math.floor(wordLikeCount / 8)) + Math.round(answerQualitySeed * 0.16)
  if (hasEvidence) score += 8
  if (hasApplication) score += 6
  if (passiveLearning && !hasEvidence) score -= 8
  if (durationSeconds > prompt.time_limit_seconds) score -= 5
  score = Math.max(45, Math.min(92, score))
  const content = Math.max(45, Math.min(96, score + (hasEvidence ? 2 : -4)))
  const expression = Math.max(
    42,
    Math.min(95, 70 + Math.round(answerQualitySeed * 0.12) - (durationSeconds > prompt.time_limit_seconds ? 8 : 0)),
  )
  const language = Math.max(45, Math.min(94, practiceType.includes('英文') ? expression - 4 : expression + 2))

  const feedback = [
    hasEvidence
      ? '已经能看到证据；接下来把指标 / 结果放到更靠前的位置。'
      : '补一个具体结果、指标或关键决策，否则这段回答缺少可验证证据。',
    hasApplication
      ? '答案已经连接到目标岗位；把岗位匹配句再压短一点。'
      : '请把故事明确连接到目标岗位，不要只停留在个人经历描述。',
    passiveLearning
      ? '“看过资料”不能算掌握；请用自己的话做一版费曼复述。'
      : framework.correction_prompt,
  ]

  return {
    session_id: `practice_${Date.now()}`,
    user_id: userId,
    practice_type: practiceType,
    question: prompt.question,
    answer_text: answerText,
    audio_placeholder: '模拟语音片段已保存',
    framework_used: framework.name,
    score,
    score_breakdown: { content, expression, language },
    duration_seconds: durationSeconds,
    source_map: prompt.source_map,
    review:
      durationSeconds > prompt.time_limit_seconds
        ? '本轮超时，说明口头答案还没有压缩到真实面试节奏。'
        : '本轮能在计时内讲完，下一步要提升证据密度和追问承压。',
    next_task: prompt.next_task,
    feedback,
    next_retry_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    created_at: new Date().toISOString(),
  }
}

export function generateCompanyPrepBrief(
  user: UserProfile,
  company: TargetCompany,
  job: TargetJob,
  project: ProjectProfile,
  bank: QuestionBankItem[],
): CompanyPrepBrief {
  const role = roleTemplates.find((item) => item.role_template_id === job.role_template_id)
  const roleCompetency = role?.core_competencies[0] ?? '产品判断、跨职能推进和业务理解'
  const bankQuestion = bank[0]?.question_text ?? '请说明一个项目如何迁移到这个岗位。'
  const secondBankQuestion = bank[1]?.question_text ?? '你如何衡量一个 AI 功能是否真正有效？'

  return {
    brief_id: `brief_${job.job_id}`,
    target_job_id: job.job_id,
    company_id: company.company_id,
    generated_at: new Date().toISOString(),
    disclaimer:
      '这份准备包是备考资料、高概率方向和满分回答策略，不是面试舱固定题库。正式模拟中，面试官会基于同一家公司/岗位理解灵活换问法、追问和延伸。',
    companyOverview: {
      whatTheyDo: `${company.company_name}是一家${company.company_type}，当前重点围绕${company.industry}场景把产品能力转成可交付业务结果。`,
      industry: company.industry,
      customers: company.company_id.includes('002') ? '硬件用户、渠道客户、IoT 生态合作方和内部产品/工程团队。' : '企业客户、AI 应用团队、业务负责人和需要效率提升的知识工作者。',
      businessModel: company.company_id.includes('002') ? '硬件销售、软件服务、生态集成和项目型交付并存。' : '订阅式 SaaS、项目制解决方案和企业定制化落地。',
      locationAndFootprint: `${company.location}为本轮目标城市；业务布局需要候选人能把本地市场、客户场景和跨团队协作讲清楚。`,
    },
    productsAndBusiness: {
      coreProducts: company.company_id.includes('002')
        ? ['AIoT 设备管理平台', '智能硬件控制端', '设备数据看板']
        : ['AI 面试/训练工作台', 'RAG 知识检索组件', '企业内部效率助手'],
      coreServices: ['需求拆解', '方案验证', '跨团队交付', '上线后指标复盘'],
      businessLines: company.company_id.includes('002')
        ? ['智能硬件产品线', 'AIoT 平台线', '渠道与客户解决方案']
        : ['AI 应用产品线', '企业知识库/RAG 方案', '客户成功与行业方案'],
      roleRelevantBusiness: `与「${job.role_title}」最相关的是把用户问题、业务目标和工程实现连接起来，而不是只写文档或复述功能。`,
      whyThisRoleMatters: `岗位需要${roleCompetency}。公司需要候选人能把模糊需求转成可验证方案，并推动算法、研发、设计、业务达成一致。`,
    },
    recentSignals: [
      '近期重点不是单点功能，而是把 AI 能力嵌入具体工作流。',
      '招聘动作说明团队正在补产品化、交付和业务理解能力。',
      '行业方向从“展示模型能力”转向“证明真实场景效果”。',
      '候选人需要准备如何看指标、如何控风险、如何和技术团队共识。',
    ],
    dailyWork: [
      `每天可能围绕「${job.jd_text}」拆需求、排优先级、写 PRD 或轻量原型。`,
      '需要和算法、后端、设计、运营或客户侧团队反复确认边界。',
      '主要产出物可能包括需求说明、用户流程、验收指标、项目计划和复盘结论。',
      job.role_title.includes('硬件') ? '会涉及硬件约束、供应链节奏、设备体验和线上线下一体化验证。' : '会涉及 AI 能力边界、知识库质量、幻觉风险和上线指标。',
    ],
    intensityAndRisks: [
      `风险标签：${job.risk_tags.join('、')}。`,
      job.abc_level === 'A' ? 'A 档岗位可能节奏快、追问深，对业务理解和表达稳定性要求高。' : '当前岗位适合验证匹配，但仍要避免只讲通用项目故事。',
      '如果 JD 偏解决方案或项目交付，需要说明自己如何面对客户、约束和临场变化。',
      '如果面试出现英文或粤语追问，应先用完整短句回答，不要追求复杂表达。',
    ],
    careerPath: [
      '入职前 3 个月重点是熟悉业务、补齐领域语言、接一个小功能或客户问题。',
      '1 年内可成长为能独立拆场景、定义指标、推动上线的 AI 产品/项目负责人。',
      '长期可转向 AI 产品、AI 硬件、项目型产品、解决方案或产品策略。',
      `这个岗位对${user.name}的价值在于把 AI 硕士、工业设计和项目经历合成可被公司理解的复合型产品能力。`,
    ],
    selfIntroStrategy: {
      openingPositioning: `开头直接定位：我是能把 AI/硬件/用户体验连接到业务落地的复合型${job.role_title}候选人。`,
      frontLoadedExperience: ['AI 硕士训练带来的技术理解', '工业设计背景带来的用户与硬件体验判断', `${project.title}里的产品化验证和表达能力`],
      keyProjects: ['Miro 项目适合证明 AI/RAG/知识工作流理解', '小米项目适合证明硬件体验和跨团队协作', '环保科技项目适合证明真实业务约束和项目推进'],
      aiMasterBridge: 'AI 硕士不要单独作为学历标签，要自然放进“我能和算法/工程讨论边界、数据和评估方式”。',
      hardwareDesignBridge: '工业设计/硬件经验要转化为“我理解真实用户、物理约束、体验闭环和交付细节”。',
      differentiator: '不要说自己只是转型产品经理，要说自己能把用户、硬件、AI 能力和商业结果放在同一张图里看。',
    },
    highProbabilityQuestions: [
      {
        id: 'hpq_why_company',
        question: `为什么选择${company.company_name}和这个${job.role_title}岗位？`,
        interviewerIntent: '考察是否真的理解公司业务、岗位价值和个人动机，而不是海投。',
        recommendedFramework: '动机三段式 + STAR 证据',
        answerStructure: ['一句话说明公司业务吸引点', '连接岗位核心能力', '用一个项目证明自己能贡献', '说明入职后第一个月怎么上手'],
        usableExperience: ['Miro 项目', 'AI 硕士背景', '工业设计/硬件经验'],
        pitfalls: ['泛泛夸公司', '只说想学习', '没有落到岗位日常'],
        thirtySecondVersion: `我选择${company.company_name}，是因为这个岗位不只是写需求，而是要把${company.industry}场景里的问题转成可交付产品。我过去做过${project.title}，能把用户问题、AI 能力和验证指标连起来，所以希望在这里做更真实的业务落地。`,
        twoMinuteVersion: `先讲公司业务和岗位价值，再用${project.title}说明自己如何识别问题、拆方案、推动验证，最后补充入职后会先熟悉产品、访谈使用者、梳理指标和找一个小场景快速交付。`,
        followUpStrategy: '如果被追问“为什么不是别家公司”，补充公司业务线、岗位日常和自己经历之间的独特交集。',
      },
      {
        id: 'hpq_role_core',
        question: `你觉得这个岗位最核心的能力是什么？`,
        interviewerIntent: '考察是否理解 JD，而不是只背自己的项目。',
        recommendedFramework: '岗位能力拆解',
        answerStructure: ['先给 3 个能力关键词', '每个关键词对应一项岗位日常', '用经历证明其中一个能力', '说明短板补法'],
        usableExperience: ['项目拆解', '跨团队协作', 'AI 产品评估'],
        pitfalls: ['只说沟通能力', '忽略业务指标', '不承认风险点'],
        thirtySecondVersion: `我会概括为三点：业务理解、技术边界感和推进落地。这个岗位需要把问题讲清楚、把方案做出来，还要证明它真的有效。`,
        twoMinuteVersion: '按业务理解、技术边界、交付推进展开，并分别对应 JD 里的需求分析、算法/研发协作和结果复盘。',
        followUpStrategy: '如果被追问“你最弱哪一项”，用具体补齐动作回答，不要防御。',
      },
      {
        id: 'hpq_project_fit',
        question: `你哪个项目最能证明你适合${job.role_title}？`,
        interviewerIntent: '考察项目选择能力、证据密度和岗位迁移能力。',
        recommendedFramework: '项目七步法',
        answerStructure: ['背景和用户问题', '目标和约束', '本人决策', '方案与取舍', '结果指标', '复盘迁移'],
        usableExperience: [project.title, '小米项目', '环保科技项目'],
        pitfalls: ['讲太多背景', '说不清本人贡献', '没有结果指标'],
        thirtySecondVersion: `我会选${project.title}，因为它最能说明我如何从用户问题出发，把 AI/产品方案拆成可验证路径，并处理约束。`,
        twoMinuteVersion: '用项目七步法完整讲一遍，重点压缩背景，把时间留给本人贡献、取舍和验证。',
        followUpStrategy: '如果追问细节，优先补数据、用户反馈、替代方案和你亲自做的决策。',
      },
      {
        id: 'hpq_risk',
        question: `你的背景不是完全直线匹配，为什么我们要选你？`,
        interviewerIntent: '考察抗压、迁移表达和岗位价值重构。',
        recommendedFramework: '宝洁八大问 + 反风险结构',
        answerStructure: ['先承认非直线背景', '重构为复合优势', '给出岗位相关证据', '说明入职后的补齐计划'],
        usableExperience: ['AI 硕士', '工业设计', '硬件/用户体验项目', 'Miro 项目'],
        pitfalls: ['急着辩解', '把转型说成缺点', '没有补齐动作'],
        thirtySecondVersion: '我的路径不是单线产品，但优势是能同时理解用户体验、硬件约束和 AI 能力边界，这正好适合需要跨团队落地的岗位。',
        twoMinuteVersion: '先把非直线路径转成复合型价值，再给项目证据，最后说明自己会如何补齐行业知识和公司业务。',
        followUpStrategy: '如果被挑战经验不足，讲“我如何快速学习业务并交付第一个小结果”。',
      },
      {
        id: 'hpq_bank',
        question: bankQuestion || secondBankQuestion,
        interviewerIntent: '从真实题库里抽取高频方向，验证候选人是否能迁移到目标岗位。',
        recommendedFramework: 'STAR-LF / 项目七步法',
        answerStructure: ['先直接回答', '再补项目证据', '最后落到岗位价值和复盘'],
        usableExperience: ['真实面试题库', '项目资料库', '训练记录'],
        pitfalls: ['背通用模板', '没有结合目标公司', '忽略追问空间'],
        thirtySecondVersion: '先用一句话答到问题，再用一个项目证据证明，最后说明这对目标岗位有什么价值。',
        twoMinuteVersion: '扩展为完整 STAR-LF：情境、任务、行动、结果、学习和迁移。',
        followUpStrategy: '如果追问没有准备过的角度，先复述问题，再回到公司业务、岗位职责和个人证据。',
      },
    ],
    mustRememberLines: [
      `这不是背题训练，本场核心是证明我理解${company.company_name}为什么需要${job.role_title}。`,
      `每个回答都要把公司业务、岗位日常和我的项目证据连起来。`,
      '遇到没准备过的问题，先稳住结构，再用真实经历和岗位价值作答。',
    ],
    interviewerPrinciples: [
      '可以命中准备包方向，但不会固定复读准备包 5 题。',
      '会换问法、追问、挑战和延伸到公司业务、JD、项目证据和风险点。',
      '不会偏离公司、岗位和用户经历。',
    ],
  }
}

export function getCompanyBriefVoicePrompts(brief: CompanyPrepBrief) {
  return [
    `这家公司核心业务是什么？请用 30 秒讲清楚，不要背准备包。`,
    `这个岗位最看重什么能力？请结合 JD 和日常工作回答。`,
    `你的哪段经历最适合这个岗位？请只选一段。`,
    `你准备用哪三个关键词介绍自己？`,
    `如果面试官问“为什么是我们公司”，你怎么回答？`,
  ].map((question, index) => ({
    id: `company_check_${brief.target_job_id}_${index}`,
    type: '公司准备语音抽查',
    question,
    time_limit_seconds: index === 4 ? 80 : 60,
    language: '中文',
  }))
}

export function isCompanyVoiceCheckPassed(results: VoiceTurnResult[]) {
  if (results.length < 5) return false
  const averageContent = results.reduce((sum, item) => sum + item.score.content, 0) / results.length
  const averageExpression = results.reduce((sum, item) => sum + item.score.expression, 0) / results.length
  return averageContent >= 62 && averageExpression >= 58
}

export function generateMockQuestions(
  job: TargetJob,
  project: ProjectProfile,
  bank: QuestionBankItem[],
  brief?: CompanyPrepBrief,
  previousMock?: MockInterview | null,
): string[] {
  const role = roleTemplates.find((item) => item.role_template_id === job.role_template_id)
  const bankQuestion = bank[0]?.question_text ?? '请说明一个短板，以及你正在如何修补它。'
  if (brief) {
    const prepared = brief.highProbabilityQuestions
    const previousFocus = previousMock?.turns.find((turn) => averageScore(turn.score) < 70)?.question
    return [
      `我们先不背准备包。你用自己的话讲一下，${brief.companyOverview.whatTheyDo}这件事和你投的${job.role_title}有什么关系？`,
      `如果我换一种问法：${prepared[0]?.question ?? `为什么选择${job.role_title}？`} 你不要按模板背，讲一个真实判断。`,
      `你提到${project.title}。这个项目里哪一个决策，最能迁移到${brief.productsAndBusiness.roleRelevantBusiness}？`,
      `假设入职第一个月，你要和算法、研发、设计或业务一起推进一个小结果，你会先做哪三件事？`,
      previousFocus
        ? `上次你在「${previousFocus}」这类问题上证据不够。这次请换一个项目证据重新回答。`
        : `真实题库延伸：${bankQuestion} 请结合${brief.companyOverview.industry}和岗位日常回答。`,
    ]
  }
  return [
    `项目深挖：在「${project.title}」里，哪个用户或业务问题先于方案出现？你本人负责的关键决策是什么？`,
    `岗位匹配：这个「${job.role_title}」岗位要求「${role?.core_competencies[0] ?? '产品判断'}」。哪个项目证据能证明你具备这项能力？`,
    'AI / 产品知识：如果公司希望基于简历、JD 和公司资料生成定制化面试题，你会不会使用 RAG？如何降低幻觉并衡量质量？',
    `压力追问：你的背景并不是直线型「${job.role_title}」路径。你如何把这点重构成岗位价值？`,
    `真实题库回放：${bankQuestion}`,
  ]
}

export function createFlexibleFollowUp(question: string, brief: CompanyPrepBrief, turnIndex: number) {
  const focus = [
    `你刚才回答的是「${question}」。请补一句：这个回答如何落到${brief.productsAndBusiness.roleRelevantBusiness}？`,
    '如果面试官挑战“这只是学校项目，不是真实业务”，你怎么补证据？',
    `换个角度，如果${brief.companyOverview.industry}场景里的用户不买账，你会看什么数据？`,
  ]
  return `追问：${focus[turnIndex % focus.length]}`
}

export function analyzeReviewTranscript(
  user: UserProfile,
  job: TargetJob,
  transcript: string,
  bank: QuestionBankItem[],
  brief?: CompanyPrepBrief,
  mockInterview?: MockInterview | null,
): RealInterviewReview {
  const lines = transcript
    .split(/\n|(?<=\?)|(?<=？)/)
    .map((line) => line.trim())
    .filter(Boolean)

  const extracted =
    lines
      .filter((line) => /[?？]|why|how|what|tell me|介绍|为什么|如何|什么|怎么|请你/i.test(line))
      .slice(0, 8) ?? []

  const fallback = [
    '请做一下自我介绍。',
    '为什么想往这个岗位方向发展？',
    '你最有代表性的项目是什么？',
    '你在那个项目里具体负责什么？',
    '你会如何衡量这个功能是否成功？',
  ]

  const extracted_questions = extracted.length > 0 ? extracted : fallback
  const bankText = bank.map((item) => item.normalized_question.toLowerCase()).join(' ')
  const matched = extracted_questions.filter((question) =>
    question
      .toLowerCase()
      .split(/\W+/)
      .some((word) => word.length > 2 && bankText.includes(word)),
  ).length
  const simulated_question_match_rate = Math.max(
    35,
    Math.min(82, Math.round((matched / extracted_questions.length) * 100) || 62),
  )
  const new_question_rate = 100 - simulated_question_match_rate

  const review_package = brief
    ? buildInterviewReviewPackage(user, job, brief, extracted_questions, mockInterview)
    : undefined

  return {
    review_id: `review_${Date.now()}`,
    user_id: user.user_id,
    target_job_id: job.job_id,
    company_name: brief?.companyOverview.whatTheyDo.split('是一家')[0] || job.company_id,
    role_title: job.role_title,
    interview_round: '手动复盘',
    interviewer_type: '混合类型',
    transcript_text: transcript,
    extracted_questions,
    simulated_question_match_rate,
    new_question_rate,
    review_type: transcript.includes('模拟面试舱') ? '模拟面试复盘' : '真实面试复盘',
    feedback: [
      '面试官关注主题：项目贡献、转型动机和结果衡量。',
      brief ? '本场问题来自公司/岗位理解、准备包方向、项目证据和临场追问，不是固定题库复读。' : '当前最弱回答：项目 ownership、评估指标和压力追问。',
      '下次模拟前先更新题库和准备包，让真实追问获得更高权重。',
    ],
    next_training_tasks: [
      '重写自我介绍里的岗位匹配段。',
      '用 3 分钟项目 7 步版本复练关键项目。',
      brief ? `补一段“为什么是${job.role_title}和这家公司”的 30 秒版本。` : '新增一条“如何评估成功”的标准回答。',
    ],
    review_package,
    created_at: new Date().toISOString(),
  }
}

function averageScore(score: { content: number; expression: number; language: number }) {
  return Math.round((score.content + score.expression + score.language) / 3)
}

function buildInterviewReviewPackage(
  user: UserProfile,
  job: TargetJob,
  brief: CompanyPrepBrief,
  extractedQuestions: string[],
  mockInterview?: MockInterview | null,
): InterviewReviewPackage {
  const turns = mockInterview?.turns ?? []
  const actualQuestions = turns.length ? turns.map((turn) => turn.question) : extractedQuestions
  const preparedKeywords = brief.highProbabilityQuestions.flatMap((item) =>
    item.question.replace(/[？?]/g, '').split(/[，、\s]/).filter((word) => word.length >= 3),
  )
  const preparedDirectionHits = actualQuestions
    .filter((question) => preparedKeywords.some((word) => question.includes(word)))
    .slice(0, 5)
  const liveExtensions = actualQuestions
    .filter((question) => question.includes('追问') || !preparedDirectionHits.includes(question))
    .slice(0, 6)
  const strongAnswers = turns
    .filter((turn) => averageScore(turn.score) >= 75)
    .map((turn) => `「${turn.question}」能继续追问，说明表达和证据基本站住。`)
  const weakTurns = turns.filter((turn) => averageScore(turn.score) < 72)

  return {
    actualQuestions,
    preparedDirectionHits: preparedDirectionHits.length ? preparedDirectionHits : ['本场未直接复读准备包问题，更多是换问法和业务延伸。'],
    liveExtensions: liveExtensions.length ? liveExtensions : ['面试官主要围绕岗位日常、项目证据和公司业务做了延伸。'],
    strongAnswers: strongAnswers.length ? strongAnswers : ['本场还没有明显稳定高分题，需要先重练短版结构。'],
    missedCompanyOrRolePoints: [
      `回答里需要更明确提到：${brief.productsAndBusiness.roleRelevantBusiness}`,
      `需要补一句「${job.role_title}」为什么对${brief.companyOverview.industry}业务重要。`,
    ],
    frameworkFit: [
      '项目题优先用项目七步法。',
      '动机题优先用动机三段式 + STAR 证据。',
      '压力题优先先承认风险，再重构为复合优势。',
    ],
    confusedAnswers: weakTurns.map((turn) => `「${turn.question}」结构还散，建议先写 30 秒版本。`).slice(0, 4),
    scriptedAnswers: turns
      .filter((turn) => turn.transcript.includes('首先') && turn.transcript.includes('其次') && turn.transcript.length < 80)
      .map((turn) => `「${turn.question}」有背稿感，需要换成真实判断。`),
    companyUnderstandingToAdd: brief.mustRememberLines,
    thirtySecondFixes: actualQuestions.slice(0, 5).map((question) => `30 秒修正版：先直接回答「${question}」，再补一个公司/岗位连接点和一个项目证据。`),
    twoMinuteFixes: actualQuestions.slice(0, 5).map((question) => `2 分钟修正版：用问题背景、本人判断、行动、结果、岗位迁移五段回答「${question}」。`),
    mustRetryQuestions: (weakTurns.length ? weakTurns.map((turn) => turn.question) : actualQuestions).slice(0, 3),
    nextInterviewerFocus: [
      '继续追问为什么选择这家公司，而不是泛泛讲岗位。',
      `追问${user.name}如何把 AI 硕士和工业设计转成岗位价值。`,
      '追问项目指标、用户证据和入职第一个月的上手计划。',
    ],
    shouldUpdatePrepBrief: liveExtensions.length >= preparedDirectionHits.length,
    shouldUpdateQuestionWeights: true,
    shouldMockAgain: weakTurns.length > 0 || turns.length < 4,
    readyForRealInterview: turns.length >= 4 && weakTurns.length <= 1,
  }
}

export function reviewToQuestions(review: RealInterviewReview): QuestionBankItem[] {
  return review.extracted_questions.map((question, index) => ({
    question_id: `${review.review_id}_q_${index}`,
    user_id: review.user_id,
    question_text: question,
    normalized_question: question.toLowerCase().replace(/[^\w\s\u4e00-\u9fa5]/g, '').slice(0, 80),
    question_type: index % 3 === 0 ? '项目深挖' : index % 3 === 1 ? '压力追问' : 'AI / 产品知识',
    source: '真实面试复盘',
    related_role_template: 'rt_ai_pm',
    related_project_id: 'project_seed_001',
    frequency: 1,
    difficulty: 3 + (index % 2),
    user_performance_score: 58,
    priority_weight: 90 - index * 3,
  }))
}
