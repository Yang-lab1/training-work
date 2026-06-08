import type { TranscribeRequest, TranscribeSuccess } from '../../../../src/lib/asr/types.js'
import { serverEnv } from '../../ai/env.js'

export const openAIAsrStatus = { implemented: true, note: 'OpenAI 音频转写接口可配置。' }

export function getOpenAIAsrProviderStatus() {
  const configured = Boolean(serverEnv.OPENAI_API_KEY?.trim())
  return {
    configured,
    note: configured ? 'OpenAI ASR Provider 已配置。' : '未配置 OPENAI_API_KEY，已回退到 Mock ASR。',
  }
}

export async function transcribeWithOpenAI(input: TranscribeRequest): Promise<TranscribeSuccess> {
  const apiKey = serverEnv.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY')
  if (!input.audioFile) throw new Error('Missing audio file')

  const model = serverEnv.OPENAI_ASR_MODEL?.trim() || 'whisper-1'
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45_000)
  try {
    const form = new FormData()
    form.append('model', model)
    form.append('file', input.audioFile, input.audioMetadata?.recordingName || 'answer.webm')
    form.append('response_format', 'json')
    if (input.trainingType === 'englishIntro') form.append('language', 'en')

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      body: form,
    })
    if (!response.ok) throw new Error(`OpenAI ASR request failed: ${response.status}`)
    const payload = await response.json() as { text?: string; duration?: number; language?: string }
    const transcript = typeof payload.text === 'string' ? payload.text.trim() : ''
    if (!transcript) throw new Error('OpenAI ASR returned empty transcript')
    const language = input.trainingType === 'englishIntro' ? 'en' : payload.language === 'en' ? 'en' : 'zh'
    return {
      success: true,
      provider: 'openai',
      model,
      transcript,
      language,
      durationSeconds: typeof payload.duration === 'number' ? Math.round(payload.duration) : input.audioMetadata?.durationSeconds,
      generatedAt: new Date().toISOString(),
    }
  } finally {
    clearTimeout(timeout)
  }
}
