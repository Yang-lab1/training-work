import type {
  AnalyzeAnswerRequest,
  AnalyzeJobContext,
  GenerateJobPackRequest,
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
