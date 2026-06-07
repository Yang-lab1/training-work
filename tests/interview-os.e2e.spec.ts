import { expect, test } from '@playwright/test'
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
      公司业务: '企业 AI 办公产品',
      岗位内容: '负责 AI 办公产品体验和需求拆解',
      岗位要求: '理解 AI 产品、用户场景和原型验证',
      匹配理由: '适合 AI 产品训练',
    },
  ])
  XLSX.utils.book_append_sheet(workbook, sheet, '正式岗_校招岗')
  XLSX.writeFile(workbook, path)
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/transcribe', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        provider: 'mock',
        transcript: '这是模拟转写文本。我正在准备测试科技公司的AI产品实习生，背景结合 AI 学习、产品体验和 Miro 项目验证。',
        language: 'zh',
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
        roleFitFeedback: '面向测试科技公司的AI产品实习生，需要突出 AI 办公产品场景。',
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
          companySummary: '测试科技公司主要做企业 AI 办公产品，候选人需要讲清业务场景和 AI 落地价值。',
          productAndBusiness: '核心业务是企业 AI 办公产品，岗位重点是需求拆解、用户体验和 MVP 验证。',
          jobRequirementBreakdown: ['理解 AI 办公场景', '能拆解产品需求', '能用项目证据说明岗位匹配'],
          workContentPrediction: ['梳理用户场景', '输出需求文档或原型', '协同研发和设计验证 MVP'],
          candidateFit: ['AI 学习经历', 'Miro 项目', '产品体验与设计背景'],
          riskPoints: ['不要只讲概念', '需要补充具体结果', '避免背准备包原文'],
          selfIntroductionStrategy: '开头直接说明申请测试科技公司的 AI产品实习生，中段讲 AI 学习和 Miro 项目，结尾回到企业 AI 办公产品。',
          miroProjectStrategy: 'Miro 项目要讲用户协作场景、AI 作用、MVP 取舍和验证结果。',
          likelyQuestions: [
            { question: '为什么选择测试科技公司？', whyItMatters: '考察公司理解。', framework: '公司业务-个人证据-岗位贡献' },
            { question: '你如何理解 AI 办公产品？', whyItMatters: '考察业务理解。', framework: '用户-场景-价值' },
            { question: '请讲 Miro 项目。', whyItMatters: '考察项目表达。', framework: '项目七步法' },
            { question: '你如何验证 AI 产品方案？', whyItMatters: '考察指标意识。', framework: '假设-指标-MVP' },
            { question: '你如何协作研发？', whyItMatters: '考察沟通能力。', framework: '目标-分工-产出' },
            { question: '你的短板是什么？', whyItMatters: '考察风险认知。', framework: '承认-迁移-补齐' },
            { question: '入职第一个月怎么做？', whyItMatters: '考察岗位日常。', framework: '了解-对齐-交付' },
            { question: '你和普通转型候选人有什么不同？', whyItMatters: '考察复合优势。', framework: '定位-证据-价值' },
          ],
          fullScoreAnswerFrameworks: [
            {
              question: '为什么选择测试科技公司？',
              frameworkName: '宝洁八大问',
              answerStructure: ['动机', '公司业务', '项目证据', '岗位贡献'],
              candidateEvidence: ['AI 学习', 'Miro 项目'],
              pitfalls: ['不要泛泛说喜欢 AI'],
            },
            {
              question: '请讲 Miro 项目。',
              frameworkName: '项目七步法',
              answerStructure: ['用户', '问题', '行动', 'MVP', '结果', '岗位关系'],
              candidateEvidence: ['Miro 项目', '产品体验'],
              pitfalls: ['不要讲成作品介绍'],
            },
          ],
          preparationTasks: ['重练自我介绍', '重讲 Miro 项目', '准备 3 个追问'],
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
          { id: 'q-2', type: 'role_fit', question: '为什么选择测试科技公司和 AI产品实习生？', source: 'selectedJob', expectedFocus: '公司业务、岗位动机、个人贡献。', followUpPolicy: '追问公司理解。' },
          { id: 'q-3', type: 'project', question: '请讲一下 Miro 项目。', source: 'miroProject', expectedFocus: '用户、场景、AI作用、MVP取舍。', followUpPolicy: '追问验证结果。' },
          { id: 'q-4', type: 'role_fit', question: '你从设计转 AI 产品的优势是什么？', source: 'selectedJob', expectedFocus: '迁移能力和风险认知。', followUpPolicy: '追问短板。' },
          { id: 'q-5', type: 'technical_basic', question: '你如何验证 AI 产品功能有效？', source: 'selectedJob', expectedFocus: '假设、指标、MVP。', followUpPolicy: '追问指标。' },
          { id: 'q-6', type: 'pressure', question: '如果认为你经验不够，你怎么回应？', source: 'mockProvider', expectedFocus: '承认差距、迁移证据。', followUpPolicy: '追问最强证据。' },
        ],
      }),
    })
  })

  await page.route('**/api/generate-follow-up', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        provider: 'mock',
        model: 'mock-follow-up-v1',
        generatedAt: new Date().toISOString(),
        followUpQuestion: { id: 'q-follow', type: 'follow_up', question: '请补充一个具体结果。', source: 'mockProvider', expectedFocus: '具体结果。', followUpPolicy: '追问验证证据。' },
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
          summary: '整场模拟面试已完成，岗位匹配基本清楚。',
          strongestAnswer: '中文自我介绍',
          weakestAnswer: 'Miro 项目讲解',
          recurringProblems: ['项目结果还可以更具体'],
          roleFitAssessment: '需要持续回到测试科技公司和 AI产品实习生。',
          communicationAssessment: '表达清楚，铺垫可减少。',
          projectDepthAssessment: '补充用户、场景和验证指标。',
          englishAssessment: '英文短句清楚即可。',
          nextTrainingPlan: ['重练 Miro 项目', '准备为什么选择公司'],
        },
      }),
    })
  })
})

test('dogfood: 上传岗位表到 AI 反馈和备份导出闭环', async ({ page }, testInfo) => {
  const fixturePath = testInfo.outputPath('job.xlsx')
  await writeJobFixture(fixturePath)

  await page.goto('/')
  await expect(page.locator('.top-nav nav button')).toHaveCount(8)
  await expect(page.getByText('今日训练')).toBeVisible()

  await page.getByRole('button', { name: /资料与岗位/ }).click()
  await page.locator('input[accept=".xlsx"]').setInputFiles(fixturePath)
  await expect(page.getByText(/已解析 1 个岗位/)).toBeVisible()
  await expect(page.getByText('测试科技公司 · AI产品实习生')).toBeVisible()
  await page.getByRole('button', { name: '选择岗位' }).click()
  await expect(page.getByText('测试科技公司 · AI产品实习生')).toBeVisible()

  await page.reload()
  await expect(page.getByText('测试科技公司 · AI产品实习生')).toBeVisible()

  await page.getByRole('button', { name: /^训练$/ }).click()
  await expect(page.getByText(/测试科技公司 · AI产品实习生/)).toBeVisible()
  await expect(page.locator('.training-task').first()).toContainText('AI产品实习生')

  const firstTask = page.locator('.training-task').first()
  await firstTask.getByRole('button', { name: /开始录音/ }).click()
  await page.waitForTimeout(900)
  await firstTask.getByRole('button', { name: /^停止$/ }).click()
  await expect(firstTask.getByText(/已保存录音/)).toBeVisible()

  await page.getByRole('button', { name: /AI 反馈/ }).click()
  await page.getByRole('button', { name: /处理反馈/ }).first().click()
  await page.getByRole('button', { name: /生成转写|重新转写/ }).click()
  await expect(page.getByText(/已生成模拟转写/)).toBeVisible()
  await page.getByRole('button', { name: /生成 AI 反馈/ }).click()
  await expect(page.getByText(/AI 反馈已保存/)).toBeVisible()
  await expect(page.getByText('总分')).toBeVisible()
  await expect(page.getByText(/主要问题/)).toBeVisible()
  await expect(page.getByText(/30 秒优化版/)).toBeVisible()
  await expect(page.getByText('下一步任务', { exact: true })).toBeVisible()

  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('interview-os-personal-mvp-v1') || '{}'))
  expect(state.history[0].selectedJob.jobTitle).toBe('AI产品实习生')
  expect(state.history[0].transcript.text).toContain('测试科技公司')
  expect(state.history[0].aiFeedback.score).toBe(82)

  await page.reload()
  await page.getByRole('button', { name: 'AI 反馈', exact: true }).click()
  await expect(page.getByText(/AI 82 分/)).toBeVisible()

  await page.getByRole('button', { name: /岗位准备包/ }).click()
  await page.getByRole('button', { name: /生成岗位准备包/ }).click()
  await expect(page.getByText(/公司业务总结/)).toBeVisible()
  await expect(page.getByText(/岗位要求拆解/)).toBeVisible()
  await expect(page.getByText(/为什么选择测试科技公司/)).toHaveCount(2)
  await expect(page.getByText(/项目七步法/)).toHaveCount(2)

  const packState = await page.evaluate(() => JSON.parse(localStorage.getItem('interview_os_job_packs') || '[]'))
  expect(packState[0].jobPack.companySummary).toContain('测试科技公司')

  await page.reload()
  await page.getByRole('button', { name: /岗位准备包/ }).click()
  await expect(page.getByText(/测试科技公司主要做企业 AI 办公产品/)).toBeVisible()

  await page.getByRole('button', { name: /模拟面试/ }).click()
  await expect(page.getByText(/岗位定向模拟/)).toBeVisible()
  await page.getByRole('button', { name: /开始一轮模拟面试/ }).click()
  await expect(page.getByText(/请用中文做一个 90 秒自我介绍/)).toBeVisible()
  await expect(page.getByText(/1\/6/)).toBeVisible()
  await page.getByRole('button', { name: /回答本题/ }).click()
  await page.waitForTimeout(900)
  await page.getByRole('button', { name: /^停止$/ }).click()
  await expect(page.getByText(/已保存本题录音/)).toBeVisible()
  await page.getByRole('button', { name: /生成转写/ }).click()
  await expect(page.getByText(/已生成模拟转写/)).toBeVisible()
  await page.getByRole('button', { name: /生成单题反馈/ }).click()
  await expect(page.getByText(/本题 AI 反馈已保存/)).toBeVisible()
  await page.getByRole('button', { name: /下一题/ }).click()
  await expect(page.getByText(/为什么选择测试科技公司/)).toBeVisible()
  await page.getByRole('button', { name: /结束并生成整场复盘/ }).click()
  await expect(page.getByText(/整场复盘已生成/)).toBeVisible()
  await expect(page.getByText(/整场分数/)).toBeVisible()

  const mockInterviewState = await page.evaluate(() => JSON.parse(localStorage.getItem('interview_os_mock_interviews') || '[]'))
  expect(mockInterviewState[0].finalReport.report.overallScore).toBe(84)

  await page.getByRole('button', { name: /数据备份/ }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /导出 JSON/ }).click()
  const download = await downloadPromise
  const backupPath = await download.path()
  expect(backupPath).toBeTruthy()
  const backup = await import('node:fs/promises').then((fs) => fs.readFile(backupPath!, 'utf8')).then(JSON.parse)
  expect(backup.selectedJob.jobTitle).toBe('AI产品实习生')
  expect(backup.trainingRecords[0].transcript.text).toContain('测试科技公司')
  expect(backup.trainingRecords[0].aiFeedback.score).toBe(82)
  expect(backup.jobPacks[0].jobPack.companySummary).toContain('测试科技公司')
  expect(backup.mockInterviews[0].finalReport.report.overallScore).toBe(84)

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(hasHorizontalOverflow).toBe(false)
})
