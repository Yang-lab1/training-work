import type { ASRProviderName } from './types'

export interface ASRProviderDescriptor {
  name: Exclude<ASRProviderName, 'mock_fallback'>
  status: 'implemented' | 'reserved'
}

export const asrProviderDescriptors: ASRProviderDescriptor[] = [
  { name: 'mock', status: 'implemented' },
  { name: 'openai', status: 'reserved' },
  { name: 'doubao', status: 'reserved' },
  { name: 'volcengine', status: 'reserved' },
  { name: 'xfyun', status: 'reserved' },
  { name: 'aliyun', status: 'reserved' },
  { name: 'tencent', status: 'reserved' },
]

export function getASRProviderDescriptor(name: Exclude<ASRProviderName, 'mock_fallback'>) {
  return asrProviderDescriptors.find((provider) => provider.name === name)
}
