import assert from 'node:assert/strict'
import analyzeAnswerRoute from '../api/analyze-answer.ts'

function request(body: unknown) {
  return new Request('http://localhost/api/analyze-answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
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
  review: {
    selfScore: 3,
    issueTags: ['超时', '逻辑混乱', '岗位匹配弱'],
    nextActionChoice: '需要重练一次',
  },
  cvText: 'AI 学习、产品设计、工业设计。',
  scriptText: '参考稿。',
}

process.env.AI_PROVIDER = 'mock'
const mockResponse = await analyzeAnswerRoute.fetch(request(baseInput))
assert.equal(mockResponse.status, 200)
const mockPayload = await mockResponse.json()
assert.equal(mockPayload.success, true)
assert.equal(mockPayload.provider, 'mock')
assert.equal(mockPayload.model, 'mock-v1')
assert.match(mockPayload.roleFitFeedback, /示例科技/)
assert.match(mockPayload.roleFitFeedback, /AI 产品实习生/)
assert.match(mockPayload.structureFeedback, /背景-行动-结果-岗位关系/)
assert.ok(mockPayload.problems.some((problem: string) => problem.includes('超时')))
assert.equal(mockPayload.nextTasks.length, 3)

process.env.AI_PROVIDER = 'deepseek'
delete process.env.DEEPSEEK_API_KEY
const fallbackResponse = await analyzeAnswerRoute.fetch(request({
  ...baseInput,
  trainingType: 'miroProject',
}))
const fallbackPayload = await fallbackResponse.json()
assert.equal(fallbackPayload.success, true)
assert.equal(fallbackPayload.provider, 'mock_fallback')
assert.ok(fallbackPayload.problems.some((problem: string) => problem.includes('用户、场景、AI 作用')))

const invalidResponse = await analyzeAnswerRoute.fetch(request({
  ...baseInput,
  transcript: '',
}))
assert.equal(invalidResponse.status, 400)
const invalidPayload = await invalidResponse.json()
assert.equal(invalidPayload.success, false)
assert.equal(invalidPayload.fallbackAvailable, true)

console.log('AI route mock, fallback, validation: passed')
