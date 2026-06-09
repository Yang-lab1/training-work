import type { TranscribeFailure } from '../src/lib/asr/types.js'
import { transcribeWithProvider } from './_lib/asr/providerRouter.js'
import { validateTranscribeRequest } from './_lib/asr/validate.js'

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
      } satisfies TranscribeFailure, 405)
    }
    try {
      const origin = request.headers.get('origin')
      const host = request.headers.get('host')
      if (origin && host && new URL(origin).host !== host) throw new Error('Cross-origin API calls are not allowed.')
      const contentLength = Number(request.headers.get('content-length') || 0)
      if (contentLength > 30_000_000) throw new Error('Audio request must be under 30 MB.')
      const contentType = request.headers.get('content-type') || ''
      if (contentType.includes('multipart/form-data')) {
        const form = await request.formData()
        const payloadText = String(form.get('payload') || '{}')
        const payload = JSON.parse(payloadText) as Record<string, unknown>
        const audio = form.get('audio')
        if (audio instanceof File) {
          payload.audioMetadata = {
            ...(payload.audioMetadata && typeof payload.audioMetadata === 'object' ? payload.audioMetadata : {}),
            recordingName: audio.name,
            mimeType: audio.type,
            size: audio.size,
          }
          payload.audioFile = audio
        }
        return json(withCallMetadata(await transcribeWithProvider(validateTranscribeRequest(payload)), startedAt))
      }
      return json(withCallMetadata(await transcribeWithProvider(validateTranscribeRequest(await request.json())), startedAt))
    } catch (error) {
      return json({
        success: false,
        error: error instanceof Error ? error.message : 'Transcription failed.',
        provider: 'mock',
        providerUsed: 'mock',
        isFallback: false,
        latencyMs: Date.now() - startedAt,
        fallbackAvailable: true,
      } satisfies TranscribeFailure, 400)
    }
  },
}
