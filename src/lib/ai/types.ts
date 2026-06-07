export type AIProviderName =
  | 'mock'
  | 'mock_fallback'
  | 'deepseek'
  | 'doubao'
  | 'openai'
  | 'gemini'
  | 'agnes'

export type ConfiguredAIProvider = Exclude<AIProviderName, 'mock_fallback'>

export type AITaskType =
  | 'analyze_answer'
  | 'generate_script'
  | 'generate_company_pack'
  | 'mock_interview_question'
  | 'generate_mock_interview'
  | 'generate_follow_up'
  | 'generate_interview_report'
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

export interface JobPackQuestion {
  question: string
  whyItMatters: string
  framework: string
}

export interface JobPackAnswerFramework {
  question: string
  frameworkName: string
  answerStructure: string[]
  candidateEvidence: string[]
  pitfalls: string[]
}

export interface JobPackContent {
  companySummary: string
  productAndBusiness: string
  jobRequirementBreakdown: string[]
  workContentPrediction: string[]
  candidateFit: string[]
  riskPoints: string[]
  selfIntroductionStrategy: string
  miroProjectStrategy: string
  likelyQuestions: JobPackQuestion[]
  fullScoreAnswerFrameworks: JobPackAnswerFramework[]
  preparationTasks: string[]
}

export interface GenerateJobPackRequest {
  taskType?: 'generate_job_pack'
  selectedJob: AnalyzeJobContext
  cvText?: string
  trainingRecords?: Array<{
    trainingType?: TrainingType
    title?: string
    durationSeconds?: number
    transcript?: { text?: string }
    aiFeedback?: Partial<StoredAIFeedback>
  }>
  aiFeedbackRecords?: Partial<StoredAIFeedback>[]
  scriptTemplates?: Record<string, string | undefined>
}

export interface GenerateJobPackSuccess {
  success: true
  provider: AIProviderName
  model: string
  generatedAt: string
  jobPack: JobPackContent
  rawProviderNote?: string
}

export interface GenerateJobPackFailure {
  success: false
  error: string
  provider: AIProviderName
  fallbackAvailable: true
}

export type GenerateJobPackResponse = GenerateJobPackSuccess | GenerateJobPackFailure

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
  generatedAt?: string
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

export type MockInterviewType = 'quick_mock' | 'job_pack_mock' | 'pressure_mock'

export type MockInterviewQuestionType =
  | 'self_intro'
  | 'project'
  | 'role_fit'
  | 'technical_basic'
  | 'pressure'
  | 'english'
  | 'follow_up'

export interface MockInterviewQuestion {
  id: string
  type: MockInterviewQuestionType
  question: string
  source: 'jobPack' | 'selectedJob' | 'miroProject' | 'mockProvider'
  expectedFocus: string
  followUpPolicy: string
}

export interface GenerateMockInterviewRequest {
  taskType?: 'generate_mock_interview'
  selectedJob: AnalyzeJobContext
  jobPack?: Partial<JobPackContent>
  cvText?: string
  trainingRecords?: Array<{
    trainingType?: TrainingType
    title?: string
    transcript?: { text?: string }
    aiFeedback?: Partial<StoredAIFeedback>
  }>
  interviewType?: MockInterviewType
}

export interface GenerateMockInterviewSuccess {
  success: true
  provider: AIProviderName
  model: string
  generatedAt: string
  questions: MockInterviewQuestion[]
  rawProviderNote?: string
}

export interface GenerateMockInterviewFailure {
  success: false
  error: string
  provider: AIProviderName
  fallbackAvailable: true
}

export type GenerateMockInterviewResponse = GenerateMockInterviewSuccess | GenerateMockInterviewFailure

export interface GenerateFollowUpRequest {
  taskType?: 'generate_follow_up'
  selectedJob: AnalyzeJobContext
  question: MockInterviewQuestion | string
  transcript: string
  aiFeedback?: Partial<StoredAIFeedback>
}

export interface GenerateFollowUpSuccess {
  success: true
  provider: AIProviderName
  model: string
  generatedAt: string
  followUpQuestion: MockInterviewQuestion
  rawProviderNote?: string
}

export interface GenerateFollowUpFailure {
  success: false
  error: string
  provider: AIProviderName
  fallbackAvailable: true
}

export type GenerateFollowUpResponse = GenerateFollowUpSuccess | GenerateFollowUpFailure

export interface InterviewReportAnswer {
  questionId: string
  question: string
  transcript?: TranscriptData
  transcriptStatus?: TranscriptStatus
  aiFeedback?: Partial<StoredAIFeedback>
  aiFeedbackStatus?: AIFeedbackStatus
  durationSeconds?: number
}

export interface InterviewFinalReport {
  overallScore: number
  summary: string
  strongestAnswer: string
  weakestAnswer: string
  recurringProblems: string[]
  roleFitAssessment: string
  communicationAssessment: string
  projectDepthAssessment: string
  englishAssessment: string
  nextTrainingPlan: string[]
}

export interface GenerateInterviewReportRequest {
  taskType?: 'generate_interview_report'
  selectedJob: AnalyzeJobContext
  jobPack?: Partial<JobPackContent>
  questions: MockInterviewQuestion[]
  answers: InterviewReportAnswer[]
}

export interface GenerateInterviewReportSuccess {
  success: true
  provider: AIProviderName
  model: string
  generatedAt: string
  finalReport: InterviewFinalReport
  rawProviderNote?: string
}

export interface GenerateInterviewReportFailure {
  success: false
  error: string
  provider: AIProviderName
  fallbackAvailable: true
}

export type GenerateInterviewReportResponse = GenerateInterviewReportSuccess | GenerateInterviewReportFailure
