import type { AnalyzeAnswerFailure } from '../src/lib/ai/types.js'
import { analyzeAnswerWithProvider } from './_lib/ai/providerRouter.js'
import { validateAnalyzeAnswerRequest } from './_lib/ai/validate.js'

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
      } satisfies AnalyzeAnswerFailure, 405)
    }

    try {
      const origin = request.headers.get('origin')
      const host = request.headers.get('host')
      if (origin && host && new URL(origin).host !== host) {
        throw new Error('Cross-origin API calls are not allowed.')
      }
      const contentLength = Number(request.headers.get('content-length') || 0)
      if (contentLength > 100_000) throw new Error('Request body is too large.')
      const input = validateAnalyzeAnswerRequest(await request.json())
      return json(withCallMetadata(await analyzeAnswerWithProvider(input), startedAt))
    } catch (error) {
      return json({
        success: false,
        error: error instanceof Error ? error.message : 'Analyze answer failed.',
        provider: 'mock',
        providerUsed: 'mock',
        isFallback: false,
        latencyMs: Date.now() - startedAt,
        fallbackAvailable: true,
      } satisfies AnalyzeAnswerFailure, 400)
    }
  },
}
