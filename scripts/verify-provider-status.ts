import assert from 'node:assert/strict'
import providerStatusRoute from '../api/provider-status.ts'

process.env.AI_PROVIDER = 'deepseek'
delete process.env.DEEPSEEK_API_KEY
process.env.ASR_PROVIDER = 'openai'
delete process.env.OPENAI_API_KEY

const response = await providerStatusRoute.fetch(new Request('http://localhost/api/provider-status'))
assert.equal(response.status, 200)
const payload = await response.json()

assert.equal(payload.success, true)
assert.equal(payload.ai.provider, 'deepseek')
assert.equal(payload.ai.configured, false)
assert.equal(payload.ai.fallbackMode, true)
assert.equal(payload.ai.availableProviders.deepseek.implemented, true)
assert.equal(payload.asr.provider, 'openai')
assert.equal(payload.asr.configured, false)
assert.equal(payload.asr.fallbackMode, true)
assert.equal(payload.asr.availableProviders.openai.implemented, true)
assert.equal(payload.routes.transcribe.path, '/api/transcribe')
assert.equal(JSON.stringify(payload).includes('sk-'), false)

console.log('Provider status route: no-key fallback and redaction checks passed')
