import { serverEnv } from '../env.js'

export function getAgnesProviderStatus() {
  const configured = Boolean(serverEnv.AGNES_API_KEY?.trim() && serverEnv.AGNES_BASE_URL?.trim())
  return {
    configured,
    note: configured
      ? 'AGNES Provider 已预留，真实调用将在后续版本接入。'
      : '未配置 AGNES_API_KEY 或 AGNES_BASE_URL，已回退到 Mock。',
  }
}
