import type { AITaskType, ConfiguredAIProvider } from './types'

export interface AIProviderDescriptor {
  name: ConfiguredAIProvider
  tasks: AITaskType[]
  status: 'implemented' | 'reserved'
}

export const aiProviderDescriptors: AIProviderDescriptor[] = [
  { name: 'mock', tasks: ['analyze_answer'], status: 'implemented' },
  { name: 'deepseek', tasks: ['analyze_answer'], status: 'implemented' },
  { name: 'doubao', tasks: ['analyze_answer'], status: 'reserved' },
  { name: 'openai', tasks: ['analyze_answer'], status: 'reserved' },
  { name: 'gemini', tasks: ['analyze_answer'], status: 'reserved' },
]

export function getAIProviderDescriptor(name: ConfiguredAIProvider) {
  return aiProviderDescriptors.find((provider) => provider.name === name)
}
