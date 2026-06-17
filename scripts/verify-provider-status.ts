import assert from 'node:assert/strict'
import providerStatusRoute from '../api/provider-status.ts'

process.env.AI_PROVIDER = 'deepseek'
delete process.env.DEEPSEEK_API_KEY
process.env.ASR_PROVIDER = 'openai'
delete process.env.OPENAI_API_KEY
delete process.env.DOUBAO_ASR_APP_ID
delete process.env.DOUBAO_ASR_ACCESS_TOKEN

const response = await providerStatusRoute.fetch(new Request('http://localhost/api/provider-status'))
assert.equal(response.status, 200)
const payload = await response.json()

assert.equal(payload.success, true)
assert.equal(payload.ai.provider, 'deepseek')
assert.equal(payload.ai.taskProviders.companyKnowledge, 'deepseek')
assert.equal(payload.ai.configured, false)
assert.equal(payload.ai.fallbackMode, true)
assert.equal(payload.ai.availableProviders.deepseek.implemented, true)
assert.equal(payload.ai.availableProviders.agnes.implemented, true)
assert.equal(payload.ai.availableProviders.agnes.configured, false)
assert.equal(payload.asr.provider, 'openai')
assert.equal(payload.asr.configured, false)
assert.equal(payload.asr.fallbackMode, true)
assert.equal(payload.asr.availableProviders.openai.implemented, true)
assert.equal(payload.routes.transcribe.path, '/api/transcribe')
assert.equal(JSON.stringify(payload).includes('sk-'), false)

console.log('Provider status route: no-key fallback and redaction checks passed')

process.env.ASR_PROVIDER = 'doubao'
process.env.DOUBAO_ASR_APP_ID = 'test-app-id'
process.env.DOUBAO_ASR_ACCESS_TOKEN = 'test-access-token'
process.env.DOUBAO_ASR_ENDPOINT = 'wss://openspeech.bytedance.com'
process.env.DOUBAO_ASR_URI = '/api/v3/sauc/bigmodel'
process.env.DOUBAO_ASR_RESOURCE_ID = 'volc.seedasr.sauc.duration'
process.env.DOUBAO_ASR_MODEL = 'doubao-streaming-asr-2.0'

const doubaoResponse = await providerStatusRoute.fetch(new Request('http://localhost/api/provider-status'))
assert.equal(doubaoResponse.status, 200)
const doubaoPayload = await doubaoResponse.json()

assert.equal(doubaoPayload.success, true)
assert.equal(doubaoPayload.asr.provider, 'doubao')
assert.equal(doubaoPayload.asr.configured, true)
assert.equal(doubaoPayload.asr.fallbackMode, true)
assert.equal(doubaoPayload.asr.availableProviders.doubao.model, 'doubao-streaming-asr-2.0')
assert.equal(JSON.stringify(doubaoPayload).includes('test-access-token'), false)

console.log('Provider status route: doubao env compatibility checks passed')
