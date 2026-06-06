import { serverEnv } from '../env.js'

export function getGeminiProviderStatus() {
  return {
    configured: Boolean(serverEnv.GEMINI_API_KEY),
    implemented: false,
    note: '已预留 GEMINI_API_KEY，后续可接入统一 AnalyzeAnswerResponse。',
  }
}
