import type { SynthesizeSpeechRequest, SynthesizeSpeechSuccess, TTSProviderName } from '../../../src/lib/tts/types.js'
import { serverEnv } from '../ai/env.js'
import { doubaoTtsStatus, getDoubaoTtsConfig, getDoubaoTtsProviderStatus, synthesizeWithDoubao } from './providers/doubaoTtsProvider.js'
import { synthesizeWithMock } from './providers/mockTtsProvider.js'

type ConfigurableTTSProvider = Exclude<TTSProviderName, 'mock_fallback'>

function configuredProvider(): ConfigurableTTSProvider {
  const value = serverEnv.TTS_PROVIDER?.trim().toLowerCase()
  if (value === 'doubao' || value === 'openai') return value
  return 'mock'
}

function statusFor(provider: ConfigurableTTSProvider) {
  if (provider === 'mock') {
    return {
      configured: true,
      implemented: true,
      model: 'mock-tts-v1',
      fallbackMode: true,
      note: 'Mock TTS 始终可用；前端会回退到浏览器临时语音。',
    }
  }
  if (provider === 'doubao') {
    const config = getDoubaoTtsConfig()
    const status = getDoubaoTtsProviderStatus()
    return {
      configured: status.configured,
      implemented: doubaoTtsStatus.implemented,
      model: config.model,
      fallbackMode: !status.configured,
      note: status.note,
    }
  }
  const configured = Boolean(serverEnv.OPENAI_API_KEY?.trim())
  return {
    configured,
    implemented: false,
    model: serverEnv.OPENAI_TTS_MODEL?.trim(),
    fallbackMode: true,
    note: configured ? 'OpenAI TTS 已预留，当前仍回退到 Mock。' : '未配置 OPENAI_API_KEY，当前使用 Mock TTS。',
  }
}

export function getTTSProviderStatus() {
  const provider = configuredProvider()
  const availableProviders = {
    mock: statusFor('mock'),
    doubao: statusFor('doubao'),
    openai: statusFor('openai'),
  }
  const current = availableProviders[provider]
  return {
    provider,
    configured: current.configured,
    fallbackMode: provider === 'mock' || !current.configured || !current.implemented,
    availableProviders,
  }
}

export async function synthesizeSpeechWithProvider(input: SynthesizeSpeechRequest): Promise<SynthesizeSpeechSuccess> {
  const provider = configuredProvider()
  if (provider === 'mock') return synthesizeWithMock(input)

  if (provider === 'doubao') {
    const status = getDoubaoTtsProviderStatus()
    if (!status.configured) {
      return synthesizeWithMock(input, 'mock_fallback', `${status.note}`)
    }
  }

  try {
    if (provider === 'doubao') return await synthesizeWithDoubao(input)
    return synthesizeWithMock(input, 'mock_fallback', `${provider} TTS Provider 已预留但尚未启用。`)
  } catch (error) {
    const detail = error instanceof Error ? `（${error.message.slice(0, 180)}）` : ''
    const note = error instanceof Error && error.name === 'AbortError'
      ? `${provider} TTS 请求超时，已回退到浏览器临时语音。`
      : `${provider} TTS 调用失败${detail}，已回退到浏览器临时语音。`
    return synthesizeWithMock(input, 'mock_fallback', note)
  }
}
