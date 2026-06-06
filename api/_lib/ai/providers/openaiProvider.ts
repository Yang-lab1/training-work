import { serverEnv } from '../env.js'

export function getOpenAIProviderStatus() {
  return {
    configured: Boolean(serverEnv.OPENAI_API_KEY),
    implemented: false,
    note: '已预留 OPENAI_API_KEY，后续可接入统一 AnalyzeAnswerResponse。',
  }
}
