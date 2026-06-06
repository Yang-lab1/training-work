import type {
  AIProviderName,
  AnalyzeAnswerSuccess,
} from '../../../src/lib/ai/types.js'

type ModelFeedback = Omit<
  AnalyzeAnswerSuccess,
  'success' | 'provider' | 'model' | 'generatedAt' | 'rawProviderNote'
>

function text(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function list(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback
  const items = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8)
  return items.length ? items : fallback
}

export function normalizeModelFeedback(
  value: unknown,
  provider: AIProviderName,
  model: string,
  rawProviderNote?: string,
): AnalyzeAnswerSuccess {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const rawScore = typeof input.score === 'number' ? input.score : Number(input.score)
  const score = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : 70

  return {
    success: true,
    provider,
    model,
    generatedAt: new Date().toISOString(),
    score,
    summary: text(input.summary, '已完成本次回答分析。'),
    strengths: list(input.strengths, ['回答已形成可复盘的完整文本。']),
    problems: list(input.problems, ['还可以进一步增加岗位证据和具体结果。']),
    roleFitFeedback: text(input.roleFitFeedback, '补充与目标岗位直接相关的经历和关键词。'),
    structureFeedback: text(input.structureFeedback, '按背景、行动、结果和岗位关系组织回答。'),
    expressionFeedback: text(input.expressionFeedback, '减少重复表达，让句子更短、更自然。'),
    timingFeedback: text(input.timingFeedback, '继续按目标时长练习，并保留必要信息。'),
    improvedShortVersion: text(input.improvedShortVersion, '请根据反馈压缩为 30 秒版本。'),
    improvedLongVersion: text(input.improvedLongVersion, '请根据反馈重写为 90 秒版本。'),
    nextTasks: list(input.nextTasks, ['只看回答骨架重讲一次。']).slice(0, 3),
    rawProviderNote,
  }
}

export function parseModelJson(content: string) {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  return JSON.parse(cleaned) as ModelFeedback
}
