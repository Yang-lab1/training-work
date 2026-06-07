import type { GenerateFollowUpFailure } from '../src/lib/ai/types.js'
import { generateFollowUpWithProvider } from './_lib/ai/providerRouter.js'
import { validateGenerateFollowUpRequest } from './_lib/ai/validate.js'

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
      return json({ success: false, error: '仅支持 POST 请求。', provider: 'mock', fallbackAvailable: true } satisfies GenerateFollowUpFailure, 405)
    }
    try {
      const origin = request.headers.get('origin')
      const host = request.headers.get('host')
      if (origin && host && new URL(origin).host !== host) throw new Error('不允许跨站调用此接口。')
      if (Number(request.headers.get('content-length') || 0) > 120_000) throw new Error('请求内容过长。')
      return json(await generateFollowUpWithProvider(validateGenerateFollowUpRequest(await request.json())))
    } catch (error) {
      return json({
        success: false,
        error: error instanceof Error ? error.message : '追问生成失败，请稍后重试。',
        provider: 'mock',
        fallbackAvailable: true,
      } satisfies GenerateFollowUpFailure, 400)
    }
  },
}
