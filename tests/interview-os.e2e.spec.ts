import { expect, test } from '@playwright/test'
import * as fs from 'node:fs/promises'
import * as XLSX from 'xlsx'

type TestJob = {
  id: string
  jobTitle: string
  normalized: {
    roleFamily: string
    riskFlags: string[]
  }
}

async function writeJobFixture(path: string) {
  const workbook = XLSX.utils.book_new()
  const rows = [
    ['测试科技公司', 'AI Product Manager', '深圳', '面议', 'AI应用产品', 'A', '正式', 'https://example.com/ai-pm', '企业 AI 应用平台', '负责 AI Agent、RAG 知识库和产品需求分析', '理解 AI 应用、用户场景和产品落地'],
    ['测试科技公司', 'AI产品经理', '深圳', '面议', 'AI应用产品', 'A', '正式', 'https://example.com/ai-product', '企业 AI 应用平台', '负责大模型产品规划、原型设计和研发协作', '理解 LLM、Agent、RAG 产品'],
    ['测试科技公司', '大模型产品经理', '深圳', '面议', '大模型产品', 'A', '正式', 'https://example.com/llm-pm', '企业 AI 应用平台', '负责大模型产品需求拆解和 MVP 验证', '理解大模型、知识库和工作流'],
    ['测试研究中心', '用户研究实习生', '香港', '面议', '用户研究', 'B', '实习', 'https://example.com/uxr', 'AI 用户体验研究', '负责用户访谈、体验分析、可用性测试', '用户研究、HCI、跨文化场景分析'],
    ['测试体验设计公司', '产品体验设计', '广州', '面议', '产品体验', 'B', '正式', 'https://example.com/pxd', 'AI 产品体验设计', '负责产品体验策略、原型和用户洞察', '产品体验设计、用户洞察、HCI'],
    ['测试 AI 公司', 'AI应用开发', '深圳', '面议', 'AI解决方案', 'B', '正式', 'https://example.com/ai-dev', 'AI 解决方案交付', '负责 AI 应用开发、后端接口和方案落地', 'Python、后端开发、AI Implementation'],
    ['测试 AI 公司', 'Forward Deployed Engineer', '香港', '面议', 'FDE', 'B', '正式', 'https://example.com/fde', 'AI 解决方案交付', '负责客户现场 AI 应用落地和产品工程', 'Forward Deployed Engineer、AI Product Engineer、客户沟通'],
    ['测试云公司', '后端开发工程师', '深圳', '25K', '云平台', 'C', '社招', 'https://example.com/backend', '云原生平台', '负责 Java、Go、K8s、SRE 和后端平台开发', '强代码、云原生、3 年以上经验'],
    ['测试销售公司', '销售经理', '广州', '底薪+提成', '销售', 'C', '社招', 'https://example.com/sales', '企业服务销售', '负责 BD、拓客、客户开发和业绩指标', '销售经验、客户开发、业绩指标'],
  ]
  const sheet = XLSX.utils.json_to_sheet(rows.map((row) => ({
    公司名称: row[0],
    岗位名称: row[1],
    城市: row[2],
    薪资: row[3],
    主线分类: row[4],
    申请优先级: row[5],
    岗位类型: row[6],
    招聘链接: row[7],
    公司业务: row[8],
    岗位内容: row[9],
    岗位要求: row[10],
  })))
  XLSX.utils.book_append_sheet(workbook, sheet, '正式岗_校招岗')
  XLSX.writeFile(workbook, path)
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/provider-status', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        ai: {
          provider: 'deepseek',
          configured: false,
          fallbackMode: true,
          availableProviders: {
            mock: { configured: true, implemented: true, fallbackMode: true, model: 'mock-v2', note: 'Mock 文本 Provider 始终可用。' },
            deepseek: { configured: false, implemented: true, fallbackMode: true, model: 'deepseek-chat', note: '缺少 DEEPSEEK_API_KEY，会回退到 Mock。' },
            agnes: { configured: false, implemented: false, fallbackMode: true, note: '预留 AGNES。' },
            doubao: { configured: false, implemented: false, fallbackMode: true, note: '预留豆包。' },
            openai: { configured: false, implemented: false, fallbackMode: true, note: '预留 OpenAI 文本。' },
            gemini: { configured: false, implemented: false, fallbackMode: true, note: '预留 Gemini。' },
          },
        },
        asr: {
          provider: 'openai',
          configured: false,
          fallbackMode: true,
          availableProviders: {
            mock: { configured: true, implemented: true, fallbackMode: true, model: 'mock-asr-v1', note: 'Mock ASR 始终可用。' },
            openai: { configured: false, implemented: true, fallbackMode: true, model: 'whisper-1', note: '缺少 OPENAI_API_KEY，已回退到 Mock ASR。' },
          },
        },
        routes: {
          providerStatus: { path: '/api/provider-status', method: 'GET', available: true, mockSafe: true },
          analyzeAnswer: { path: '/api/analyze-answer', method: 'POST', available: true, mockSafe: true },
          transcribe: { path: '/api/transcribe', method: 'POST', available: true, mockSafe: true },
          generateJobPack: { path: '/api/generate-job-pack', method: 'POST', available: true, mockSafe: true },
          generateMockInterview: { path: '/api/generate-mock-interview', method: 'POST', available: true, mockSafe: true },
          reviewRealInterview: { path: '/api/review-real-interview', method: 'POST', available: true, mockSafe: true },
          generateCompanyKnowledgePack: { path: '/api/generate-company-knowledge-pack', method: 'POST', available: true, mockSafe: true },
        },
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
          companySummary: '测试科技公司做企业 AI 应用平台。',
          productAndBusiness: '核心方向是 AI Agent、RAG 知识库和工作流。',
          jobRequirementBreakdown: ['AI 产品理解', '需求拆解', '跨团队协作'],
          workContentPrediction: ['梳理用户场景', '定义 MVP', '跟进研发落地'],
          candidateFit: ['AI 学习背景', '工业设计和体验', 'Miro 项目'],
          riskPoints: ['项目结果需要更量化'],
          selfIntroductionStrategy: '先讲 AI 产品定位，再讲项目证据。',
          miroProjectStrategy: '讲用户、场景、AI 作用和 MVP 取舍。',
          likelyQuestions: [{ question: '为什么选择这个岗位？', whyItMatters: '岗位动机', framework: '结论-证据-岗位关系' }],
          fullScoreAnswerFrameworks: [{ question: '介绍一个项目', frameworkName: 'STAR', answerStructure: ['背景', '行动', '结果'], candidateEvidence: ['Miro 项目'], pitfalls: ['不要泛泛而谈'] }],
          preparationTasks: ['重练自我介绍', '准备 Miro 项目指标'],
        },
      }),
    })
  })

  await page.route('**/api/transcribe', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        provider: 'mock',
        model: 'mock-asr-v1',
        transcript: '这是模拟转写。我正在面试测试科技公司的 AI Product Manager，会结合 AI 应用平台、Miro 项目和用户场景说明岗位匹配。',
        language: 'zh',
        durationSeconds: 68,
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
        summary: '回答覆盖岗位和项目，但结果还可以更具体。',
        strengths: ['提到 AI 应用平台和 Miro 项目。'],
        problems: ['项目结果不够具体。'],
        roleFitFeedback: '要突出企业 AI 应用平台场景。',
        structureFeedback: '按背景-行动-结果-岗位关系重讲。',
        expressionFeedback: '减少铺垫。',
        timingFeedback: '控制在目标时长内。',
        fluencyFeedback: '真实 ASR 接入后再看停顿。',
        memorizationRisk: '背稿风险低。',
        specificityFeedback: '补充用户、场景、AI 作用和 MVP 取舍。',
        improvedShortVersion: '30 秒优化版。',
        improvedLongVersion: '90 秒优化版。',
        nextTasks: ['重练 Miro 项目', '补充一个可验证结果'],
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
          { id: 'q-2', type: 'role_fit', question: '为什么选择测试科技公司和 AI Product Manager？', source: 'selectedJob', expectedFocus: '公司业务、岗位动机、个人贡献。', followUpPolicy: '追问公司理解。' },
          { id: 'q-3', type: 'project', question: '请讲一个 Miro 项目。', source: 'miroProject', expectedFocus: '用户、场景、AI作用、MVP取舍。', followUpPolicy: '追问验证结果。' },
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
          recurringProblems: ['项目结果还可以更具体', '公司业务连接可以更紧'],
          roleFitAssessment: '岗位匹配清晰。',
          communicationAssessment: '表达清晰，铺垫可减少。',
          projectDepthAssessment: '项目深度可加强。',
          englishAssessment: '英文短句清晰即可。',
          nextTrainingPlan: ['重练 Miro 项目', '准备为什么选择公司', '补充 AI 产品指标'],
        },
      }),
    })
  })
})

test('dogfood: Daily Driver workbench, shortlist, immersive interview, diagnostics, backup', async ({ page }, testInfo) => {
  const jobFixturePath = testInfo.outputPath('job.xlsx')
  await writeJobFixture(jobFixturePath)

  await page.goto('/')
  await expect(page.locator('.top-nav nav button')).toHaveCount(11)
  await expect(page.getByTestId('daily-workbench')).toBeVisible()
  await expect(page.getByTestId('daily-workbench').locator('button.primary-button')).toHaveCount(1)

  await page.locator('.top-nav nav button').nth(1).click()
  await page.locator('input[accept=".xlsx"]').setInputFiles(jobFixturePath)
  await page.waitForFunction(() => {
    const raw = localStorage.getItem('interview_os_job_pool')
    return raw ? JSON.parse(raw).length === 9 : false
  })

  const jobPool = await page.evaluate<TestJob[]>(() => JSON.parse(localStorage.getItem('interview_os_job_pool') || '[]') as TestJob[])
  expect(jobPool).toHaveLength(9)
  expect(jobPool.filter((job) => job.normalized?.roleFamily === 'AI产品 / AI应用产品')).toHaveLength(3)
  expect(jobPool.filter((job) => job.normalized?.roleFamily === '用户研究 / 产品体验')).toHaveLength(2)
  expect(jobPool.find((job) => job.jobTitle === '后端开发工程师')?.normalized.riskFlags).toContain('strong_code')
  expect(jobPool.find((job) => job.jobTitle === '销售经理')?.normalized.riskFlags).toContain('sales_heavy')

  const aiPmRow = page.locator('.job-row').filter({ hasText: 'AI Product Manager' })
  await aiPmRow.locator('.job-row-actions button').nth(0).click()
  await page.locator('.job-smart-filters select').nth(4).selectOption('shortlisted')
  await expect(page.locator('.job-row')).toHaveCount(1)
  await expect(aiPmRow).toBeVisible()
  await aiPmRow.locator('.job-row-actions button').nth(1).click()
  await page.locator('.job-smart-filters select').nth(4).selectOption('preparing')
  await expect(aiPmRow).toBeVisible()
  await aiPmRow.locator('.job-row-actions button').nth(2).click()

  await page.reload()
  const selectedJob = await page.evaluate(() => JSON.parse(localStorage.getItem('interview_os_selected_job') || 'null'))
  const userStatus = await page.evaluate(() => JSON.parse(localStorage.getItem('interview_os_job_user_status') || '{}'))
  expect(selectedJob.jobTitle).toBe('AI Product Manager')
  expect(selectedJob.normalized.roleFamily).toBe('AI产品 / AI应用产品')
  expect(userStatus[selectedJob.id]).toBe('preparing')

  await page.locator('.top-nav nav button').nth(0).click()
  await expect(page.getByTestId('daily-workbench')).toContainText('生成岗位准备包')

  await page.locator('.top-nav nav button').nth(5).click()
  await page.locator('.primary-flow .primary-button').click()
  await expect(page.locator('.job-pack-report')).toContainText('测试科技公司做企业 AI 应用平台')

  await page.locator('.top-nav nav button').nth(0).click()
  await expect(page.getByTestId('daily-workbench')).toContainText('开始一轮模拟面试')

  await page.locator('.top-nav nav button').nth(6).click()
  await expect(page.getByTestId('interview-lobby')).toBeVisible()
  await page.locator('.interview-lobby .primary-button').click()
  await expect(page.getByTestId('interview-waiting-room')).toBeVisible()
  await page.locator('.interview-waiting-room .primary-button').click()
  await expect(page.getByTestId('interview-room')).toBeVisible()
  await expect(page.getByTestId('virtual-interviewer')).toBeVisible()
  await expect(page.getByTestId('candidate-window')).toBeVisible()
  await expect(page.locator('.meeting-control-bar')).toBeVisible()

  await page.locator('.meeting-status-bar button').click()
  await expect(page.getByTestId('interview-room')).toHaveClass(/meeting-room--fullscreen/)
  await page.locator('.meeting-status-bar button').click()
  await expect(page.getByTestId('interview-room')).not.toHaveClass(/meeting-room--fullscreen/)

  for (let index = 0; index < 3; index += 1) {
    await page.locator('.meeting-control-bar button').nth(0).click()
    await page.waitForTimeout(450)
    await page.locator('.meeting-control-bar button').nth(1).click()
    await page.locator('.meeting-control-bar button').nth(3).click()
    await expect(page.locator('.meeting-room-typebar')).toContainText('模拟转写')
    await page.locator('.meeting-control-bar button').nth(4).click()
    await expect(page.getByTestId('interview-feedback-summary')).toBeVisible()
    await expect(page.getByTestId('meeting-short-feedback')).toBeVisible()
    const detailOpen = await page.locator('.ai-report-detail').last().evaluate((node) => (node as HTMLDetailsElement).open)
    expect(detailOpen).toBe(false)
    if (index < 2) await page.locator('.meeting-control-bar button').nth(5).click()
  }

  await page.locator('.meeting-control-bar button').nth(6).click()
  await expect(page.getByTestId('interview-review-room')).toBeVisible()
  await expect(page.locator('.review-summary-report')).toContainText('84')

  await page.locator('.top-nav nav button').nth(10).click()
  await expect(page.getByTestId('provider-diagnostics')).toContainText('Mock / fallback')
  await expect(page.getByTestId('provider-diagnostics')).toContainText('/api/provider-status')
  await page.getByRole('button', { name: /测试文本模型/ }).click()
  await expect(page.getByTestId('provider-diagnostics')).toContainText('文本模型测试完成')
  await page.getByRole('button', { name: /测试语音转写/ }).click()
  await expect(page.getByTestId('provider-diagnostics')).toContainText('语音转写测试完成')
  const diagnosticsText = await page.getByTestId('provider-diagnostics').textContent()
  expect(diagnosticsText).not.toContain('sk-')
  expect(diagnosticsText).not.toContain('test-key')

  await page.locator('.top-nav nav button').nth(9).click()
  await expect(page.getByTestId('data-management')).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /导出 JSON/ }).click()
  const download = await downloadPromise
  const backupPath = await download.path()
  expect(backupPath).toBeTruthy()
  const backup = JSON.parse(await fs.readFile(backupPath!, 'utf8'))
  expect(backup.appVersion).toBe('1.2A')
  expect(backup.selectedJob.jobTitle).toBe('AI Product Manager')
  expect(backup.jobUserStatus[backup.selectedJob.id]).toBe('preparing')
  expect(backup.jobPacks).toHaveLength(1)
  expect(backup.mockInterviews[0].finalReport.report.overallScore).toBe(84)

  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.locator('.top-nav nav button').nth(9).click()
  page.once('dialog', (dialog) => void dialog.accept())
  await page.locator('input[accept=".json,application/json"]').setInputFiles(backupPath!)
  await expect(page.getByText('导入成功。')).toBeVisible()
  await page.reload()
  const restored = await page.evaluate(() => ({
    selectedJob: JSON.parse(localStorage.getItem('interview_os_selected_job') || 'null'),
    status: JSON.parse(localStorage.getItem('interview_os_job_user_status') || '{}'),
    packs: JSON.parse(localStorage.getItem('interview_os_job_packs') || '[]'),
    interviews: JSON.parse(localStorage.getItem('interview_os_mock_interviews') || '[]'),
  }))
  expect(restored.selectedJob.jobTitle).toBe('AI Product Manager')
  expect(restored.status[restored.selectedJob.id]).toBe('preparing')
  expect(restored.packs).toHaveLength(1)
  expect(restored.interviews[0].finalReport.report.overallScore).toBe(84)

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(hasHorizontalOverflow).toBe(false)
})
