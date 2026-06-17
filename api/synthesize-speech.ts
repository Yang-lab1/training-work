import type { SynthesizeSpeechFailure, SynthesizeSpeechRequest } from '../src/lib/tts/types.js'
import { synthesizeSpeechWithProvider } from './_lib/tts/providerRouter.js'

function json(payload: unknown, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function withCallMetadata<T extends { provider?: string; rawProviderNote?: string }>(payload: T, startedAt: number) {
  const isFallback = payload.provider === 'mock_fallback'
  return {
    ...payload,
    providerUsed: payload.provider,
    isFallback,
    fallbackReason: isFallback ? payload.rawProviderNote || 'provider fallback' : undefined,
    latencyMs: Date.now() - startedAt,
  }
}

function validateRequest(input: unknown): SynthesizeSpeechRequest {
  if (!input || typeof input !== 'object') throw new Error('Invalid TTS payload.')
  const payload = input as Partial<SynthesizeSpeechRequest>
  const text = typeof payload.text === 'string' ? payload.text.trim() : ''
  if (!text) throw new Error('Missing text.')
  if (text.length > 800) throw new Error('TTS text must be under 800 characters.')
  return {
    text,
    selectedJob: payload.selectedJob || null,
    questionId: typeof payload.questionId === 'string' ? payload.questionId : undefined,
    voiceStyle: payload.voiceStyle === 'neutral' ? 'neutral' : 'interviewer',
  }
}

export default {
  async fetch(request: Request) {
    const startedAt = Date.now()
    if (request.method !== 'POST') {
      return json({
        success: false,
        error: 'Only POST is supported.',
        provider: 'mock',
        providerUsed: 'mock',
        isFallback: false,
        latencyMs: Date.now() - startedAt,
        fallbackAvailable: true,
      } satisfies SynthesizeSpeechFailure, 405)
    }

    try {
      const origin = request.headers.get('origin')
      const host = request.headers.get('host')
      if (origin && host && new URL(origin).host !== host) throw new Error('Cross-origin API calls are not allowed.')
      const contentLength = Number(request.headers.get('content-length') || 0)
      if (contentLength > 20_000) throw new Error('TTS request must be under 20 KB.')
      return json(withCallMetadata(await synthesizeSpeechWithProvider(validateRequest(await request.json())), startedAt))
    } catch (error) {
      return json({
        success: false,
        error: error instanceof Error ? error.message : 'Speech synthesis failed.',
        provider: 'mock',
        providerUsed: 'mock',
        isFallback: false,
        latencyMs: Date.now() - startedAt,
        fallbackAvailable: true,
      } satisfies SynthesizeSpeechFailure, 400)
    }
  },
}
