import type { TranscribeRequest, TranscribeSuccess } from '../../../../src/lib/asr/types.js'

export async function transcribeWithMock(
  input: TranscribeRequest,
  provider: 'mock' | 'mock_fallback' = 'mock',
  note?: string,
): Promise<TranscribeSuccess> {
  const company = input.selectedJob?.companyName || '目标公司'
  const role = input.selectedJob?.jobTitle || '目标岗位'
  const language = input.trainingType === 'englishIntro' ? 'en' : 'zh'
  const transcript = input.trainingType === 'englishIntro'
    ? `This is a mock transcript for the ${role} role at ${company}. My background combines AI learning, product thinking, and hands-on project work.`
    : input.trainingType === 'miroProject'
      ? `这是模拟转写文本。我在 Miro 项目中从用户协作场景出发，完成需求拆解、原型设计和 MVP 验证，并说明这段经历如何匹配${company}的${role}。`
      : `这是模拟转写文本。我正在准备${company}的${role}，我的背景结合了 AI 学习、产品体验和设计实践，并通过具体项目说明岗位匹配。`
  return {
    success: true,
    provider,
    transcript,
    language,
    generatedAt: new Date().toISOString(),
    rawProviderNote: note || '当前未上传音频到真实 ASR，返回模拟转写用于验证流程。',
  }
}
