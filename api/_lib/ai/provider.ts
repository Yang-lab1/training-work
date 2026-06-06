import type {
  AIProviderName,
  AnalyzeAnswerRequest,
  AnalyzeAnswerSuccess,
} from '../../../src/lib/ai/types.js'

export interface AnalyzeAnswerProvider {
  name: Exclude<AIProviderName, 'mock_fallback'>
  model: string
  analyzeAnswer(input: AnalyzeAnswerRequest): Promise<AnalyzeAnswerSuccess>
}
