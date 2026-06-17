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

const DOUBAO_TTS_VOICE_ALIASES: Record<string, string> = {
  'Vivi': 'zh_female_vv_uranus_bigtts',
  'vivi': 'zh_female_vv_uranus_bigtts',
  '小何': 'zh_female_xiaohe_uranus_bigtts',
  '小天': 'zh_male_taocheng_uranus_bigtts',
  '云舟': 'zh_male_m191_uranus_bigtts',
  '刘飞': 'zh_male_liufei_uranus_bigtts',
  '灿灿': 'zh_female_cancan_uranus_bigtts',
  '爽快思思': 'zh_female_shuangkuaisisi_uranus_bigtts',
}

function normalizeVoiceType(value: string) {
  const trimmed = value.trim()
  return DOUBAO_TTS_VOICE_ALIASES[trimmed] || trimmed
}

export function getDoubaoTtsConfig(): DoubaoTtsConfig {
  const resourceId = serverEnv.DOUBAO_TTS_RESOURCE_ID?.trim() || 'seed-tts-2.0'
  const rawVoiceType = serverEnv.DOUBAO_TTS_VOICE_TYPE?.trim() || serverEnv.DOUBAO_TTS_VOICE_ID?.trim() || ''
  return {
    apiKey: serverEnv.DOUBAO_TTS_API_KEY?.trim() || '',
    appId: serverEnv.DOUBAO_TTS_APP_ID?.trim() || serverEnv.DOUBAO_TTS_APPID?.trim() || '',
    accessToken: serverEnv.DOUBAO_TTS_ACCESS_TOKEN?.trim() || '',
    endpoint: serverEnv.DOUBAO_TTS_ENDPOINT?.trim() || 'https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse',
    resourceId,
    model: serverEnv.DOUBAO_TTS_MODEL?.trim() || resourceId,
    voiceType: normalizeVoiceType(rawVoiceType),
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

function requestId() {
  return globalThis.crypto?.randomUUID?.() || `interview-os-${Date.now()}`
}

function redactSensitive(value: string, config: DoubaoTtsConfig) {
  return [config.apiKey, config.accessToken, config.appId]
    .filter(Boolean)
    .reduce((text, secret) => text.replaceAll(secret, '[redacted]'), value)
}

function looksLikeBase64(value: string) {
  return value.length > 32 && /^[A-Za-z0-9+/=_-]+$/.test(value)
}

function collectAudioBase64(value: unknown): string[] {
  if (!value || typeof value !== 'object') return []
  const record = value as Record<string, unknown>
  const direct = ['audio', 'audio_data', 'audioData', 'payload', 'data']
    .map((key) => record[key])
    .filter((item): item is string => typeof item === 'string' && looksLikeBase64(item))
  const nested = ['data', 'result', 'response']
    .flatMap((key) => collectAudioBase64(record[key]))
  return [...direct, ...nested]
}

function parseSseAudioBase64(body: string) {
  const chunks: Uint8Array[] = []
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('event:') || line.startsWith(':')) continue
    const data = line.startsWith('data:') ? line.slice(5).trim() : line.startsWith('{') ? line : ''
    if (!data || data === '[DONE]') continue
    try {
      const payload = JSON.parse(data) as { code?: number; message?: string; data?: unknown }
      if (payload.code && payload.code !== 0 && payload.code !== 20000000) throw new Error(payload.message || `Doubao TTS error code ${payload.code}`)
      collectAudioBase64(payload).forEach((audio) => chunks.push(base64ToBytes(audio)))
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error
    }
  }
  return chunks.length ? bytesToBase64(concatBytes(chunks)) : ''
}

function parseChunkedJsonAudio(body: string) {
  const chunks: Uint8Array[] = []
  let index = 0
  while (index < body.length) {
    const start = body.indexOf('{', index)
    if (start < 0) break
    let depth = 0
    let inString = false
    let escaped = false
    let end = -1
    for (let cursor = start; cursor < body.length; cursor += 1) {
      const char = body[cursor]
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = !inString
      } else if (!inString && char === '{') {
        depth += 1
      } else if (!inString && char === '}') {
        depth -= 1
        if (depth === 0) {
          end = cursor + 1
          break
        }
      }
    }
    if (end < 0) break
    const jsonText = body.slice(start, end)
    try {
      const payload = JSON.parse(jsonText) as { code?: number; message?: string; data?: unknown }
      if (payload.code && payload.code !== 0 && payload.code !== 20000000) throw new Error(payload.message || `Doubao TTS error code ${payload.code}`)
      collectAudioBase64(payload).forEach((audio) => chunks.push(base64ToBytes(audio)))
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error
    }
    index = end
  }
  return chunks.length ? bytesToBase64(concatBytes(chunks)) : ''
}

function parseJsonAudio(body: string) {
  try {
    const payload = JSON.parse(body) as { code?: number; message?: string; data?: unknown }
    if (payload.code && payload.code !== 0 && payload.code !== 20000000) throw new Error(payload.message || `Doubao TTS error code ${payload.code}`)
    const chunks = collectAudioBase64(payload).map(base64ToBytes)
    return chunks.length ? bytesToBase64(concatBytes(chunks)) : ''
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    return ''
  }
}

function parseDoubaoAudio(contentType: string, responseText: string, arrayBuffer?: ArrayBuffer) {
  if (contentType.includes('audio/') || contentType.includes('octet-stream')) {
    if (!arrayBuffer) return ''
    return bytesToBase64(new Uint8Array(arrayBuffer))
  }
  return parseSseAudioBase64(responseText) || parseChunkedJsonAudio(responseText) || parseJsonAudio(responseText)
}

function buildV3Payload(input: SynthesizeSpeechRequest, config: DoubaoTtsConfig) {
  return {
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
  }
}

function buildV3Headers(config: DoubaoTtsConfig) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Api-Resource-Id': config.resourceId,
    'X-Api-Request-Id': requestId(),
  }
  if (config.apiKey) {
    headers['X-Api-Key'] = config.apiKey
  } else if (config.appId && config.accessToken) {
    headers['X-Api-App-Id'] = config.appId
    headers['X-Api-Access-Key'] = config.accessToken
    headers.Authorization = `Bearer;${config.accessToken}`
  }
  return headers
}

async function requestV3Tts(endpoint: string, input: SynthesizeSpeechRequest, config: DoubaoTtsConfig, signal: AbortSignal) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: buildV3Headers(config),
    signal,
    body: JSON.stringify(buildV3Payload(input, config)),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(redactSensitive(`Doubao TTS request failed: ${response.status} ${errorText.slice(0, 180)}`, config))
  }
  const contentType = response.headers.get('content-type') || ''
  const isBinary = contentType.includes('audio/') || contentType.includes('octet-stream')
  const arrayBuffer = isBinary ? await response.arrayBuffer() : undefined
  const responseText = isBinary ? '' : await response.text()
  const audioBase64 = parseDoubaoAudio(contentType, responseText, arrayBuffer)
  if (!audioBase64) throw new Error(redactSensitive(`Doubao TTS returned empty audio: ${responseText.slice(0, 240)}`, config))
  return audioBase64
}

async function requestLegacyV1Tts(input: SynthesizeSpeechRequest, config: DoubaoTtsConfig, signal: AbortSignal) {
  if (!config.appId || !config.accessToken) throw new Error('Missing legacy Doubao TTS App ID or Access Token')
  const response = await fetch('https://openspeech.bytedance.com/api/v1/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer;${config.accessToken}`,
    },
    signal,
    body: JSON.stringify({
      app: { appid: config.appId, token: config.accessToken, cluster: 'volcano_tts' },
      user: { uid: `interview-os-${input.questionId || Date.now()}` },
      audio: {
        voice_type: config.voiceType,
        encoding: 'mp3',
        speed_ratio: 1,
        volume_ratio: 1,
        pitch_ratio: 1,
      },
      request: {
        reqid: requestId(),
        text: input.text.slice(0, 800),
        text_type: 'plain',
        operation: 'query',
      },
    }),
  })
  const responseText = await response.text()
  if (!response.ok) throw new Error(redactSensitive(`Doubao legacy TTS failed: ${response.status} ${responseText.slice(0, 180)}`, config))
  const audioBase64 = parseDoubaoAudio(response.headers.get('content-type') || '', responseText)
  if (!audioBase64) throw new Error(redactSensitive(`Doubao legacy TTS returned empty audio: ${responseText.slice(0, 240)}`, config))
  return audioBase64
}

export async function synthesizeWithDoubao(input: SynthesizeSpeechRequest): Promise<SynthesizeSpeechSuccess> {
  const config = getDoubaoTtsConfig()
  if (!(config.apiKey || (config.appId && config.accessToken))) throw new Error('Missing Doubao TTS credentials')
  if (!config.voiceType) throw new Error('Missing DOUBAO_TTS_VOICE_TYPE')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25_000)
  try {
    const endpoints = [config.endpoint]
    if (config.endpoint.endsWith('/sse')) endpoints.push(config.endpoint.replace(/\/sse$/, ''))
    const errors: string[] = []
    let audioBase64 = ''
    for (const endpoint of endpoints) {
      try {
        audioBase64 = await requestV3Tts(endpoint, input, config, controller.signal)
        break
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'unknown V3 TTS error')
      }
    }
    if (!audioBase64 && config.appId && config.accessToken) {
      try {
        audioBase64 = await requestLegacyV1Tts(input, config, controller.signal)
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'unknown legacy TTS error')
      }
    }
    if (!audioBase64) throw new Error(redactSensitive(errors.join(' | '), config))

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
