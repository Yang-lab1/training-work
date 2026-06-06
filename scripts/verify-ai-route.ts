import assert from 'node:assert/strict'
import analyzeAnswerRoute from '../api/analyze-answer.ts'
import transcribeRoute from '../api/transcribe.ts'

function request(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
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
delete process.env.DEEPSEEK_API_KEY
const fallbackResponse = await analyzeAnswerRoute.fetch(request('/api/analyze-answer', {
  ...baseInput,
  trainingType: 'miroProject',
}))
const fallbackPayload = await fallbackResponse.json()
assert.equal(fallbackPayload.success, true)
assert.equal(fallbackPayload.provider, 'mock_fallback')
assert.ok(fallbackPayload.problems.some((problem: string) => problem.includes('用户、场景、AI 作用')))

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

console.log('AI and ASR routes: mock, fallback, validation passed')
