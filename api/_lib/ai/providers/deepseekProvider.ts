import type {
  AnalyzeAnswerRequest,
  AnalyzeAnswerSuccess,
} from '../../../../src/lib/ai/types.js'
import { serverEnv } from '../env.js'
import type { AnalyzeAnswerProvider } from '../provider.js'
import { normalizeModelFeedback, parseModelJson } from '../response.js'

const SYSTEM_PROMPT = `你是一名严格的中文面试教练。请分析候选人的一次训练回答，并只输出合法 JSON。
必须具体结合训练类型、目标公司、目标岗位、回答文本、自评标签和时长。
禁止空泛鼓励，必须指出可执行修改。
JSON 字段必须为：
score, summary, strengths, problems, roleFitFeedback, structureFeedback,
expressionFeedback, timingFeedback, improvedShortVersion, improvedLongVersion, nextTasks。
score 为 0-100 数字；strengths、problems、nextTasks 为字符串数组；其余字段为字符串。
分析维度：是否回答问题、岗位贴合、结构、表达、时长、AI/项目能力、具体证据，以及 30 秒和 90 秒修改稿。`

export function createDeepSeekProvider(apiKey: string): AnalyzeAnswerProvider {
  const model = serverEnv.DEEPSEEK_MODEL?.trim() || 'deepseek-chat'
  return {
    name: 'deepseek',
    model,
    async analyzeAnswer(input: AnalyzeAnswerRequest): Promise<AnalyzeAnswerSuccess> {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 18_000)
      try {
        const response = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            response_format: { type: 'json_object' },
            temperature: 0.3,
            max_tokens: 2400,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: `请基于以下 JSON 输入生成反馈：\n${JSON.stringify(input)}` },
            ],
          }),
        })
        if (!response.ok) throw new Error(`DeepSeek request failed: ${response.status}`)
        const payload = await response.json() as {
          choices?: Array<{ message?: { content?: string } }>
        }
        const content = payload.choices?.[0]?.message?.content
        if (!content) throw new Error('DeepSeek returned empty content')
        return normalizeModelFeedback(parseModelJson(content), 'deepseek', model)
      } finally {
        clearTimeout(timeout)
      }
    },
  }
}
