import type {
  AnalyzeAnswerRequest,
  AnalyzeJobContext,
  GenerateFollowUpRequest,
  GenerateInterviewReportRequest,
  GenerateJobPackRequest,
  GenerateMockInterviewRequest,
  MockInterviewQuestion,
  MockInterviewType,
  TrainingType,
} from '../../../src/lib/ai/types.js'

const trainingTypes = new Set<TrainingType>(['chineseIntro', 'englishIntro', 'miroProject'])

function safeText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function safeNumber(value: unknown, max: number) {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.min(max, Math.round(number))) : 0
}

function safeJob(value: unknown): AnalyzeJobContext | null {
  if (!value || typeof value !== 'object') return null
  const job = value as Record<string, unknown>
  return {
    id: safeText(job.id, 160),
    companyName: safeText(job.companyName, 160),
    jobTitle: safeText(job.jobTitle, 200),
    city: safeText(job.city, 100),
    jobType: safeText(job.jobType, 100),
    priority: safeText(job.priority, 50),
    mainTrack: safeText(job.mainTrack, 300),
    companyBusiness: safeText(job.companyBusiness, 1600),
    jobContent: safeText(job.jobContent, 2400),
    jobRequirements: safeText(job.jobRequirements, 2400),
    businessDirection: safeText(job.businessDirection, 500),
  }
}

function requiredJob(value: unknown): AnalyzeJobContext {
  const job = safeJob(value)
  if (!job?.companyName || !job.jobTitle) throw new Error('请先选择有效岗位。')
  return job
}

export function validateAnalyzeAnswerRequest(value: unknown): AnalyzeAnswerRequest {
  if (!value || typeof value !== 'object') throw new Error('请求内容格式不正确。')
  const input = value as Record<string, unknown>
  const trainingRecordId = safeText(input.trainingRecordId, 200)
  const trainingType = safeText(input.trainingType, 40) as TrainingType
  const transcript = safeText(input.transcript, 20_000)

  if (!trainingRecordId) throw new Error('缺少训练记录 ID。')
  if (!trainingTypes.has(trainingType)) throw new Error('训练类型不受支持。')
  if (!transcript) throw new Error('请先提供回答文本。')

  return {
    taskType: 'analyze_answer',
    trainingRecordId,
    trainingType,
    selectedJob: safeJob(input.selectedJob),
    transcript,
    durationSeconds: safeNumber(input.durationSeconds, 3600),
    targetSeconds: safeNumber(input.targetSeconds, 3600),
    cvText: safeText(input.cvText, 6000),
    scriptText: safeText(input.scriptText, 8000),
  }
}

export function validateGenerateJobPackRequest(value: unknown): GenerateJobPackRequest {
  if (!value || typeof value !== 'object') throw new Error('请求内容格式不正确。')
  const input = value as Record<string, unknown>
  const trainingRecords = Array.isArray(input.trainingRecords)
    ? input.trainingRecords.slice(0, 20).map((record) => {
      const item = record && typeof record === 'object' ? record as Record<string, unknown> : {}
      const transcript = item.transcript && typeof item.transcript === 'object' ? item.transcript as Record<string, unknown> : {}
      const aiFeedback = item.aiFeedback && typeof item.aiFeedback === 'object' ? item.aiFeedback as Record<string, unknown> : {}
      return {
        trainingType: safeText(item.trainingType, 40) as TrainingType,
        title: safeText(item.title, 120),
        durationSeconds: safeNumber(item.durationSeconds, 3600),
        transcript: { text: safeText(transcript.text, 3000) },
        aiFeedback: {
          score: safeNumber(aiFeedback.score, 100),
          summary: safeText(aiFeedback.summary, 800),
          problems: Array.isArray(aiFeedback.problems) ? aiFeedback.problems.map((problem) => safeText(problem, 300)).filter(Boolean).slice(0, 8) : [],
          nextTasks: Array.isArray(aiFeedback.nextTasks) ? aiFeedback.nextTasks.map((task) => safeText(task, 300)).filter(Boolean).slice(0, 8) : [],
        },
      }
    })
    : []
  const aiFeedbackRecords = trainingRecords.map((record) => record.aiFeedback).filter(Boolean)
  const scriptTemplates = input.scriptTemplates && typeof input.scriptTemplates === 'object'
    ? Object.fromEntries(Object.entries(input.scriptTemplates as Record<string, unknown>).map(([key, val]) => [key, safeText(val, 4000)]))
    : {}

  return {
    taskType: 'generate_job_pack',
    selectedJob: requiredJob(input.selectedJob),
    cvText: safeText(input.cvText, 8000),
    trainingRecords,
    aiFeedbackRecords,
    scriptTemplates,
  }
}

function safeQuestion(value: unknown, index = 0): MockInterviewQuestion {
  const item = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const type = safeText(item.type, 40) as MockInterviewQuestion['type']
  const source = safeText(item.source, 40) as MockInterviewQuestion['source']
  return {
    id: safeText(item.id, 120) || `q-${index + 1}`,
    type: ['self_intro', 'project', 'role_fit', 'technical_basic', 'pressure', 'english', 'follow_up'].includes(type) ? type : 'role_fit',
    question: safeText(item.question, 1200) || '请介绍一下你为什么适合这个岗位。',
    source: ['jobPack', 'selectedJob', 'miroProject', 'mockProvider'].includes(source) ? source : 'mockProvider',
    expectedFocus: safeText(item.expectedFocus, 1000),
    followUpPolicy: safeText(item.followUpPolicy, 1000),
  }
}

function safeJobPack(value: unknown) {
  if (!value || typeof value !== 'object') return undefined
  const pack = value as Record<string, unknown>
  return {
    companySummary: safeText(pack.companySummary, 2000),
    productAndBusiness: safeText(pack.productAndBusiness, 2000),
    selfIntroductionStrategy: safeText(pack.selfIntroductionStrategy, 2000),
    miroProjectStrategy: safeText(pack.miroProjectStrategy, 2000),
    likelyQuestions: Array.isArray(pack.likelyQuestions) ? pack.likelyQuestions.slice(0, 10).map((item) => {
      const q = item && typeof item === 'object' ? item as Record<string, unknown> : {}
      return { question: safeText(q.question, 800), whyItMatters: safeText(q.whyItMatters, 800), framework: safeText(q.framework, 800) }
    }) : [],
  }
}

export function validateGenerateMockInterviewRequest(value: unknown): GenerateMockInterviewRequest {
  if (!value || typeof value !== 'object') throw new Error('请求内容格式不正确。')
  const input = value as Record<string, unknown>
  const interviewType = safeText(input.interviewType, 40) as MockInterviewType
  return {
    taskType: 'generate_mock_interview',
    selectedJob: requiredJob(input.selectedJob),
    jobPack: safeJobPack(input.jobPack),
    cvText: safeText(input.cvText, 6000),
    trainingRecords: Array.isArray(input.trainingRecords) ? input.trainingRecords.slice(0, 20).map((record) => {
      const item = record && typeof record === 'object' ? record as Record<string, unknown> : {}
      const transcript = item.transcript && typeof item.transcript === 'object' ? item.transcript as Record<string, unknown> : {}
      return {
        trainingType: safeText(item.trainingType, 40) as TrainingType,
        title: safeText(item.title, 120),
        transcript: { text: safeText(transcript.text, 1600) },
      }
    }) : [],
    interviewType: ['quick_mock', 'job_pack_mock', 'pressure_mock'].includes(interviewType) ? interviewType : 'job_pack_mock',
  }
}

export function validateGenerateFollowUpRequest(value: unknown): GenerateFollowUpRequest {
  if (!value || typeof value !== 'object') throw new Error('请求内容格式不正确。')
  const input = value as Record<string, unknown>
  return {
    taskType: 'generate_follow_up',
    selectedJob: requiredJob(input.selectedJob),
    question: typeof input.question === 'string' ? safeText(input.question, 1200) : safeQuestion(input.question),
    transcript: safeText(input.transcript, 20_000),
    aiFeedback: input.aiFeedback && typeof input.aiFeedback === 'object' ? input.aiFeedback as GenerateFollowUpRequest['aiFeedback'] : undefined,
  }
}

export function validateGenerateInterviewReportRequest(value: unknown): GenerateInterviewReportRequest {
  if (!value || typeof value !== 'object') throw new Error('请求内容格式不正确。')
  const input = value as Record<string, unknown>
  return {
    taskType: 'generate_interview_report',
    selectedJob: requiredJob(input.selectedJob),
    jobPack: safeJobPack(input.jobPack),
    questions: Array.isArray(input.questions) ? input.questions.slice(0, 12).map(safeQuestion) : [],
    answers: Array.isArray(input.answers) ? input.answers.slice(0, 12).map((answer) => {
      const item = answer && typeof answer === 'object' ? answer as Record<string, unknown> : {}
      const transcript = item.transcript && typeof item.transcript === 'object' ? item.transcript as Record<string, unknown> : {}
      const aiFeedback = item.aiFeedback && typeof item.aiFeedback === 'object' ? item.aiFeedback as Record<string, unknown> : {}
      return {
        questionId: safeText(item.questionId, 120),
        question: safeText(item.question, 1200),
        transcript: transcript.text ? {
          text: safeText(transcript.text, 20_000),
          source: safeText(transcript.source, 20) === 'asr' ? 'asr' : safeText(transcript.source, 20) === 'manual' ? 'manual' : 'mock',
          updatedAt: safeText(transcript.updatedAt, 80) || new Date().toISOString(),
          provider: safeText(transcript.provider, 80),
          language: safeText(transcript.language, 20) as 'zh' | 'en' | 'mixed',
        } : undefined,
        aiFeedback: {
          score: safeNumber(aiFeedback.score, 100),
          summary: safeText(aiFeedback.summary, 1000),
          problems: Array.isArray(aiFeedback.problems) ? aiFeedback.problems.map((item) => safeText(item, 300)).filter(Boolean).slice(0, 8) : [],
          nextTasks: Array.isArray(aiFeedback.nextTasks) ? aiFeedback.nextTasks.map((item) => safeText(item, 300)).filter(Boolean).slice(0, 8) : [],
        },
        durationSeconds: safeNumber(item.durationSeconds, 3600),
      }
    }) : [],
  }
}
