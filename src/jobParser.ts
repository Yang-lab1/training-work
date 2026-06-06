export interface JobRecord {
  id: string
  companyName: string
  jobTitle: string
  city: string
  jobType: string
  priority: string
  mainTrack: string
  salary: string
  sourceSheet: string
  source: string
  link: string
  companyBusiness: string
  jobContent: string
  jobRequirements: string
  businessDirection: string
  roleFitReason: string
  matchLevel: string
  difficulty: string
  isTodayNew: boolean
  selectedAt?: string
}

type Row = Record<string, unknown>

const preferredSheets = [
  '正式岗_校招岗',
  '实习岗',
  '今日新增',
  '面试顺序表',
  '次选_条件不完全符合',
]

const aliases = {
  companyName: ['公司名称', '公司', '公司名', '企业', '企业名称', '单位名称'],
  jobTitle: ['岗位名称', '岗位', '职位', '职位名称', '岗位名'],
  city: ['工作城市', '城市', '地点', '工作地点', '办公地点'],
  salary: ['薪资区间', '薪资', '薪酬', '月薪', '待遇', '薪资范围'],
  matchLevel: ['匹配度', '岗位匹配度', '匹配'],
  mainTrack: ['主线分类', '主线', '方向', '岗位方向', '赛道'],
  priority: ['ABC投递档位', '申请优先级', '优先级', '投递优先级', '推荐等级', 'A/B/C'],
  jobType: ['岗位类型', '类型', '正式/实习', '校招/社招'],
  companyBusiness: ['公司是做什么的', '公司业务', '主营业务', '业务介绍', '公司介绍'],
  jobContent: ['岗位是做什么的', '岗位内容', '职位内容', '工作内容', '岗位职责', '职位职责'],
  jobRequirements: ['岗位要求', '职位要求', '任职要求', '要求', '实习要求', '经验要求'],
  source: ['来源', '岗位来源', '招聘来源'],
  link: ['招聘链接', '投递链接', '职位链接', '链接', 'URL'],
  difficulty: ['可投难度', '投递难度', '难度'],
  roleFitReason: ['档位理由', '匹配理由', '岗位匹配理由', '排序理由', '面试建议'],
} satisfies Record<string, string[]>

export async function parseJobWorkbook(file: File): Promise<JobRecord[]> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(await file.arrayBuffer(), { cellDates: true })
  const orderedSheets = [
    ...preferredSheets.filter((name) => workbook.SheetNames.includes(name)),
    ...workbook.SheetNames.filter((name) => !preferredSheets.includes(name)),
  ]
  const jobs: JobRecord[] = []

  for (const sheetName of orderedSheets) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue
    const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: '', raw: false })
    const headers = rows.length ? Object.keys(rows[0]) : []
    const linkHeader = findHeader(headers, aliases.link)
    const linkColumnIndex = linkHeader ? headers.indexOf(linkHeader) : -1

    rows.forEach((row, index) => {
      const companyName = getValue(row, aliases.companyName)
      const jobTitle = getValue(row, aliases.jobTitle)
      if (!companyName || !jobTitle) return

      const cellAddress = linkColumnIndex >= 0
        ? XLSX.utils.encode_cell({ r: index + 1, c: linkColumnIndex })
        : ''
      const hyperlink = cellAddress ? sheet[cellAddress]?.l?.Target ?? '' : ''
      const sourceSheet = sheetName
      const mainTrack = getValue(row, aliases.mainTrack)
      const companyBusiness = getValue(row, aliases.companyBusiness)
      const jobContent = getValue(row, aliases.jobContent)

      jobs.push({
        id: createJobId(companyName, jobTitle, getValue(row, aliases.city), sourceSheet),
        companyName,
        jobTitle,
        city: getValue(row, aliases.city),
        jobType: getValue(row, aliases.jobType) || inferJobType(sourceSheet, jobTitle),
        priority: getValue(row, aliases.priority),
        mainTrack,
        salary: getValue(row, aliases.salary),
        sourceSheet,
        source: getValue(row, aliases.source),
        link: hyperlink || getValue(row, aliases.link),
        companyBusiness,
        jobContent,
        jobRequirements: getValue(row, aliases.jobRequirements),
        businessDirection: companyBusiness || mainTrack,
        roleFitReason: getValue(row, aliases.roleFitReason),
        matchLevel: getValue(row, aliases.matchLevel),
        difficulty: getValue(row, aliases.difficulty),
        isTodayNew: sourceSheet.includes('今日新增'),
      })
    })
  }

  const deduped = new Map<string, JobRecord>()
  for (const job of jobs) {
    const key = normalize(`${job.companyName}|${job.jobTitle}|${job.city}`)
    if (!deduped.has(key)) deduped.set(key, job)
  }
  return Array.from(deduped.values())
}

function getValue(row: Row, candidates: string[]) {
  const header = findHeader(Object.keys(row), candidates)
  if (!header) return ''
  const value = row[header]
  return value == null ? '' : String(value).trim()
}

function findHeader(headers: string[], candidates: string[]) {
  const exact = headers.find((header) => candidates.some((candidate) => normalize(header) === normalize(candidate)))
  if (exact) return exact
  return headers.find((header) => candidates.some((candidate) => {
    const normalizedHeader = normalize(header)
    const normalizedCandidate = normalize(candidate)
    return normalizedHeader.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedHeader)
  }))
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[\s_\-/（）()【】[\]：:]/g, '')
}

function createJobId(company: string, title: string, city: string, sheet: string) {
  const seed = `${company}|${title}|${city}|${sheet}`
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash << 5) - hash + seed.charCodeAt(index)) | 0
  }
  return `job-${Math.abs(hash)}`
}

function inferJobType(sheet: string, title: string) {
  if (sheet.includes('实习') || title.toLowerCase().includes('intern') || title.includes('实习')) return '实习'
  if (sheet.includes('校招')) return '校招'
  return '正式'
}
