import { expect, test } from '@playwright/test'
import * as fs from 'node:fs/promises'
import * as XLSX from 'xlsx'

async function writeJobFixture(path: string) {
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.json_to_sheet([
    {
      公司名称: '测试科技公司',
      岗位名称: 'AI产品实习生',
      城市: '深圳',
      薪资: '面议',
      主线分类: 'AI应用产品',
      申请优先级: 'A',
      岗位类型: '实习',
      招聘链接: 'https://example.com/job',
      公司业务: '企业 AI 应用平台',
      岗位内容: '负责 AI 产品需求分析、原型设计和落地协作',
      岗位要求: '理解 AI 应用、良好沟通、用户场景分析',
      匹配理由: '适合 AI 产品训练',
    },
  ])
  XLSX.utils.book_append_sheet(workbook, sheet, '正式岗_校招岗')
  XLSX.writeFile(workbook, path)
}

async function writeTextFixture(path: string) {
  await fs.writeFile(
    path,
    '测试科技公司是一家企业 AI 应用平台公司，主要为制造业和跨境电商团队提供 AI 工作流、知识库和智能客服解决方案。近期重点方向包括 AI Agent、RAG 知识库和业务流程自动化。',
    'utf8',
  )
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/transcribe', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        provider: 'mock',
        model: 'mock-asr-v1',
        transcript: [
          '面试官：请先做一下自我介绍。',
          '用户：我正在准备测试科技公司的AI产品实习生，背景结合 AI 学习、产品体验和 Miro 项目。',
          '面试官：你为什么从设计转向 AI 产品？',
          '用户：我希望把设计、用户场景和 AI 应用落地结合起来。',
          '面试官：你能讲一下 Miro 项目吗？',
          '用户：Miro 是一个跨文化沟通训练系统，我负责需求拆解、MVP 取舍和验证。',
        ].join('\n'),
        language: 'zh',
        durationSeconds: 96,
        generatedAt: new Date().toISOString(),
      }),
    })
  })

  await page.route('**/api/analyze-answer', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        provider: 'mock',
        model: 'mock-v2',
        generatedAt: new Date().toISOString(),
        score: 82,
        summary: '回答能覆盖岗位和项目，但还可以压缩表达。',
        strengths: ['提到了 AI 学习和 Miro 项目。'],
        problems: ['项目结果还可以更具体。'],
        roleFitFeedback: '面向测试科技公司的AI产品实习生，需要突出企业 AI 应用平台场景。',
        structureFeedback: '按结论-证据-结果-岗位关系组织。',
        expressionFeedback: '减少重复连接词。',
        timingFeedback: '控制在目标时长内。',
        fluencyFeedback: '后续接入真实 ASR 后分析停顿和语速。',
        memorizationRisk: '当前无法仅凭文本判断真实背稿风险。',
        specificityFeedback: '补充用户、场景、AI作用和MVP取舍。',
        improvedShortVersion: '我正在申请测试科技公司的AI产品实习生，能用 AI 与产品项目经验支持岗位需求。',
        improvedLongVersion: '我正在申请测试科技公司的AI产品实习生。我的背景结合 AI 学习、产品体验和 Miro 项目经验，能够从用户场景出发拆解需求、设计 MVP 并验证结果。',
        nextTasks: ['重练 30 秒压缩版。', '补充一个可验证结果。'],
      }),
    })
  })

  await page.route('**/api/generate-job-pack', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        provider: 'mock',
        model: 'mock-job-pack-v1',
        generatedAt: new Date().toISOString(),
        jobPack: {
          companySummary: '测试科技公司主要做企业 AI 应用平台。',
          productAndBusiness: '核心业务是 AI 工作流、知识库和智能客服。',
          jobRequirementBreakdown: ['理解 AI 应用平台', '能拆解产品需求', '能和研发设计协作'],
          workContentPrediction: ['用户场景分析', '需求文档输出', 'MVP 验证'],
          candidateFit: ['AI 学习经历', 'Miro 项目', '产品体验背景'],
          riskPoints: ['项目结果不够量化', '公司资料理解需要更具体'],
          selfIntroductionStrategy: '开头直接定位测试科技公司 AI产品实习生。',
          miroProjectStrategy: 'Miro 项目要讲用户、场景、AI作用、MVP取舍和验证结果。',
          likelyQuestions: Array.from({ length: 8 }, (_, index) => ({
            question: index === 0 ? '为什么选择测试科技公司？' : `高频问题 ${index + 1}`,
            whyItMatters: '考察岗位理解。',
            framework: 'STAR / 项目七步法',
          })),
          fullScoreAnswerFrameworks: [
            {
              question: '为什么选择测试科技公司？',
              frameworkName: '宝洁八大问',
              answerStructure: ['动机', '公司业务', '项目证据', '岗位贡献'],
              candidateEvidence: ['AI 学习', 'Miro 项目'],
              pitfalls: ['不要泛泛而谈'],
            },
            {
              question: '请讲 Miro 项目。',
              frameworkName: '项目七步法',
              answerStructure: ['用户', '问题', '行动', 'MVP', '结果', '岗位关系'],
              candidateEvidence: ['Miro 项目'],
              pitfalls: ['不要讲成作品介绍'],
            },
          ],
          preparationTasks: ['重练自我介绍', '重讲 Miro 项目'],
        },
      }),
    })
  })

  await page.route('**/api/generate-mock-interview', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        provider: 'mock',
        model: 'mock-interview-v1',
        generatedAt: new Date().toISOString(),
        questions: [
          { id: 'q-1', type: 'self_intro', question: '请用中文做一个 90 秒自我介绍。', source: 'selectedJob', expectedFocus: '背景、AI 学习、项目证据、岗位匹配。', followUpPolicy: '追问项目证据。' },
          { id: 'q-2', type: 'role_fit', question: '为什么选择测试科技公司和AI产品实习生？', source: 'selectedJob', expectedFocus: '公司业务、岗位动机、个人贡献。', followUpPolicy: '追问公司理解。' },
          { id: 'q-3', type: 'project', question: '请讲一下 Miro 项目。', source: 'miroProject', expectedFocus: '用户、场景、AI作用、MVP取舍。', followUpPolicy: '追问验证结果。' },
          { id: 'q-4', type: 'role_fit', question: '你从设计转 AI 产品的优势是什么？', source: 'selectedJob', expectedFocus: '迁移能力和风险认知。', followUpPolicy: '追问短板。' },
          { id: 'q-5', type: 'technical_basic', question: '你如何验证 AI 产品功能有效？', source: 'selectedJob', expectedFocus: '假设、指标、MVP。', followUpPolicy: '追问指标。' },
          { id: 'q-6', type: 'pressure', question: '如果认为你经验不够，你怎么回应？', source: 'mockProvider', expectedFocus: '承认差距、迁移证据。', followUpPolicy: '追问最强证据。' },
        ],
      }),
    })
  })

  await page.route('**/api/generate-interview-report', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        provider: 'mock',
        model: 'mock-interview-report-v1',
        generatedAt: new Date().toISOString(),
        finalReport: {
          overallScore: 84,
          summary: '整场模拟面试已完成，岗位匹配基本清晰。',
          strongestAnswer: '中文自我介绍',
          weakestAnswer: 'Miro 项目讲解',
          recurringProblems: ['项目结果还可以更具体'],
          roleFitAssessment: '需要持续回到测试科技公司和AI产品实习生。',
          communicationAssessment: '表达清晰，铺垫可减少。',
          projectDepthAssessment: '补充用户、场景和验证指标。',
          englishAssessment: '英文短句清晰即可。',
          nextTrainingPlan: ['重练 Miro 项目', '准备为什么选择公司'],
        },
      }),
    })
  })

  await page.route('**/api/review-real-interview', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        provider: 'mock',
        model: 'mock-real-interview-v1',
        generatedAt: new Date().toISOString(),
        extractedQuestions: [
          { id: 'real-q-1', question: '请先做一下自我介绍。', category: 'self_intro', confidence: 0.9, sourceSpan: '面试官：请先做一下自我介绍。' },
          { id: 'real-q-2', question: '你为什么从设计转向 AI 产品？', category: 'role_fit', confidence: 0.85, sourceSpan: '面试官：你为什么从设计转向 AI 产品？' },
          { id: 'real-q-3', question: '你能讲一下 Miro 项目吗？', category: 'project', confidence: 0.88, sourceSpan: '面试官：你能讲一下 Miro 项目吗？' },
        ],
        extractedAnswers: [
          { questionId: 'real-q-1', answerText: '我正在准备测试科技公司的AI产品实习生。', durationEstimate: 60, qualityNote: '需要补充结果。' },
        ],
        comparison: {
          predictedByMockInterview: ['请先做一下自我介绍。'],
          predictedByJobPack: ['你能讲一下 Miro 项目吗？'],
          missedQuestions: ['你为什么从设计转向 AI 产品？'],
          newQuestionPatterns: ['转型动机追问'],
          weakAreas: ['岗位匹配证据'],
        },
        reviewReport: {
          overallSummary: '真实面试主要考察自我介绍、转型动机和 Miro 项目。',
          interviewerFocus: ['转型动机', '项目深度', '岗位理解'],
          strongestAnswer: '自我介绍',
          weakestAnswer: 'Miro 项目',
          missedPreparation: ['转型动机准备不足'],
          unexpectedQuestions: ['你为什么从设计转向 AI 产品？'],
          answerQuality: '回答可复盘，但证据密度不足。',
          roleFitAssessment: '岗位匹配需要更早连接测试科技公司的企业 AI 应用平台。',
          nextTrainingTasks: ['重练转型动机 60 秒版本', '把真实问题加入模拟面试'],
          questionBankUpdates: [
            { question: '你为什么从设计转向 AI 产品？', category: 'role_fit', source: 'real_interview', selectedJobId: 'fixture-job', priority: 'high', suggestedPracticeType: 'mockInterview' },
          ],
        },
      }),
    })
  })

  await page.route('**/api/generate-company-knowledge-pack', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        provider: 'mock',
        model: 'mock-company-knowledge-v1',
        generatedAt: new Date().toISOString(),
        companyKnowledgePack: {
          sourceSummary: '已读取公司资料和岗位信息。',
          companyCoreBusiness: '测试科技公司是一家企业 AI 应用平台公司。',
          productLines: ['AI Agent', 'RAG 知识库', '智能客服'],
          recentSignals: ['AI Agent', '业务流程自动化'],
          roleContext: 'AI产品实习生需要拆解需求、设计原型并推动落地。',
          interviewFocusPrediction: ['公司业务理解', 'Miro 项目迁移', 'AI 应用落地'],
          risksAndUnknowns: ['公开资料仍需二次核验'],
          evidenceMap: [{ claim: '测试科技公司提供企业 AI 应用平台。', sourceId: 'source-1', sourceName: 'company-source.txt', confidence: 'high' }],
          recommendedQuestions: ['你了解我们的企业 AI 应用平台吗？'],
          howToUseInInterview: ['自我介绍开头点出企业 AI 应用平台', '项目回答结尾回到岗位要求'],
        },
      }),
    })
  })
})

test('dogfood: V0.8 real interview and company knowledge loop', async ({ page }, testInfo) => {
  const jobFixturePath = testInfo.outputPath('job.xlsx')
  const companySourcePath = testInfo.outputPath('company-source.txt')
  const realAudioPath = testInfo.outputPath('real-interview.webm')
  await writeJobFixture(jobFixturePath)
  await writeTextFixture(companySourcePath)
  await fs.writeFile(realAudioPath, 'fake audio', 'utf8')

  await page.goto('/')
  await expect(page.locator('.top-nav nav button')).toHaveCount(10)
  await expect(page.getByRole('button', { name: /真实面试复盘/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /公司资料增强/ })).toBeVisible()

  await page.getByRole('button', { name: /资料与岗位/ }).click()
  await page.locator('input[accept=".xlsx"]').setInputFiles(jobFixturePath)
  await expect(page.getByText(/已解析 1 个岗位/)).toBeVisible()
  await page.getByRole('button', { name: '选择岗位' }).click()
  await page.reload()
  await expect(page.getByText(/测试科技公司 · AI产品实习生/)).toBeVisible()

  await page.getByRole('button', { name: /^训练$/ }).click()
  const firstTask = page.locator('.training-task').first()
  await expect(firstTask).toContainText('AI产品实习生')
  await firstTask.getByRole('button', { name: /开始录音/ }).click()
  await page.waitForTimeout(700)
  await firstTask.getByRole('button', { name: /^停止$/ }).click()
  await expect(firstTask.getByText(/已保存录音/)).toBeVisible()

  await page.getByRole('button', { name: /AI 反馈/ }).click()
  await page.getByRole('button', { name: /处理反馈/ }).first().click()
  await page.getByRole('button', { name: /生成转写|重新转写/ }).click()
  await expect(page.getByText(/已生成模拟转写/)).toBeVisible()
  await page.getByRole('button', { name: /生成 AI 反馈/ }).click()
  await expect(page.getByText(/AI 反馈已保存/)).toBeVisible()

  await page.getByRole('button', { name: /岗位准备包/ }).click()
  await page.getByRole('button', { name: /生成岗位准备包/ }).click()
  await expect(page.getByText(/测试科技公司主要做企业 AI 应用平台/)).toBeVisible()

  await page.getByRole('button', { name: /模拟面试/ }).click()
  await page.getByRole('button', { name: /开始一轮模拟面试/ }).click()
  await expect(page.getByText(/请用中文做一个 90 秒自我介绍/)).toBeVisible()
  await page.getByRole('button', { name: /回答本题/ }).click()
  await page.waitForTimeout(700)
  await page.getByRole('button', { name: /^停止$/ }).click()
  await page.getByRole('button', { name: /生成转写/ }).click()
  await page.getByRole('button', { name: /生成单题反馈/ }).click()
  await expect(page.getByText(/本题 AI 反馈已保存/)).toBeVisible()
  await page.getByRole('button', { name: /结束并生成整场复盘/ }).click()
  await expect(page.getByText(/整场分数/)).toBeVisible()

  await page.getByRole('button', { name: /真实面试复盘/ }).click()
  await page.locator('input[accept="audio/*,.webm,.wav,.mp3,.m4a,.aac,.ogg,.mp4"]').setInputFiles(realAudioPath)
  await expect(page.getByText(/真实面试录音已保存/)).toBeVisible()
  await page.getByRole('button', { name: /生成转写/ }).first().click()
  await expect(page.getByText(/已生成模拟真实面试转写/)).toBeVisible()
  await page.getByRole('button', { name: /生成真实复盘/ }).first().click()
  await expect(page.getByText(/真实面试复盘已生成/)).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: /你为什么从设计转向 AI 产品/ }).first()).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: /真实面试复盘/ }).click()
  await expect(page.getByText(/真实面试主要考察自我介绍/)).toBeVisible()

  await page.getByRole('button', { name: /公司资料增强/ }).click()
  await page.locator('input[accept=".txt,.md,.html,text/plain,text/markdown,text/html"]').first().setInputFiles(companySourcePath)
  await expect(page.getByText(/公司资料已读取/)).toBeVisible()
  await page.getByRole('button', { name: /生成公司知识包/ }).click()
  await expect(page.getByText(/测试科技公司是一家企业 AI 应用平台公司/)).toBeVisible()
  await expect(page.getByText(/证据地图/)).toBeVisible()

  await page.getByRole('button', { name: /岗位准备包/ }).click()
  await page.getByRole('button', { name: /重新生成/ }).click()
  await expect(page.getByText(/测试科技公司主要做企业 AI 应用平台/)).toBeVisible()

  await page.getByRole('button', { name: /数据备份/ }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /导出 JSON/ }).click()
  const download = await downloadPromise
  const backupPath = await download.path()
  expect(backupPath).toBeTruthy()
  const backup = JSON.parse(await fs.readFile(backupPath!, 'utf8'))
  expect(backup.selectedJob.jobTitle).toBe('AI产品实习生')
  expect(backup.jobPacks[0].jobPack.companySummary).toContain('测试科技公司')
  expect(backup.mockInterviews[0].finalReport.report.overallScore).toBe(84)
  expect(backup.realInterviews[0].reviewReport.questionBankUpdates[0].question).toContain('设计转向 AI 产品')
  expect(backup.questionBank[0].question).toContain('设计转向 AI 产品')
  expect(backup.companySources[0].sourceName).toBe('company-source.txt')
  expect(backup.companyKnowledgePacks[0].companyKnowledgePack.evidenceMap[0].sourceName).toBe('company-source.txt')

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(hasHorizontalOverflow).toBe(false)
})
