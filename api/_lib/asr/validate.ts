import type { AnalyzeJobContext, TrainingType } from '../../../src/lib/ai/types.js'
import type { AudioMetadata, TranscribeRequest } from '../../../src/lib/asr/types.js'

const trainingTypes = new Set<TrainingType>(['chineseIntro', 'englishIntro', 'miroProject'])
const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const number = (value: unknown, max: number) => {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.min(max, parsed)) : 0
}

function job(value: unknown): AnalyzeJobContext | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  return {
    id: text(input.id, 160),
    companyName: text(input.companyName, 160),
    jobTitle: text(input.jobTitle, 200),
    city: text(input.city, 100),
    jobType: text(input.jobType, 100),
    priority: text(input.priority, 50),
    mainTrack: text(input.mainTrack, 300),
    companyBusiness: text(input.companyBusiness, 1600),
    jobContent: text(input.jobContent, 2400),
    jobRequirements: text(input.jobRequirements, 2400),
    businessDirection: text(input.businessDirection, 500),
  }
}

function audio(value: unknown): AudioMetadata | undefined {
  if (!value || typeof value !== 'object') return undefined
  const input = value as Record<string, unknown>
  return {
    recordingId: text(input.recordingId, 200),
    recordingName: text(input.recordingName, 300),
    durationSeconds: number(input.durationSeconds, 3600),
    mimeType: text(input.mimeType, 100),
    size: number(input.size, 100_000_000),
  }
}

export function validateTranscribeRequest(value: unknown): TranscribeRequest {
  if (!value || typeof value !== 'object') throw new Error('请求内容格式不正确。')
  const input = value as Record<string, unknown>
  const trainingRecordId = text(input.trainingRecordId, 200)
  const trainingType = text(input.trainingType, 40) as TrainingType
  if (!trainingRecordId) throw new Error('缺少训练记录 ID。')
  if (!trainingTypes.has(trainingType)) throw new Error('训练类型不受支持。')
  return {
    trainingRecordId,
    trainingType,
    audioMetadata: audio(input.audioMetadata),
    selectedJob: job(input.selectedJob),
  }
}
