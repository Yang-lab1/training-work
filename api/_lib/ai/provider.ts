import type {
  AIProviderName,
  AnalyzeAnswerRequest,
  AnalyzeAnswerSuccess,
  GenerateJobPackRequest,
  GenerateJobPackSuccess,
  GenerateFollowUpRequest,
  GenerateFollowUpSuccess,
  GenerateInterviewReportRequest,
  GenerateInterviewReportSuccess,
  GenerateMockInterviewRequest,
  GenerateMockInterviewSuccess,
} from '../../../src/lib/ai/types.js'

export interface AnalyzeAnswerProvider {
  name: Exclude<AIProviderName, 'mock_fallback'>
  model: string
  analyzeAnswer(input: AnalyzeAnswerRequest): Promise<AnalyzeAnswerSuccess>
  generateJobPack?(input: GenerateJobPackRequest): Promise<GenerateJobPackSuccess>
  generateMockInterview?(input: GenerateMockInterviewRequest): Promise<GenerateMockInterviewSuccess>
  generateFollowUp?(input: GenerateFollowUpRequest): Promise<GenerateFollowUpSuccess>
  generateInterviewReport?(input: GenerateInterviewReportRequest): Promise<GenerateInterviewReportSuccess>
}
