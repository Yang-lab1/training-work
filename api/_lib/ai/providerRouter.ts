import type {
  AnalyzeAnswerRequest,
  AnalyzeAnswerSuccess,
  ConfiguredAIProvider,
  GenerateJobPackRequest,
  GenerateJobPackSuccess,
} from '../../../src/lib/ai/types.js'
import { serverEnv } from './env.js'
import { createDeepSeekProvider } from './providers/deepseekProvider.js'
import { getDoubaoProviderStatus } from './providers/doubaoProvider.js'
import { getGeminiProviderStatus } from './providers/geminiProvider.js'
import { analyzeWithMock, generateJobPackWithMock } from './providers/mockProvider.js'
import { getOpenAIProviderStatus } from './providers/openaiProvider.js'

function configuredProvider(): ConfiguredAIProvider {
  const value = serverEnv.AI_PROVIDER?.trim().toLowerCase()
  if (value === 'deepseek' || value === 'doubao' || value === 'openai' || value === 'gemini') return value
  return 'mock'
}

export async function analyzeAnswerWithProvider(
  input: AnalyzeAnswerRequest,
): Promise<AnalyzeAnswerSuccess> {
  const provider = configuredProvider()
  if (provider === 'mock') return analyzeWithMock(input)

  try {
    if (provider === 'deepseek') {
      const apiKey = serverEnv.DEEPSEEK_API_KEY?.trim()
      if (!apiKey) {
        return analyzeWithMock(input, 'mock_fallback', '未配置 DEEPSEEK_API_KEY，已自动使用模拟反馈。')
      }
      return await createDeepSeekProvider(apiKey).analyzeAnswer(input)
    }

    const status = provider === 'doubao'
      ? getDoubaoProviderStatus()
      : provider === 'openai'
        ? getOpenAIProviderStatus()
        : getGeminiProviderStatus()
    return analyzeWithMock(input, 'mock_fallback', `${provider} Provider 尚未启用。${status.note}`)
  } catch (error) {
    const reason = error instanceof Error && error.name === 'AbortError'
      ? `${provider} 请求超时，已自动使用模拟反馈。`
      : `${provider} 调用失败，已自动使用模拟反馈。`
    return analyzeWithMock(input, 'mock_fallback', reason)
  }
}

export async function generateJobPackWithProvider(
  input: GenerateJobPackRequest,
): Promise<GenerateJobPackSuccess> {
  const provider = configuredProvider()
  if (provider === 'mock') return generateJobPackWithMock(input)

  try {
    if (provider === 'deepseek') {
      const apiKey = serverEnv.DEEPSEEK_API_KEY?.trim()
      if (!apiKey) {
        return generateJobPackWithMock(input, 'mock_fallback', '未配置 DEEPSEEK_API_KEY，已自动使用模拟岗位准备包。')
      }
      const deepseek = createDeepSeekProvider(apiKey)
      if (!deepseek.generateJobPack) throw new Error('DeepSeek job pack generator is unavailable')
      return await deepseek.generateJobPack(input)
    }

    const status = provider === 'doubao'
      ? getDoubaoProviderStatus()
      : provider === 'openai'
        ? getOpenAIProviderStatus()
        : getGeminiProviderStatus()
    return generateJobPackWithMock(input, 'mock_fallback', `${provider} Provider 尚未启用。${status.note}`)
  } catch (error) {
    const reason = error instanceof Error && error.name === 'AbortError'
      ? `${provider} 岗位准备包请求超时，已自动使用模拟结果。`
      : `${provider} 岗位准备包调用失败，已自动使用模拟结果。`
    return generateJobPackWithMock(input, 'mock_fallback', reason)
  }
}
