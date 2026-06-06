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
