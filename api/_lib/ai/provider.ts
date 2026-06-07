import type {
  AIProviderName,
  AnalyzeAnswerRequest,
  AnalyzeAnswerSuccess,
  GenerateJobPackRequest,
  GenerateJobPackSuccess,
} from '../../../src/lib/ai/types.js'

export interface AnalyzeAnswerProvider {
  name: Exclude<AIProviderName, 'mock_fallback'>
  model: string
  analyzeAnswer(input: AnalyzeAnswerRequest): Promise<AnalyzeAnswerSuccess>
  generateJobPack?(input: GenerateJobPackRequest): Promise<GenerateJobPackSuccess>
}
