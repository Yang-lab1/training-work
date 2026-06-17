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
  'mock',
  'openai',
  'doubao',
  'volcengine',
  'xfyun',
  'aliyun',
  'tencent',
])

type DoubaoAsrConfig = {
  appId: string
  accessToken: string
  secretKey: string
  endpoint: string
  uri: string
  resourceId: string
  model: string
}

function configuredProvider(): ConfigurableASRProvider {
  const value = serverEnv.ASR_PROVIDER?.trim().toLowerCase() as ASRProviderName | undefined
  return value && value !== 'mock_fallback' && supported.has(value) ? value : 'mock'
}

function getDoubaoAsrConfig(): DoubaoAsrConfig {
  return {
    appId:
      serverEnv.DOUBAO_ASR_APP_ID?.trim()
      || serverEnv.DOUBAO_ASR_APPID?.trim()
      || '',
    accessToken:
      serverEnv.DOUBAO_ASR_ACCESS_TOKEN?.trim()
      || serverEnv.DOUBAO_ASR_API_KEY?.trim()
      || '',
    secretKey: serverEnv.DOUBAO_ASR_SECRET_KEY?.trim() || '',
    endpoint: serverEnv.DOUBAO_ASR_ENDPOINT?.trim() || 'wss://openspeech.bytedance.com',
    uri: serverEnv.DOUBAO_ASR_URI?.trim() || '/api/v3/sauc/bigmodel',
    resourceId: serverEnv.DOUBAO_ASR_RESOURCE_ID?.trim() || 'volc.seedasr.sauc.duration',
    model: serverEnv.DOUBAO_ASR_MODEL?.trim() || 'doubao-streaming-asr-2.0',
  }
}

function keyFor(provider: ASRProviderName) {
  if (provider === 'openai') return serverEnv.OPENAI_API_KEY?.trim() || ''
  if (provider === 'doubao') return getDoubaoAsrConfig().accessToken
  if (provider === 'volcengine') return serverEnv.VOLCENGINE_ASR_API_KEY?.trim() || ''
  if (provider === 'xfyun') return serverEnv.XFYUN_ASR_API_KEY?.trim() || ''
  if (provider === 'aliyun') return serverEnv.ALIYUN_ASR_API_KEY?.trim() || ''
  if (provider === 'tencent') return serverEnv.TENCENT_ASR_API_KEY?.trim() || ''
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

  if (provider === 'doubao') {
    const config = getDoubaoAsrConfig()
    const configured = Boolean(config.appId && config.accessToken)
    return {
      configured,
      implemented: doubaoAsrStatus.implemented,
      model: config.model,
      fallbackMode: true,
      note: configured
        ? `豆包 ASR 凭证已配置（${config.endpoint}${config.uri} / ${config.resourceId}），当前真实流式转写仍在接入中，现阶段会回退 Mock。`
        : '未配置 DOUBAO_ASR_APP_ID 或 DOUBAO_ASR_ACCESS_TOKEN，会回退到 Mock。',
    }
  }

  const providerStatus = provider === 'volcengine'
    ? volcengineAsrStatus
    : provider === 'xfyun'
      ? xfyunAsrStatus
      : provider === 'aliyun'
        ? aliyunAsrStatus
        : tencentAsrStatus

  const configured = Boolean(keyFor(provider))
  return {
    configured,
    implemented: providerStatus.implemented,
    model: undefined,
    fallbackMode: true,
    note: configured
      ? `${provider} ASR 已配置，但真实调用仍预留。`
      : providerStatus.note,
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

  if (provider === 'mock') {
    return transcribeWithMock(input)
  }

  if (provider === 'doubao') {
    const config = getDoubaoAsrConfig()
    if (!config.appId || !config.accessToken) {
      return transcribeWithMock(input, 'mock_fallback', '未配置豆包 ASR 的 APP_ID 或 ACCESS_TOKEN，已自动使用模拟转写。')
    }
  } else if (!keyFor(provider)) {
    return transcribeWithMock(input, 'mock_fallback', `未配置 ${provider} ASR Key，已自动使用模拟转写。`)
  }

  try {
    if (provider === 'openai') {
      return await transcribeWithOpenAI(input)
    }

    return transcribeWithMock(input, 'mock_fallback', `${provider} ASR Provider 已预留但尚未启用真实音频上传。`)
  } catch (error) {
    const note = error instanceof Error && error.name === 'AbortError'
      ? `${provider} ASR 请求超时，已自动使用模拟转写。`
      : `${provider} ASR 调用失败，已自动使用模拟转写。`
    return transcribeWithMock(input, 'mock_fallback', note)
  }
}
