import { expect, test } from '@playwright/test'
import * as fs from 'node:fs/promises'
import * as XLSX from 'xlsx'

type ParsedJob = {
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
    ['测试云公司', '后端开发工程师', '深圳', '25K', '云平台', 'C', '社招', 'https://example.com/backend', '云原生平台', '负责 Java、Go、K8s、SRE 和后端平台开发', '强代码、云原生、3年以上经验'],
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
  await page.route('**/api/transcribe', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        provider: 'mock',
        model: 'mock-asr-v1',
        transcript: '这是模拟转写文本。我正在面试测试科技公司的 AI Product Manager，会结合 AI 应用平台、Miro 项目和用户场景说明岗位匹配。',
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
        summary: '回答能覆盖岗位和项目，但项目结果还可以更具体。',
        strengths: ['提到 AI 应用平台和 Miro 项目。'],
        problems: ['项目不够具体。'],
        roleFitFeedback: '面向测试科技公司的 AI Product Manager，要突出企业 AI 应用平台场景。',
        structureFeedback: '按背景-行动-结果-岗位关系重讲。',
        expressionFeedback: '减少铺垫。',
        timingFeedback: '控制在目标时长内。',
        fluencyFeedback: '后续接入真实 ASR 后分析停顿。',
        memorizationRisk: '暂未发现明显背稿。',
        specificityFeedback: '补充用户、场景、AI 作用和 MVP 取舍。',
        improvedShortVersion: '我正在申请测试科技公司的 AI Product Manager，能用 AI 产品和 Miro 项目经验支撑岗位需求。',
        improvedLongVersion: '我正在申请测试科技公司的 AI Product Manager。我的背景结合 AI 学习、产品体验和 Miro 项目经验，能从用户场景出发拆解需求、设计 MVP 并验证结果。',
        nextTasks: ['重练 Miro 项目 90 秒版本。', '补充一个可验证结果。'],
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
          recurringProblems: ['项目结果还可以更具体'],
          roleFitAssessment: '需要持续回到测试科技公司和 AI Product Manager。',
          communicationAssessment: '表达清晰，铺垫可减少。',
          projectDepthAssessment: '补充用户、场景和验证指标。',
          englishAssessment: '英文短句清晰即可。',
          nextTrainingPlan: ['重练 Miro 项目', '准备为什么选择公司'],
        },
      }),
    })
  })
})

test('dogfood: smart job filters and immersive interview room', async ({ page }, testInfo) => {
  const jobFixturePath = testInfo.outputPath('job.xlsx')
  await writeJobFixture(jobFixturePath)

  await page.goto('/')
  await expect(page.locator('.top-nav nav button')).toHaveCount(10)

  await page.getByRole('button', { name: /资料与岗位/ }).click()
  await page.locator('input[accept=".xlsx"]').setInputFiles(jobFixturePath)
  await page.waitForFunction(() => {
    const raw = localStorage.getItem('interview_os_job_pool')
    return raw ? JSON.parse(raw).length === 9 : false
  })

  const jobPool = await page.evaluate<ParsedJob[]>(() => JSON.parse(localStorage.getItem('interview_os_job_pool') || '[]') as ParsedJob[])
  expect(jobPool).toHaveLength(9)
  const aiProductJobs = jobPool.filter((job) => job.normalized?.roleFamily === 'AI产品 / AI应用产品')
  expect(aiProductJobs.map((job) => job.jobTitle).sort()).toEqual(['AI Product Manager', 'AI产品经理', '大模型产品经理'].sort())
  const researchJobs = jobPool.filter((job) => job.normalized?.roleFamily === '用户研究 / 产品体验')
  expect(researchJobs.map((job) => job.jobTitle).sort()).toEqual(['产品体验设计', '用户研究实习生'].sort())
  expect(jobPool.find((job) => job.jobTitle === '后端开发工程师')?.normalized.riskFlags).toContain('strong_code')
  expect(jobPool.find((job) => job.jobTitle === '销售经理')?.normalized.riskFlags).toContain('sales_heavy')

  await expect(page.getByLabel('岗位智能筛选统计')).toContainText('总岗位')
  await expect(page.getByText('AI产品 / AI应用产品 3')).toBeVisible()
  await expect(page.getByText('用户研究 / 产品体验 2')).toBeVisible()
  await page.getByLabel('隐藏强代码').check()
  await expect(page.getByText('后端开发工程师')).toHaveCount(0)
  await page.getByLabel('隐藏强代码').uncheck()

  await page.locator('.job-row').filter({ hasText: 'AI Product Manager' }).getByRole('button', { name: /选择岗位/ }).click()
  await page.reload()
  const selectedJob = await page.evaluate(() => JSON.parse(localStorage.getItem('interview_os_selected_job') || 'null'))
  expect(selectedJob.jobTitle).toBe('AI Product Manager')
  expect(selectedJob.normalized.roleFamily).toBe('AI产品 / AI应用产品')

  await page.getByRole('button', { name: /模拟面试/ }).click()
  await expect(page.getByTestId('interview-lobby')).toContainText('面试大厅')
  await page.getByRole('button', { name: /AI 产品岗位面试/ }).click()
  await expect(page.getByTestId('interview-waiting-room')).toContainText('面试等待室')
  await page.getByRole('button', { name: /进入面试/ }).click()
  await expect(page.getByTestId('interview-room')).toBeVisible()
  await expect(page.getByTestId('virtual-interviewer')).toContainText('请用中文做一个 90 秒自我介绍')
  await expect(page.getByTestId('candidate-window')).toContainText('我的窗口')
  await expect(page.getByLabel('面试状态栏')).toContainText('第 1 / 6 题')
  await expect(page.getByLabel('底部控制栏')).toBeVisible()

  await page.getByRole('button', { name: /开始回答/ }).click()
  await page.waitForTimeout(700)
  await page.getByRole('button', { name: /^停止$/ }).click()
  await page.getByRole('button', { name: /生成转写/ }).click()
  await expect(page.getByText(/模拟转写/).last()).toBeVisible()
  await page.getByRole('button', { name: /生成单题反馈/ }).click()
  await expect(page.getByText(/本题 AI 反馈已保存/)).toBeVisible()
  await expect(page.getByText('单题反馈', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /下一题/ }).click()
  await expect(page.getByLabel('面试状态栏')).toContainText('第 2 / 6 题')
  await page.getByRole('button', { name: /结束面试/ }).click()
  await expect(page.getByTestId('interview-review-room')).toContainText('面试复盘室')
  await expect(page.getByText(/整场分数/)).toBeVisible()

  await page.getByRole('button', { name: /数据备份/ }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /导出 JSON/ }).click()
  const download = await downloadPromise
  const backupPath = await download.path()
  expect(backupPath).toBeTruthy()
  const backup = JSON.parse(await fs.readFile(backupPath!, 'utf8'))
  expect(backup.selectedJob.normalized.roleFamily).toBe('AI产品 / AI应用产品')
  expect(backup.mockInterviews[0].finalReport.report.overallScore).toBe(84)

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(hasHorizontalOverflow).toBe(false)
})
