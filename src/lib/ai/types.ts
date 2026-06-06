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

export interface AnalyzeReviewInput {
  selfScore?: number
  issueTags: string[]
  nextActionChoice?: string
}

export interface AnalyzeAnswerRequest {
  taskType?: 'analyze_answer'
  trainingRecordId: string
  trainingType: TrainingType
  selectedJob: AnalyzeJobContext | null
  transcript: string
  durationSeconds: number
  targetSeconds: number
  review: AnalyzeReviewInput
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
  source: 'manual' | 'mock'
  updatedAt: string
}

export type StoredAIFeedback = Omit<AnalyzeAnswerSuccess, 'success'>
