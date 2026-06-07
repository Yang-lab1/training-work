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
})

test('dogfood: 上传岗位表到 AI 反馈和备份导出闭环', async ({ page }, testInfo) => {
  const fixturePath = testInfo.outputPath('job.xlsx')
  await writeJobFixture(fixturePath)

  await page.goto('/')
  await expect(page.locator('.top-nav nav button')).toHaveCount(6)
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

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(hasHorizontalOverflow).toBe(false)
})
