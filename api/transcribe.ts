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

export default {
  async fetch(request: Request) {
    if (request.method !== 'POST') {
      return json({
        success: false,
        error: '仅支持 POST 请求。',
        provider: 'mock',
        fallbackAvailable: true,
      } satisfies TranscribeFailure, 405)
    }
    try {
      const origin = request.headers.get('origin')
      const host = request.headers.get('host')
      if (origin && host && new URL(origin).host !== host) throw new Error('不允许跨站调用此接口。')
      const contentLength = Number(request.headers.get('content-length') || 0)
      if (contentLength > 30_000_000) throw new Error('音频请求不能超过 30 MB。')
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
        }
        return json(await transcribeWithProvider(validateTranscribeRequest(payload)))
      }
      return json(await transcribeWithProvider(validateTranscribeRequest(await request.json())))
    } catch (error) {
      return json({
        success: false,
        error: error instanceof Error ? error.message : '转写失败，请稍后重试。',
        provider: 'mock',
        fallbackAvailable: true,
      } satisfies TranscribeFailure, 400)
    }
  },
}
