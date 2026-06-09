import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import {
  Archive,
  BrainCircuit,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  Download,
  FileAudio,
  FileText,
  History,
  Home,
  Maximize2,
  MessagesSquare,
  Mic,
  Minimize2,
  RotateCcw,
  Save,
  Sparkles,
  Square,
  Trash2,
  Upload,
} from 'lucide-react'
import { normalizeJobRecord, parseJobWorkbook } from './jobParser'
import type { JobRecord } from './jobParser'
import type {
  AIFeedbackStatus,
  AnalyzeAnswerResponse,
  GenerateFollowUpResponse,
  GenerateInterviewReportResponse,
  GenerateJobPackResponse,
  GenerateMockInterviewResponse,
  GenerateCompanyKnowledgePackResponse,
  InterviewFinalReport,
  JobPackContent,
  CompanyKnowledgePackContent,
  CompanySourceInput,
  QuestionBankUpdate,
  RealInterviewReviewReport,
  ReviewRealInterviewResponse,
  ExtractedRealInterviewQuestion,
  ExtractedRealInterviewAnswer,
  RealInterviewComparison,
  MockInterviewQuestion,
  MockInterviewType,
  StoredAIFeedback,
  TrainingType,
  TranscriptData,
  TranscriptStatus,
} from './lib/ai/types'
import type { TranscribeResponse } from './lib/asr/types'
import './App.css'

const APP_VERSION = '1.2A'
const STORAGE_KEY = 'interview-os-personal-mvp-v1'
const UPLOADED_FILES_KEY = 'interview_os_uploaded_files'
const JOB_POOL_KEY = 'interview_os_job_pool'
const SELECTED_JOB_KEY = 'interview_os_selected_job'
const LEGACY_TARGET_ROLE_KEY = 'interview_os_target_role'
const CV_TEXT_KEY = 'interview_os_cv_text'
const SCRIPT_TEMPLATES_KEY = 'interview_os_script_templates'
const TRAINING_RECORDS_KEY = 'interview_os_training_records'
const JOB_PACKS_KEY = 'interview_os_job_packs'
const MOCK_INTERVIEWS_KEY = 'interview_os_mock_interviews'
const REAL_INTERVIEWS_KEY = 'interview_os_real_interviews'
const QUESTION_BANK_KEY = 'interview_os_question_bank'
const COMPANY_SOURCES_KEY = 'interview_os_company_sources'
const COMPANY_KNOWLEDGE_PACKS_KEY = 'interview_os_company_knowledge_packs'
const JOB_USER_STATUS_KEY = 'interview_os_job_user_status'
const RECORDING_DB_NAME = 'interview-os-recordings'
const RECORDING_STORE = 'recordings'

type ViewId = 'today' | 'materials' | 'training' | 'history' | 'feedback' | 'jobPack' | 'mockInterview' | 'realInterview' | 'companyKnowledge' | 'backup' | 'diagnostics'
type UploadCategory = 'cv' | 'project' | 'job' | 'job-map'
type CvParseStatus = '未上传' | '已上传，未解析' | '已提取文本' | '需要文本版'
type TaskId = 'cn-intro' | 'en-intro' | 'miro-project'
type ScriptTemplateKey = 'chineseIntro' | 'englishIntro' | 'miroProject'
type InterviewUiState = 'lobby' | 'waiting_room' | 'interview_room' | 'review_room'
type InterviewPhase = 'asking' | 'answering' | 'transcribing' | 'analyzing' | 'feedback_ready' | 'follow_up' | 'completed'
type JobSortMode = 'match' | 'priority' | 'today' | 'city' | 'family'
type JobUserStatus = 'not_started' | 'shortlisted' | 'preparing' | 'applied' | 'interviewing' | 'interviewed' | 'paused' | 'rejected'
type JobUserStatusMap = Record<string, JobUserStatus>

interface JobFilters {
  search: string
  roleFamily: string
  roleTrack: string
  cityGroup: string
  priorityBucket: string
  hideStrongCode: boolean
  hideAlgorithm: boolean
  hideSales: boolean
  hideOnsite: boolean
  hideTravel: boolean
  hideLowSalary: boolean
  hideHighExperience: boolean
  userStatus: '' | JobUserStatus
  hideRejected: boolean
  sort: JobSortMode
}

interface UploadedFileMeta {
  id: string
  name: string
  size: number
  type: string
  uploadedAt: string
  status: '已选择' | '已解析' | '未解析'
  category: UploadCategory
  parseStatus?: CvParseStatus
}

interface CvTextState {
  text: string
  source: 'upload' | 'manual'
  fileName?: string
  updatedAt?: string
}

interface LegacyReview {
  selfScore?: number
  issueTags?: string[]
  nextActionChoice?: string
  biggestProblem?: string
  nextImprovement?: string
  legacyBiggestProblem?: string
  legacyNextImprovement?: string
}

interface TrainingTask {
  id: TaskId
  scriptKey: ScriptTemplateKey
  title: string
  subtitle: string
  prompt: string
  targetSeconds: number
  memorySkeleton: string[]
  defaultReferenceTemplate: string
  done: boolean
  savedAt?: string
  recordingId?: string
  recordingName?: string
  durationSeconds?: number
  lastMessage?: string
}

interface TrainingRecord {
  id: string
  taskId: TaskId
  trainingType: TrainingType
  title: string
  savedAt: string
  durationSeconds: number
  targetSeconds: number
  selectedJob: JobRecord | null
  audioMetadata: {
    recordingId?: string
    recordingName?: string
    durationSeconds: number
    mimeType?: string
  }
  recordingId?: string
  recordingName?: string
  hasDownload: boolean
  transcript?: TranscriptData
  transcriptStatus: TranscriptStatus
  aiFeedback?: StoredAIFeedback
  aiFeedbackStatus: AIFeedbackStatus
  review?: LegacyReview
}

interface StoredMvpState {
  uploadedFiles: UploadedFileMeta[]
  tasks: TrainingTask[]
  history: TrainingRecord[]
  lastSavedAt?: string
}

interface ScriptTemplates {
  chineseIntro?: string
  englishIntro?: string
  miroProject?: string
  updatedAt?: string
}

interface AudioPreview {
  url: string
  size: number
  type: string
}

interface BackupPayload {
  appVersion: string
  exportedAt: string
  uploadedFiles: UploadedFileMeta[]
  jobPool: JobRecord[]
  selectedJob: JobRecord | null
  cvText: CvTextState
  scriptTemplates: ScriptTemplates
  trainingRecords: TrainingRecord[]
  jobPacks: StoredJobPack[]
  mockInterviews: MockInterviewSession[]
  realInterviews: StoredRealInterview[]
  questionBank: QuestionBankUpdate[]
  companySources: CompanySourceInput[]
  companyKnowledgePacks: StoredCompanyKnowledgePack[]
  jobUserStatus: JobUserStatusMap
}

interface ProviderAvailability {
  configured: boolean
  implemented: boolean
  fallbackMode: boolean
  model?: string
  note: string
}

interface ProviderStatusPayload {
  success: true
  ai: {
    provider: string
    configured: boolean
    fallbackMode: boolean
    availableProviders: Record<string, ProviderAvailability>
  }
  asr: {
    provider: string
    configured: boolean
    fallbackMode: boolean
    availableProviders: Record<string, ProviderAvailability>
  }
  routes: Record<string, {
    path: string
    method: string
    available: boolean
    mockSafe: boolean
  }>
}

interface StoredJobPack {
  id: string
  selectedJobId: string
  selectedJob: JobRecord
  provider: string
  model: string
  generatedAt: string
  jobPack: JobPackContent
  rawProviderNote?: string
}

interface MockInterviewAnswer {
  id: string
  questionId: string
  audioMetadata?: TrainingRecord['audioMetadata']
  recordingId?: string
  recordingName?: string
  transcript?: TranscriptData
  transcriptStatus: TranscriptStatus
  aiFeedback?: StoredAIFeedback
  aiFeedbackStatus: AIFeedbackStatus
  durationSeconds: number
  createdAt: string
}

interface MockInterviewSession {
  id: string
  selectedJob: JobRecord
  jobPackId?: string
  companyKnowledgePackId?: string
  status: 'not_started' | 'in_progress' | 'completed'
  uiState: InterviewUiState
  createdAt: string
  startedAt?: string
  completedAt?: string
  interviewType: MockInterviewType
  currentQuestionIndex: number
  currentPhase: InterviewPhase
  questions: MockInterviewQuestion[]
  answers: MockInterviewAnswer[]
  followUps: MockInterviewQuestion[]
  finalReport?: {
    provider: string
    model: string
    generatedAt: string
    report: InterviewFinalReport
    rawProviderNote?: string
  }
}

interface StoredRealInterview {
  id: string
  selectedJob: JobRecord
  relatedMockInterviewId?: string
  recordingId?: string
  recordingName?: string
  audioMetadata?: TrainingRecord['audioMetadata']
  transcript?: TranscriptData
  transcriptStatus: TranscriptStatus
  extractedQuestions: ExtractedRealInterviewQuestion[]
  extractedAnswers: ExtractedRealInterviewAnswer[]
  comparison?: RealInterviewComparison
  reviewReport?: RealInterviewReviewReport
  provider?: string
  model?: string
  generatedAt?: string
  rawProviderNote?: string
  createdAt: string
  updatedAt: string
}

interface StoredCompanyKnowledgePack {
  id: string
  selectedJobId: string
  selectedJob: JobRecord
  provider: string
  model: string
  generatedAt: string
  companyKnowledgePack: CompanyKnowledgePackContent
  sourceIds: string[]
  rawProviderNote?: string
}

const defaultTasks: TrainingTask[] = [
  {
    id: 'cn-intro',
    scriptKey: 'chineseIntro',
    title: '中文自我介绍',
    subtitle: '60-90 秒',
    prompt: '讲清背景、AI 学习、项目证据和岗位匹配。',
    targetSeconds: 90,
    memorySkeleton: ['开头定位', 'AI 与产品背景', '相关项目证据', '岗位匹配收尾'],
    defaultReferenceTemplate: '大家好，我正在准备【公司名称】的【XXX岗位】。我的背景结合了 AI 学习、产品体验和工业设计训练。围绕【岗位相关业务/产品方向】，我会用具体项目说明如何理解用户、拆解需求并推进可验证方案。',
    done: false,
  },
  {
    id: 'en-intro',
    scriptKey: 'englishIntro',
    title: '英文自我介绍',
    subtitle: '60-90 秒',
    prompt: 'Introduce your background and explain why it matches the selected role.',
    targetSeconds: 90,
    memorySkeleton: ['Positioning', 'AI and product background', 'Project evidence', 'Role fit'],
    defaultReferenceTemplate: 'Hi, I am preparing for the [XXX role] opportunity at 【公司名称】. My background combines AI study, product experience, and industrial design. For [business/product direction], I connect user needs with practical product solutions.',
    done: false,
  },
  {
    id: 'miro-project',
    scriptKey: 'miroProject',
    title: 'Miro 项目讲解',
    subtitle: '3 分钟',
    prompt: '讲清项目问题、你的角色、关键决策、结果和岗位关系。',
    targetSeconds: 180,
    memorySkeleton: ['用户与场景', '我的角色', 'AI 与 MVP 取舍', '结果与岗位关系'],
    defaultReferenceTemplate: '这个 Miro 项目适合用于【公司名称】的【XXX岗位】面试。重点是说明我如何围绕【岗位相关业务/产品方向】发现协作问题、判断优先级、设计 MVP 并根据反馈迭代。',
    done: false,
  },
]

const defaultState: StoredMvpState = { uploadedFiles: [], tasks: defaultTasks, history: [] }

const navigation: Array<{ id: ViewId; label: string; icon: ReactNode }> = [
  { id: 'today', label: '今日训练', icon: <Home size={17} /> },
  { id: 'materials', label: '资料与岗位', icon: <BriefcaseBusiness size={17} /> },
  { id: 'training', label: '训练', icon: <Mic size={17} /> },
  { id: 'history', label: '历史', icon: <History size={17} /> },
  { id: 'feedback', label: 'AI 反馈', icon: <BrainCircuit size={17} /> },
  { id: 'jobPack', label: '岗位准备包', icon: <Sparkles size={17} /> },
  { id: 'mockInterview', label: '模拟面试', icon: <MessagesSquare size={17} /> },
  { id: 'realInterview', label: '真实面试复盘', icon: <FileAudio size={17} /> },
  { id: 'companyKnowledge', label: '公司资料增强', icon: <FileText size={17} /> },
  { id: 'backup', label: '数据备份', icon: <Archive size={17} /> },
  { id: 'diagnostics', label: '系统诊断', icon: <BrainCircuit size={17} /> },
]

const JOB_USER_STATUS_OPTIONS: Array<{ value: JobUserStatus; label: string }> = [
  { value: 'not_started', label: '未处理' },
  { value: 'shortlisted', label: '短名单' },
  { value: 'preparing', label: '准备中' },
  { value: 'applied', label: '已投递' },
  { value: 'interviewing', label: '面试中' },
  { value: 'interviewed', label: '已面试' },
  { value: 'paused', label: '暂缓' },
  { value: 'rejected', label: '不适合' },
]

function App() {
  const [activeView, setActiveView] = useState<ViewId>('today')
  const [state, setState] = useState<StoredMvpState>(readStoredState)
  const [jobPool, setJobPool] = useState<JobRecord[]>(readJobPool)
  const [selectedJob, setSelectedJob] = useState<JobRecord | null>(readSelectedJob)
  const [cvTextState, setCvTextState] = useState<CvTextState>(readCvTextState)
  const [scriptTemplates, setScriptTemplates] = useState<ScriptTemplates>(readScriptTemplates)
  const [jobPacks, setJobPacks] = useState<StoredJobPack[]>(readJobPacks)
  const [mockInterviews, setMockInterviews] = useState<MockInterviewSession[]>(readMockInterviews)
  const [realInterviews, setRealInterviews] = useState<StoredRealInterview[]>(readRealInterviews)
  const [questionBank, setQuestionBank] = useState<QuestionBankUpdate[]>(readQuestionBank)
  const [companySources, setCompanySources] = useState<CompanySourceInput[]>(readCompanySources)
  const [companyKnowledgePacks, setCompanyKnowledgePacks] = useState<StoredCompanyKnowledgePack[]>(readCompanyKnowledgePacks)
  const [jobUserStatus, setJobUserStatus] = useState<JobUserStatusMap>(readJobUserStatus)
  const [legacyRole, setLegacyRole] = useState(readLegacyRole)
  const [jobError, setJobError] = useState('')
  const [jobMessage, setJobMessage] = useState('')
  const [backupMessage, setBackupMessage] = useState('')
  const [importError, setImportError] = useState('')
  const [recorderError, setRecorderError] = useState('')
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null)
  const [advancedScriptId, setAdvancedScriptId] = useState<TaskId | null>(null)
  const [scriptDraft, setScriptDraft] = useState('')
  const [recordingTaskId, setRecordingTaskId] = useState<TaskId | null>(null)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [audioPreviews, setAudioPreviews] = useState<Record<string, AudioPreview>>({})
  const [filters, setFilters] = useState<JobFilters>({
    search: '',
    roleFamily: '',
    roleTrack: '',
    cityGroup: '',
    priorityBucket: '',
    hideStrongCode: false,
    hideAlgorithm: false,
    hideSales: false,
    hideOnsite: false,
    hideTravel: false,
    hideLowSalary: false,
    hideHighExperience: false,
    userStatus: '',
    hideRejected: true,
    sort: 'match',
  })
  const [jobPackMessage, setJobPackMessage] = useState('')
  const [jobPackLoading, setJobPackLoading] = useState(false)
  const [mockInterviewMessage, setMockInterviewMessage] = useState('')
  const [mockInterviewLoading, setMockInterviewLoading] = useState('')
  const [realInterviewMessage, setRealInterviewMessage] = useState('')
  const [realInterviewLoading, setRealInterviewLoading] = useState('')
  const [companyKnowledgeMessage, setCompanyKnowledgeMessage] = useState('')
  const [companyKnowledgeLoading, setCompanyKnowledgeLoading] = useState(false)
  const [selectedMockType, setSelectedMockType] = useState<MockInterviewType>('job_pack_mock')
  const [providerStatus, setProviderStatus] = useState<ProviderStatusPayload | null>(null)
  const [providerStatusLoading, setProviderStatusLoading] = useState(false)
  const [providerStatusMessage, setProviderStatusMessage] = useState('')
  const [recordingInterviewQuestionId, setRecordingInterviewQuestionId] = useState<string | null>(null)
  const [interviewAudioPreviews, setInterviewAudioPreviews] = useState<Record<string, AudioPreview>>({})
  const [realInterviewAudioPreviews, setRealInterviewAudioPreviews] = useState<Record<string, AudioPreview>>({})
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const startedAtRef = useRef(0)

  const cvFile = getFileByCategory(state.uploadedFiles, 'cv')
  const projectFile = getFileByCategory(state.uploadedFiles, 'project')
  const jobFile = getFileByCategory(state.uploadedFiles, 'job')
  const jobMapFile = getFileByCategory(state.uploadedFiles, 'job-map')
  const todayRecords = state.history.filter((record) => isToday(record.savedAt))
  const completedCount = defaultTasks.filter((task) => todayRecords.some((record) => record.taskId === task.id)).length
  const analyzedToday = todayRecords.filter((record) => record.aiFeedbackStatus === 'completed').length
  const filteredJobs = useMemo(() => filterJobs(jobPool, filters, jobUserStatus), [jobPool, filters, jobUserStatus])
  const filterOptions = useMemo(() => buildFilterOptions(jobPool), [jobPool])
  const jobStats = useMemo(() => buildJobStats(jobPool, filteredJobs), [jobPool, filteredJobs])
  const currentJobPack = useMemo(
    () => selectedJob ? jobPacks.find((pack) => pack.selectedJobId === selectedJob.id) : undefined,
    [jobPacks, selectedJob],
  )
  const currentKnowledgePack = useMemo(
    () => selectedJob ? companyKnowledgePacks.find((pack) => pack.selectedJobId === selectedJob.id) : undefined,
    [companyKnowledgePacks, selectedJob],
  )
  const currentCompanySources = useMemo(
    () => selectedJob ? companySources.filter((source) => !source.selectedJobId || source.selectedJobId === selectedJob.id) : companySources,
    [companySources, selectedJob],
  )
  const activeMockInterview = useMemo(
    () => mockInterviews.find((session) => session.status === 'in_progress') || mockInterviews[0],
    [mockInterviews],
  )
  const dailyAction = useMemo(
    () => buildDailyAction({
      jobPool,
      selectedJob,
      currentJobPack,
      mockInterviews,
      realInterviews,
      history: state.history,
      cvText: cvTextState,
    }),
    [jobPool, selectedJob, currentJobPack, mockInterviews, realInterviews, state.history, cvTextState],
  )
  const nextActions = generateNextActions(jobPool, selectedJob, cvTextState, todayRecords, currentJobPack, mockInterviews)

  function commitState(updater: (current: StoredMvpState) => StoredMvpState) {
    setState((current) => ({ ...updater(current), lastSavedAt: new Date().toISOString() }))
  }

  function updateRecord(recordId: string, updater: (record: TrainingRecord) => TrainingRecord) {
    commitState((current) => ({
      ...current,
      history: current.history.map((record) => record.id === recordId ? updater(record) : record),
    }))
  }

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    localStorage.setItem(UPLOADED_FILES_KEY, JSON.stringify(state.uploadedFiles))
    localStorage.setItem(TRAINING_RECORDS_KEY, JSON.stringify(state.history))
  }, [state])
  useEffect(() => { localStorage.setItem(JOB_POOL_KEY, JSON.stringify(jobPool)) }, [jobPool])
  useEffect(() => {
    if (selectedJob) localStorage.setItem(SELECTED_JOB_KEY, JSON.stringify(selectedJob))
    else localStorage.removeItem(SELECTED_JOB_KEY)
  }, [selectedJob])
  useEffect(() => { localStorage.setItem(CV_TEXT_KEY, JSON.stringify(cvTextState)) }, [cvTextState])
  useEffect(() => { localStorage.setItem(SCRIPT_TEMPLATES_KEY, JSON.stringify(scriptTemplates)) }, [scriptTemplates])
  useEffect(() => { localStorage.setItem(JOB_PACKS_KEY, JSON.stringify(jobPacks)) }, [jobPacks])
  useEffect(() => { localStorage.setItem(MOCK_INTERVIEWS_KEY, JSON.stringify(mockInterviews)) }, [mockInterviews])
  useEffect(() => { localStorage.setItem(REAL_INTERVIEWS_KEY, JSON.stringify(realInterviews)) }, [realInterviews])
  useEffect(() => { localStorage.setItem(QUESTION_BANK_KEY, JSON.stringify(questionBank)) }, [questionBank])
  useEffect(() => { localStorage.setItem(COMPANY_SOURCES_KEY, JSON.stringify(companySources)) }, [companySources])
  useEffect(() => { localStorage.setItem(COMPANY_KNOWLEDGE_PACKS_KEY, JSON.stringify(companyKnowledgePacks)) }, [companyKnowledgePacks])
  useEffect(() => { localStorage.setItem(JOB_USER_STATUS_KEY, JSON.stringify(jobUserStatus)) }, [jobUserStatus])

  useEffect(() => {
    if (activeView === 'diagnostics') void refreshProviderStatus()
  }, [activeView])

  useEffect(() => {
    let disposed = false
    async function loadAudio() {
      const previews: Record<string, AudioPreview> = {}
      for (const task of state.tasks) {
        if (!task.recordingId) continue
        const blob = await readRecordingBlob(task.recordingId)
        if (blob && !disposed) previews[task.id] = createPreview(blob)
      }
      if (!disposed) setAudioPreviews(previews)
    }
    void loadAudio()
    return () => { disposed = true }
  }, [state.tasks])

  useEffect(() => {
    let disposed = false
    async function loadInterviewAudio() {
      const previews: Record<string, AudioPreview> = {}
      for (const session of mockInterviews) {
        for (const answer of session.answers) {
          if (!answer.recordingId) continue
          const blob = await readRecordingBlob(answer.recordingId)
          if (blob && !disposed) previews[answer.questionId] = createPreview(blob)
        }
      }
      if (!disposed) setInterviewAudioPreviews(previews)
    }
    void loadInterviewAudio()
    return () => { disposed = true }
  }, [mockInterviews])

  useEffect(() => {
    let disposed = false
    async function loadRealInterviewAudio() {
      const previews: Record<string, AudioPreview> = {}
      for (const interview of realInterviews) {
        if (!interview.recordingId) continue
        const blob = await readRecordingBlob(interview.recordingId)
        if (blob && !disposed) previews[interview.id] = createPreview(blob)
      }
      if (!disposed) setRealInterviewAudioPreviews(previews)
    }
    void loadRealInterviewAudio()
    return () => { disposed = true }
  }, [realInterviews])

  useEffect(() => {
    if (!recordingTaskId && !recordingInterviewQuestionId) return undefined
    const timer = window.setInterval(() => {
      setRecordingSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000))
    }, 250)
    return () => window.clearInterval(timer)
  }, [recordingTaskId, recordingInterviewQuestionId])

  useEffect(() => () => stopStream(), [])

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  async function handleUpload(category: UploadCategory, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (category === 'job') {
      if (!file.name.toLowerCase().endsWith('.xlsx')) {
        setJobError('请上传 .xlsx 岗位表。')
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        setJobError('岗位表不能超过 10 MB。')
        return
      }
      try {
        const parsedJobs = await parseJobWorkbook(file)
        if (!parsedJobs.length) throw new Error('未识别到岗位')
        setJobPool(parsedJobs)
        setSelectedJob(null)
        setJobUserStatus({})
        setJobError('')
        setJobMessage(`已解析 ${parsedJobs.length} 个岗位。`)
        saveFileMeta(category, file, '已解析')
      } catch {
        setJobError('岗位表解析失败，请检查是否包含公司和岗位名称列。')
      }
      return
    }
    if (category === 'job-map') {
      saveFileMeta(category, file, '未解析')
      setJobMessage('交互地图已保存；当前版本优先解析 job.xlsx。')
      return
    }
    let parseStatus: CvParseStatus | undefined
    if (category === 'cv') {
      parseStatus = canExtractPlainText(file.name, file.type) ? '已提取文本' : '需要文本版'
      if (parseStatus === '已提取文本') saveCvText(await file.text(), file.name, 'upload')
    }
    saveFileMeta(category, file, '已选择', parseStatus)
  }

  function saveFileMeta(category: UploadCategory, file: File, status: UploadedFileMeta['status'], parseStatus?: CvParseStatus) {
    const meta: UploadedFileMeta = {
      id: `${category}-${file.name}-${file.lastModified}-${file.size}`,
      name: file.name,
      size: file.size,
      type: file.type || getFileExtension(file.name),
      uploadedAt: new Date().toISOString(),
      status,
      category,
      parseStatus,
    }
    commitState((current) => ({
      ...current,
      uploadedFiles: [...current.uploadedFiles.filter((item) => item.category !== category), meta],
    }))
  }

  async function handleCvTextUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !canExtractPlainText(file.name, file.type)) return
    saveCvText(await file.text(), file.name, 'upload')
  }

  function saveCvText(text: string, fileName: string, source: CvTextState['source']) {
    setCvTextState({ text: text.trim(), source, fileName, updatedAt: new Date().toISOString() })
  }

  function removeFile(category: UploadCategory) {
    commitState((current) => ({
      ...current,
      uploadedFiles: current.uploadedFiles.filter((file) => file.category !== category),
    }))
    if (category === 'job') {
      setJobPool([])
      setSelectedJob(null)
    }
  }

  function selectJob(job: JobRecord) {
    setSelectedJob({ ...job, selectedAt: new Date().toISOString() })
    setJobUserStatus((current) => ({
      ...current,
      [job.id]: current[job.id] && current[job.id] !== 'not_started' ? current[job.id] : 'preparing',
    }))
    setActiveView('training')
  }

  function updateJobUserStatus(jobId: string, status: JobUserStatus) {
    setJobUserStatus((current) => ({ ...current, [jobId]: status }))
  }

  function runDailyAction() {
    setActiveView(dailyAction.view)
  }

  async function refreshProviderStatus() {
    setProviderStatusLoading(true)
    setProviderStatusMessage('')
    try {
      const response = await fetch('/api/provider-status', { cache: 'no-store' })
      const result = await response.json() as ProviderStatusPayload | { success: false; error?: string }
      if (!response.ok || !result.success) throw new Error(result.success ? '诊断失败。' : result.error || '诊断失败。')
      setProviderStatus(result)
      setProviderStatusMessage('状态已刷新。')
    } catch (error) {
      setProviderStatusMessage(error instanceof Error ? error.message : '诊断失败。')
    } finally {
      setProviderStatusLoading(false)
    }
  }

  async function testTextProvider() {
    setProviderStatusLoading(true)
    setProviderStatusMessage('')
    try {
      const response = await fetch('/api/analyze-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType: 'analyze_answer',
          trainingRecordId: 'provider-smoke',
          trainingType: 'chineseIntro',
          selectedJob,
          transcript: '这是一次 provider smoke。候选人正在练习 AI 产品岗位自我介绍。',
          durationSeconds: 60,
          targetSeconds: 90,
          cvText: cvTextState.text.slice(0, 1000),
          scriptText: selectedJob ? renderScript(defaultTasks[0].defaultReferenceTemplate, selectedJob) : defaultTasks[0].defaultReferenceTemplate,
        }),
      })
      const result = await response.json() as AnalyzeAnswerResponse
      if (!response.ok || !result.success) throw new Error(result.success ? '文本模型测试失败。' : result.error)
      setProviderStatusMessage(`文本模型测试完成：${result.provider} / ${result.model}${result.provider === 'mock' || result.provider === 'mock_fallback' ? '（模拟或 fallback）' : '（真实模型）'}`)
    } catch (error) {
      setProviderStatusMessage(error instanceof Error ? error.message : '文本模型测试失败。')
    } finally {
      setProviderStatusLoading(false)
    }
  }

  async function testAsrProvider() {
    setProviderStatusLoading(true)
    setProviderStatusMessage('')
    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainingRecordId: 'provider-smoke',
          trainingType: 'chineseIntro',
          selectedJob,
          audioMetadata: { durationSeconds: 30, recordingName: 'provider-smoke.webm' },
        }),
      })
      const result = await response.json() as TranscribeResponse
      if (!response.ok || !result.success) throw new Error(result.success ? '语音转写测试失败。' : result.error)
      setProviderStatusMessage(`语音转写测试完成：${result.provider}${result.provider === 'mock' || result.provider === 'mock_fallback' ? '（模拟或 fallback）' : '（真实 ASR）'}`)
    } catch (error) {
      setProviderStatusMessage(error instanceof Error ? error.message : '语音转写测试失败。')
    } finally {
      setProviderStatusLoading(false)
    }
  }

  async function startRecording(taskId: TaskId) {
    if (recordingTaskId || recordingInterviewQuestionId) return
    setRecorderError('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setRecorderError('当前浏览器不支持录音，请使用最新版 Chrome、Edge 或 Safari。')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = getSupportedAudioMimeType()
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      chunksRef.current = []
      streamRef.current = stream
      mediaRecorderRef.current = recorder
      startedAtRef.current = Date.now()
      setRecordingTaskId(taskId)
      setRecordingInterviewQuestionId(null)
      setRecordingSeconds(0)
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size) chunksRef.current.push(event.data)
      })
      recorder.addEventListener('stop', () => {
        const duration = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        void finishRecording(taskId, blob, duration)
        stopStream()
        mediaRecorderRef.current = null
        chunksRef.current = []
        setRecordingTaskId(null)
        setRecordingSeconds(0)
      })
      recorder.start()
    } catch (error) {
      stopStream()
      setRecordingTaskId(null)
      setRecorderError(error instanceof Error ? error.message : '录音权限被拒绝。')
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
  }

  async function startInterviewAnswerRecording(questionId: string) {
    if (recordingTaskId || recordingInterviewQuestionId) return
    setRecorderError('')
    setMockInterviewMessage('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setRecorderError('当前浏览器不支持录音，请使用最新版 Chrome、Edge 或 Safari。')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = getSupportedAudioMimeType()
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      chunksRef.current = []
      streamRef.current = stream
      mediaRecorderRef.current = recorder
      startedAtRef.current = Date.now()
      setRecordingInterviewQuestionId(questionId)
      setMockInterviews((current) => updateMockSessionPhase(current, activeMockInterview?.id || '', 'answering'))
      setRecordingSeconds(0)
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size) chunksRef.current.push(event.data)
      })
      recorder.addEventListener('stop', () => {
        const duration = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        void finishInterviewAnswerRecording(questionId, blob, duration)
        stopStream()
        mediaRecorderRef.current = null
        chunksRef.current = []
        setRecordingInterviewQuestionId(null)
        setRecordingSeconds(0)
      })
      recorder.start()
    } catch (error) {
      stopStream()
      setRecordingInterviewQuestionId(null)
      setRecorderError(error instanceof Error ? error.message : '录音权限被拒绝。')
    }
  }

  async function finishRecording(taskId: TaskId, blob: Blob, duration: number) {
    const task = state.tasks.find((item) => item.id === taskId)
    if (!task) return
    const recordingId = `answer-${taskId}-${Date.now()}`
    const recordingName = `${task.title}-回答-${formatDateForFile(new Date())}.webm`
    await saveRecordingBlob(recordingId, blob)
    setAudioPreviews((current) => ({ ...current, [taskId]: createPreview(blob) }))
    const now = new Date().toISOString()
    const record: TrainingRecord = {
      id: `${taskId}-${Date.now()}`,
      taskId,
      trainingType: taskIdToTrainingType(taskId),
      title: task.title,
      savedAt: now,
      durationSeconds: duration,
      targetSeconds: task.targetSeconds,
      selectedJob,
      audioMetadata: { recordingId, recordingName, durationSeconds: duration, mimeType: blob.type },
      recordingId,
      recordingName,
      hasDownload: true,
      transcriptStatus: 'not_started',
      aiFeedbackStatus: 'transcript_needed',
    }
    commitState((current) => ({
      ...current,
      tasks: current.tasks.map((item) => item.id === taskId ? {
        ...item,
        done: true,
        savedAt: now,
        durationSeconds: duration,
        recordingId,
        recordingName,
        lastMessage: '已保存录音。下一步：生成转写并获取 AI 反馈。',
      } : item),
      history: [record, ...current.history].slice(0, 50),
    }))
  }

  async function startMockInterview(interviewType: MockInterviewType = 'job_pack_mock') {
    if (!selectedJob) {
      setMockInterviewMessage('请先选择目标岗位。')
      setActiveView('materials')
      return
    }
    setMockInterviewLoading('start')
    setMockInterviewMessage('')
    try {
      const response = await fetch('/api/generate-mock-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType: 'generate_mock_interview',
          selectedJob,
          jobPack: currentJobPack?.jobPack,
          companyKnowledgePack: currentKnowledgePack?.companyKnowledgePack,
          questionBank,
          realInterviewReviews: realInterviews.map((interview) => interview.reviewReport).filter(Boolean).slice(0, 8),
          cvText: cvTextState.text.slice(0, 6000),
          trainingRecords: state.history.slice(0, 20),
          interviewType,
        }),
      })
      const result = await response.json() as GenerateMockInterviewResponse
      if (!response.ok || !result.success) throw new Error(result.success ? '模拟面试生成失败。' : result.error)
      const session: MockInterviewSession = {
        id: `mock-interview-${Date.now()}`,
        selectedJob,
        jobPackId: currentJobPack?.id,
        companyKnowledgePackId: currentKnowledgePack?.id,
        status: 'in_progress',
        uiState: 'waiting_room',
        createdAt: new Date().toISOString(),
        interviewType,
        currentQuestionIndex: 0,
        currentPhase: 'asking',
        questions: result.questions,
        answers: [],
        followUps: [],
      }
      setMockInterviews((current) => [session, ...current].slice(0, 20))
      setMockInterviewMessage(result.provider === 'mock' || result.provider === 'mock_fallback' ? '已生成模拟面试问题。' : '模拟面试已生成。')
    } catch (error) {
      setMockInterviewMessage(error instanceof Error ? error.message : '模拟面试生成失败。')
    } finally {
      setMockInterviewLoading('')
    }
  }

  async function finishInterviewAnswerRecording(questionId: string, blob: Blob, duration: number) {
    const session = activeMockInterview
    const question = session?.questions.find((item) => item.id === questionId)
    if (!session || !question) return
    const recordingId = `mock-answer-${questionId}-${Date.now()}`
    const recordingName = `模拟面试-${questionId}-${formatDateForFile(new Date())}.webm`
    await saveRecordingBlob(recordingId, blob)
    setInterviewAudioPreviews((current) => ({ ...current, [questionId]: createPreview(blob) }))
    const answer: MockInterviewAnswer = {
      id: `answer-${questionId}-${Date.now()}`,
      questionId,
      audioMetadata: { recordingId, recordingName, durationSeconds: duration, mimeType: blob.type },
      recordingId,
      recordingName,
      transcriptStatus: 'not_started',
      aiFeedbackStatus: 'transcript_needed',
      durationSeconds: duration,
      createdAt: new Date().toISOString(),
    }
    setMockInterviews((current) => current.map((item) => item.id === session.id ? {
      ...item,
      currentPhase: 'feedback_ready',
      answers: [answer, ...item.answers.filter((existing) => existing.questionId !== questionId)],
    } : item))
    setMockInterviewMessage('已保存本题录音。下一步生成转写。')
  }

  async function generateInterviewAnswerTranscript(sessionId: string, questionId: string) {
    const session = mockInterviews.find((item) => item.id === sessionId)
    const answer = session?.answers.find((item) => item.questionId === questionId)
    if (!session || !answer) return
    setMockInterviewLoading(`transcript-${questionId}`)
    setMockInterviewMessage('')
    setMockInterviews((current) => updateMockSessionPhase(updateMockAnswer(current, sessionId, questionId, (item) => ({ ...item, transcriptStatus: 'transcribing' })), sessionId, 'transcribing'))
    try {
      const payload = {
        trainingRecordId: answer.id,
        trainingType: questionToTrainingType(session.questions.find((question) => question.id === questionId)?.type),
        audioMetadata: answer.audioMetadata,
        selectedJob: session.selectedJob,
      }
      const blob = answer.recordingId ? await readRecordingBlob(answer.recordingId) : null
      if (answer.recordingId && !blob) setMockInterviewMessage('该记录没有可用音频 Blob，请重新录制或使用模拟转写测试流程。')
      const requestInit: RequestInit = blob
        ? (() => {
          const form = new FormData()
          form.append('payload', JSON.stringify(payload))
          form.append('audio', blob, answer.recordingName || 'mock-answer.webm')
          return { method: 'POST', body: form }
        })()
        : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
      const response = await fetch('/api/transcribe', requestInit)
      const result = await response.json() as TranscribeResponse
      if (!response.ok || !result.success) throw new Error(result.success ? '转写失败。' : result.error)
      const transcript: TranscriptData = {
        text: result.transcript,
        source: result.provider === 'mock' || result.provider === 'mock_fallback' ? 'mock' : 'asr',
        updatedAt: result.generatedAt,
        generatedAt: result.generatedAt,
        provider: result.provider,
        language: result.language,
      }
      setMockInterviews((current) => updateMockSessionPhase(updateMockAnswer(current, sessionId, questionId, (item) => ({
        ...item,
        transcript,
        transcriptStatus: transcript.source === 'mock' ? 'mock_ready' : 'completed',
        aiFeedback: undefined,
        aiFeedbackStatus: 'ready_to_analyze',
      })), sessionId, 'feedback_ready'))
      setMockInterviewMessage(transcript.source === 'mock' ? '已生成模拟转写。' : '本题转写完成。')
    } catch (error) {
      setMockInterviews((current) => updateMockSessionPhase(updateMockAnswer(current, sessionId, questionId, (item) => ({ ...item, transcriptStatus: 'failed', aiFeedbackStatus: 'transcript_needed' })), sessionId, 'asking'))
      setMockInterviewMessage(error instanceof Error ? error.message : '转写失败。')
    } finally {
      setMockInterviewLoading('')
    }
  }

  async function generateInterviewAnswerFeedback(sessionId: string, questionId: string) {
    const session = mockInterviews.find((item) => item.id === sessionId)
    const answer = session?.answers.find((item) => item.questionId === questionId)
    const question = session?.questions.find((item) => item.id === questionId)
    const text = answer?.transcript?.text?.trim()
    if (!session || !answer || !question || !text) {
      setMockInterviewMessage('请先生成本题转写文本。')
      return
    }
    setMockInterviewLoading(`feedback-${questionId}`)
    setMockInterviewMessage('')
    setMockInterviews((current) => updateMockSessionPhase(updateMockAnswer(current, sessionId, questionId, (item) => ({ ...item, aiFeedbackStatus: 'analyzing' })), sessionId, 'analyzing'))
    try {
      const response = await fetch('/api/analyze-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType: 'analyze_answer',
          trainingRecordId: answer.id,
          trainingType: questionToTrainingType(question.type),
          selectedJob: session.selectedJob,
          transcript: text,
          durationSeconds: answer.durationSeconds,
          targetSeconds: question.type === 'project' ? 180 : 90,
          cvText: cvTextState.text.slice(0, 6000),
          scriptText: `面试官问题：${question.question}\n期待重点：${question.expectedFocus}\n准备包：${currentJobPack?.jobPack.selfIntroductionStrategy || ''}\n${currentJobPack?.jobPack.miroProjectStrategy || ''}`,
        }),
      })
      const result = await response.json() as AnalyzeAnswerResponse
      if (!response.ok || !result.success) throw new Error(result.success ? '反馈生成失败。' : result.error)
      const { success: _success, ...aiFeedback } = result
      void _success
      setMockInterviews((current) => updateMockSessionPhase(updateMockAnswer(current, sessionId, questionId, (item) => ({ ...item, aiFeedback, aiFeedbackStatus: 'completed' })), sessionId, 'feedback_ready'))
      setMockInterviewMessage('本题 AI 反馈已保存。')
    } catch (error) {
      setMockInterviews((current) => updateMockSessionPhase(updateMockAnswer(current, sessionId, questionId, (item) => ({ ...item, aiFeedbackStatus: 'failed' })), sessionId, 'feedback_ready'))
      setMockInterviewMessage(error instanceof Error ? error.message : '反馈生成失败。')
    } finally {
      setMockInterviewLoading('')
    }
  }

  async function generateFollowUpQuestion(sessionId: string, questionId: string) {
    const session = mockInterviews.find((item) => item.id === sessionId)
    const question = session?.questions.find((item) => item.id === questionId)
    const answer = session?.answers.find((item) => item.questionId === questionId)
    if (!session || !question || !answer?.transcript || !answer.aiFeedback) {
      setMockInterviewMessage('需要先完成本题转写和 AI 反馈。')
      return
    }
    setMockInterviewLoading(`follow-${questionId}`)
    try {
      const response = await fetch('/api/generate-follow-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskType: 'generate_follow_up', selectedJob: session.selectedJob, question, transcript: answer.transcript.text, aiFeedback: answer.aiFeedback }),
      })
      const result = await response.json() as GenerateFollowUpResponse
      if (!response.ok || !result.success) throw new Error(result.success ? '追问生成失败。' : result.error)
      setMockInterviews((current) => current.map((item) => item.id === sessionId ? { ...item, questions: [...item.questions, result.followUpQuestion], followUps: [...item.followUps, result.followUpQuestion], currentQuestionIndex: item.questions.length, currentPhase: 'follow_up' } : item))
      setMockInterviewMessage('已生成追问。')
    } catch (error) {
      setMockInterviewMessage(error instanceof Error ? error.message : '追问生成失败。')
    } finally {
      setMockInterviewLoading('')
    }
  }

  function nextInterviewQuestion(sessionId: string) {
    setMockInterviews((current) => current.map((session) => session.id === sessionId ? { ...session, currentQuestionIndex: Math.min(session.currentQuestionIndex + 1, session.questions.length - 1), currentPhase: 'asking' } : session))
  }

  function enterMockInterviewRoom(sessionId: string) {
    setMockInterviews((current) => current.map((session) => session.id === sessionId ? {
      ...session,
      uiState: 'interview_room',
      startedAt: session.startedAt || new Date().toISOString(),
      currentPhase: 'asking',
    } : session))
  }

  async function finishMockInterview(sessionId: string) {
    const session = mockInterviews.find((item) => item.id === sessionId)
    if (!session) return
    setMockInterviewLoading('report')
    setMockInterviewMessage('')
    try {
      const response = await fetch('/api/generate-interview-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType: 'generate_interview_report',
          selectedJob: session.selectedJob,
          jobPack: currentJobPack?.jobPack,
          questions: session.questions,
          answers: session.answers.map((answer) => ({
            questionId: answer.questionId,
            question: session.questions.find((question) => question.id === answer.questionId)?.question || '',
            transcript: answer.transcript,
            transcriptStatus: answer.transcriptStatus,
            aiFeedback: answer.aiFeedback,
            aiFeedbackStatus: answer.aiFeedbackStatus,
            durationSeconds: answer.durationSeconds,
          })),
        }),
      })
      const result = await response.json() as GenerateInterviewReportResponse
      if (!response.ok || !result.success) throw new Error(result.success ? '整场复盘生成失败。' : result.error)
      setMockInterviews((current) => current.map((item) => item.id === sessionId ? {
        ...item,
        status: 'completed',
        uiState: 'review_room',
        currentPhase: 'completed',
        completedAt: new Date().toISOString(),
        finalReport: {
          provider: result.provider,
          model: result.model,
          generatedAt: result.generatedAt,
          report: result.finalReport,
          rawProviderNote: result.rawProviderNote,
        },
      } : item))
      setMockInterviewMessage('整场复盘已生成。')
    } catch (error) {
      setMockInterviewMessage(error instanceof Error ? error.message : '整场复盘生成失败。')
    } finally {
      setMockInterviewLoading('')
    }
  }

  function deleteMockInterview(sessionId: string) {
    setMockInterviews((current) => current.filter((session) => session.id !== sessionId))
  }

  async function handleRealInterviewAudioUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !selectedJob) {
      if (!selectedJob) setRealInterviewMessage('请先选择目标岗位。')
      return
    }
    const recordingId = `real-interview-${Date.now()}`
    await saveRecordingBlob(recordingId, file)
    const now = new Date().toISOString()
    const interview: StoredRealInterview = {
      id: `real-${Date.now()}`,
      selectedJob,
      relatedMockInterviewId: activeMockInterview?.id,
      recordingId,
      recordingName: file.name,
      audioMetadata: { recordingId, recordingName: file.name, durationSeconds: 0, mimeType: file.type },
      transcriptStatus: 'not_started',
      extractedQuestions: [],
      extractedAnswers: [],
      createdAt: now,
      updatedAt: now,
    }
    setRealInterviewAudioPreviews((current) => ({ ...current, [interview.id]: createPreview(file) }))
    setRealInterviews((current) => [interview, ...current].slice(0, 20))
    setRealInterviewMessage('真实面试录音已保存到本地。下一步生成转写。')
  }

  async function generateRealInterviewTranscript(interviewId: string) {
    const interview = realInterviews.find((item) => item.id === interviewId)
    if (!interview) return
    setRealInterviewLoading(`transcript-${interviewId}`)
    setRealInterviewMessage('')
    setRealInterviews((current) => current.map((item) => item.id === interviewId ? { ...item, transcriptStatus: 'transcribing', updatedAt: new Date().toISOString() } : item))
    try {
      const payload = {
        trainingRecordId: interview.id,
        trainingType: 'chineseIntro',
        audioMetadata: interview.audioMetadata,
        selectedJob: interview.selectedJob,
        sourceType: 'real_interview',
      }
      const blob = interview.recordingId ? await readRecordingBlob(interview.recordingId) : null
      if (!blob) throw new Error('该记录没有可用音频文件，请重新上传录音，或使用模拟转写测试流程。')
      const form = new FormData()
      form.append('payload', JSON.stringify(payload))
      form.append('audio', blob, interview.recordingName || 'real-interview.webm')
      const response = await fetch('/api/transcribe', { method: 'POST', body: form })
      const result = await response.json() as TranscribeResponse
      if (!response.ok || !result.success) throw new Error(result.success ? '转写失败。' : result.error)
      const transcript: TranscriptData = {
        text: result.transcript,
        source: result.provider === 'mock' || result.provider === 'mock_fallback' ? 'mock' : 'asr',
        updatedAt: result.generatedAt,
        generatedAt: result.generatedAt,
        provider: result.provider,
        language: result.language,
      }
      setRealInterviews((current) => current.map((item) => item.id === interviewId ? {
        ...item,
        transcript,
        transcriptStatus: transcript.source === 'mock' ? 'mock_ready' : 'completed',
        updatedAt: new Date().toISOString(),
      } : item))
      setRealInterviewMessage(transcript.source === 'mock' ? '已生成模拟真实面试转写。' : '真实面试转写完成。')
    } catch (error) {
      setRealInterviews((current) => current.map((item) => item.id === interviewId ? { ...item, transcriptStatus: 'failed', updatedAt: new Date().toISOString() } : item))
      setRealInterviewMessage(error instanceof Error ? error.message : '真实面试转写失败。')
    } finally {
      setRealInterviewLoading('')
    }
  }

  async function reviewRealInterview(interviewId: string) {
    const interview = realInterviews.find((item) => item.id === interviewId)
    if (!interview?.transcript?.text) {
      setRealInterviewMessage('请先生成真实面试转写。')
      return
    }
    setRealInterviewLoading(`review-${interviewId}`)
    setRealInterviewMessage('')
    try {
      const response = await fetch('/api/review-real-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType: 'review_real_interview',
          selectedJob: interview.selectedJob,
          transcript: interview.transcript.text,
          jobPack: currentJobPack?.jobPack,
          mockInterview: activeMockInterview,
          trainingRecords: state.history.slice(0, 20),
          cvText: cvTextState.text.slice(0, 8000),
        }),
      })
      const result = await response.json() as ReviewRealInterviewResponse
      if (!response.ok || !result.success) throw new Error(result.success ? '真实面试复盘失败。' : result.error)
      setRealInterviews((current) => current.map((item) => item.id === interviewId ? {
        ...item,
        extractedQuestions: result.extractedQuestions,
        extractedAnswers: result.extractedAnswers,
        comparison: result.comparison,
        reviewReport: result.reviewReport,
        provider: result.provider,
        model: result.model,
        generatedAt: result.generatedAt,
        rawProviderNote: result.rawProviderNote,
        updatedAt: new Date().toISOString(),
      } : item))
      setQuestionBank((current) => mergeQuestionBank(current, result.reviewReport.questionBankUpdates, interview.selectedJob.id))
      setRealInterviewMessage('真实面试复盘已生成，并已反补题库。')
    } catch (error) {
      setRealInterviewMessage(error instanceof Error ? error.message : '真实面试复盘失败。')
    } finally {
      setRealInterviewLoading('')
    }
  }

  function deleteRealInterview(interviewId: string) {
    setRealInterviews((current) => current.filter((interview) => interview.id !== interviewId))
  }

  async function handleCompanySourceUpload(type: CompanySourceInput['type'], event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !selectedJob) {
      if (!selectedJob) setCompanyKnowledgeMessage('请先选择目标岗位。')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setCompanyKnowledgeMessage('公司资料文本不能超过 2 MB。')
      return
    }
    const text = await readSourceFileText(file)
    const now = new Date().toISOString()
    const source: CompanySourceInput = {
      id: `company-source-${Date.now()}`,
      selectedJobId: selectedJob.id,
      type,
      title: file.name,
      sourceName: file.name,
      text,
      wordCount: countTextUnits(text),
      uploadedAt: now,
    }
    setCompanySources((current) => [source, ...current].slice(0, 40))
    setCompanyKnowledgeMessage('公司资料已读取。下一步生成公司知识包。')
  }

  async function generateCompanyKnowledgePack() {
    if (!selectedJob) {
      setCompanyKnowledgeMessage('请先选择目标岗位。')
      setActiveView('materials')
      return
    }
    setCompanyKnowledgeLoading(true)
    setCompanyKnowledgeMessage('')
    try {
      const response = await fetch('/api/generate-company-knowledge-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType: 'generate_company_knowledge_pack',
          selectedJob,
          jobPack: currentJobPack?.jobPack,
          companySources: currentCompanySources,
          cvText: cvTextState.text.slice(0, 8000),
          realInterviewReviews: realInterviews.map((interview) => interview.reviewReport).filter(Boolean).slice(0, 8),
        }),
      })
      const result = await response.json() as GenerateCompanyKnowledgePackResponse
      if (!response.ok || !result.success) throw new Error(result.success ? '公司知识包生成失败。' : result.error)
      const pack: StoredCompanyKnowledgePack = {
        id: `${selectedJob.id || selectedJob.companyName}-knowledge-${Date.now()}`,
        selectedJobId: selectedJob.id,
        selectedJob,
        provider: result.provider,
        model: result.model,
        generatedAt: result.generatedAt,
        companyKnowledgePack: result.companyKnowledgePack,
        sourceIds: currentCompanySources.map((source) => source.id),
        rawProviderNote: result.rawProviderNote,
      }
      setCompanyKnowledgePacks((current) => [pack, ...current.filter((item) => item.selectedJobId !== selectedJob.id)].slice(0, 20))
      setCompanyKnowledgeMessage(result.provider === 'mock' || result.provider === 'mock_fallback' ? '已生成模拟公司知识包。' : '公司知识包已生成。')
    } catch (error) {
      setCompanyKnowledgeMessage(error instanceof Error ? error.message : '公司知识包生成失败。')
    } finally {
      setCompanyKnowledgeLoading(false)
    }
  }

  function deleteCompanySource(sourceId: string) {
    setCompanySources((current) => current.filter((source) => source.id !== sourceId))
  }

  function deleteCompanyKnowledgePack(packId: string) {
    setCompanyKnowledgePacks((current) => current.filter((pack) => pack.id !== packId))
  }

  async function resetTask(taskId: TaskId) {
    const task = state.tasks.find((item) => item.id === taskId)
    if (task?.recordingId) await deleteRecordingBlob(task.recordingId)
    commitState((current) => ({
      ...current,
      tasks: current.tasks.map((item) => item.id === taskId ? { ...getDefaultTask(taskId) } : item),
    }))
    setAudioPreviews((current) => {
      const next = { ...current }
      delete next[taskId]
      return next
    })
  }

  function beginScriptEdit(task: TrainingTask) {
    setAdvancedScriptId(task.id)
    setScriptDraft(scriptTemplates[task.scriptKey] || task.defaultReferenceTemplate)
  }

  function saveScript(task: TrainingTask) {
    setScriptTemplates((current) => ({
      ...current,
      [task.scriptKey]: scriptDraft.trim() || task.defaultReferenceTemplate,
      updatedAt: new Date().toISOString(),
    }))
    setAdvancedScriptId(null)
  }

  function restoreScript(task: TrainingTask) {
    if (!window.confirm('确认恢复默认参考稿？')) return
    setScriptTemplates((current) => {
      const next = { ...current, updatedAt: new Date().toISOString() }
      delete next[task.scriptKey]
      return next
    })
  }

  function exportBackup() {
    const payload: BackupPayload = {
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      uploadedFiles: state.uploadedFiles,
      jobPool,
      selectedJob,
      cvText: cvTextState,
      scriptTemplates,
      trainingRecords: state.history,
      jobPacks,
      mockInterviews,
      realInterviews,
      questionBank,
      companySources,
      companyKnowledgePacks,
      jobUserStatus,
    }
    downloadJson(payload, `interview-os-backup-${formatDateForFileName(new Date())}.json`)
    setBackupMessage('已导出备份。')
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as Partial<BackupPayload>
      if (!isValidBackup(parsed)) throw new Error('字段不完整')
      if (!window.confirm('导入会覆盖当前本地数据，确认继续？')) return
      const records = normalizeTrainingRecords(parsed.trainingRecords)
      setJobPool(parsed.jobPool)
      setSelectedJob(parsed.selectedJob)
      setCvTextState(parsed.cvText)
      setScriptTemplates(parsed.scriptTemplates)
      setJobPacks(normalizeJobPacks(parsed.jobPacks))
      setMockInterviews(normalizeMockInterviews(parsed.mockInterviews))
      setRealInterviews(normalizeRealInterviews(parsed.realInterviews))
      setQuestionBank(normalizeQuestionBank(parsed.questionBank))
      setCompanySources(normalizeCompanySources(parsed.companySources))
      setCompanyKnowledgePacks(normalizeCompanyKnowledgePacks(parsed.companyKnowledgePacks))
      setJobUserStatus(normalizeJobUserStatus(parsed.jobUserStatus))
      setState({
        uploadedFiles: normalizeFiles(parsed.uploadedFiles),
        tasks: defaultTasks.map((task) => {
          const latest = records.find((record) => record.taskId === task.id)
          return latest ? {
            ...task,
            done: isToday(latest.savedAt),
            savedAt: latest.savedAt,
            durationSeconds: latest.durationSeconds,
            recordingId: latest.recordingId,
            recordingName: latest.recordingName,
          } : task
        }),
        history: records,
        lastSavedAt: new Date().toISOString(),
      })
      setBackupMessage('导入成功。')
      setImportError('')
    } catch {
      setImportError('导入失败：不是有效的 Interview OS JSON 备份。')
    }
  }

  async function clearAllData() {
    if (!window.confirm('确认清空全部本地数据？此操作不可恢复。')) return
    for (const key of [STORAGE_KEY, UPLOADED_FILES_KEY, JOB_POOL_KEY, SELECTED_JOB_KEY, LEGACY_TARGET_ROLE_KEY, CV_TEXT_KEY, SCRIPT_TEMPLATES_KEY, TRAINING_RECORDS_KEY, JOB_PACKS_KEY, MOCK_INTERVIEWS_KEY, REAL_INTERVIEWS_KEY, QUESTION_BANK_KEY, COMPANY_SOURCES_KEY, COMPANY_KNOWLEDGE_PACKS_KEY, JOB_USER_STATUS_KEY]) {
      localStorage.removeItem(key)
    }
    await deleteRecordingDatabase()
    setState(defaultState)
    setJobPool([])
    setSelectedJob(null)
    setCvTextState({ text: '', source: 'upload' })
    setScriptTemplates({})
    setJobPacks([])
    setMockInterviews([])
    setRealInterviews([])
    setQuestionBank([])
    setCompanySources([])
    setCompanyKnowledgePacks([])
    setJobUserStatus({})
    setLegacyRole(null)
    setAudioPreviews({})
    setBackupMessage('已清空全部本地数据。')
  }

  async function generateJobPack() {
    if (!selectedJob) {
      setJobPackMessage('请先在“资料与岗位”中选择目标岗位。')
      return
    }
    setJobPackLoading(true)
    setJobPackMessage('')
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 30_000)
    try {
      const response = await fetch('/api/generate-job-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          taskType: 'generate_job_pack',
          selectedJob,
          companyKnowledgePack: currentKnowledgePack?.companyKnowledgePack,
          cvText: cvTextState.text.slice(0, 8000),
          trainingRecords: state.history.slice(0, 20),
          aiFeedbackRecords: state.history.map((record) => record.aiFeedback).filter(Boolean),
          scriptTemplates,
        }),
      })
      const result = await response.json() as GenerateJobPackResponse
      if (!response.ok || !result.success) throw new Error(result.success ? '岗位准备包生成失败。' : result.error)
      const pack: StoredJobPack = {
        id: `${selectedJob.id || selectedJob.companyName}-${Date.now()}`,
        selectedJobId: selectedJob.id,
        selectedJob,
        provider: result.provider,
        model: result.model,
        generatedAt: result.generatedAt,
        jobPack: result.jobPack,
        rawProviderNote: result.rawProviderNote,
      }
      setJobPacks((current) => [pack, ...current.filter((item) => item.selectedJobId !== selectedJob.id)].slice(0, 20))
      setJobPackMessage(result.provider === 'mock' || result.provider === 'mock_fallback' ? '已生成模拟岗位准备包。' : '岗位准备包已生成。')
    } catch (error) {
      setJobPackMessage(error instanceof Error && error.name === 'AbortError' ? '请求超时，未覆盖已有准备包。' : error instanceof Error ? error.message : '岗位准备包生成失败。')
    } finally {
      clearTimeout(timeout)
      setJobPackLoading(false)
    }
  }

  function deleteJobPack(packId: string) {
    setJobPacks((current) => current.filter((pack) => pack.id !== packId))
    setJobPackMessage('已删除岗位准备包。')
  }

  function exportJobPack(pack: StoredJobPack) {
    downloadJson(pack, `interview-os-job-pack-${formatDateForFileName(new Date())}.json`)
    setJobPackMessage('已导出岗位准备包。')
  }

  const sharedRecordProps = {
    currentJob: selectedJob,
    cvText: cvTextState.text,
    tasks: state.tasks,
    scriptTemplates,
    onUpdate: updateRecord,
    expandedId: expandedHistoryId,
    onExpand: setExpandedHistoryId,
  }

  return (
    <div className="app-frame">
      <header className="top-nav">
        <button className="brand" type="button" onClick={() => setActiveView('today')}>
          <span>IO</span><strong>Interview OS</strong><em>V{APP_VERSION}</em>
        </button>
        <nav aria-label="主导航">
          {navigation.map((item) => (
            <button className={activeView === item.id ? 'active' : ''} type="button" key={item.id} onClick={() => setActiveView(item.id)}>
              {item.icon}<span>{item.label}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="product-page">
        {activeView === 'today' && (
          <Page title="今日下一步" subtitle={selectedJob ? `${selectedJob.companyName} · ${selectedJob.jobTitle}` : '先建立今天的目标岗位。'}>
            <section className="daily-workbench" data-testid="daily-workbench">
              <div className="daily-main">
                <span className="eyebrow">推荐动作</span>
                <h2>{dailyAction.title}</h2>
                <p>{dailyAction.detail}</p>
                <button className="primary-button" type="button" onClick={runDailyAction}>
                  {dailyAction.icon}{dailyAction.cta}
                </button>
              </div>
              <aside className="daily-context">
                <div>
                  <span>当前岗位</span>
                  <strong>{selectedJob ? selectedJob.jobTitle : '未选择'}</strong>
                  <p>{selectedJob ? `${selectedJob.companyName} · ${selectedJob.city || '城市未写'}` : '岗位来自 job.xlsx，不手填。'}</p>
                </div>
                <div>
                  <span>最近状态</span>
                  <strong>{getLatestActivityLabel(state.history, mockInterviews, realInterviews)}</strong>
                  <p>{currentJobPack ? '准备包已生成' : selectedJob ? '准备包待生成' : '等待岗位表'}</p>
                </div>
              </aside>
            </section>
            <section className="today-compact-status" aria-label="今日训练状态">
              <Metric label="今日录音" value={`${completedCount}/3`} />
              <Metric label="AI 反馈" value={`${analyzedToday}/${todayRecords.length || 0}`} />
              <Metric label="岗位库" value={`${jobPool.length}`} />
            </section>
            <section className="daily-remaining">
              <div>
                <span className="eyebrow">还差什么</span>
                <ul>{nextActions.slice(0, 3).map((action) => <li key={action}>{action}</li>)}</ul>
              </div>
              <div>
                <span className="eyebrow">数据状态</span>
                <p>{buildDataStatusText({ jobPool, selectedJob, jobPacks, mockInterviews, realInterviews, companySources })}</p>
              </div>
            </section>
          </Page>
        )}

        {activeView === 'materials' && (
          <Page title="资料与岗位" subtitle="上传资料，解析岗位表，选择本次训练岗位。">
            <section className="section-block">
              <SectionHeading icon={<Upload size={20} />} title="资料" />
              <div className="upload-list">
                <UploadRow title="CV 文件" hint="TXT / MD 可读取；PDF / DOCX 仅保存文件状态" file={cvFile} button="上传 CV" accept=".pdf,.doc,.docx,.txt,.md" onChange={(event) => void handleUpload('cv', event)} onRemove={() => removeFile('cv')} />
                <UploadRow title="CV 文本版" hint="上传 TXT / Markdown，不需要手动填写" file={cvTextState.fileName ? toCvTextMeta(cvTextState) : undefined} button="上传文本版" accept=".txt,.md,text/plain,text/markdown" onChange={(event) => void handleCvTextUpload(event)} onRemove={() => setCvTextState({ text: '', source: 'upload' })} />
                <UploadRow title="项目资料" hint="保存项目资料文件名和状态" file={projectFile} button="上传项目资料" accept=".pdf,.doc,.docx,.txt,.md" onChange={(event) => void handleUpload('project', event)} onRemove={() => removeFile('project')} />
                <UploadRow title="交互地图 HTML" hint="当前仅保存 metadata" file={jobMapFile} button="上传 HTML" accept=".html,text/html" onChange={(event) => void handleUpload('job-map', event)} onRemove={() => removeFile('job-map')} />
              </div>
              <p className="quiet-status">{getCvStatusText(cvFile, cvTextState)}</p>
            </section>

            <section className="section-block">
              <SectionHeading icon={<BriefcaseBusiness size={20} />} title="岗位库" />
              <div className="job-upload-line">
                <div><strong>job.xlsx</strong><span>{jobFile ? `${jobFile.name} · ${jobPool.length} 个岗位` : '尚未上传岗位表'}</span></div>
                <label className="small-upload-button"><input type="file" accept=".xlsx" onChange={(event) => void handleUpload('job', event)} /><Upload size={15} />{jobFile ? '重新上传' : '上传 job.xlsx'}</label>
              </div>
              {jobMessage && <p className="success-line">{jobMessage}</p>}
              {jobError && <p className="error-line">{jobError}</p>}
              {selectedJob && <div className="selected-job"><span>当前岗位</span><strong>{selectedJob.companyName} · {selectedJob.jobTitle}</strong><p>{selectedJob.city || '城市未写'} · {selectedJob.mainTrack || '方向未写'}</p></div>}
              {jobPool.length > 0 ? (
                <>
                  <JobStats stats={jobStats} />
                  <div className="job-smart-filters">
                    <label className="job-search"><span>搜索</span><input value={filters.search} placeholder="公司、岗位、JD、城市、主线" onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></label>
                    <FilterSelect label="岗位族群" value={filters.roleFamily} options={filterOptions.roleFamily} onChange={(value) => setFilters({ ...filters, roleFamily: value })} />
                    <FilterSelect label="求职主线" value={filters.roleTrack} options={filterOptions.roleTrack} onChange={(value) => setFilters({ ...filters, roleTrack: value })} />
                    <FilterSelect label="城市组" value={filters.cityGroup} options={filterOptions.cityGroup} onChange={(value) => setFilters({ ...filters, cityGroup: value })} />
                    <FilterSelect label="优先级" value={filters.priorityBucket} options={filterOptions.priorityBucket} onChange={(value) => setFilters({ ...filters, priorityBucket: value })} />
                    <FilterSelect label="准备状态" value={filters.userStatus} options={JOB_USER_STATUS_OPTIONS.map((item) => item.value)} getLabel={jobUserStatusLabel} onChange={(value) => setFilters({ ...filters, userStatus: value as JobFilters['userStatus'] })} />
                    <label><span>排序</span><select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value as JobSortMode })}><option value="match">匹配度最高</option><option value="priority">优先级最高</option><option value="today">今日新增优先</option><option value="city">城市优先</option><option value="family">岗位族群</option></select></label>
                  </div>
                  <div className="risk-filter-bar">
                    <RiskToggle label="隐藏不适合" checked={filters.hideRejected} onChange={(checked) => setFilters({ ...filters, hideRejected: checked })} />
                    <RiskToggle label="隐藏强代码" checked={filters.hideStrongCode} onChange={(checked) => setFilters({ ...filters, hideStrongCode: checked })} />
                    <RiskToggle label="隐藏纯算法" checked={filters.hideAlgorithm} onChange={(checked) => setFilters({ ...filters, hideAlgorithm: checked })} />
                    <RiskToggle label="隐藏强销售" checked={filters.hideSales} onChange={(checked) => setFilters({ ...filters, hideSales: checked })} />
                    <RiskToggle label="隐藏长期驻场" checked={filters.hideOnsite} onChange={(checked) => setFilters({ ...filters, hideOnsite: checked })} />
                    <RiskToggle label="隐藏高频出差" checked={filters.hideTravel} onChange={(checked) => setFilters({ ...filters, hideTravel: checked })} />
                    <RiskToggle label="隐藏低薪" checked={filters.hideLowSalary} onChange={(checked) => setFilters({ ...filters, hideLowSalary: checked })} />
                    <RiskToggle label="隐藏高年限" checked={filters.hideHighExperience} onChange={(checked) => setFilters({ ...filters, hideHighExperience: checked })} />
                  </div>
                  <div className="job-list">
                    {filteredJobs.slice(0, 30).map((job) => {
                      const status = getJobUserStatus(jobUserStatus, job.id)
                      const readiness = buildJobReadiness(job, { status, jobPacks, mockInterviews, realInterviews, history: state.history })
                      return (
                      <article className={`job-row ${selectedJob?.id === job.id ? 'selected' : ''}`} key={job.id}>
                        <div>
                          <strong>{job.companyName} · {job.jobTitle}</strong>
                          <span>{[job.city, job.jobType, job.salary, job.sourceSheet].filter(Boolean).join(' · ')}</span>
                          <div className="job-tags">
                            <em>{job.normalized.roleFamily}</em>
                            <em>{job.normalized.roleTrack}</em>
                            <em>{job.normalized.priorityBucket}</em>
                            <em>{job.normalized.matchScore} 分</em>
                            <em className="status">{jobUserStatusLabel(status)}</em>
                            {job.normalized.riskFlags.map((flag) => <em className="risk" key={flag}>{flag}</em>)}
                          </div>
                          <p>{job.normalized.matchReasons.slice(0, 3).join('；')}</p>
                          <div className="job-readiness">
                            {readiness.signals.map((signal) => <span key={signal}>{signal}</span>)}
                            <strong>{readiness.nextStep}</strong>
                          </div>
                        </div>
                        <div className="job-row-actions">
                          <select aria-label={`设置 ${job.jobTitle} 状态`} value={status} onChange={(event) => updateJobUserStatus(job.id, event.target.value as JobUserStatus)}>
                            {JOB_USER_STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                          </select>
                          <button type="button" onClick={() => updateJobUserStatus(job.id, 'shortlisted')}>加入短名单</button>
                          <button type="button" onClick={() => updateJobUserStatus(job.id, 'preparing')}>准备中</button>
                          <button type="button" onClick={() => selectJob(job)}>{selectedJob?.id === job.id ? '已选择' : '选择岗位'}</button>
                        </div>
                      </article>
                    )})}
                  </div>
                </>
              ) : <p className="empty-state">上传 job.xlsx 后，岗位会显示在这里。</p>}
              {legacyRole && <div className="legacy-notice"><span>检测到旧版岗位数据，仅作兼容提示。</span><button type="button" onClick={() => { localStorage.removeItem(LEGACY_TARGET_ROLE_KEY); setLegacyRole(null) }}>清理旧数据</button></div>}
            </section>
          </Page>
        )}

        {activeView === 'training' && (
          <Page title="训练" subtitle={selectedJob ? `${selectedJob.companyName} · ${selectedJob.jobTitle}` : '未选择岗位时仅可进行通用训练。'}>
            {recorderError && <p className="error-line">{recorderError}</p>}
            <div className="task-list">
              {state.tasks.map((task) => {
                const preview = audioPreviews[task.id]
                const rawScript = scriptTemplates[task.scriptKey] || task.defaultReferenceTemplate
                const renderedScript = selectedJob ? renderScript(rawScript, selectedJob) : rawScript
                const isRecording = recordingTaskId === task.id
                return (
                  <section className="training-task" key={task.id}>
                    <header>
                      <div><span>{task.subtitle}</span><h2>{task.title}</h2><p>{task.prompt}</p></div>
                      {task.done && <Check size={22} />}
                    </header>
                    <div className="training-detail">
                      <div><span>记忆骨架</span><ul>{task.memorySkeleton.map((item) => <li key={item}>{item}</li>)}</ul></div>
                      <div><span>参考稿</span><p>{renderedScript}</p></div>
                    </div>
                    <details className="advanced-details">
                      <summary onClick={() => beginScriptEdit(task)}><ChevronDown size={16} />高级：编辑参考稿</summary>
                      {advancedScriptId === task.id && <div className="script-editor"><textarea value={scriptDraft} onChange={(event) => setScriptDraft(event.target.value)} rows={7} /><div className="inline-actions"><button className="primary-button" type="button" onClick={() => saveScript(task)}>保存</button><button type="button" onClick={() => restoreScript(task)}>恢复默认</button></div></div>}
                    </details>
                    <div className="recorder-controls">
                      <button className="primary-button" type="button" onClick={() => void startRecording(task.id)} disabled={Boolean(recordingTaskId)}><Mic size={16} />{isRecording ? `录音中 ${formatDuration(recordingSeconds)}` : '开始录音'}</button>
                      <button type="button" onClick={stopRecording} disabled={!isRecording}><Square size={15} />停止</button>
                      <button type="button" onClick={() => void resetTask(task.id)}><RotateCcw size={15} />重练</button>
                    </div>
                    {preview && <div className="audio-result"><audio controls src={preview.url} /><a href={preview.url} download={task.recordingName}><Download size={15} />下载</a><span>{formatDuration(task.durationSeconds || 0)} · {formatFileSize(preview.size)}</span></div>}
                    {task.lastMessage && <p className="success-line">{task.lastMessage}</p>}
                  </section>
                )
              })}
            </div>
          </Page>
        )}

        {activeView === 'history' && (
          <Page title="训练历史" subtitle="录音记录、转写状态和 AI 反馈状态。">
            <RecordList records={state.history} mode="history" {...sharedRecordProps} onDelete={(id) => commitState((current) => ({ ...current, history: current.history.filter((item) => item.id !== id) }))} />
          </Page>
        )}

        {activeView === 'feedback' && (
          <Page title="AI 反馈" subtitle="转写完成后，由 AI 负责评分、诊断、改稿和下一步任务。">
            <div className="feedback-summary">
              <Metric label="等待转写" value={`${state.history.filter((item) => item.transcriptStatus === 'not_started' || item.transcriptStatus === 'failed').length}`} />
              <Metric label="待分析" value={`${state.history.filter((item) => item.aiFeedbackStatus === 'ready_to_analyze').length}`} />
              <Metric label="已完成" value={`${state.history.filter((item) => item.aiFeedbackStatus === 'completed').length}`} />
            </div>
            <RecordList records={state.history} mode="feedback" {...sharedRecordProps} />
          </Page>
        )}

        {activeView === 'jobPack' && (
          <Page title="岗位准备包" subtitle="根据岗位表、CV 文本和训练记录生成，不需要手填。">
            {!selectedJob ? (
              <section className="primary-flow">
                <div>
                  <span className="eyebrow">尚未选择岗位</span>
                  <h2>先选择目标岗位</h2>
                  <p>岗位准备包只能基于 job.xlsx 中的岗位生成。</p>
                </div>
                <button className="primary-button" type="button" onClick={() => setActiveView('materials')}><Upload size={17} />去选择岗位</button>
              </section>
            ) : (
              <>
                <section className="primary-flow">
                  <div>
                    <span className="eyebrow">当前岗位</span>
                    <h2>{selectedJob.jobTitle}</h2>
                    <p>{selectedJob.companyName} · {selectedJob.city || '城市未写'} · {selectedJob.mainTrack || selectedJob.companyBusiness || '方向未写'}</p>
                  </div>
                  <button className="primary-button" type="button" onClick={() => void generateJobPack()} disabled={jobPackLoading}>
                    <Sparkles size={17} />{jobPackLoading ? '生成中…' : currentJobPack ? '重新生成准备包' : '生成岗位准备包'}
                  </button>
                </section>
                {jobPackMessage && <p className={jobPackMessage.includes('失败') || jobPackMessage.includes('超时') ? 'error-line' : 'success-line'}>{jobPackMessage}</p>}
                {currentJobPack ? (
                  <JobPackReport pack={currentJobPack} onDelete={() => deleteJobPack(currentJobPack.id)} onExport={() => exportJobPack(currentJobPack)} />
                ) : (
                  <p className="empty-state">还没有岗位准备包。生成后会保存到本地，刷新后不会丢。</p>
                )}
              </>
            )}
          </Page>
        )}

        {activeView === 'mockInterview' && (
          <Page title="模拟面试" subtitle={selectedJob ? `${selectedJob.companyName} · ${selectedJob.jobTitle}` : '请先选择目标岗位。'}>
            {!selectedJob ? (
              <section className="primary-flow compact-empty">
                <p className="empty-state">请先选择目标岗位。</p>
                <button className="primary-button" type="button" onClick={() => setActiveView('materials')}><BriefcaseBusiness size={17} />选择岗位</button>
              </section>
            ) : (
              <>
                <section className="primary-flow interview-lobby" data-testid="interview-lobby">
                  <div>
                    <span className="eyebrow">面试大厅</span>
                    <h2>{selectedJob.companyName}</h2>
                    <p>{selectedJob.jobTitle}</p>
                  </div>
                  <div className="interview-lobby-actions">
                    <div className="interview-type-grid" aria-label="面试类型">
                      {([
                        ['job_pack_mock', 'AI 产品'],
                        ['quick_mock', '快速'],
                        ['pressure_mock', '压力'],
                      ] as Array<[MockInterviewType, string]>).map(([type, label]) => (
                        <button
                          key={type}
                          className={selectedMockType === type ? 'active' : ''}
                          type="button"
                          onClick={() => setSelectedMockType(type)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="recent-interview">
                      <span>最近</span>
                      <strong>{activeMockInterview ? `${activeMockInterview.selectedJob.companyName} · ${activeMockInterview.status === 'completed' ? '已复盘' : '进行中'}` : '暂无'}</strong>
                    </div>
                    <div className="inline-actions">
                      <button className="primary-button" type="button" onClick={() => void startMockInterview(selectedMockType)} disabled={Boolean(mockInterviewLoading)}>
                        <MessagesSquare size={17} />{mockInterviewLoading === 'start' ? '生成中…' : '开始新面试'}
                      </button>
                      {!currentJobPack && <button type="button" onClick={() => setActiveView('jobPack')}>准备包</button>}
                    </div>
                  </div>
                </section>
                {recorderError && <p className="error-line">{recorderError}</p>}
                {mockInterviewMessage && <p className={mockInterviewMessage.includes('失败') || mockInterviewMessage.includes('缺少') ? 'error-line' : 'success-line'}>{mockInterviewMessage}</p>}
                {activeMockInterview ? (
                  <MockInterviewPanel
                    session={activeMockInterview}
                    currentQuestion={activeMockInterview.questions[activeMockInterview.currentQuestionIndex]}
                    currentAnswer={activeMockInterview.answers.find((answer) => answer.questionId === activeMockInterview.questions[activeMockInterview.currentQuestionIndex]?.id)}
                    preview={interviewAudioPreviews[activeMockInterview.questions[activeMockInterview.currentQuestionIndex]?.id]}
                    loading={mockInterviewLoading}
                    recordingQuestionId={recordingInterviewQuestionId}
                    recordingSeconds={recordingSeconds}
                    onStartRecording={(questionId) => void startInterviewAnswerRecording(questionId)}
                    onStopRecording={stopRecording}
                    onTranscript={(questionId) => void generateInterviewAnswerTranscript(activeMockInterview.id, questionId)}
                    onFeedback={(questionId) => void generateInterviewAnswerFeedback(activeMockInterview.id, questionId)}
                    onFollowUp={(questionId) => void generateFollowUpQuestion(activeMockInterview.id, questionId)}
                    onNext={() => nextInterviewQuestion(activeMockInterview.id)}
                    onEnterRoom={() => enterMockInterviewRoom(activeMockInterview.id)}
                    onFinish={() => void finishMockInterview(activeMockInterview.id)}
                    onDelete={() => deleteMockInterview(activeMockInterview.id)}
                  />
                ) : <p className="empty-state">还没有模拟面试。点击上方按钮生成问题。</p>}
              </>
            )}
          </Page>
        )}

        {activeView === 'realInterview' && (
          <Page title="真实面试复盘" subtitle={selectedJob ? `${selectedJob.companyName} · ${selectedJob.jobTitle}` : '先选择目标岗位，再上传真实面试录音'}>
            {!selectedJob ? (
              <section className="primary-flow">
                <div>
                  <span className="eyebrow">需要目标岗位</span>
                  <h2>先在岗位库选择岗位</h2>
                  <p>真实面试复盘会把问题反补到该岗位的题库和下一轮训练。</p>
                </div>
                <button className="primary-button" type="button" onClick={() => setActiveView('materials')}><BriefcaseBusiness size={17} />去选择岗位</button>
              </section>
            ) : (
              <>
                <section className="primary-flow">
                  <div>
                    <span className="eyebrow">真实录音复盘</span>
                    <h2>上传真实面试录音</h2>
                    <p>系统会转写、提取面试官问题，生成复盘并反补题库。</p>
                  </div>
                  <label className="small-upload-button">
                    <input type="file" accept="audio/*,.webm,.wav,.mp3,.m4a,.aac,.ogg,.mp4" onChange={(event) => void handleRealInterviewAudioUpload(event)} />
                    <Upload size={16} />上传真实面试录音
                  </label>
                </section>
                {realInterviewMessage && <p className={realInterviewMessage.includes('失败') || realInterviewMessage.includes('没有') || realInterviewMessage.includes('请先') ? 'error-line' : 'success-line'}>{realInterviewMessage}</p>}
                <div className="record-list">
                  {realInterviews.length ? realInterviews.map((interview) => (
                    <RealInterviewCard
                      key={interview.id}
                      interview={interview}
                      preview={realInterviewAudioPreviews[interview.id]}
                      loading={realInterviewLoading}
                      onTranscript={() => void generateRealInterviewTranscript(interview.id)}
                      onReview={() => void reviewRealInterview(interview.id)}
                      onDelete={() => deleteRealInterview(interview.id)}
                    />
                  )) : <p className="empty-state">还没有真实面试录音。上传后会保存到本地浏览器。</p>}
                </div>
              </>
            )}
          </Page>
        )}

        {activeView === 'companyKnowledge' && (
          <Page title="公司资料增强" subtitle={selectedJob ? `${selectedJob.companyName} · ${selectedJob.jobTitle}` : '先选择目标岗位，再上传公司资料'}>
            {!selectedJob ? (
              <section className="primary-flow">
                <div>
                  <span className="eyebrow">需要目标岗位</span>
                  <h2>先选择目标岗位</h2>
                  <p>公司知识包会绑定当前岗位，无需补录岗位信息。</p>
                </div>
                <button className="primary-button" type="button" onClick={() => setActiveView('materials')}><BriefcaseBusiness size={17} />去选择岗位</button>
              </section>
            ) : (
              <>
                <section className="primary-flow">
                  <div>
                    <span className="eyebrow">资料来源</span>
                    <h2>上传公司资料文本</h2>
                    <p>支持 TXT / Markdown / HTML 文本。PDF / DOCX 暂只建议另存为文本后上传。</p>
                  </div>
                  <div className="inline-actions">
                    <label className="small-upload-button"><input type="file" accept=".txt,.md,.html,text/plain,text/markdown,text/html" onChange={(event) => void handleCompanySourceUpload('company_official', event)} /><Upload size={15} />公司资料</label>
                    <label className="small-upload-button"><input type="file" accept=".txt,.md,.html,text/plain,text/markdown,text/html" onChange={(event) => void handleCompanySourceUpload('job_description', event)} /><Upload size={15} />岗位 JD</label>
                    <label className="small-upload-button"><input type="file" accept=".txt,.md,.html,text/plain,text/markdown,text/html" onChange={(event) => void handleCompanySourceUpload('article', event)} /><Upload size={15} />文章文本</label>
                    <label className="small-upload-button"><input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={(event) => void handleCompanySourceUpload('portfolio', event)} /><Upload size={15} />作品集文本</label>
                  </div>
                </section>
                <section className="primary-flow">
                  <div>
                    <span className="eyebrow">{currentCompanySources.length} 个来源</span>
                    <h2>生成公司知识包</h2>
                    <p>{currentJobPack ? '会结合岗位准备包和真实面试复盘。' : '建议先生成岗位准备包，但也可以直接生成。'}</p>
                  </div>
                  <button className="primary-button" type="button" onClick={() => void generateCompanyKnowledgePack()} disabled={companyKnowledgeLoading}>
                    <Sparkles size={16} />{companyKnowledgeLoading ? '生成中…' : currentKnowledgePack ? '重新生成知识包' : '生成公司知识包'}
                  </button>
                </section>
                {companyKnowledgeMessage && <p className={companyKnowledgeMessage.includes('失败') || companyKnowledgeMessage.includes('请先') ? 'error-line' : 'success-line'}>{companyKnowledgeMessage}</p>}
                <CompanySourcesList sources={currentCompanySources} onDelete={deleteCompanySource} />
                {currentKnowledgePack ? (
                  <CompanyKnowledgeReport pack={currentKnowledgePack} onDelete={() => deleteCompanyKnowledgePack(currentKnowledgePack.id)} />
                ) : <p className="empty-state">还没有公司知识包。生成后会保存到本地，并可被岗位准备包和模拟面试引用。</p>}
              </>
            )}
          </Page>
        )}

        {activeView === 'backup' && (
          <Page title="数据管理" subtitle="查看本地数据，导出备份，必要时恢复。">
            <section className="data-management-grid" data-testid="data-management">
              <Metric label="岗位" value={`${jobPool.length}`} />
              <Metric label="训练记录" value={`${state.history.length}`} />
              <Metric label="模拟面试" value={`${mockInterviews.length}`} />
              <Metric label="真实复盘" value={`${realInterviews.filter((item) => item.reviewReport).length}`} />
              <Metric label="公司资料" value={`${companySources.length}`} />
              <Metric label="准备包" value={`${jobPacks.length}`} />
            </section>
            <section className="storage-note">
              <strong>本地存储</strong>
              <p>JSON 备份包含岗位、训练、转写、AI 反馈、准备包、真实复盘和公司知识包。录音 Blob 仍保存在浏览器 IndexedDB，不会写入 JSON。</p>
            </section>
            <section className="backup-actions">
              <button className="primary-button" type="button" onClick={exportBackup}><Download size={16} />导出 JSON</button>
              <label className="small-upload-button"><input type="file" accept=".json,application/json" onChange={(event) => void importBackup(event)} /><Upload size={16} />导入 JSON</label>
              <button className="danger-text" type="button" onClick={() => void clearAllData()}><Trash2 size={16} />清空本地数据</button>
            </section>
            {backupMessage && <p className="success-line">{backupMessage}</p>}
            {importError && <p className="error-line">{importError}</p>}
          </Page>
        )}

        {activeView === 'diagnostics' && (
          <Page title="系统诊断" subtitle="Provider 状态与 API 可用性。">
            <DiagnosticsView
              status={providerStatus}
              loading={providerStatusLoading}
              message={providerStatusMessage}
              onRefresh={() => void refreshProviderStatus()}
              onTestText={() => void testTextProvider()}
              onTestAsr={() => void testAsrProvider()}
            />
          </Page>
        )}
      </main>
    </div>
  )
}

function Page({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <div className="page-view"><header className="page-heading"><h1>{title}</h1><p>{subtitle}</p></header>{children}</div>
}

function SectionHeading({ icon, title }: { icon: ReactNode; title: string }) {
  return <div className="section-heading">{icon}<h2>{title}</h2></div>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>
}

function DiagnosticsView({
  status,
  loading,
  message,
  onRefresh,
  onTestText,
  onTestAsr,
}: {
  status: ProviderStatusPayload | null
  loading: boolean
  message: string
  onRefresh: () => void
  onTestText: () => void
  onTestAsr: () => void
}) {
  const mode = status
    ? status.ai.fallbackMode || status.asr.fallbackMode
      ? 'Mock / fallback 模式'
      : '真实模型模式'
    : '未检测'
  return (
    <section className="diagnostics-panel" data-testid="provider-diagnostics">
      <header>
        <div>
          <span className="eyebrow">当前模式</span>
          <h2>{mode}</h2>
          {status && <p>{status.ai.configured ? '文本模型已配置。' : '文本模型未配置，当前可用模拟反馈。'}{status.asr.configured ? '语音转写已配置。' : '语音转写未配置，当前可用模拟转写。'}</p>}
        </div>
        <div className="inline-actions">
          <button type="button" onClick={onRefresh} disabled={loading}><RotateCcw size={16} />刷新状态</button>
          <button className="primary-button" type="button" onClick={onTestText} disabled={loading}><BrainCircuit size={16} />测试文本模型</button>
          <button type="button" onClick={onTestAsr} disabled={loading}><FileAudio size={16} />测试语音转写</button>
        </div>
      </header>
      {message && <p className={message.includes('失败') ? 'error-line' : 'success-line'}>{message}</p>}
      {status ? (
        <>
          <div className="diagnostic-summary-grid">
            <ProviderSummaryCard title="AI_PROVIDER" provider={status.ai.provider} configured={status.ai.configured} fallbackMode={status.ai.fallbackMode} />
            <ProviderSummaryCard title="ASR_PROVIDER" provider={status.asr.provider} configured={status.asr.configured} fallbackMode={status.asr.fallbackMode} />
          </div>
          <ProviderMatrix title="文本 Provider" providers={status.ai.availableProviders} />
          <ProviderMatrix title="ASR Provider" providers={status.asr.availableProviders} />
          <section className="route-status-grid" aria-label="API route 状态">
            <h3>API routes</h3>
            {Object.entries(status.routes).map(([name, route]) => (
              <div key={name}>
                <strong>{route.path}</strong>
                <span>{route.method} · {route.available ? '可用' : '不可用'} · {route.mockSafe ? '可 fallback' : '不可 fallback'}</span>
              </div>
            ))}
          </section>
        </>
      ) : <p className="empty-state">尚未读取诊断状态。</p>}
    </section>
  )
}

function ProviderSummaryCard({ title, provider, configured, fallbackMode }: { title: string; provider: string; configured: boolean; fallbackMode: boolean }) {
  return (
    <article className="provider-summary-card">
      <span>{title}</span>
      <strong>{provider}</strong>
      <div className="diagnostic-badges">
        <StatusBadge label={configured ? 'configured' : 'missing'} tone={configured ? 'ready' : 'idle'} />
        <StatusBadge label={fallbackMode ? 'fallback' : 'real'} tone={fallbackMode ? 'idle' : 'ready'} />
      </div>
    </article>
  )
}

function ProviderMatrix({ title, providers }: { title: string; providers: Record<string, ProviderAvailability> }) {
  return (
    <section className="provider-matrix">
      <h3>{title}</h3>
      {Object.entries(providers).map(([name, provider]) => (
        <div key={name}>
          <strong>{name}</strong>
          <span>{provider.model || '默认模型'}</span>
          <StatusBadge label={provider.configured ? 'configured' : 'missing'} tone={provider.configured ? 'ready' : 'idle'} />
          <StatusBadge label={provider.implemented ? 'real path' : 'reserved'} tone={provider.implemented ? 'ready' : 'idle'} />
          <p>{provider.note}</p>
        </div>
      ))}
    </section>
  )
}

function StatusBadge({ label, tone }: { label: string; tone: 'ready' | 'idle' }) {
  return <span className={`diagnostic-badge ${tone}`}>{label}</span>
}

function UploadRow({ title, hint, file, button, accept, onChange, onRemove }: { title: string; hint: string; file?: UploadedFileMeta; button: string; accept: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void; onRemove: () => void }) {
  return <div className="upload-row"><div className="upload-main"><strong>{title}</strong><span>{file ? `${file.name} · ${file.status}` : hint}</span></div><label className="small-upload-button"><input type="file" accept={accept} onChange={onChange} /><Upload size={15} />{file ? '替换' : button}</label>{file && <button className="icon-button" type="button" onClick={onRemove} aria-label={`删除 ${title}`}><Trash2 size={16} /></button>}</div>
}

function FilterSelect({ label, value, options, getLabel, onChange }: { label: string; value: string; options: string[]; getLabel?: (value: string) => string; onChange: (value: string) => void }) {
  return <label><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}><option value="">全部</option>{options.map((option) => <option key={option} value={option}>{getLabel ? getLabel(option) : option}</option>)}</select></label>
}

function RiskToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="risk-toggle"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>
}

function JobStats({ stats }: { stats: ReturnType<typeof buildJobStats> }) {
  return (
    <section className="job-stats" aria-label="岗位智能筛选统计">
      <div><span>总岗位</span><strong>{stats.total}</strong></div>
      <div><span>当前筛选</span><strong>{stats.filtered}</strong></div>
      <div><span>A / B / C / 排除</span><strong>{stats.prioritySummary}</strong></div>
      <div>
        <span>岗位族群</span>
        <p>{stats.familySummary}</p>
      </div>
      <div>
        <span>求职主线</span>
        <p>{stats.trackSummary}</p>
      </div>
    </section>
  )
}

function MockInterviewPanel({
  session,
  currentQuestion,
  currentAnswer,
  preview,
  loading,
  recordingQuestionId,
  recordingSeconds,
  onStartRecording,
  onStopRecording,
  onTranscript,
  onFeedback,
  onFollowUp,
  onNext,
  onEnterRoom,
  onFinish,
  onDelete,
}: {
  session: MockInterviewSession
  currentQuestion?: MockInterviewQuestion
  currentAnswer?: MockInterviewAnswer
  preview?: AudioPreview
  loading: string
  recordingQuestionId: string | null
  recordingSeconds: number
  onStartRecording: (questionId: string) => void
  onStopRecording: () => void
  onTranscript: (questionId: string) => void
  onFeedback: (questionId: string) => void
  onFollowUp: (questionId: string) => void
  onNext: () => void
  onEnterRoom: () => void
  onFinish: () => void
  onDelete: () => void
}) {
  const roomRef = useRef<HTMLElement | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const isRecording = currentQuestion ? recordingQuestionId === currentQuestion.id : false
  const canGoNext = session.currentQuestionIndex < session.questions.length - 1
  const typeLabel = session.interviewType === 'pressure_mock' ? '英文压力面试' : session.interviewType === 'quick_mock' ? '快速摸底面试' : 'AI 产品岗位面试'
  const phaseLabel: Record<InterviewPhase, string> = {
    asking: '提问中',
    answering: '回答中',
    transcribing: '转写中',
    analyzing: '分析中',
    feedback_ready: '下一题',
    follow_up: '可追问',
    completed: '已结束',
  }
  const displayedQuestion = session.currentPhase === 'follow_up' && session.followUps.length ? session.followUps[session.followUps.length - 1] : currentQuestion
  const questionTimer = isRecording ? recordingSeconds : currentAnswer?.durationSeconds || 0
  const visiblePhase = session.currentPhase === 'asking' && !currentAnswer ? '待回答' : phaseLabel[session.currentPhase]
  const feedbackSummary = currentAnswer?.aiFeedback
    ? truncateText(`${currentAnswer.aiFeedback.score} 分 · ${currentAnswer.aiFeedback.summary}`, 96)
    : ''

  useEffect(() => {
    function syncFullscreenState() {
      if (!document.fullscreenElement && isFullscreen) setIsFullscreen(false)
    }
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsFullscreen(false)
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => setIsFullscreen(false))
      }
    }
    document.addEventListener('fullscreenchange', syncFullscreenState)
    window.addEventListener('keydown', handleKeydown)
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState)
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [isFullscreen])

  async function enterFullscreen() {
    setIsFullscreen(true)
    try {
      await roomRef.current?.requestFullscreen?.()
    } catch {
      setIsFullscreen(true)
    }
  }

  async function exitFullscreen() {
    setIsFullscreen(false)
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
    } catch {
      setIsFullscreen(false)
    }
  }

  if (session.uiState === 'waiting_room') {
    return (
      <section className="interview-waiting-room" data-testid="interview-waiting-room">
        <div>
          <span className="eyebrow">面试等待室</span>
          <h2>{session.selectedJob.companyName}</h2>
          <p>{session.selectedJob.jobTitle} · {typeLabel}</p>
        </div>
        <div className="waiting-room-grid">
          <div><span>预计题数</span><strong>{session.questions.length}</strong></div>
          <div><span>预计时长</span><strong>{session.questions.length * 3} 分钟</strong></div>
          <div><span>麦克风</span><strong>待命</strong></div>
          <div><span>模式</span><strong>{typeLabel}</strong></div>
        </div>
        <details className="waiting-materials">
          <summary>查看准备资料</summary>
          <p>岗位信息、准备包、公司知识包、题库会在后台参与出题。</p>
        </details>
        <div className="inline-actions">
          <button className="primary-button" type="button" onClick={onEnterRoom}><Mic size={16} />开始面试</button>
          <button className="danger-text" type="button" onClick={onDelete}><Trash2 size={15} />删除</button>
        </div>
      </section>
    )
  }

  if (session.uiState === 'review_room' || session.status === 'completed') {
    return (
      <section className="review-room" data-testid="interview-review-room">
        <header>
          <div>
            <span className="eyebrow">面试复盘室</span>
            <h2>{session.selectedJob.companyName} · {session.selectedJob.jobTitle}</h2>
            <p>{session.answers.length} 个回答 · {session.finalReport ? '整场复盘已生成' : '等待生成整场复盘'}</p>
          </div>
          <button className="danger-text" type="button" onClick={onDelete}><Trash2 size={15} />删除</button>
        </header>
        {session.finalReport ? <InterviewFinalReportView finalReport={session.finalReport} /> : (
          <button className="primary-button" type="button" onClick={onFinish} disabled={loading === 'report' || !session.answers.length}><Sparkles size={15} />{loading === 'report' ? '复盘中…' : '生成整场复盘'}</button>
        )}
      </section>
    )
  }

  return (
    <section ref={roomRef} className={`meeting-room ${isFullscreen ? 'meeting-room--fullscreen' : ''}`} data-testid="interview-room">
      <header className="meeting-status-bar" aria-label="面试状态栏">
        <div className="meeting-title">
          <strong>{session.selectedJob.companyName}</strong>
          <span>{session.selectedJob.jobTitle}</span>
        </div>
        <div><span>题目</span><strong>第 {session.currentQuestionIndex + 1} / {session.questions.length}</strong></div>
        <div><span>计时</span><strong>{formatDuration(questionTimer)}</strong></div>
        <div><span>状态</span><strong>{visiblePhase}</strong></div>
        <button type="button" onClick={() => isFullscreen ? void exitFullscreen() : void enterFullscreen()}>
          {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}{isFullscreen ? '退出全屏' : '全屏面试'}
        </button>
      </header>

      <div className="meeting-room-typebar">
        <span>{typeLabel}</span>
        {currentAnswer?.transcript && <span>{transcriptStatusLabel(currentAnswer.transcriptStatus)}</span>}
        {currentAnswer?.aiFeedback && <span>{currentAnswer.aiFeedback.provider === 'mock_fallback' ? 'fallback mock' : currentAnswer.aiFeedback.provider}</span>}
      </div>

      <div className="meeting-stage">
        <article className="interviewer-panel" data-testid="virtual-interviewer">
          <div className="interviewer-avatar"><MessagesSquare size={34} /></div>
          <div className="interviewer-meta">
            <span>虚拟面试官</span>
            {session.currentPhase === 'follow_up' && <strong>追问</strong>}
          </div>
          <h3>{displayedQuestion?.question || '面试问题生成中…'}</h3>
          <p>{truncateText(displayedQuestion?.expectedFocus || '围绕岗位、项目证据和表达结构回答。', 88)}</p>
        </article>
        <aside className="candidate-window" data-testid="candidate-window">
          <span>我的窗口</span>
          <strong>{isRecording ? '录音中' : currentAnswer ? '已回答' : '待回答'}</strong>
          <div className={`wave-bars ${isRecording ? 'active' : ''}`} aria-hidden="true"><i /><i /><i /><i /></div>
          <p>{isRecording ? formatDuration(recordingSeconds) : '麦克风待命'}</p>
        </aside>
      </div>

      {currentQuestion && (
        <div className="meeting-control-bar" aria-label="底部控制栏">
          <button className="primary-button" type="button" onClick={() => onStartRecording(currentQuestion.id)} disabled={Boolean(recordingQuestionId)}>
            <Mic size={16} />开始回答
          </button>
          <button type="button" onClick={onStopRecording} disabled={!isRecording}><Square size={15} />停止</button>
          <button type="button" onClick={() => { if (preview?.url) void new Audio(preview.url).play() }} disabled={!preview}><FileAudio size={15} />回放</button>
          <button type="button" onClick={() => onTranscript(currentQuestion.id)} disabled={!currentAnswer || loading === `transcript-${currentQuestion.id}`}>
            <FileText size={15} />{loading === `transcript-${currentQuestion.id}` ? '转写中…' : '转写'}
          </button>
          <button type="button" onClick={() => onFeedback(currentQuestion.id)} disabled={!currentAnswer?.transcript || loading === `feedback-${currentQuestion.id}`}>
            <BrainCircuit size={15} />{loading === `feedback-${currentQuestion.id}` ? '分析中…' : '反馈'}
          </button>
          <button type="button" onClick={onNext} disabled={!canGoNext}>下一题</button>
          <button className="primary-button" type="button" onClick={onFinish} disabled={loading === 'report' || !session.answers.length}><Sparkles size={15} />结束面试</button>
        </div>
      )}

      <div className="meeting-side-notes">
        {currentAnswer?.transcript && (
          <details className="meeting-detail">
            <summary>转写</summary>
            <p>{currentAnswer.transcript.text}</p>
          </details>
        )}
        {currentAnswer?.aiFeedback && (
          <aside className="feedback-summary-strip" data-testid="interview-feedback-summary">
            <div>
              <span>单题反馈</span>
              <strong>{feedbackSummary}</strong>
            </div>
            {currentQuestion && <button type="button" onClick={() => onFollowUp(currentQuestion.id)} disabled={loading === `follow-${currentQuestion.id}`}>追问</button>}
            <div className="meeting-short-feedback" data-testid="meeting-short-feedback">
              <span>最重要的问题</span>
              <strong>{currentAnswer.aiFeedback.problems[0] || '没有明显硬伤。'}</strong>
              <p>{currentAnswer.aiFeedback.nextTasks[0] || '进入下一题。'}</p>
            </div>
            <details className="meeting-detail">
              <summary>详细反馈</summary>
              <AIFeedbackReport feedback={currentAnswer.aiFeedback} />
            </details>
          </aside>
        )}
      </div>
    </section>
  )
}

function InterviewFinalReportView({ finalReport }: { finalReport: NonNullable<MockInterviewSession['finalReport']> }) {
  const isMock = finalReport.provider === 'mock' || finalReport.provider === 'mock_fallback'
  const retryItems = [
    finalReport.report.weakestAnswer,
    ...finalReport.report.recurringProblems,
  ].filter(Boolean).slice(0, 3)
  return (
    <article className="review-summary-report">
      <header>
        <div><span>总分</span><strong>{finalReport.report.overallScore}</strong></div>
        <p>{finalReport.report.summary}</p>
        <em>{finalReport.provider} · {finalReport.model} · {formatDateTime(finalReport.generatedAt)}</em>
      </header>
      {isMock && <p className="mock-notice">当前为模拟复盘，仅用于测试流程。</p>}
      {finalReport.rawProviderNote && <p className="provider-note">{finalReport.rawProviderNote}</p>}
      <div className="review-summary-grid">
        <FeedbackList title="三个主要问题" items={finalReport.report.recurringProblems.slice(0, 3)} />
        <FeedbackList title="三个下一步任务" items={finalReport.report.nextTrainingPlan.slice(0, 3)} />
        <FeedbackList title="建议重练题目" items={retryItems} />
      </div>
      <details className="meeting-detail review-detail">
        <summary>展开详细复盘</summary>
        <dl className="feedback-detail-list">
          <div><dt>最强回答</dt><dd>{finalReport.report.strongestAnswer}</dd></div>
          <div><dt>最弱回答</dt><dd>{finalReport.report.weakestAnswer}</dd></div>
          <div><dt>岗位匹配</dt><dd>{finalReport.report.roleFitAssessment}</dd></div>
          <div><dt>项目深度</dt><dd>{finalReport.report.projectDepthAssessment}</dd></div>
          <div><dt>英文表达</dt><dd>{finalReport.report.englishAssessment}</dd></div>
          <div><dt>面试官担心点</dt><dd>{finalReport.report.communicationAssessment}</dd></div>
        </dl>
      </details>
    </article>
  )
}

function RealInterviewCard({
  interview,
  preview,
  loading,
  onTranscript,
  onReview,
  onDelete,
}: {
  interview: StoredRealInterview
  preview?: AudioPreview
  loading: string
  onTranscript: () => void
  onReview: () => void
  onDelete: () => void
}) {
  const isMock = interview.provider === 'mock' || interview.provider === 'mock_fallback'
  return (
    <article className="record-card">
      <header>
        <div>
          <h3>{interview.recordingName || '真实面试录音'}</h3>
          <p>{interview.selectedJob.companyName} · {interview.selectedJob.jobTitle} · {formatDateTime(interview.createdAt)}</p>
        </div>
        <button className="danger-text" type="button" onClick={onDelete}><Trash2 size={15} />删除</button>
      </header>
      {preview && <div className="audio-result"><audio controls src={preview.url} /><span>{formatFileSize(preview.size)}</span></div>}
      <div className="status-row">
        <span>转写：{transcriptStatusLabel(interview.transcriptStatus)}</span>
        <span>复盘：{interview.reviewReport ? '已生成' : '待生成'}</span>
      </div>
      <div className="inline-actions">
        <button type="button" onClick={onTranscript} disabled={loading === `transcript-${interview.id}`}><FileText size={15} />{loading === `transcript-${interview.id}` ? '转写中…' : '生成转写'}</button>
        <button className="primary-button" type="button" onClick={onReview} disabled={!interview.transcript || loading === `review-${interview.id}`}><BrainCircuit size={15} />{loading === `review-${interview.id}` ? '复盘中…' : '生成真实复盘'}</button>
      </div>
      {interview.transcript && <div className="transcript-preview"><span>{interview.transcript.provider || interview.transcript.source}</span><p>{interview.transcript.text}</p></div>}
      {interview.reviewReport && (
        <article className="ai-report">
          <header>
            <div><span>真实面试复盘</span><strong>{interview.extractedQuestions.length}</strong></div>
            <p>{interview.reviewReport.overallSummary}</p>
            <em>{interview.provider} · {interview.model} · {interview.generatedAt ? formatDateTime(interview.generatedAt) : ''}</em>
          </header>
          {isMock && <p className="mock-notice">当前为模拟真实面试复盘，仅用于测试流程。</p>}
          {interview.rawProviderNote && <p className="provider-note">{interview.rawProviderNote}</p>}
          <FeedbackList title="面试官实际问题" items={interview.extractedQuestions.map((question) => question.question)} />
          <FeedbackList title="反补训练任务" items={interview.reviewReport.nextTrainingTasks} />
          <FeedbackList title="题库更新" items={interview.reviewReport.questionBankUpdates.map((item) => item.question)} />
          <dl className="feedback-detail-list">
            <div><dt>面试官重点</dt><dd>{interview.reviewReport.interviewerFocus.join('、')}</dd></div>
            <div><dt>最强回答</dt><dd>{interview.reviewReport.strongestAnswer}</dd></div>
            <div><dt>最弱回答</dt><dd>{interview.reviewReport.weakestAnswer}</dd></div>
            <div><dt>岗位匹配</dt><dd>{interview.reviewReport.roleFitAssessment}</dd></div>
          </dl>
        </article>
      )}
    </article>
  )
}

function CompanySourcesList({ sources, onDelete }: { sources: CompanySourceInput[]; onDelete: (sourceId: string) => void }) {
  if (!sources.length) return <p className="empty-state">还没有上传公司资料。可以先用 job.xlsx 生成，也可以补充公司官网、JD、公众号文章导出文本。</p>
  return (
    <section className="material-list">
      {sources.map((source) => (
        <div className="material-row" key={source.id}>
          <div><strong>{source.title}</strong><span>{source.type} · {source.wordCount} 字 · {formatDateTime(source.uploadedAt)}</span></div>
          <button className="danger-text" type="button" onClick={() => onDelete(source.id)}><Trash2 size={15} />删除</button>
        </div>
      ))}
    </section>
  )
}

function CompanyKnowledgeReport({ pack, onDelete }: { pack: StoredCompanyKnowledgePack; onDelete: () => void }) {
  const isMock = pack.provider === 'mock' || pack.provider === 'mock_fallback'
  return (
    <article className="job-pack-report">
      <header>
        <div>
          <span className="eyebrow">公司知识包</span>
          <h2>{pack.selectedJob.companyName}</h2>
          <p>{pack.provider} · {pack.model} · {formatDateTime(pack.generatedAt)}</p>
        </div>
        <button className="danger-text" type="button" onClick={onDelete}><Trash2 size={15} />删除</button>
      </header>
      {isMock && <p className="mock-notice">当前为模拟公司知识包，仅用于测试流程。</p>}
      {pack.rawProviderNote && <p className="provider-note">{pack.rawProviderNote}</p>}
      <section className="brief-section"><h3>来源摘要</h3><p>{pack.companyKnowledgePack.sourceSummary}</p></section>
      <section className="brief-section"><h3>核心业务</h3><p>{pack.companyKnowledgePack.companyCoreBusiness}</p></section>
      <div className="brief-grid">
        <FeedbackList title="产品线" items={pack.companyKnowledgePack.productLines} />
        <FeedbackList title="近期信号" items={pack.companyKnowledgePack.recentSignals} />
        <FeedbackList title="面试重点预测" items={pack.companyKnowledgePack.interviewFocusPrediction} />
        <FeedbackList title="风险与未知" items={pack.companyKnowledgePack.risksAndUnknowns} />
      </div>
      <section className="brief-section"><h3>岗位上下文</h3><p>{pack.companyKnowledgePack.roleContext}</p></section>
      <FeedbackList title="推荐追问" items={pack.companyKnowledgePack.recommendedQuestions} />
      <FeedbackList title="面试中怎么用" items={pack.companyKnowledgePack.howToUseInInterview} />
      <section className="question-list">
        <h3>证据地图</h3>
        {pack.companyKnowledgePack.evidenceMap.map((item) => (
          <details key={`${item.sourceId}-${item.claim}`}>
            <summary>{item.claim}</summary>
            <p>{item.sourceName} · {item.confidence}</p>
          </details>
        ))}
      </section>
    </article>
  )
}

function RecordList({
  records,
  mode,
  currentJob,
  cvText,
  tasks,
  scriptTemplates,
  expandedId,
  onExpand,
  onUpdate,
  onDelete,
}: {
  records: TrainingRecord[]
  mode: 'history' | 'feedback'
  currentJob: JobRecord | null
  cvText: string
  tasks: TrainingTask[]
  scriptTemplates: ScriptTemplates
  expandedId: string | null
  onExpand: (id: string | null) => void
  onUpdate: (id: string, updater: (record: TrainingRecord) => TrainingRecord) => void
  onDelete?: (id: string) => void
}) {
  if (!records.length) return <p className="empty-state">还没有训练记录。</p>
  return <div className="record-list">{records.map((record) => (
    <RecordRow
      key={record.id}
      record={record}
      currentJob={currentJob}
      cvText={cvText}
      scriptText={getScriptTextForTask(record.taskId, tasks, scriptTemplates, record.selectedJob || currentJob)}
      expanded={expandedId === record.id}
      mode={mode}
      onToggle={() => onExpand(expandedId === record.id ? null : record.id)}
      onUpdate={(updater) => onUpdate(record.id, updater)}
      onDelete={onDelete ? () => onDelete(record.id) : undefined}
    />
  ))}</div>
}

function RecordRow({
  record,
  currentJob,
  cvText,
  scriptText,
  expanded,
  mode,
  onToggle,
  onUpdate,
  onDelete,
}: {
  record: TrainingRecord
  currentJob: JobRecord | null
  cvText: string
  scriptText: string
  expanded: boolean
  mode: 'history' | 'feedback'
  onToggle: () => void
  onUpdate: (updater: (record: TrainingRecord) => TrainingRecord) => void
  onDelete?: () => void
}) {
  const [transcriptDraft, setTranscriptDraft] = useState(record.transcript?.text || '')
  const [message, setMessage] = useState('')
  const [transcribing, setTranscribing] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const job = record.selectedJob || currentJob

  function saveManualTranscript() {
    const text = transcriptDraft.trim()
    if (!text) {
      setMessage('请先粘贴回答文本。')
      return
    }
    onUpdate((current) => ({
      ...current,
      transcript: { text, source: 'manual', updatedAt: new Date().toISOString() },
      transcriptStatus: 'manual_ready',
      aiFeedback: undefined,
      aiFeedbackStatus: 'ready_to_analyze',
    }))
    setMessage('临时测试文本已保存。')
  }

  async function generateTranscript() {
    setTranscribing(true)
    setMessage('')
    onUpdate((current) => ({ ...current, transcriptStatus: 'transcribing' }))
    try {
      const payload = {
        trainingRecordId: record.id,
        trainingType: record.trainingType,
        audioMetadata: record.audioMetadata,
        selectedJob: job,
      }
      const blob = record.recordingId ? await readRecordingBlob(record.recordingId) : null
      if (record.recordingId && !blob) {
        setMessage('该记录没有可用音频 Blob，请重新录制或使用模拟转写测试流程。')
      }
      const requestInit: RequestInit = blob
        ? (() => {
          const form = new FormData()
          form.append('payload', JSON.stringify(payload))
          form.append('audio', blob, record.recordingName || record.audioMetadata.recordingName || 'answer.webm')
          return { method: 'POST', body: form }
        })()
        : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      const response = await fetch('/api/transcribe', {
        ...requestInit,
      })
      const result = await response.json() as TranscribeResponse
      if (!response.ok || !result.success) throw new Error(result.success ? '转写失败。' : result.error)
      const transcript: TranscriptData = {
        text: result.transcript,
        source: result.provider === 'mock' || result.provider === 'mock_fallback' ? 'mock' : 'asr',
        updatedAt: result.generatedAt,
        provider: result.provider,
        language: result.language,
      }
      setTranscriptDraft(result.transcript)
      onUpdate((current) => ({
        ...current,
        transcript,
        transcriptStatus: transcript.source === 'mock' ? 'mock_ready' : 'completed',
        aiFeedback: undefined,
        aiFeedbackStatus: 'ready_to_analyze',
      }))
      setMessage(result.provider === 'mock' || result.provider === 'mock_fallback' ? '已生成模拟转写，可继续测试 AI 反馈。' : '转写完成。')
    } catch (error) {
      onUpdate((current) => ({ ...current, transcriptStatus: 'failed', aiFeedbackStatus: 'transcript_needed' }))
      setMessage(error instanceof Error ? error.message : '转写失败。')
    } finally {
      setTranscribing(false)
    }
  }

  function clearTranscript() {
    setTranscriptDraft('')
    onUpdate((current) => ({
      ...current,
      transcript: undefined,
      transcriptStatus: 'not_started',
      aiFeedback: undefined,
      aiFeedbackStatus: 'transcript_needed',
    }))
    setMessage('已清空转写和旧反馈。')
  }

  async function generateFeedback() {
    const text = (record.transcript?.text || transcriptDraft).trim()
    if (!text) {
      setMessage('需要先生成转写文本。')
      return
    }
    setAnalyzing(true)
    setMessage('')
    onUpdate((current) => ({ ...current, aiFeedbackStatus: 'analyzing' }))
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 25_000)
    try {
      const response = await fetch('/api/analyze-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          taskType: 'analyze_answer',
          trainingRecordId: record.id,
          trainingType: record.trainingType,
          selectedJob: job,
          transcript: text,
          durationSeconds: record.durationSeconds,
          targetSeconds: record.targetSeconds,
          cvText: cvText.slice(0, 6000),
          scriptText: scriptText.slice(0, 8000),
        }),
      })
      const result = await response.json() as AnalyzeAnswerResponse
      if (!response.ok || !result.success) throw new Error(result.success ? '反馈生成失败。' : result.error)
      const { success: _success, ...aiFeedback } = result
      void _success
      onUpdate((current) => ({ ...current, aiFeedback, aiFeedbackStatus: 'completed' }))
      setMessage('AI 反馈已保存。')
    } catch (error) {
      onUpdate((current) => ({ ...current, aiFeedbackStatus: 'failed' }))
      setMessage(error instanceof Error && error.name === 'AbortError' ? '请求超时，训练记录未丢失。' : error instanceof Error ? error.message : '反馈生成失败。')
    } finally {
      clearTimeout(timeout)
      setAnalyzing(false)
    }
  }

  return (
    <article className="record-row">
      <div className="record-main">
        <div className="record-title"><FileAudio size={18} /><div><strong>{record.title}</strong><span>{formatDateTime(record.savedAt)} · {formatDuration(record.durationSeconds)}</span></div></div>
        <div className="status-line">
          <StatusPill icon={<FileText size={14} />} label={transcriptStatusLabel(record.transcriptStatus)} tone={record.transcriptStatus === 'completed' || record.transcriptStatus === 'mock_ready' || record.transcriptStatus === 'manual_ready' ? 'ready' : 'idle'} />
          <StatusPill icon={<BrainCircuit size={14} />} label={record.aiFeedback ? `AI ${record.aiFeedback.score} 分` : feedbackStatusLabel(record.aiFeedbackStatus)} tone={record.aiFeedbackStatus === 'completed' ? 'ready' : 'idle'} />
        </div>
      </div>
      <div className="record-actions">
        <button type="button" onClick={onToggle}>{expanded ? '收起' : mode === 'feedback' ? '处理反馈' : '查看详情'}</button>
        {onDelete && <button className="danger-text" type="button" onClick={onDelete}><Trash2 size={14} />删除</button>}
      </div>
      {expanded && (
        <div className="record-detail">
          <section className="transcript-workflow">
            <div className="workflow-heading">
              <div><span className="eyebrow">第一步</span><h3>生成回答转写</h3><p>当前 ASR 默认使用 Mock。真实 Provider 接入后，前端流程无需重写。</p></div>
              <button className="primary-button" type="button" onClick={() => void generateTranscript()} disabled={transcribing}><FileText size={16} />{transcribing ? '转写中…' : record.transcript ? '重新转写' : '生成转写'}</button>
            </div>
            {record.transcript && <div className="transcript-preview"><span>{record.transcript.provider || record.transcript.source} · {formatDateTime(record.transcript.updatedAt)}</span><p>{record.transcript.text}</p></div>}
            <details className="advanced-details">
              <summary><ChevronDown size={16} />临时测试：回答文本</summary>
              <p>当前版本默认等待 ASR 转写。也可临时粘贴文本测试 AI 反馈。</p>
              <textarea value={transcriptDraft} onChange={(event) => setTranscriptDraft(event.target.value)} rows={6} maxLength={20_000} placeholder="粘贴回答转写文本" />
              <div className="inline-actions"><button type="button" onClick={saveManualTranscript}><Save size={15} />保存测试文本</button><button className="danger-text" type="button" onClick={clearTranscript}>清空转写</button></div>
            </details>
          </section>

          <section className="analysis-workflow">
            <div className="workflow-heading">
              <div><span className="eyebrow">第二步</span><h3>AI 评价</h3><p>评分、诊断、改稿和任务均由 AI 生成。</p></div>
              <button className="primary-button" type="button" onClick={() => void generateFeedback()} disabled={analyzing || !record.transcript}><BrainCircuit size={16} />{analyzing ? '分析中…' : record.aiFeedback ? '重新生成' : '生成 AI 反馈'}</button>
            </div>
            {record.aiFeedback ? <AIFeedbackReport feedback={record.aiFeedback} /> : <p className="empty-state">完成转写后即可生成反馈。</p>}
          </section>

          {message && <p className={message.includes('失败') || message.includes('超时') ? 'error-line' : 'success-line'}>{message}</p>}
        </div>
      )}
    </article>
  )
}

function StatusPill({ icon, label, tone }: { icon: ReactNode; label: string; tone: 'ready' | 'idle' }) {
  return <span className={`status-pill ${tone}`}>{icon}{label}</span>
}

function AIFeedbackReport({ feedback }: { feedback: StoredAIFeedback }) {
  const isMock = feedback.provider === 'mock' || feedback.provider === 'mock_fallback'
  const providerLabel = feedback.provider === 'deepseek'
    ? '由 DeepSeek 生成'
    : feedback.provider === 'mock_fallback'
      ? '真实模型调用失败，已自动使用模拟反馈。'
      : feedback.provider === 'mock'
        ? '当前为模拟反馈，仅用于测试流程。'
        : `${feedback.provider} · ${feedback.model}`
  const topProblems = feedback.problems.slice(0, 3)
  const topTasks = feedback.nextTasks.slice(0, 3)
  const shouldRetry = feedback.score < 78 || feedback.problems.length >= 3
  return (
    <div className="ai-report">
      <header><div><span>总分</span><strong>{feedback.score}</strong></div><p>{feedback.summary}</p><em>{providerLabel} · {feedback.model} · {formatDateTime(feedback.generatedAt)}</em></header>
      {isMock && <p className="mock-notice">{providerLabel}</p>}
      {feedback.rawProviderNote && <p className="provider-note">{feedback.rawProviderNote}</p>}
      <div className="feedback-short-grid" data-testid="ai-short-report">
        <FeedbackList title="最重要的问题" items={topProblems.length ? topProblems : ['当前没有明显硬伤。']} />
        <FeedbackList title="下一步任务" items={topTasks.length ? topTasks : ['保持节奏，进入下一段训练。']} />
        <section><strong>是否建议重答</strong><p>{shouldRetry ? '建议重答一次，只看骨架讲。' : '可以进入下一题。'}</p></section>
      </div>
      <details className="ai-report-detail">
        <summary>查看详细报告</summary>
        <div className="feedback-columns"><FeedbackList title="做得好的地方" items={feedback.strengths} /><FeedbackList title="全部问题" items={feedback.problems} /></div>
        <dl className="feedback-detail-list">
          <div><dt>岗位匹配</dt><dd>{feedback.roleFitFeedback}</dd></div>
          <div><dt>结构</dt><dd>{feedback.structureFeedback}</dd></div>
          <div><dt>表达</dt><dd>{feedback.expressionFeedback}</dd></div>
          <div><dt>时长</dt><dd>{feedback.timingFeedback}</dd></div>
          <div><dt>流畅度</dt><dd>{feedback.fluencyFeedback}</dd></div>
          <div><dt>背稿风险</dt><dd>{feedback.memorizationRisk}</dd></div>
          <div><dt>具体性</dt><dd>{feedback.specificityFeedback}</dd></div>
        </dl>
        <details><summary>30 秒优化版</summary><p>{feedback.improvedShortVersion}</p></details>
        <details><summary>90 秒优化版</summary><p>{feedback.improvedLongVersion}</p></details>
      </details>
    </div>
  )
}

function JobPackReport({ pack, onDelete, onExport }: { pack: StoredJobPack; onDelete: () => void; onExport: () => void }) {
  const isMock = pack.provider === 'mock' || pack.provider === 'mock_fallback'
  const providerLabel = pack.provider === 'deepseek'
    ? '由 DeepSeek 生成'
    : pack.provider === 'mock_fallback'
      ? '真实模型调用失败，已自动使用模拟准备包。'
      : pack.provider === 'mock'
        ? '当前为模拟准备包，仅用于测试流程。'
        : `${pack.provider} · ${pack.model}`
  return (
    <article className="job-pack-report">
      <header>
        <div><span className="eyebrow">岗位准备包</span><h2>{pack.selectedJob.companyName} · {pack.selectedJob.jobTitle}</h2><p>{providerLabel} · {pack.model} · {formatDateTime(pack.generatedAt)}</p></div>
        <div className="inline-actions"><button type="button" onClick={onExport}><Download size={15} />导出准备包</button><button className="danger-text" type="button" onClick={onDelete}><Trash2 size={15} />删除</button></div>
      </header>
      {isMock && <p className="mock-notice">{providerLabel}</p>}
      {pack.rawProviderNote && <p className="provider-note">{pack.rawProviderNote}</p>}
      <section className="brief-section"><h3>公司业务总结</h3><p>{pack.jobPack.companySummary}</p></section>
      <section className="brief-section"><h3>产品与业务方向</h3><p>{pack.jobPack.productAndBusiness}</p></section>
      <div className="brief-grid">
        <FeedbackList title="岗位要求拆解" items={pack.jobPack.jobRequirementBreakdown} />
        <FeedbackList title="日常工作预测" items={pack.jobPack.workContentPrediction} />
        <FeedbackList title="候选人匹配点" items={pack.jobPack.candidateFit} />
        <FeedbackList title="风险点" items={pack.jobPack.riskPoints} />
      </div>
      <section className="brief-section"><h3>自我介绍策略</h3><p>{pack.jobPack.selfIntroductionStrategy}</p></section>
      <section className="brief-section"><h3>Miro 项目讲法</h3><p>{pack.jobPack.miroProjectStrategy}</p></section>
      <section className="question-list">
        <h3>高频面试问题</h3>
        {pack.jobPack.likelyQuestions.map((question) => (
          <details key={question.question}>
            <summary>{question.question}</summary>
            <p><strong>考察：</strong>{question.whyItMatters}</p>
            <p><strong>框架：</strong>{question.framework}</p>
          </details>
        ))}
      </section>
      <section className="question-list">
        <h3>满分回答框架</h3>
        {pack.jobPack.fullScoreAnswerFrameworks.map((framework) => (
          <details key={`${framework.question}-${framework.frameworkName}`}>
            <summary>{framework.question}</summary>
            <p><strong>{framework.frameworkName}</strong></p>
            <FeedbackList title="回答结构" items={framework.answerStructure} />
            <FeedbackList title="可调用经历" items={framework.candidateEvidence} />
            <FeedbackList title="雷区" items={framework.pitfalls} />
          </details>
        ))}
      </section>
      <FeedbackList title="面试前准备任务" items={pack.jobPack.preparationTasks} />
    </article>
  )
}

function FeedbackList({ title, items }: { title: string; items: string[] }) {
  return <section><strong>{title}</strong><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></section>
}

function readStoredState(): StoredMvpState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) as Partial<StoredMvpState> : {}
    return {
      uploadedFiles: normalizeFiles(parsed.uploadedFiles ?? readArray(UPLOADED_FILES_KEY)),
      tasks: normalizeTasks(parsed.tasks),
      history: normalizeTrainingRecords(parsed.history ?? readArray(TRAINING_RECORDS_KEY)),
      lastSavedAt: parsed.lastSavedAt,
    }
  } catch {
    return defaultState
  }
}

function readJobPool() { return readArray<JobRecord>(JOB_POOL_KEY).map(ensureNormalizedJob) }
function readSelectedJob() { try { const raw = localStorage.getItem(SELECTED_JOB_KEY); return raw ? ensureNormalizedJob(JSON.parse(raw) as JobRecord) : null } catch { return null } }
function readCvTextState(): CvTextState { try { const raw = localStorage.getItem(CV_TEXT_KEY); return raw ? { text: '', source: 'upload', ...JSON.parse(raw) } : { text: '', source: 'upload' } } catch { return { text: '', source: 'upload' } } }
function readScriptTemplates(): ScriptTemplates { try { const raw = localStorage.getItem(SCRIPT_TEMPLATES_KEY); return raw ? JSON.parse(raw) : {} } catch { return {} } }
function readJobPacks() { return normalizeJobPacks(readArray<StoredJobPack>(JOB_PACKS_KEY)) }
function readMockInterviews() { return normalizeMockInterviews(readArray<MockInterviewSession>(MOCK_INTERVIEWS_KEY)) }
function readRealInterviews() { return normalizeRealInterviews(readArray<StoredRealInterview>(REAL_INTERVIEWS_KEY)) }
function readQuestionBank() { return normalizeQuestionBank(readArray<QuestionBankUpdate>(QUESTION_BANK_KEY)) }
function readCompanySources() { return normalizeCompanySources(readArray<CompanySourceInput>(COMPANY_SOURCES_KEY)) }
function readCompanyKnowledgePacks() { return normalizeCompanyKnowledgePacks(readArray<StoredCompanyKnowledgePack>(COMPANY_KNOWLEDGE_PACKS_KEY)) }
function readJobUserStatus() { return normalizeJobUserStatus(readObject<JobUserStatusMap>(JOB_USER_STATUS_KEY)) }
function readLegacyRole() { try { const raw = localStorage.getItem(LEGACY_TARGET_ROLE_KEY); return raw ? JSON.parse(raw) : null } catch { return null } }
function readArray<T>(key: string): T[] { try { const raw = localStorage.getItem(key); const parsed = raw ? JSON.parse(raw) : []; return Array.isArray(parsed) ? parsed : [] } catch { return [] } }
function readObject<T extends Record<string, unknown>>(key: string): Partial<T> { try { const raw = localStorage.getItem(key); const parsed = raw ? JSON.parse(raw) : {}; return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {} } catch { return {} } }

function normalizeTasks(tasks?: TrainingTask[]) {
  return defaultTasks.map((defaultTask) => {
    const saved = tasks?.find((task) => task.id === defaultTask.id)
    return { ...defaultTask, ...saved, defaultReferenceTemplate: defaultTask.defaultReferenceTemplate }
  })
}

function normalizeTrainingRecords(records?: Array<Partial<TrainingRecord> & { review?: LegacyReview }>): TrainingRecord[] {
  return (Array.isArray(records) ? records : []).map((record) => {
    const taskId = isTaskId(record.taskId) ? record.taskId : 'cn-intro'
    const task = getDefaultTask(taskId)
    const transcript = record.transcript
    const aiFeedback = record.aiFeedback
    return {
      id: record.id || `${taskId}-${Date.now()}`,
      taskId,
      trainingType: record.trainingType || taskIdToTrainingType(taskId),
      title: record.title || task.title,
      savedAt: record.savedAt || new Date().toISOString(),
      durationSeconds: record.durationSeconds || 0,
      targetSeconds: record.targetSeconds || task.targetSeconds,
      selectedJob: record.selectedJob || null,
      audioMetadata: record.audioMetadata || {
        recordingId: record.recordingId,
        recordingName: record.recordingName,
        durationSeconds: record.durationSeconds || 0,
      },
      recordingId: record.recordingId,
      recordingName: record.recordingName,
      hasDownload: Boolean(record.hasDownload || record.recordingId),
      transcript,
      transcriptStatus: record.transcriptStatus || (transcript ? transcript.source === 'mock' ? 'mock_ready' : transcript.source === 'manual' ? 'manual_ready' : 'completed' : 'not_started'),
      aiFeedback,
      aiFeedbackStatus: record.aiFeedbackStatus || (aiFeedback ? 'completed' : transcript ? 'ready_to_analyze' : 'transcript_needed'),
      review: record.review,
    }
  }).sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
}

function normalizeFiles(files?: UploadedFileMeta[]) { return (Array.isArray(files) ? files : []).map((file, index) => ({ ...file, category: file.category ?? (index === 0 ? 'cv' : 'project') })) }
function normalizeJobPacks(packs?: StoredJobPack[]) {
  return (Array.isArray(packs) ? packs : []).filter((pack) => pack?.selectedJob && pack?.jobPack).map((pack) => ({
    ...pack,
    id: pack.id || `${pack.selectedJob.id || pack.selectedJob.companyName}-${pack.generatedAt || Date.now()}`,
    selectedJobId: pack.selectedJobId || pack.selectedJob.id,
    provider: pack.provider || 'mock',
    model: pack.model || 'unknown',
    generatedAt: pack.generatedAt || new Date().toISOString(),
  }))
}
function normalizeMockInterviews(sessions?: MockInterviewSession[]) {
  return (Array.isArray(sessions) ? sessions : []).filter((session) => session?.selectedJob && Array.isArray(session.questions)).map((session) => ({
    ...session,
    id: session.id || `mock-interview-${Date.now()}`,
    status: session.status || 'in_progress',
    uiState: session.uiState || (session.status === 'completed' ? 'review_room' : 'waiting_room'),
    currentPhase: session.currentPhase || (session.status === 'completed' ? 'completed' : 'asking'),
    createdAt: session.createdAt || new Date().toISOString(),
    startedAt: session.startedAt,
    interviewType: session.interviewType || 'job_pack_mock',
    companyKnowledgePackId: session.companyKnowledgePackId,
    currentQuestionIndex: Math.max(0, Math.min(session.currentQuestionIndex || 0, Math.max(0, session.questions.length - 1))),
    questions: session.questions,
    followUps: Array.isArray(session.followUps) ? session.followUps : [],
    answers: Array.isArray(session.answers) ? session.answers.map((answer) => ({
      ...answer,
      transcriptStatus: answer.transcriptStatus || (answer.transcript ? answer.transcript.source === 'mock' ? 'mock_ready' : 'completed' : 'not_started'),
      aiFeedbackStatus: answer.aiFeedbackStatus || (answer.aiFeedback ? 'completed' : answer.transcript ? 'ready_to_analyze' : 'transcript_needed'),
      durationSeconds: answer.durationSeconds || answer.audioMetadata?.durationSeconds || 0,
      createdAt: answer.createdAt || new Date().toISOString(),
    })) : [],
  })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

function normalizeRealInterviews(interviews?: StoredRealInterview[]) {
  return (Array.isArray(interviews) ? interviews : []).filter((interview) => interview?.selectedJob).map((interview) => ({
    ...interview,
    id: interview.id || `real-${Date.now()}`,
    transcriptStatus: interview.transcriptStatus || (interview.transcript ? interview.transcript.source === 'mock' ? 'mock_ready' : 'completed' : 'not_started'),
    extractedQuestions: Array.isArray(interview.extractedQuestions) ? interview.extractedQuestions : [],
    extractedAnswers: Array.isArray(interview.extractedAnswers) ? interview.extractedAnswers : [],
    createdAt: interview.createdAt || new Date().toISOString(),
    updatedAt: interview.updatedAt || interview.createdAt || new Date().toISOString(),
  })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

function normalizeQuestionBank(items?: QuestionBankUpdate[]) {
  return (Array.isArray(items) ? items : []).filter((item) => item?.question).map((item) => ({
    ...item,
    source: 'real_interview' as const,
    priority: item.priority || 'medium',
    suggestedPracticeType: item.suggestedPracticeType || 'mockInterview',
  }))
}

function updateMockSessionPhase(sessions: MockInterviewSession[], sessionId: string, phase: InterviewPhase) {
  return sessions.map((session) => session.id === sessionId ? { ...session, currentPhase: phase } : session)
}

function normalizeCompanySources(sources?: CompanySourceInput[]) {
  return (Array.isArray(sources) ? sources : []).filter((source) => source?.sourceName && typeof source.text === 'string').map((source) => ({
    ...source,
    id: source.id || `company-source-${Date.now()}`,
    type: source.type || 'other',
    title: source.title || source.sourceName,
    wordCount: source.wordCount || countTextUnits(source.text),
    uploadedAt: source.uploadedAt || new Date().toISOString(),
  }))
}

function normalizeCompanyKnowledgePacks(packs?: StoredCompanyKnowledgePack[]) {
  return (Array.isArray(packs) ? packs : []).filter((pack) => pack?.selectedJob && pack?.companyKnowledgePack).map((pack) => ({
    ...pack,
    id: pack.id || `${pack.selectedJob.id || pack.selectedJob.companyName}-knowledge-${Date.now()}`,
    selectedJobId: pack.selectedJobId || pack.selectedJob.id,
    provider: pack.provider || 'mock',
    model: pack.model || 'unknown',
    generatedAt: pack.generatedAt || new Date().toISOString(),
    sourceIds: Array.isArray(pack.sourceIds) ? pack.sourceIds : [],
  }))
}

function normalizeJobUserStatus(input?: Partial<JobUserStatusMap>): JobUserStatusMap {
  const allowed = new Set(JOB_USER_STATUS_OPTIONS.map((item) => item.value))
  return Object.fromEntries(Object.entries(input || {}).filter(([, value]) => allowed.has(value as JobUserStatus))) as JobUserStatusMap
}

function updateMockAnswer(
  sessions: MockInterviewSession[],
  sessionId: string,
  questionId: string,
  updater: (answer: MockInterviewAnswer) => MockInterviewAnswer,
) {
  return sessions.map((session) => session.id !== sessionId ? session : {
    ...session,
    answers: session.answers.map((answer) => answer.questionId === questionId ? updater(answer) : answer),
  })
}
function getFileByCategory(files: UploadedFileMeta[], category: UploadCategory) { return files.find((file) => file.category === category) }
function getDefaultTask(id: TaskId) { return defaultTasks.find((task) => task.id === id) || defaultTasks[0] }
function isTaskId(value: unknown): value is TaskId { return value === 'cn-intro' || value === 'en-intro' || value === 'miro-project' }
function canExtractPlainText(name: string, type: string) { const ext = getFileExtension(name).toLowerCase(); return ext === '.txt' || ext === '.md' || type.startsWith('text/') }
function toCvTextMeta(cv: CvTextState): UploadedFileMeta { return { id: 'cv-text', name: cv.fileName || 'CV 文本', size: new Blob([cv.text]).size, type: 'text/plain', uploadedAt: cv.updatedAt || new Date().toISOString(), status: '已解析', category: 'cv', parseStatus: '已提取文本' } }
function getCvStatusText(file: UploadedFileMeta | undefined, cv: CvTextState) { if (cv.text) return `已读取 CV 文本：${cv.fileName || '文本版'}。`; if (!file) return '尚未上传 CV。'; if (file.parseStatus === '需要文本版') return 'CV 已上传，但当前格式暂未解析。请补充 TXT / Markdown 文本版。'; return 'CV 已上传，但暂未解析内容。' }

function ensureNormalizedJob(job: JobRecord): JobRecord {
  return job.normalized ? job : { ...job, normalized: normalizeJobRecord(job) }
}

function filterJobs(jobs: JobRecord[], filters: JobFilters, statusMap: JobUserStatusMap) {
  const normalizedJobs = jobs.map(ensureNormalizedJob)
  const search = filters.search.trim().toLowerCase()
  const riskChecks: Array<[boolean, string]> = [
    [filters.hideStrongCode, 'strong_code'],
    [filters.hideAlgorithm, 'algorithm_heavy'],
    [filters.hideSales, 'sales_heavy'],
    [filters.hideOnsite, 'onsite_delivery'],
    [filters.hideTravel, 'travel_heavy'],
    [filters.hideLowSalary, 'low_salary'],
    [filters.hideHighExperience, 'high_experience'],
  ]
  const filtered = normalizedJobs.filter((job) => {
    const normalized = job.normalized
    const status = getJobUserStatus(statusMap, job.id)
    return (!search || normalized.searchableText.toLowerCase().includes(search))
      && (!filters.roleFamily || normalized.roleFamily === filters.roleFamily)
      && (!filters.roleTrack || normalized.roleTrack === filters.roleTrack)
      && (!filters.cityGroup || normalized.cityGroup === filters.cityGroup)
      && (!filters.priorityBucket || normalized.priorityBucket === filters.priorityBucket)
      && (!filters.userStatus || status === filters.userStatus)
      && (!filters.hideRejected || status !== 'rejected')
      && riskChecks.every(([enabled, flag]) => !enabled || !normalized.riskFlags.includes(flag))
  })

  return filtered.sort((a, b) => {
    if (filters.sort === 'priority') return priorityRank(a.normalized.priorityBucket) - priorityRank(b.normalized.priorityBucket) || b.normalized.matchScore - a.normalized.matchScore
    if (filters.sort === 'today') return Number(b.isTodayNew) - Number(a.isTodayNew) || b.normalized.matchScore - a.normalized.matchScore
    if (filters.sort === 'city') return a.normalized.cityGroup.localeCompare(b.normalized.cityGroup, 'zh-CN') || b.normalized.matchScore - a.normalized.matchScore
    if (filters.sort === 'family') return a.normalized.roleFamily.localeCompare(b.normalized.roleFamily, 'zh-CN') || b.normalized.matchScore - a.normalized.matchScore
    return b.normalized.matchScore - a.normalized.matchScore
  })
}

function buildFilterOptions(jobs: JobRecord[]) {
  const normalizedJobs = jobs.map(ensureNormalizedJob)
  const values = (selector: (job: JobRecord) => string) => [...new Set(normalizedJobs.map(selector).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  return {
    roleFamily: values((job) => job.normalized.roleFamily),
    roleTrack: values((job) => job.normalized.roleTrack),
    cityGroup: values((job) => job.normalized.cityGroup),
    priorityBucket: values((job) => job.normalized.priorityBucket),
  }
}

function buildJobStats(allJobs: JobRecord[], filteredJobs: JobRecord[]) {
  const normalizedAll = allJobs.map(ensureNormalizedJob)
  const countBy = (items: JobRecord[], selector: (job: JobRecord) => string) => items.reduce<Record<string, number>>((acc, job) => {
    const key = selector(job) || '未分类'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
  const priorityCounts = countBy(normalizedAll, (job) => job.normalized.priorityBucket)
  const familyCounts = countBy(normalizedAll, (job) => job.normalized.roleFamily)
  const trackCounts = countBy(normalizedAll, (job) => job.normalized.roleTrack)
  return {
    total: normalizedAll.length,
    filtered: filteredJobs.length,
    prioritySummary: ['A 优先', 'B 可投', 'C 次选', 'E 排除'].map((key) => `${key.replace(' ', '')} ${priorityCounts[key] || 0}`).join(' / '),
    familySummary: summarizeCounts(familyCounts),
    trackSummary: summarizeCounts(trackCounts),
  }
}

function summarizeCounts(counts: Record<string, number>) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([key, value]) => `${key} ${value}`)
    .join('；') || '暂无'
}

function priorityRank(value: string) {
  if (value.startsWith('A')) return 1
  if (value.startsWith('B')) return 2
  if (value.startsWith('C')) return 3
  if (value.startsWith('D')) return 4
  return 5
}

function getJobUserStatus(statusMap: JobUserStatusMap, jobId?: string): JobUserStatus {
  return jobId && statusMap[jobId] ? statusMap[jobId] : 'not_started'
}

function jobUserStatusLabel(status: string) {
  return JOB_USER_STATUS_OPTIONS.find((item) => item.value === status)?.label || '未处理'
}

function buildJobReadiness(
  job: JobRecord,
  context: {
    status: JobUserStatus
    jobPacks: StoredJobPack[]
    mockInterviews: MockInterviewSession[]
    realInterviews: StoredRealInterview[]
    history: TrainingRecord[]
  },
) {
  const hasPack = context.jobPacks.some((pack) => pack.selectedJobId === job.id)
  const hasMock = context.mockInterviews.some((session) => session.selectedJob.id === job.id)
  const hasReal = context.realInterviews.some((interview) => interview.selectedJob.id === job.id)
  const latestTraining = context.history.find((record) => record.selectedJob?.id === job.id)
  const signals = [
    hasPack ? '有准备包' : '无准备包',
    hasMock ? '有模拟面试' : '未模拟',
    hasReal ? '有真实复盘' : '未复盘',
    latestTraining ? `最近训练 ${formatDateTime(latestTraining.savedAt)}` : '未训练',
  ]
  const nextStep = !hasPack ? '下一步：生成准备包' : !hasMock ? '下一步：开始模拟面试' : !hasReal ? '下一步：真实面试后复盘' : '下一步：进入下一轮训练'
  return { signals, nextStep }
}

function getLatestActivityLabel(records: TrainingRecord[], mockInterviews: MockInterviewSession[], realInterviews: StoredRealInterview[]) {
  const latestTraining = records[0]
  const latestMock = mockInterviews[0]
  const latestReal = realInterviews[0]
  const candidates = [
    latestTraining && { label: `${latestTraining.title} ${feedbackStatusLabel(latestTraining.aiFeedbackStatus)}`, time: latestTraining.savedAt },
    latestMock && { label: `模拟面试 ${latestMock.status === 'completed' ? '已复盘' : '进行中'}`, time: latestMock.createdAt },
    latestReal && { label: `真实面试 ${latestReal.reviewReport ? '已复盘' : transcriptStatusLabel(latestReal.transcriptStatus)}`, time: latestReal.updatedAt },
  ].filter(Boolean) as Array<{ label: string; time: string }>
  return candidates.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())[0]?.label || '暂无训练'
}

function buildDailyAction(context: {
  jobPool: JobRecord[]
  selectedJob: JobRecord | null
  currentJobPack?: StoredJobPack
  mockInterviews: MockInterviewSession[]
  realInterviews: StoredRealInterview[]
  history: TrainingRecord[]
  cvText: CvTextState
}): { title: string; detail: string; cta: string; view: ViewId; icon: ReactNode } {
  const latestRealNeedsReview = context.realInterviews.find((item) => !item.reviewReport)
  const latestMock = context.mockInterviews[0]
  if (!context.jobPool.length) return { title: '先上传岗位表', detail: '岗位库建立后，系统才能给出今天的训练路径。', cta: '上传岗位表', view: 'materials', icon: <Upload size={17} /> }
  if (!context.selectedJob) return { title: '选择一个目标岗位', detail: '从岗位库里选一个今天要准备的岗位。', cta: '选择目标岗位', view: 'materials', icon: <BriefcaseBusiness size={17} /> }
  if (!context.currentJobPack) return { title: '生成岗位准备包', detail: '先让系统读懂公司、岗位和你的匹配点。', cta: '生成准备包', view: 'jobPack', icon: <Sparkles size={17} /> }
  if (!latestMock) return { title: '开始一轮模拟面试', detail: '进入面试舱，按一问一答完成今天的主训练。', cta: '开始模拟面试', view: 'mockInterview', icon: <MessagesSquare size={17} /> }
  if (latestMock.status !== 'completed' || !latestMock.finalReport) return { title: '完成模拟面试复盘', detail: '把进行中的面试收尾，拿到下一轮训练任务。', cta: '查看复盘', view: 'mockInterview', icon: <BrainCircuit size={17} /> }
  if (latestRealNeedsReview) return { title: '生成真实面试复盘', detail: '真实面试录音已转写，下一步提取问题并反补题库。', cta: '生成真实复盘', view: 'realInterview', icon: <FileAudio size={17} /> }
  const missingFeedback = context.history.find((record) => record.transcript && !record.aiFeedback)
  if (missingFeedback) return { title: '补齐 AI 反馈', detail: `${missingFeedback.title} 已有转写，等待生成短报告。`, cta: '生成 AI 反馈', view: 'feedback', icon: <BrainCircuit size={17} /> }
  return { title: '继续岗位训练', detail: '今天可以重练一段回答，或直接进入下一轮模拟面试。', cta: '进入训练', view: 'training', icon: <Mic size={17} /> }
}

function buildDataStatusText(context: {
  jobPool: JobRecord[]
  selectedJob: JobRecord | null
  jobPacks: StoredJobPack[]
  mockInterviews: MockInterviewSession[]
  realInterviews: StoredRealInterview[]
  companySources: CompanySourceInput[]
}) {
  return `岗位 ${context.jobPool.length} 个，准备包 ${context.jobPacks.length} 个，模拟面试 ${context.mockInterviews.length} 场，真实复盘 ${context.realInterviews.filter((item) => item.reviewReport).length} 份，公司资料 ${context.companySources.length} 条。`
}

function generateNextActions(jobPool: JobRecord[], selectedJob: JobRecord | null, cv: CvTextState, records: TrainingRecord[], jobPack?: StoredJobPack, mockInterviews: MockInterviewSession[] = []) {
  if (!jobPool.length) return ['上传 job.xlsx，建立岗位库。']
  if (!selectedJob) return ['从岗位库选择一个目标岗位。']
  if (!jobPack) return ['生成当前岗位准备包。']
  if (!mockInterviews.length) return ['开始一轮模拟面试。']
  if (!cv.text) return ['上传 TXT / Markdown 简历文本版。']
  const missing = defaultTasks.filter((task) => !records.some((record) => record.taskId === task.id))
  if (missing.length) return [`完成剩余录音：${missing.map((task) => task.title).join('、')}。`]
  const withoutTranscript = records.find((record) => !record.transcript)
  if (withoutTranscript) return [`为${withoutTranscript.title}生成转写文本。`, '也可以使用模拟转写测试流程。']
  const withoutFeedback = records.find((record) => !record.aiFeedback)
  if (withoutFeedback) return [`为${withoutFeedback.title}生成 AI 反馈。`]
  return records.flatMap((record) => record.aiFeedback?.nextTasks || []).slice(0, 3)
}

function getScriptTextForTask(taskId: TaskId, tasks: TrainingTask[], templates: ScriptTemplates, job: JobRecord | null) {
  const task = tasks.find((item) => item.id === taskId) || getDefaultTask(taskId)
  const text = templates[task.scriptKey] || task.defaultReferenceTemplate
  return job ? renderScript(text, job) : text
}

function renderScript(template: string, job: JobRecord) {
  const direction = job.companyBusiness || job.mainTrack || job.businessDirection || '相关业务方向'
  return template
    .replaceAll('【XXX岗位】', job.jobTitle)
    .replaceAll('【公司名称】', job.companyName)
    .replaceAll('【岗位相关业务/产品方向】', direction)
    .replaceAll('[XXX role]', job.jobTitle)
    .replaceAll('[business/product direction]', direction)
}

function taskIdToTrainingType(taskId: TaskId): TrainingType {
  if (taskId === 'en-intro') return 'englishIntro'
  if (taskId === 'miro-project') return 'miroProject'
  return 'chineseIntro'
}

function questionToTrainingType(type?: MockInterviewQuestion['type']): TrainingType {
  if (type === 'english') return 'englishIntro'
  if (type === 'project') return 'miroProject'
  return 'chineseIntro'
}

function transcriptStatusLabel(status: TranscriptStatus) {
  return { not_started: '未转写', mock_ready: '模拟转写', manual_ready: '临时文本', transcribing: '转写中', completed: '已转写', failed: '转写失败' }[status]
}

function feedbackStatusLabel(status: AIFeedbackStatus) {
  return { not_ready: '尚未就绪', transcript_needed: '等待转写', ready_to_analyze: '待生成反馈', analyzing: '分析中', completed: '已完成', failed: '反馈失败' }[status]
}

function createPreview(blob: Blob): AudioPreview { return { url: URL.createObjectURL(blob), size: blob.size, type: blob.type } }
function getSupportedAudioMimeType() { return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type)) || '' }
function getFileExtension(name: string) { const index = name.lastIndexOf('.'); return index >= 0 ? name.slice(index) : '' }
function isToday(value: string) { const date = new Date(value); const now = new Date(); return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate() }
function formatDateTime(value: string) { return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }
function truncateText(text: string, maxLength: number) { const compact = text.replace(/\s+/g, ' ').trim(); return compact.length > maxLength ? `${compact.slice(0, maxLength - 1)}…` : compact }
function formatDuration(seconds: number) { const minutes = Math.floor(seconds / 60); const rest = seconds % 60; return `${minutes}:${String(rest).padStart(2, '0')}` }
function formatFileSize(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB` }
function formatDateForFile(date: Date) { return date.toISOString().replace(/[:.]/g, '-').slice(0, 19) }
function formatDateForFileName(date: Date) { return date.toISOString().slice(0, 10) }
function downloadJson(payload: unknown, name: string) { const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url) }
async function readSourceFileText(file: File) {
  const raw = await file.text()
  if (file.name.toLowerCase().endsWith('.html') || file.type === 'text/html') {
    return raw
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 40_000)
  }
  return raw.slice(0, 40_000)
}
function countTextUnits(text: string) { return text.trim().replace(/\s+/g, '').length }
function mergeQuestionBank(current: QuestionBankUpdate[], updates: QuestionBankUpdate[], selectedJobId?: string) {
  const map = new Map<string, QuestionBankUpdate>()
  for (const item of current) map.set(`${item.selectedJobId || ''}::${item.question}`, item)
  for (const item of updates) {
    const next = { ...item, selectedJobId: item.selectedJobId || selectedJobId }
    map.set(`${next.selectedJobId || ''}::${next.question}`, next)
  }
  return [...map.values()].slice(0, 120)
}

function openRecordingDb(): Promise<IDBDatabase> { return new Promise((resolve, reject) => { const request = indexedDB.open(RECORDING_DB_NAME, 1); request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(RECORDING_STORE)) request.result.createObjectStore(RECORDING_STORE) }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) }) }
async function saveRecordingBlob(id: string, blob: Blob) { const db = await openRecordingDb(); await new Promise<void>((resolve, reject) => { const tx = db.transaction(RECORDING_STORE, 'readwrite'); tx.objectStore(RECORDING_STORE).put(blob, id); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) }); db.close() }
async function readRecordingBlob(id: string) { const db = await openRecordingDb(); const blob = await new Promise<Blob | null>((resolve, reject) => { const request = db.transaction(RECORDING_STORE, 'readonly').objectStore(RECORDING_STORE).get(id); request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null); request.onerror = () => reject(request.error) }); db.close(); return blob }
async function deleteRecordingBlob(id: string) { const db = await openRecordingDb(); await new Promise<void>((resolve) => { const tx = db.transaction(RECORDING_STORE, 'readwrite'); tx.objectStore(RECORDING_STORE).delete(id); tx.oncomplete = () => resolve(); tx.onerror = () => resolve() }); db.close() }
async function deleteRecordingDatabase() { await new Promise<void>((resolve) => { const request = indexedDB.deleteDatabase(RECORDING_DB_NAME); request.onsuccess = () => resolve(); request.onerror = () => resolve(); request.onblocked = () => resolve() }) }
function isValidBackup(payload: Partial<BackupPayload>): payload is BackupPayload { return Boolean(Array.isArray(payload.uploadedFiles) && Array.isArray(payload.jobPool) && Array.isArray(payload.trainingRecords) && payload.cvText && payload.scriptTemplates) }

export default App
