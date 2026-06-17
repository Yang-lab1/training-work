import type { SynthesizeSpeechRequest, SynthesizeSpeechSuccess, TTSProviderName } from '../../../../src/lib/tts/types.js'

export const mockTtsStatus = { implemented: true, note: 'Mock TTS 始终可用；前端会回退到浏览器临时语音。' }

export async function synthesizeWithMock(
  input: SynthesizeSpeechRequest,
  provider: TTSProviderName = 'mock',
  rawProviderNote?: string,
): Promise<SynthesizeSpeechSuccess> {
  return {
    success: true,
    provider,
    model: provider === 'mock_fallback' ? 'mock-tts-fallback' : 'mock-tts-v1',
    generatedAt: new Date().toISOString(),
    rawProviderNote: rawProviderNote || `Mock TTS：${input.text.slice(0, 40)}`,
  }
}
