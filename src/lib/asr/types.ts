import type { AnalyzeJobContext, TrainingType } from '../ai/types'

export type ASRProviderName =
  | 'mock'
  | 'mock_fallback'
  | 'openai'
  | 'doubao'
  | 'volcengine'
  | 'xfyun'
  | 'aliyun'
  | 'tencent'

export interface AudioMetadata {
  recordingId?: string
  recordingName?: string
  durationSeconds?: number
  mimeType?: string
  size?: number
}

export interface TranscribeRequest {
  trainingRecordId: string
  trainingType: TrainingType
  audioMetadata?: AudioMetadata
  sourceType?: 'training' | 'mock_interview' | 'real_interview'
  selectedJob: AnalyzeJobContext | null
  audioFile?: File
}

export interface TranscribeSuccess {
  success: true
  provider: ASRProviderName
  model?: string
  transcript: string
  language: 'zh' | 'en' | 'mixed'
  durationSeconds?: number
  generatedAt: string
  rawProviderNote?: string
}

export interface TranscribeFailure {
  success: false
  error: string
  provider: ASRProviderName
  fallbackAvailable: true
}

export type TranscribeResponse = TranscribeSuccess | TranscribeFailure
