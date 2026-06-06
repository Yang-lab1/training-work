import type {
  BaselinePrompt,
  CompanyPrepBrief,
  MockInterview,
  MockInterviewTurn,
  TargetJob,
  VoiceScoreBreakdown,
  VoiceTurnResult,
} from '../types'

export type AdapterKind = 'ASR' | 'TTS' | 'LLM' | 'RAG' | 'WEB_RESEARCH' | 'VIDEO_CAPTURE'

export interface ApiAdapterStatus {
  kind: AdapterKind
  name: string
  status: 'mock'
  future_endpoint: string
  current_behavior: string
}

export const apiAdapters: ApiAdapterStatus[] = [
  {
    kind: 'ASR',
    name: '语音转文字接口',
    status: 'mock',
    future_endpoint: '/api/asr/transcribe',
    current_behavior: '根据题目类型生成模拟转写，保留文本修正入口。',
  },
  {
    kind: 'TTS',
    name: '面试官语音接口',
    status: 'mock',
    future_endpoint: '/api/tts/interviewer',
    current_behavior: '显示面试官正在提问和声波状态，不播放真实音频。',
  },
  {
    kind: 'LLM',
    name: '追问与评分接口',
    status: 'mock',
    future_endpoint: '/api/coach/score',
    current_behavior: '按内容、表达、语言三类生成模拟评分和追问。',
  },
  {
    kind: 'RAG',
    name: '检索接口',
    status: 'mock',
    future_endpoint: '/api/rag/retrieve',
    current_behavior: '把个人、岗位、知识、真实面试四个库的来源标签返回给训练卡。',
  },
  {
    kind: 'WEB_RESEARCH',
    name: '公司资料抓取接口',
    status: 'mock',
    future_endpoint: '/api/research/company',
    current_behavior: '公司定向入口先生成示例公司画像，不抓取官网、公众号或公开资料。',
  },
  {
    kind: 'VIDEO_CAPTURE',
    name: '视频 / 面部状态识别接口',
    status: 'mock',
    future_endpoint: '/api/video/capture',
    current_behavior: '面试舱只显示摄像头占位和候选人状态，不做真实视频分析。',
  },
]

export function mockAsrTranscribe({
  prompt,
  fallbackText,
  durationSeconds,
  mode,
}: {
  prompt: string
  fallbackText?: string
  durationSeconds: number
  mode: string
}) {
  if (fallbackText?.trim()) return fallbackText.trim()
  const durationLabel = durationSeconds > 0 ? `${durationSeconds} 秒` : '一小段'
  return `这是一次 ${mode} 的模拟转写。我先回答问题：${prompt}。我的结构是先说背景和问题，再说我的角色、关键决策、结果指标，最后把这个经历连接到目标岗位。整段回答大约 ${durationLabel}，下一轮我会把证据和岗位匹配句说得更靠前。`
}

export function mockScoreVoiceAnswer({
  transcript,
  durationSeconds,
  limitSeconds,
  language,
}: {
  transcript: string
  durationSeconds: number
  limitSeconds: number
  language: string
}): VoiceScoreBreakdown {
  const hasEvidence = /指标|结果|证据|决策|用户|问题|role|metric|result|decision/i.test(transcript)
  const tooLong = durationSeconds > limitSeconds
  const tooShort = transcript.length < 60
  const base = hasEvidence ? 76 : 64
  return {
    content: Math.max(45, Math.min(95, base + (tooShort ? -8 : 4))),
    expression: Math.max(42, Math.min(94, 74 + (tooLong ? -9 : 3) + (tooShort ? -5 : 0))),
    language: Math.max(40, Math.min(94, language.includes('英文') ? 70 : 78)),
  }
}

export function mockVoiceTurn({
  prompt,
  question,
  fallbackText,
  durationSeconds,
}: {
  prompt: BaselinePrompt
  question?: string
  fallbackText?: string
  durationSeconds: number
}): VoiceTurnResult {
  const activeQuestion = question ?? prompt.question
  const transcript = mockAsrTranscribe({
    prompt: activeQuestion,
    fallbackText,
    durationSeconds,
    mode: prompt.type,
  })
  const score = mockScoreVoiceAnswer({
    transcript,
    durationSeconds,
    limitSeconds: prompt.time_limit_seconds,
    language: prompt.language,
  })
  return {
    turn_id: `voice_${Date.now()}`,
    question: activeQuestion,
    transcript,
    duration_seconds: durationSeconds,
    stuck: durationSeconds < 35,
    over_time: durationSeconds > prompt.time_limit_seconds,
    score,
    feedback: [
      score.content >= 75 ? '内容能答到问题，下一步压缩开头。' : '内容还需要更明确回答问题本身。',
      score.expression >= 75 ? '表达节奏基本可用。' : '表达出现卡顿或节奏不稳，需要重录短版。',
      score.language >= 75 ? '语言表达能支撑追问。' : '语言完整度还不够，建议先练短句。',
    ],
    created_at: new Date().toISOString(),
  }
}

export function mockInterviewerLine(question: string) {
  return `面试官：${question}`
}

export function mockFollowUp(question: string) {
  return `追问：如果时间更少、证据更少，你会如何用 30 秒讲清楚这道题？原题是：${question}`
}

export function mockCompanyResearch(job: TargetJob) {
  return {
    company_profile: '公司画像：团队关注产品落地、指标定义和跨职能推进。',
    research_note: `真实 API 版会读取官网、公众号和公开资料；当前基于「${job.role_title}」岗位卡、用户资料和题库生成定向准备。`,
  }
}

export function buildMockInterviewRecord({
  userId,
  job,
  interviewType,
  questions,
  turns,
  prepBrief,
}: {
  userId: string
  job: TargetJob
  interviewType: string
  questions: string[]
  turns: MockInterviewTurn[]
  prepBrief?: CompanyPrepBrief
}): MockInterview {
  const score =
    turns.length > 0
      ? Math.round(
          turns.reduce((sum, turn) => sum + turn.score.content + turn.score.expression + turn.score.language, 0) /
            (turns.length * 3),
        )
      : 62
  return {
    mock_id: `mock_${Date.now()}`,
    user_id: userId,
    target_job_id: job.job_id,
    interview_type: interviewType,
    questions,
    turns,
    score,
    feedback: [
      '模拟面试舱已按一题一答记录转写，并保留追问上下文。',
      score >= 75 ? '可以进入下一轮岗位定向训练。' : '建议先复练项目讲解和压力追问。',
      'Review 页面会区分准备包命中、换问法和临场延伸，再反哺题库。',
    ],
    generated_from_sources: prepBrief
      ? [
          '公司/岗位准备包底层理解（非固定题库）',
          '公司业务与岗位 JD',
          '用户 CV / 项目资料',
          '真实题库与上轮模拟表现',
          '面试官临场追问逻辑',
        ]
      : ['个人资料库', '岗位市场数据库', '面试知识/教学资料库', '真实面试数据库'],
    prep_brief_id: prepBrief?.brief_id,
    status: 'finished',
    created_at: new Date().toISOString(),
  }
}
