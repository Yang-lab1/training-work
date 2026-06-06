import { serverEnv } from '../env.js'

export function getDoubaoProviderStatus() {
  return {
    configured: Boolean(serverEnv.DOUBAO_API_KEY && serverEnv.DOUBAO_ENDPOINT),
    implemented: false,
    note: '已预留 DOUBAO_API_KEY 与 DOUBAO_ENDPOINT，后续接入火山方舟请求格式。',
  }
}
