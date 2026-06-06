export type AIProviderName =
  | 'mock'
  | 'mock_fallback'
  | 'deepseek'
  | 'doubao'
  | 'openai'
  | 'gemini'

export type ConfiguredAIProvider = Exclude<AIProviderName, 'mock_fallback'>

export type AITaskType =
  | 'analyze_answer'
  | 'generate_script'
  | 'generate_company_pack'
  | 'mock_interview_question'
  | 'review_real_interview'

export type TrainingType = 'chineseIntro' | 'englishIntro' | 'miroProject'

export interface AnalyzeJobContext {
  id?: string
  companyName?: string
  jobTitle?: string
  city?: string
  jobType?: string
  priority?: string
  mainTrack?: string
  companyBusiness?: string
  jobContent?: string
  jobRequirements?: string
  businessDirection?: string
}

export interface AnalyzeAnswerRequest {
  taskType?: 'analyze_answer'
  trainingRecordId: string
  trainingType: TrainingType
  selectedJob: AnalyzeJobContext | null
  transcript: string
  durationSeconds: number
  targetSeconds: number
  cvText?: string
  scriptText?: string
}

export interface AnalyzeAnswerSuccess {
  success: true
  provider: AIProviderName
  model: string
  generatedAt: string
  score: number
  summary: string
  strengths: string[]
  problems: string[]
  roleFitFeedback: string
  structureFeedback: string
  expressionFeedback: string
  timingFeedback: string
  fluencyFeedback: string
  memorizationRisk: string
  specificityFeedback: string
  improvedShortVersion: string
  improvedLongVersion: string
  nextTasks: string[]
  rawProviderNote?: string
}

export interface AnalyzeAnswerFailure {
  success: false
  error: string
  provider: AIProviderName
  fallbackAvailable: true
}

export type AnalyzeAnswerResponse = AnalyzeAnswerSuccess | AnalyzeAnswerFailure

export interface TranscriptData {
  text: string
  source: 'manual' | 'mock' | 'asr'
  updatedAt: string
  provider?: string
  language?: 'zh' | 'en' | 'mixed'
}

export type StoredAIFeedback = Omit<AnalyzeAnswerSuccess, 'success'>

export type TranscriptStatus =
  | 'not_started'
  | 'mock_ready'
  | 'manual_ready'
  | 'transcribing'
  | 'completed'
  | 'failed'

export type AIFeedbackStatus =
  | 'not_ready'
  | 'transcript_needed'
  | 'ready_to_analyze'
  | 'analyzing'
  | 'completed'
  | 'failed'
