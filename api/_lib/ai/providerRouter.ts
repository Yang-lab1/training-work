import type {
  AnalyzeAnswerRequest,
  AnalyzeAnswerSuccess,
  ConfiguredAIProvider,
  GenerateFollowUpRequest,
  GenerateFollowUpSuccess,
  GenerateInterviewReportRequest,
  GenerateInterviewReportSuccess,
  GenerateJobPackRequest,
  GenerateJobPackSuccess,
  GenerateMockInterviewRequest,
  GenerateMockInterviewSuccess,
} from '../../../src/lib/ai/types.js'
import { serverEnv } from './env.js'
import { createDeepSeekProvider } from './providers/deepseekProvider.js'
import { getDoubaoProviderStatus } from './providers/doubaoProvider.js'
import { getGeminiProviderStatus } from './providers/geminiProvider.js'
import { getAgnesProviderStatus } from './providers/agnesProvider.js'
import { analyzeWithMock, generateFollowUpWithMock, generateInterviewReportWithMock, generateJobPackWithMock, generateMockInterviewWithMock } from './providers/mockProvider.js'
import { getOpenAIProviderStatus } from './providers/openaiProvider.js'

function configuredProvider(): ConfiguredAIProvider {
  const value = serverEnv.AI_PROVIDER?.trim().toLowerCase()
  if (value === 'deepseek' || value === 'doubao' || value === 'openai' || value === 'gemini' || value === 'agnes') return value
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
        : provider === 'gemini'
          ? getGeminiProviderStatus()
          : getAgnesProviderStatus()
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
        : provider === 'gemini'
          ? getGeminiProviderStatus()
          : getAgnesProviderStatus()
    return generateJobPackWithMock(input, 'mock_fallback', `${provider} Provider 尚未启用。${status.note}`)
  } catch (error) {
    const reason = error instanceof Error && error.name === 'AbortError'
      ? `${provider} 岗位准备包请求超时，已自动使用模拟结果。`
      : `${provider} 岗位准备包调用失败，已自动使用模拟结果。`
    return generateJobPackWithMock(input, 'mock_fallback', reason)
  }
}

export async function generateMockInterviewWithProvider(
  input: GenerateMockInterviewRequest,
): Promise<GenerateMockInterviewSuccess> {
  const provider = configuredProvider()
  if (provider === 'mock') return generateMockInterviewWithMock(input)

  try {
    if (provider === 'deepseek') {
      const apiKey = serverEnv.DEEPSEEK_API_KEY?.trim()
      if (!apiKey) return generateMockInterviewWithMock(input, 'mock_fallback', '未配置 DEEPSEEK_API_KEY，已自动使用模拟面试问题。')
      const deepseek = createDeepSeekProvider(apiKey)
      if (!deepseek.generateMockInterview) throw new Error('DeepSeek mock interview generator is unavailable')
      return await deepseek.generateMockInterview(input)
    }
    const status = provider === 'doubao'
      ? getDoubaoProviderStatus()
      : provider === 'openai'
        ? getOpenAIProviderStatus()
        : provider === 'gemini'
          ? getGeminiProviderStatus()
          : getAgnesProviderStatus()
    return generateMockInterviewWithMock(input, 'mock_fallback', `${provider} Provider 尚未启用。${status.note}`)
  } catch (error) {
    const reason = error instanceof Error && error.name === 'AbortError'
      ? `${provider} 模拟面试请求超时，已自动使用模拟问题。`
      : `${provider} 模拟面试调用失败，已自动使用模拟问题。`
    return generateMockInterviewWithMock(input, 'mock_fallback', reason)
  }
}

export async function generateFollowUpWithProvider(
  input: GenerateFollowUpRequest,
): Promise<GenerateFollowUpSuccess> {
  const provider = configuredProvider()
  if (provider === 'mock') return generateFollowUpWithMock(input)

  try {
    if (provider === 'deepseek') {
      const apiKey = serverEnv.DEEPSEEK_API_KEY?.trim()
      if (!apiKey) return generateFollowUpWithMock(input, 'mock_fallback', '未配置 DEEPSEEK_API_KEY，已自动使用模拟追问。')
      const deepseek = createDeepSeekProvider(apiKey)
      if (!deepseek.generateFollowUp) throw new Error('DeepSeek follow-up generator is unavailable')
      return await deepseek.generateFollowUp(input)
    }
    return generateFollowUpWithMock(input, 'mock_fallback', `${provider} Provider 尚未启用。`)
  } catch {
    return generateFollowUpWithMock(input, 'mock_fallback', `${provider} 追问调用失败，已自动使用模拟追问。`)
  }
}

export async function generateInterviewReportWithProvider(
  input: GenerateInterviewReportRequest,
): Promise<GenerateInterviewReportSuccess> {
  const provider = configuredProvider()
  if (provider === 'mock') return generateInterviewReportWithMock(input)

  try {
    if (provider === 'deepseek') {
      const apiKey = serverEnv.DEEPSEEK_API_KEY?.trim()
      if (!apiKey) return generateInterviewReportWithMock(input, 'mock_fallback', '未配置 DEEPSEEK_API_KEY，已自动使用模拟整场复盘。')
      const deepseek = createDeepSeekProvider(apiKey)
      if (!deepseek.generateInterviewReport) throw new Error('DeepSeek interview report generator is unavailable')
      return await deepseek.generateInterviewReport(input)
    }
    return generateInterviewReportWithMock(input, 'mock_fallback', `${provider} Provider 尚未启用。`)
  } catch {
    return generateInterviewReportWithMock(input, 'mock_fallback', `${provider} 整场复盘调用失败，已自动使用模拟复盘。`)
  }
}
