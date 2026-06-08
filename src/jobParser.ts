export interface NormalizedJob {
  normalizedTitle: string
  roleFamily: string
  roleTrack: string
  roleLevel: string
  jobNature: string
  cityGroup: string
  priorityBucket: string
  riskFlags: string[]
  matchScore: number
  matchReasons: string[]
  searchableText: string
}

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
  normalized: NormalizedJob
  selectedAt?: string
}

type Row = Record<string, unknown>
type JobRecordBase = Omit<JobRecord, 'normalized' | 'selectedAt'>

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
  city: ['城市', '工作城市', '地点', '工作地点', '办公地点'],
  salary: ['薪资', '薪酬', '月薪', '待遇', '薪资范围', '薪资区间'],
  matchLevel: ['匹配度', '岗位匹配度', '匹配'],
  mainTrack: ['主线分类', '主线', '方向', '岗位方向', '赛道'],
  priority: ['优先级', '申请优先级', '投递优先级', '推荐等级', 'A/B/C', 'ABC投递档位'],
  jobType: ['岗位类型', '类型', '正式/实习', '校招/社招'],
  companyBusiness: ['公司业务', '公司是做什么的', '主营业务', '业务介绍', '公司介绍'],
  jobContent: ['岗位内容', '岗位是做什么的', '职位内容', '工作内容', '岗位职责', '职位职责'],
  jobRequirements: ['岗位要求', '职位要求', '任职要求', '要求', '实习要求', '经验要求'],
  source: ['来源', '岗位来源', '招聘来源'],
  link: ['链接', '招聘链接', '投递链接', 'URL', '职位链接'],
  difficulty: ['可投难度', '投递难度', '难度'],
  roleFitReason: ['档位理由', '匹配理由', '岗位匹配理由', '排序理由', '面试建议'],
} satisfies Record<string, string[]>

const roleRules = [
  {
    normalizedTitle: 'AI解决方案',
    roleFamily: 'AI解决方案 / FDE / 产品工程',
    roleTrack: '备线D：AI解决方案 / TPM / 项目型产品',
    keywords: ['ai解决方案', 'solutions engineer', 'ai solutions', 'fde', 'forward deployed engineer', 'product engineer', 'ai应用工程', 'ai应用开发', 'implementation', 'consultant'],
  },
  {
    normalizedTitle: 'AI产品经理',
    roleFamily: 'AI产品 / AI应用产品',
    roleTrack: '主线B：AI应用落地 / AI产品 / Agent / RAG',
    keywords: ['ai产品', 'ai product', '大模型产品', 'llm产品', 'agent产品', 'rag产品', '知识库产品', 'ai工作流', 'product manager', 'product intern'],
  },
  {
    normalizedTitle: '用户研究',
    roleFamily: '用户研究 / 产品体验',
    roleTrack: '主线C：用户研究 / 产品体验 / HCI',
    keywords: ['用户研究', 'ux research', 'user research', '产品体验', '体验设计', '体验策略', '用户洞察', 'hci', '可用性测试', 'ai ux'],
  },
  {
    normalizedTitle: 'AI硬件产品',
    roleFamily: 'AI硬件 / AIoT / 智能终端',
    roleTrack: '主线A：AI智能硬件 / AI终端 / AIoT',
    keywords: ['ai硬件', '智能硬件', 'aiot', 'ai终端', '智能终端', 'ai眼镜', '可穿戴', '机器人产品', '具身智能', '智能家居', '端侧ai', '边缘ai', '智能座舱'],
  },
  {
    normalizedTitle: 'TPM/NPI',
    roleFamily: '项目管理 / TPM / NPI',
    roleTrack: '备线D：AI解决方案 / TPM / 项目型产品',
    keywords: ['tpm', 'npi', '技术项目经理', '产品项目经理', '研发项目管理', '项目管理', '产品规划', '解决方案经理', '数字化转型', '工业互联网'],
  },
]

const riskRules = [
  { flag: 'strong_code', keywords: ['后端开发', 'java', 'go', 'k8s', 'sre', '云原生', '运维平台', '前端开发', '全栈', 'python开发'] },
  { flag: 'algorithm_heavy', keywords: ['算法训练', '模型训练', '深度学习', 'cv算法', 'nlp算法', '推荐算法', '算法工程师'] },
  { flag: 'sales_heavy', keywords: ['销售', 'bd', '拓客', '客户开发', '业绩指标', '提成', '地推'] },
  { flag: 'onsite_delivery', keywords: ['驻场', '客户现场', '现场交付'] },
  { flag: 'travel_heavy', keywords: ['长期出差', '频繁出差', '全国交付', '出差'] },
  { flag: 'low_salary', keywords: ['100-150', '150-200', '低薪'] },
  { flag: 'high_experience', keywords: ['5年以上', '五年以上', '8年以上', '高级', '资深', '专家'] },
  { flag: 'english_heavy', keywords: ['英文流利', '英语流利', '全英文', 'english'] },
  { flag: 'unclear_jd', keywords: ['职责不明', 'jd不明', '待补充'] },
  { flag: 'outsourcing_risk', keywords: ['外包', '派遣', '第三方'] },
]

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
      const mainTrack = getValue(row, aliases.mainTrack)
      const companyBusiness = getValue(row, aliases.companyBusiness)
      const baseJob: JobRecordBase = {
        id: createJobId(companyName, jobTitle, getValue(row, aliases.city), sheetName),
        companyName,
        jobTitle,
        city: getValue(row, aliases.city),
        jobType: getValue(row, aliases.jobType) || inferJobType(sheetName, jobTitle),
        priority: getValue(row, aliases.priority),
        mainTrack,
        salary: getValue(row, aliases.salary),
        sourceSheet: sheetName,
        source: getValue(row, aliases.source),
        link: hyperlink || getValue(row, aliases.link),
        companyBusiness,
        jobContent: getValue(row, aliases.jobContent),
        jobRequirements: getValue(row, aliases.jobRequirements),
        businessDirection: companyBusiness || mainTrack,
        roleFitReason: getValue(row, aliases.roleFitReason),
        matchLevel: getValue(row, aliases.matchLevel),
        difficulty: getValue(row, aliases.difficulty),
        isTodayNew: sheetName.includes('今日新增'),
      }

      jobs.push({ ...baseJob, normalized: normalizeJobRecord(baseJob) })
    })
  }

  const deduped = new Map<string, JobRecord>()
  for (const job of jobs) {
    const key = normalize(`${job.companyName}|${job.jobTitle}|${job.city}`)
    if (!deduped.has(key)) deduped.set(key, job)
  }
  return Array.from(deduped.values())
}

export function normalizeJobRecord(job: JobRecordBase): NormalizedJob {
  const searchableText = [
    job.companyName,
    job.jobTitle,
    job.city,
    job.jobType,
    job.priority,
    job.mainTrack,
    job.salary,
    job.companyBusiness,
    job.jobContent,
    job.jobRequirements,
    job.businessDirection,
    job.roleFitReason,
    job.matchLevel,
    job.difficulty,
    job.sourceSheet,
  ].filter(Boolean).join(' ')
  const text = searchableText.toLowerCase()
  const matchedRule = roleRules.find((rule) => rule.keywords.some((keyword) => text.includes(keyword.toLowerCase())))
  const riskFlags = riskRules
    .filter((rule) => rule.keywords.some((keyword) => text.includes(keyword.toLowerCase())))
    .map((rule) => rule.flag)
  const roleLevel = inferRoleLevel(text, job)
  const jobNature = inferJobNature(text, job)
  const cityGroup = inferCityGroup(job.city || searchableText)
  const roleTrack = matchedRule?.roleTrack || inferFallbackTrack(text)
  const priorityBucket = inferPriorityBucket(text, job, riskFlags, roleTrack)
  const matchScore = calculateMatchScore(priorityBucket, riskFlags, matchedRule?.roleFamily, roleLevel)
  const matchReasons = buildMatchReasons(matchedRule?.roleFamily, roleTrack, riskFlags, job, priorityBucket)

  return {
    normalizedTitle: matchedRule?.normalizedTitle || normalizeFallbackTitle(job.jobTitle),
    roleFamily: matchedRule?.roleFamily || '其他 / 待判断',
    roleTrack,
    roleLevel,
    jobNature,
    cityGroup,
    priorityBucket,
    riskFlags,
    matchScore,
    matchReasons,
    searchableText,
  }
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
    .replace(/[\s_/（）()【】[\]、，,：:：-]/g, '')
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

function inferRoleLevel(text: string, job: JobRecordBase) {
  if (text.includes('intern') || text.includes('实习') || job.sourceSheet.includes('实习')) return '实习'
  if (text.includes('校招') || text.includes('应届')) return '校招'
  if (text.includes('高级') || text.includes('资深') || text.includes('专家') || text.includes('5年以上') || text.includes('五年以上')) return '中高级'
  if (text.includes('社招')) return '社招'
  if (text.includes('初级') || text.includes('junior')) return '初级'
  return '不明'
}

function inferJobNature(text: string, job: JobRecordBase) {
  if (text.includes('实习') || text.includes('intern') || job.sourceSheet.includes('实习')) return '实习'
  if (text.includes('校招') || job.sourceSheet.includes('校招')) return '校招'
  if (text.includes('社招')) return '社招'
  if (text.includes('外企') || text.includes('global') || text.includes('english')) return '外企'
  if (text.includes('央企') || text.includes('国企') || text.includes('研究院')) return '央国企'
  if (text.includes('创业')) return '创业公司'
  if (job.jobType) return job.jobType
  return '不明'
}

function inferCityGroup(value: string) {
  const text = value.toLowerCase()
  if (text.includes('深圳')) return '深圳'
  if (text.includes('香港') || text.includes('hong kong') || text.includes('hk')) return '香港'
  if (text.includes('广州')) return '广州'
  if (text.includes('东莞')) return '东莞'
  if (text.includes('佛山')) return '佛山'
  if (text.includes('远程') || text.includes('remote')) return '远程'
  return '其他'
}

function inferPriorityBucket(text: string, job: JobRecordBase, riskFlags: string[], roleTrack: string) {
  const raw = `${job.priority} ${job.matchLevel} ${job.difficulty}`.toUpperCase()
  if (raw.includes('排除') || raw.includes('F') || riskFlags.includes('sales_heavy')) return 'E 排除'
  if (raw.includes('A')) return riskFlags.length ? 'B 可投' : 'A 优先'
  if (raw.includes('B')) return 'B 可投'
  if (raw.includes('C') || raw.includes('次选')) return 'C 次选'
  if (roleTrack.startsWith('主线') && !riskFlags.length) return 'A 优先'
  if (roleTrack.startsWith('主线')) return 'B 可投'
  if (text.includes('后端开发') || text.includes('算法工程师')) return 'E 排除'
  return riskFlags.length ? 'D 观察' : 'B 可投'
}

function calculateMatchScore(priorityBucket: string, riskFlags: string[], roleFamily?: string, roleLevel?: string) {
  let score = priorityBucket.startsWith('A') ? 88 : priorityBucket.startsWith('B') ? 76 : priorityBucket.startsWith('C') ? 62 : priorityBucket.startsWith('D') ? 48 : 25
  if (roleFamily && roleFamily !== '其他 / 待判断') score += 5
  if (roleLevel === '实习' || roleLevel === '校招') score += 4
  score -= riskFlags.length * 7
  return Math.max(0, Math.min(100, score))
}

function buildMatchReasons(roleFamily: string | undefined, roleTrack: string, riskFlags: string[], job: JobRecordBase, priorityBucket: string) {
  const reasons: string[] = []
  if (roleFamily && roleFamily !== '其他 / 待判断') reasons.push(`归入${roleFamily}`)
  reasons.push(roleTrack)
  if (job.companyBusiness || job.jobContent) reasons.push('有公司业务或岗位内容可用于准备包')
  if (priorityBucket.startsWith('A') || priorityBucket.startsWith('B')) reasons.push('可进入岗位定向训练')
  if (riskFlags.length) reasons.push(`风险：${riskFlags.join('、')}`)
  return reasons.length ? reasons : ['信息不足，需人工复核']
}

function normalizeFallbackTitle(title: string) {
  const lower = title.toLowerCase()
  if (lower.includes('product') || title.includes('产品')) return '产品相关'
  if (title.includes('研究') || lower.includes('research')) return '用户研究'
  if (title.includes('设计') || lower.includes('design')) return '产品体验设计'
  if (title.includes('工程') || lower.includes('engineer')) return '工程相关'
  return title || '待判断岗位'
}

function inferFallbackTrack(text: string) {
  if (text.includes('设计') || text.includes('research') || text.includes('研究')) return '主线C：用户研究 / 产品体验 / HCI'
  if (text.includes('硬件') || text.includes('iot')) return '主线A：AI智能硬件 / AI终端 / AIoT'
  if (text.includes('数字化') || text.includes('项目')) return '备线D：AI解决方案 / TPM / 项目型产品'
  return '次选E：相关但风险较高'
}
