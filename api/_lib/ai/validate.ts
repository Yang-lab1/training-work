import type {
  AnalyzeAnswerRequest,
  AnalyzeJobContext,
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
