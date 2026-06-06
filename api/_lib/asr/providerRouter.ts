import type { ASRProviderName, TranscribeRequest, TranscribeSuccess } from '../../../src/lib/asr/types.js'
import { serverEnv } from '../ai/env.js'
import { transcribeWithMock } from './providers/mockAsrProvider.js'

const supported = new Set<ASRProviderName>([
  'mock', 'openai', 'doubao', 'volcengine', 'xfyun', 'aliyun', 'tencent',
])

function configuredProvider(): ASRProviderName {
  const value = serverEnv.ASR_PROVIDER?.trim().toLowerCase() as ASRProviderName | undefined
  return value && supported.has(value) ? value : 'mock'
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

export async function transcribeWithProvider(input: TranscribeRequest): Promise<TranscribeSuccess> {
  const provider = configuredProvider()
  if (provider === 'mock') return transcribeWithMock(input)
  if (!keyFor(provider)?.trim()) {
    return transcribeWithMock(input, 'mock_fallback', `未配置 ${provider} ASR Key，已自动使用模拟转写。`)
  }
  return transcribeWithMock(input, 'mock_fallback', `${provider} ASR Provider 已预留但尚未启用真实音频上传。`)
}
