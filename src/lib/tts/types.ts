import type { AnalyzeJobContext } from '../ai/types'

export type TTSProviderName = 'mock' | 'mock_fallback' | 'doubao' | 'openai'

export interface SynthesizeSpeechRequest {
  text: string
  selectedJob?: AnalyzeJobContext | null
  questionId?: string
  voiceStyle?: 'interviewer' | 'neutral'
}

export interface SynthesizeSpeechSuccess {
  success: true
  provider: TTSProviderName
  providerUsed?: TTSProviderName
  model?: string
  isFallback?: boolean
  fallbackReason?: string
  latencyMs?: number
  audioBase64?: string
  mimeType?: string
  generatedAt: string
  rawProviderNote?: string
}

export interface SynthesizeSpeechFailure {
  success: false
  error: string
  provider: TTSProviderName
  providerUsed?: TTSProviderName
  isFallback?: boolean
  fallbackReason?: string
  latencyMs?: number
  fallbackAvailable: true
}

export type SynthesizeSpeechResponse = SynthesizeSpeechSuccess | SynthesizeSpeechFailure
