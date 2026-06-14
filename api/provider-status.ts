import { getAIProviderStatus } from './_lib/ai/providerRouter.js'
import { getASRProviderStatus } from './_lib/asr/providerRouter.js'

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

const routes = {
  providerStatus: { path: '/api/provider-status', method: 'GET', available: true, mockSafe: true },
  analyzeAnswer: { path: '/api/analyze-answer', method: 'POST', available: true, mockSafe: true },
  transcribe: { path: '/api/transcribe', method: 'POST', available: true, mockSafe: true },
  generateJobPack: { path: '/api/generate-job-pack', method: 'POST', available: true, mockSafe: true },
  generateMockInterview: { path: '/api/generate-mock-interview', method: 'POST', available: true, mockSafe: true },
  reviewRealInterview: { path: '/api/review-real-interview', method: 'POST', available: true, mockSafe: true },
  generateCompanyKnowledgePack: { path: '/api/generate-company-knowledge-pack', method: 'POST', available: true, mockSafe: true },
  jobDataLatest: { path: '/api/job-data/latest', method: 'GET', available: true, mockSafe: true },
}

export default {
  async fetch(request: Request) {
    if (request.method !== 'GET') {
      return json({ success: false, error: '仅支持 GET 请求。' }, 405)
    }
    return json({
      success: true,
      ai: getAIProviderStatus(),
      asr: getASRProviderStatus(),
      routes,
    })
  },
}
