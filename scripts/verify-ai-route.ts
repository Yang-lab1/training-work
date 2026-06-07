import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import analyzeAnswerRoute from '../api/analyze-answer.ts'
import generateJobPackRoute from '../api/generate-job-pack.ts'
import transcribeRoute from '../api/transcribe.ts'

function request(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function withFakeDeepSeekServer<T>(handler: (baseUrl: string) => Promise<T>) {
  const server = createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/chat/completions') {
      res.writeHead(404)
      res.end()
      return
    }
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      const isJobPack = body.includes('companySummary')
      const content = isJobPack ? {
        companySummary: '示例科技是一家企业 AI 办公产品公司。',
        productAndBusiness: '核心业务是 AI 办公产品和企业效率工具。',
        jobRequirementBreakdown: ['理解 AI 办公产品', '能拆解需求', '能讲清项目证据'],
        workContentPrediction: ['用户场景分析', '需求文档输出', 'MVP 验证'],
        candidateFit: ['AI 学习', 'Miro 项目', '产品体验'],
        riskPoints: ['结果证据不足', '业务理解需要更具体'],
        selfIntroductionStrategy: '开头直接定位示例科技 AI 产品实习生。',
        miroProjectStrategy: 'Miro 项目重点讲用户、场景、AI 作用和 MVP 取舍。',
        likelyQuestions: Array.from({ length: 8 }, (_, index) => ({
          question: `DeepSeek 模拟问题 ${index + 1}`,
          whyItMatters: '考察岗位理解。',
          framework: 'STAR',
        })),
        fullScoreAnswerFrameworks: [
          {
            question: '为什么选择示例科技？',
            frameworkName: 'STAR',
            answerStructure: ['背景', '行动', '结果', '岗位关系'],
            candidateEvidence: ['AI 学习', 'Miro 项目'],
            pitfalls: ['不要泛泛而谈'],
          },
        ],
        preparationTasks: ['准备自我介绍', '重讲 Miro 项目'],
      } : {
        score: 88,
        summary: 'DeepSeek 模拟真实 provider 返回的结构化反馈。',
        strengths: ['结合了岗位。'],
        problems: ['还可以更具体。'],
        roleFitFeedback: '面向示例科技 AI 产品实习生，岗位匹配明确。',
        structureFeedback: '结构清晰。',
        expressionFeedback: '表达自然。',
        timingFeedback: '时长可控。',
        fluencyFeedback: '需要真实 ASR 进一步判断。',
        memorizationRisk: '背稿风险低。',
        specificityFeedback: '补充更多指标。',
        improvedShortVersion: '30 秒优化版。',
        improvedLongVersion: '90 秒优化版。',
        nextTasks: ['重练岗位匹配结尾。'],
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('fake server failed')
  try {
    return await handler(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
}

const baseInput = {
  taskType: 'analyze_answer',
  trainingRecordId: 'qa-record-1',
  trainingType: 'chineseIntro',
  selectedJob: {
    id: 'job-1',
    companyName: '示例科技',
    jobTitle: 'AI 产品实习生',
    mainTrack: 'AI 应用产品',
    companyBusiness: '企业 AI 办公产品',
  },
  transcript: '我有 AI 学习、产品体验和工业设计背景，做过 Miro 协作项目，并负责需求拆解和 MVP 验证。',
  durationSeconds: 120,
  targetSeconds: 90,
  cvText: 'AI 学习、产品设计、工业设计。',
  scriptText: '参考稿。',
}

process.env.AI_PROVIDER = 'mock'
const mockResponse = await analyzeAnswerRoute.fetch(request('/api/analyze-answer', baseInput))
assert.equal(mockResponse.status, 200)
const mockPayload = await mockResponse.json()
assert.equal(mockPayload.success, true)
assert.equal(mockPayload.provider, 'mock')
assert.equal(mockPayload.model, 'mock-v2')
assert.match(mockPayload.roleFitFeedback, /示例科技/)
assert.match(mockPayload.roleFitFeedback, /AI 产品实习生/)
assert.match(mockPayload.structureFeedback, /结论-证据-结果-岗位关系/)
assert.ok(mockPayload.problems.some((problem: string) => problem.includes('超时')))
assert.equal(mockPayload.nextTasks.length, 3)
assert.ok(mockPayload.fluencyFeedback)
assert.ok(mockPayload.memorizationRisk)
assert.ok(mockPayload.specificityFeedback)

process.env.AI_PROVIDER = 'deepseek'
await withFakeDeepSeekServer(async (baseUrl) => {
  process.env.DEEPSEEK_API_KEY = 'test-key'
  process.env.DEEPSEEK_BASE_URL = baseUrl
  const realPathResponse = await analyzeAnswerRoute.fetch(request('/api/analyze-answer', baseInput))
  const realPathPayload = await realPathResponse.json()
  assert.equal(realPathPayload.success, true)
  assert.equal(realPathPayload.provider, 'deepseek')
  assert.equal(realPathPayload.score, 88)

  const realJobPackResponse = await generateJobPackRoute.fetch(request('/api/generate-job-pack', {
    selectedJob: baseInput.selectedJob,
  }))
  const realJobPackPayload = await realJobPackResponse.json()
  assert.equal(realJobPackPayload.success, true)
  assert.equal(realJobPackPayload.provider, 'deepseek')
  assert.match(realJobPackPayload.jobPack.companySummary, /示例科技/)
})

process.env.AI_PROVIDER = 'deepseek'
delete process.env.DEEPSEEK_API_KEY
delete process.env.DEEPSEEK_BASE_URL
const fallbackResponse = await analyzeAnswerRoute.fetch(request('/api/analyze-answer', {
  ...baseInput,
  trainingType: 'miroProject',
}))
const fallbackPayload = await fallbackResponse.json()
assert.equal(fallbackPayload.success, true)
assert.equal(fallbackPayload.provider, 'mock_fallback')
assert.ok(fallbackPayload.problems.some((problem: string) => problem.includes('用户、场景、AI 作用')))

process.env.AI_PROVIDER = 'deepseek'
process.env.DEEPSEEK_API_KEY = 'test-invalid-key'
process.env.DEEPSEEK_BASE_URL = 'https://127.0.0.1:1'
const failedRealProviderResponse = await analyzeAnswerRoute.fetch(request('/api/analyze-answer', baseInput))
const failedRealProviderPayload = await failedRealProviderResponse.json()
assert.equal(failedRealProviderPayload.success, true)
assert.equal(failedRealProviderPayload.provider, 'mock_fallback')
delete process.env.DEEPSEEK_API_KEY
delete process.env.DEEPSEEK_BASE_URL

const invalidResponse = await analyzeAnswerRoute.fetch(request('/api/analyze-answer', {
  ...baseInput,
  transcript: '',
}))
assert.equal(invalidResponse.status, 400)
const invalidPayload = await invalidResponse.json()
assert.equal(invalidPayload.success, false)
assert.equal(invalidPayload.fallbackAvailable, true)

process.env.ASR_PROVIDER = 'mock'
const transcribeResponse = await transcribeRoute.fetch(request('/api/transcribe', {
  trainingRecordId: 'qa-record-1',
  trainingType: 'chineseIntro',
  audioMetadata: { recordingId: 'audio-1', durationSeconds: 92 },
  selectedJob: baseInput.selectedJob,
}))
assert.equal(transcribeResponse.status, 200)
const transcribePayload = await transcribeResponse.json()
assert.equal(transcribePayload.success, true)
assert.equal(transcribePayload.provider, 'mock')
assert.match(transcribePayload.transcript, /示例科技/)

const form = new FormData()
form.append('payload', JSON.stringify({
  trainingRecordId: 'qa-record-form',
  trainingType: 'chineseIntro',
  audioMetadata: { recordingId: 'audio-form' },
  selectedJob: baseInput.selectedJob,
}))
form.append('audio', new Blob(['fake audio'], { type: 'audio/webm' }), 'qa.webm')
const multipartResponse = await transcribeRoute.fetch(new Request('http://localhost/api/transcribe', {
  method: 'POST',
  body: form,
}))
const multipartPayload = await multipartResponse.json()
assert.equal(multipartPayload.success, true)
assert.equal(multipartPayload.provider, 'mock')

process.env.ASR_PROVIDER = 'openai'
delete process.env.OPENAI_API_KEY
const asrFallbackResponse = await transcribeRoute.fetch(request('/api/transcribe', {
  trainingRecordId: 'qa-record-1',
  trainingType: 'englishIntro',
  audioMetadata: { recordingId: 'audio-1' },
  selectedJob: baseInput.selectedJob,
}))
const asrFallbackPayload = await asrFallbackResponse.json()
assert.equal(asrFallbackPayload.provider, 'mock_fallback')
assert.equal(asrFallbackPayload.language, 'en')

process.env.AI_PROVIDER = 'mock'
const jobPackResponse = await generateJobPackRoute.fetch(request('/api/generate-job-pack', {
  selectedJob: baseInput.selectedJob,
  cvText: baseInput.cvText,
  trainingRecords: [{ ...baseInput, title: '中文自我介绍', transcript: { text: baseInput.transcript }, aiFeedback: mockPayload }],
  scriptTemplates: { chineseIntro: baseInput.scriptText },
}))
const jobPackPayload = await jobPackResponse.json()
assert.equal(jobPackPayload.success, true)
assert.equal(jobPackPayload.provider, 'mock')
assert.match(jobPackPayload.jobPack.companySummary, /示例科技/)
assert.ok(jobPackPayload.jobPack.likelyQuestions.length >= 8)
assert.ok(jobPackPayload.jobPack.fullScoreAnswerFrameworks.length >= 2)

process.env.AI_PROVIDER = 'deepseek'
delete process.env.DEEPSEEK_API_KEY
const jobPackFallbackResponse = await generateJobPackRoute.fetch(request('/api/generate-job-pack', {
  selectedJob: baseInput.selectedJob,
}))
const jobPackFallbackPayload = await jobPackFallbackResponse.json()
assert.equal(jobPackFallbackPayload.success, true)
assert.equal(jobPackFallbackPayload.provider, 'mock_fallback')

console.log('AI, ASR and job pack routes: mock, configurable provider fallback, validation passed')
