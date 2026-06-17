import type { SynthesizeSpeechRequest, SynthesizeSpeechSuccess } from '../../../../src/lib/tts/types.js'
import { serverEnv } from '../../ai/env.js'

export const doubaoTtsStatus = { implemented: true, note: '豆包语音合成 2.0 Provider 可配置。' }

interface DoubaoTtsConfig {
  apiKey: string
  appId: string
  accessToken: string
  endpoint: string
  resourceId: string
  model: string
  voiceType: string
}

export function getDoubaoTtsConfig(): DoubaoTtsConfig {
  const resourceId = serverEnv.DOUBAO_TTS_RESOURCE_ID?.trim() || 'seed-tts-2.0'
  return {
    apiKey: serverEnv.DOUBAO_TTS_API_KEY?.trim() || '',
    appId: serverEnv.DOUBAO_TTS_APP_ID?.trim() || serverEnv.DOUBAO_TTS_APPID?.trim() || '',
    accessToken:
      serverEnv.DOUBAO_TTS_ACCESS_TOKEN?.trim()
      || serverEnv.DOUBAO_TTS_API_KEY?.trim()
      || '',
    endpoint: serverEnv.DOUBAO_TTS_ENDPOINT?.trim() || 'https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse',
    resourceId,
    model: serverEnv.DOUBAO_TTS_MODEL?.trim() || resourceId,
    voiceType: serverEnv.DOUBAO_TTS_VOICE_TYPE?.trim() || serverEnv.DOUBAO_TTS_VOICE_ID?.trim() || '',
  }
}

export function getDoubaoTtsProviderStatus() {
  const config = getDoubaoTtsConfig()
  const configured = Boolean((config.apiKey || (config.appId && config.accessToken)) && config.voiceType)
  const missing = [
    !config.apiKey && !(config.appId && config.accessToken) ? 'DOUBAO_TTS_API_KEY 或 DOUBAO_TTS_APP_ID + DOUBAO_TTS_ACCESS_TOKEN' : '',
    !config.voiceType ? 'DOUBAO_TTS_VOICE_TYPE' : '',
  ].filter(Boolean)
  return {
    configured,
    note: configured
      ? `豆包 TTS 已配置（${config.resourceId} / ${config.voiceType}）。`
      : `未配置 ${missing.join('、')}，面试官声音会回退到浏览器临时语音。`,
  }
}

function base64ToBytes(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

function concatBytes(chunks: Uint8Array[]) {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0)
  const output = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.length
  }
  return output
}

function redactSensitive(value: string, config: DoubaoTtsConfig) {
  return [config.apiKey, config.accessToken, config.appId]
    .filter(Boolean)
    .reduce((text, secret) => text.replaceAll(secret, '[redacted]'), value)
}

function parseSseAudioBase64(body: string) {
  const chunks: Uint8Array[] = []
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line.startsWith('data:')) continue
    const data = line.slice(5).trim()
    if (!data || data === '[DONE]') continue
    try {
      const payload = JSON.parse(data) as { code?: number; message?: string; data?: string }
      if (payload.code && payload.code !== 0 && payload.code !== 20000000) {
        throw new Error(payload.message || `Doubao TTS error code ${payload.code}`)
      }
      if (typeof payload.data === 'string' && payload.data) {
        chunks.push(base64ToBytes(payload.data))
      }
    } catch (error) {
      if (error instanceof Error && /Doubao TTS error code/.test(error.message)) throw error
    }
  }
  return chunks.length ? bytesToBase64(concatBytes(chunks)) : ''
}

export async function synthesizeWithDoubao(input: SynthesizeSpeechRequest): Promise<SynthesizeSpeechSuccess> {
  const config = getDoubaoTtsConfig()
  if (!(config.apiKey || (config.appId && config.accessToken))) throw new Error('Missing Doubao TTS credentials')
  if (!config.voiceType) throw new Error('Missing DOUBAO_TTS_VOICE_TYPE')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25_000)
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Api-Resource-Id': config.resourceId,
    }
    if (config.apiKey) headers['X-Api-Key'] = config.apiKey
    if (config.appId) headers['X-Api-App-Id'] = config.appId
    if (config.accessToken) {
      headers['X-Api-Access-Key'] = config.accessToken
      headers.Authorization = `Bearer;${config.accessToken}`
    }

    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        user: { uid: `interview-os-${input.questionId || Date.now()}` },
        req_params: {
          text: input.text.slice(0, 800),
          speaker: config.voiceType,
          audio_params: {
            format: 'mp3',
            sample_rate: 24000,
            speech_rate: 0,
            loudness_rate: 0,
          },
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(redactSensitive(`Doubao TTS request failed: ${response.status} ${errorText.slice(0, 180)}`, config))
    }
    const contentType = response.headers.get('content-type') || ''
    const audioBase64 = contentType.includes('audio/')
      ? bytesToBase64(new Uint8Array(await response.arrayBuffer()))
      : parseSseAudioBase64(await response.text())
    if (!audioBase64) throw new Error('Doubao TTS returned empty audio')

    return {
      success: true,
      provider: 'doubao',
      model: config.model,
      audioBase64,
      mimeType: 'audio/mpeg',
      generatedAt: new Date().toISOString(),
    }
  } finally {
    clearTimeout(timeout)
  }
}
