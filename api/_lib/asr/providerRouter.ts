import type { ASRProviderName, TranscribeRequest, TranscribeSuccess } from '../../../src/lib/asr/types.js'
import { serverEnv } from '../ai/env.js'
import { aliyunAsrStatus } from './providers/aliyunAsrProvider.js'
import { doubaoAsrStatus } from './providers/doubaoAsrProvider.js'
import { transcribeWithMock } from './providers/mockAsrProvider.js'
import { getOpenAIAsrProviderStatus, openAIAsrStatus, transcribeWithOpenAI } from './providers/openaiAsrProvider.js'
import { tencentAsrStatus } from './providers/tencentAsrProvider.js'
import { volcengineAsrStatus } from './providers/volcengineAsrProvider.js'
import { xfyunAsrStatus } from './providers/xfyunAsrProvider.js'

type ConfigurableASRProvider = Exclude<ASRProviderName, 'mock_fallback'>

const supported = new Set<ConfigurableASRProvider>([
  'mock', 'openai', 'doubao', 'volcengine', 'xfyun', 'aliyun', 'tencent',
])

function configuredProvider(): ConfigurableASRProvider {
  const value = serverEnv.ASR_PROVIDER?.trim().toLowerCase() as ASRProviderName | undefined
  return value && value !== 'mock_fallback' && supported.has(value) ? value : 'mock'
}

function keyFor(provider: ASRProviderName) {
  if (provider === 'openai') return serverEnv.OPENAI_API_KEY
  if (provider === 'doubao') return serverEnv.DOUBAO_ASR_API_KEY
  if (provider === 'volcengine') return serverEnv.VOLCENGINE_ASR_API_KEY
  if (provider === 'xfyun') return serverEnv.XFYUN_ASR_API_KEY
  if (provider === 'aliyun') return serverEnv.ALIYUN_ASR_API_KEY
  if (provider === 'tencent') return serverEnv.TENCENT_ASR_API_KEY
  return ''
}

function statusFor(provider: Exclude<ASRProviderName, 'mock_fallback'>) {
  if (provider === 'mock') {
    return {
      configured: true,
      implemented: true,
      model: 'mock-asr-v1',
      fallbackMode: true,
      note: 'Mock ASR 始终可用。',
    }
  }
  if (provider === 'openai') {
    const status = getOpenAIAsrProviderStatus()
    return {
      configured: status.configured,
      implemented: openAIAsrStatus.implemented,
      model: serverEnv.OPENAI_ASR_MODEL?.trim() || 'whisper-1',
      fallbackMode: !status.configured,
      note: status.note,
    }
  }
  const providerStatus = provider === 'doubao'
    ? doubaoAsrStatus
    : provider === 'volcengine'
      ? volcengineAsrStatus
      : provider === 'xfyun'
        ? xfyunAsrStatus
        : provider === 'aliyun'
          ? aliyunAsrStatus
          : tencentAsrStatus
  const configured = Boolean(keyFor(provider)?.trim())
  return {
    configured,
    implemented: providerStatus.implemented,
    model: provider === 'doubao' ? serverEnv.DOUBAO_ASR_MODEL?.trim() : undefined,
    fallbackMode: true,
    note: configured ? `${provider} ASR 已配置但真实调用仍预留。` : providerStatus.note,
  }
}

export function getASRProviderStatus() {
  const provider = configuredProvider()
  const availableProviders = {
    mock: statusFor('mock'),
    openai: statusFor('openai'),
    doubao: statusFor('doubao'),
    volcengine: statusFor('volcengine'),
    xfyun: statusFor('xfyun'),
    aliyun: statusFor('aliyun'),
    tencent: statusFor('tencent'),
  }
  const current = availableProviders[provider]
  return {
    provider,
    configured: current.configured,
    fallbackMode: provider === 'mock' || !current.configured || !current.implemented,
    availableProviders,
  }
}

export async function transcribeWithProvider(input: TranscribeRequest): Promise<TranscribeSuccess> {
  const provider = configuredProvider()
  if (provider === 'mock') return transcribeWithMock(input)
  if (!keyFor(provider)?.trim()) {
    return transcribeWithMock(input, 'mock_fallback', `未配置 ${provider} ASR Key，已自动使用模拟转写。`)
  }
  try {
    if (provider === 'openai') return await transcribeWithOpenAI(input)
    return transcribeWithMock(input, 'mock_fallback', `${provider} ASR Provider 已预留但尚未启用真实音频上传。`)
  } catch (error) {
    const note = error instanceof Error && error.name === 'AbortError'
      ? `${provider} ASR 请求超时，已自动使用模拟转写。`
      : `${provider} ASR 调用失败，已自动使用模拟转写。`
    return transcribeWithMock(input, 'mock_fallback', note)
  }
}
