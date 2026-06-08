import type {
  AnalyzeAnswerRequest,
  AnalyzeAnswerSuccess,
  ConfiguredAIProvider,
  GenerateCompanyKnowledgePackRequest,
  GenerateCompanyKnowledgePackSuccess,
  GenerateFollowUpRequest,
  GenerateFollowUpSuccess,
  GenerateInterviewReportRequest,
  GenerateInterviewReportSuccess,
  GenerateJobPackRequest,
  GenerateJobPackSuccess,
  GenerateMockInterviewRequest,
  GenerateMockInterviewSuccess,
  ReviewRealInterviewRequest,
  ReviewRealInterviewSuccess,
} from '../../../src/lib/ai/types.js'
import { serverEnv } from './env.js'
import { createDeepSeekProvider } from './providers/deepseekProvider.js'
import { getDoubaoProviderStatus } from './providers/doubaoProvider.js'
import { getGeminiProviderStatus } from './providers/geminiProvider.js'
import { getAgnesProviderStatus } from './providers/agnesProvider.js'
import { analyzeWithMock, generateCompanyKnowledgePackWithMock, generateFollowUpWithMock, generateInterviewReportWithMock, generateJobPackWithMock, generateMockInterviewWithMock, reviewRealInterviewWithMock } from './providers/mockProvider.js'
import { getOpenAIProviderStatus } from './providers/openaiProvider.js'

function configuredProvider(): ConfiguredAIProvider {
  const value = serverEnv.AI_PROVIDER?.trim().toLowerCase()
  if (value === 'deepseek' || value === 'doubao' || value === 'openai' || value === 'gemini' || value === 'agnes') return value
  return 'mock'
}

function providerStatus(provider: ConfiguredAIProvider) {
  if (provider === 'mock') {
    return {
      configured: true,
      implemented: true,
      model: 'mock-v2',
      fallbackMode: true,
      note: 'Mock 文本 Provider 始终可用。',
    }
  }
  if (provider === 'deepseek') {
    const configured = Boolean(serverEnv.DEEPSEEK_API_KEY?.trim())
    return {
      configured,
      implemented: true,
      model: serverEnv.DEEPSEEK_MODEL?.trim() || 'deepseek-chat',
      fallbackMode: !configured,
      note: configured ? 'DeepSeek 文本 Provider 已配置。' : '缺少 DEEPSEEK_API_KEY，会回退到 Mock。',
    }
  }
  const status = provider === 'doubao'
    ? getDoubaoProviderStatus()
    : provider === 'openai'
      ? getOpenAIProviderStatus()
      : provider === 'gemini'
        ? getGeminiProviderStatus()
        : getAgnesProviderStatus()
  return {
    configured: status.configured,
    implemented: Boolean('implemented' in status ? status.implemented : false),
    model: provider === 'doubao'
      ? serverEnv.DOUBAO_MODEL?.trim()
      : provider === 'openai'
        ? serverEnv.OPENAI_MODEL?.trim()
        : provider === 'gemini'
          ? serverEnv.GEMINI_MODEL?.trim()
          : serverEnv.AGNES_MODEL?.trim(),
    fallbackMode: true,
    note: status.note,
  }
}

export function getAIProviderStatus() {
  const provider = configuredProvider()
  const availableProviders = {
    mock: providerStatus('mock'),
    deepseek: providerStatus('deepseek'),
    agnes: providerStatus('agnes'),
    doubao: providerStatus('doubao'),
    openai: providerStatus('openai'),
    gemini: providerStatus('gemini'),
  }
  const current = availableProviders[provider]
  return {
    provider,
    configured: current.configured,
    fallbackMode: provider === 'mock' || !current.configured || !current.implemented,
    availableProviders,
  }
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

export async function reviewRealInterviewWithProvider(
  input: ReviewRealInterviewRequest,
): Promise<ReviewRealInterviewSuccess> {
  const provider = configuredProvider()
  if (provider === 'mock') return reviewRealInterviewWithMock(input)

  try {
    if (provider === 'deepseek') {
      const apiKey = serverEnv.DEEPSEEK_API_KEY?.trim()
      if (!apiKey) return reviewRealInterviewWithMock(input, 'mock_fallback', '未配置 DEEPSEEK_API_KEY，已自动使用模拟真实面试复盘。')
      const deepseek = createDeepSeekProvider(apiKey)
      if (!deepseek.reviewRealInterview) throw new Error('DeepSeek real interview review is unavailable')
      return await deepseek.reviewRealInterview(input)
    }
    const status = provider === 'doubao'
      ? getDoubaoProviderStatus()
      : provider === 'openai'
        ? getOpenAIProviderStatus()
        : provider === 'gemini'
          ? getGeminiProviderStatus()
          : getAgnesProviderStatus()
    return reviewRealInterviewWithMock(input, 'mock_fallback', `${provider} Provider 尚未启用。${status.note}`)
  } catch (error) {
    const reason = error instanceof Error && error.name === 'AbortError'
      ? `${provider} 真实面试复盘请求超时，已自动使用模拟复盘。`
      : `${provider} 真实面试复盘调用失败，已自动使用模拟复盘。`
    return reviewRealInterviewWithMock(input, 'mock_fallback', reason)
  }
}

export async function generateCompanyKnowledgePackWithProvider(
  input: GenerateCompanyKnowledgePackRequest,
): Promise<GenerateCompanyKnowledgePackSuccess> {
  const provider = configuredProvider()
  if (provider === 'mock') return generateCompanyKnowledgePackWithMock(input)

  try {
    if (provider === 'deepseek') {
      const apiKey = serverEnv.DEEPSEEK_API_KEY?.trim()
      if (!apiKey) return generateCompanyKnowledgePackWithMock(input, 'mock_fallback', '未配置 DEEPSEEK_API_KEY，已自动使用模拟公司知识包。')
      const deepseek = createDeepSeekProvider(apiKey)
      if (!deepseek.generateCompanyKnowledgePack) throw new Error('DeepSeek company knowledge pack generator is unavailable')
      return await deepseek.generateCompanyKnowledgePack(input)
    }
    const status = provider === 'doubao'
      ? getDoubaoProviderStatus()
      : provider === 'openai'
        ? getOpenAIProviderStatus()
        : provider === 'gemini'
          ? getGeminiProviderStatus()
          : getAgnesProviderStatus()
    return generateCompanyKnowledgePackWithMock(input, 'mock_fallback', `${provider} Provider 尚未启用。${status.note}`)
  } catch (error) {
    const reason = error instanceof Error && error.name === 'AbortError'
      ? `${provider} 公司知识包请求超时，已自动使用模拟结果。`
      : `${provider} 公司知识包调用失败，已自动使用模拟结果。`
    return generateCompanyKnowledgePackWithMock(input, 'mock_fallback', reason)
  }
}
