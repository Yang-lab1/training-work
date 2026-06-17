import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import {
  Archive,
  BrainCircuit,
  BriefcaseBusiness,
  Camera,
  CameraOff,
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
  MicOff,
  Minimize2,
  MoreHorizontal,
  PanelRightOpen,
  Phone,
  PhoneOff,
  RotateCcw,
  Save,
  Sparkles,
  Square,
  Trash2,
  Upload,
  UserCircle,
  Volume2,
  VolumeX,
  X,
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
import { useRecordingGuard } from './useRecordingGuard'

const APP_VERSION = '1.4A'
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
const PROVIDER_STATE_KEY = 'interview_os_provider_state'
const REMOTE_JOB_DATA_KEY = 'interview_os_remote_job_data'
const DEFAULT_REMOTE_JOB_MANIFEST_URL = 'https://raw.githubusercontent.com/Yang-lab1/training-work/main/latest/manifest.json'
const REMOTE_JOB_MANIFEST_URL = import.meta.env.VITE_JOB_DATA_MANIFEST_URL || DEFAULT_REMOTE_JOB_MANIFEST_URL
const RECORDING_DB_NAME = 'interview-os-recordings'
const RECORDING_STORE = 'recordings'

type ViewId = 'today' | 'materials' | 'training' | 'history' | 'feedback' | 'mockInterview' | 'realInterview' | 'backup' | 'diagnostics'
type UploadCategory = 'cv' | 'cv-zh' | 'cv-en' | 'project' | 'job' | 'job-map'
type CvParseStatus = '未上传' | '已上传，未解析' | '已提取文本' | '需要文本版'
type TaskId = 'cn-intro' | 'en-intro' | 'miro-project'
type ScriptTemplateKey = 'chineseIntro' | 'englishIntro' | 'miroProject'
type InterviewUiState = 'lobby' | 'waiting_room' | 'interview_room' | 'review_room'
type InterviewPhase = 'asking' | 'answering' | 'transcribing' | 'analyzing' | 'feedback_ready' | 'follow_up' | 'completed'
type JobSortMode = 'match' | 'priority' | 'today' | 'city' | 'family'
type JobUserStatus = 'not_started' | 'shortlisted' | 'preparing' | 'applied' | 'interviewing' | 'interviewed' | 'paused' | 'rejected'
type JobUserStatusMap = Record<string, JobUserStatus>
type RiskPreset = 'recommended' | 'all' | 'no-code' | 'no-sales-delivery' | 'custom'

interface JobFilters {
  search: string
  jobNature: string
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
  providerState?: ProviderState
  remoteJobData?: RemoteJobDataState
}

interface RemoteJobManifest {
  schemaVersion?: string
  dataVersion?: string
  updatedAt?: string
  timezone?: string
  jobsCount?: number
  newJobsCount?: number
  updatedJobsCount?: number
  removedJobsCount?: number
  jobsUrl?: string
  hash?: string
}

interface RemoteJobDataState {
  status: 'idle' | 'synced' | 'unchanged' | 'failed'
  source: 'github_raw' | 'api_proxy'
  manifestUrl: string
  jobsUrl?: string
  dataVersion?: string
  updatedAt?: string
  jobsCount?: number
  newJobsCount?: number
  updatedJobsCount?: number
  removedJobsCount?: number
  hash?: string
  lastCheckedAt?: string
  lastSyncedAt?: string
  error?: string
}

interface ProviderCallRecord {
  type: 'text' | 'asr'
  providerUsed?: string
  model?: string
  isFallback?: boolean
  fallbackReason?: string
  latencyMs?: number
  success: boolean
  error?: string
  at: string
}

interface ProviderState {
  lastTextCall?: ProviderCallRecord
  lastAsrCall?: ProviderCallRecord
  providerHistory: ProviderCallRecord[]
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
    taskProviders?: Record<string, string>
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
  transcriptProvider?: string
  transcriptModel?: string
  transcriptIsFallback?: boolean
  analysisProvider?: string
  analysisModel?: string
  analysisIsFallback?: boolean
  autoAnalyzedAt?: string
  followUpDecision?: 'follow_up' | 'next_question' | 'redo'
  improvedShortVersion?: string
  improvedFullVersion?: string
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

const primaryNavigation: Array<{ id: ViewId; label: string; icon: ReactNode }> = [
  { id: 'today', label: '今日', icon: <Home size={17} /> },
  { id: 'materials', label: '资料与岗位', icon: <BriefcaseBusiness size={17} /> },
  { id: 'mockInterview', label: '模拟面试', icon: <MessagesSquare size={17} /> },
  { id: 'feedback', label: '反馈', icon: <BrainCircuit size={17} /> },
]

const accountNavigation: Array<{ id: ViewId; label: string; helper: string; icon: ReactNode }> = [
  { id: 'realInterview', label: '真实面试复盘', helper: '真实录音转写与反补', icon: <FileAudio size={17} /> },
  { id: 'history', label: '面试记录', helper: '录音、转写和反馈', icon: <History size={17} /> },
  { id: 'backup', label: '数据管理', helper: '导入、导出、本地存储', icon: <Archive size={17} /> },
  { id: 'diagnostics', label: '系统诊断', helper: '模型、ASR 和 fallback', icon: <BrainCircuit size={17} /> },
]

const JOB_USER_STATUS_OPTIONS: Array<{ value: JobUserStatus; label: string }> = [
  { value: 'not_started', label: '未处理' },
  { value: 'shortlisted', label: '我想投' },
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
  const [providerState, setProviderState] = useState<ProviderState>(readProviderState)
  const [remoteJobData, setRemoteJobData] = useState<RemoteJobDataState>(readRemoteJobData)
  const [legacyRole, setLegacyRole] = useState(readLegacyRole)
  const [jobError, setJobError] = useState('')
  const [jobMessage, setJobMessage] = useState('')
  const [remoteJobMessage, setRemoteJobMessage] = useState('')
  const [remoteJobSyncing, setRemoteJobSyncing] = useState(false)
  const [materialsMessage, setMaterialsMessage] = useState('')
  const [backupMessage, setBackupMessage] = useState('')
  const [importError, setImportError] = useState('')
  const [recorderError, setRecorderError] = useState('')
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null)
  const [advancedScriptId, setAdvancedScriptId] = useState<TaskId | null>(null)
  const [scriptDraft, setScriptDraft] = useState('')
  const [recordingTaskId, setRecordingTaskId] = useState<TaskId | null>(null)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [audioPreviews, setAudioPreviews] = useState<Record<string, AudioPreview>>({})
  const [filters, setFilters] = useState<JobFilters>(() => defaultJobFilters())
  const [showAdvancedJobFilters, setShowAdvancedJobFilters] = useState(false)
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
  useRecordingGuard(recordingTaskId, recordingInterviewQuestionId)
  const [realInterviewAudioPreviews, setRealInterviewAudioPreviews] = useState<Record<string, AudioPreview>>({})
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const startedAtRef = useRef(0)
  const jobSelectionRef = useRef<HTMLElement | null>(null)
  const autoJobPackAttemptRef = useRef<Set<string>>(new Set())
  const autoCompanyKnowledgeAttemptRef = useRef<Set<string>>(new Set())

  const legacyCvFile = getFileByCategory(state.uploadedFiles, 'cv')
  const cvZhFile = getFileByCategory(state.uploadedFiles, 'cv-zh') || legacyCvFile
  const cvEnFile = getFileByCategory(state.uploadedFiles, 'cv-en')
  const projectFile = getFileByCategory(state.uploadedFiles, 'project')
  const todayRecords = state.history.filter((record) => isToday(record.savedAt))
  const todayMockCount = mockInterviews.filter((session) => isToday(session.startedAt || session.createdAt)).length
  const todayMockFeedbackCount = mockInterviews
    .filter((session) => isToday(session.startedAt || session.createdAt))
    .flatMap((session) => session.answers)
    .filter((answer) => answer.aiFeedbackStatus === 'completed').length
  const filteredJobs = useMemo(() => filterJobs(jobPool, filters, jobUserStatus), [jobPool, filters, jobUserStatus])
  const filterOptions = useMemo(() => buildFilterOptions(jobPool), [jobPool])
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
  const activeMockInterviewJobPack = useMemo(
    () => activeMockInterview
      ? jobPacks.find((pack) => pack.id === activeMockInterview.jobPackId)
        || jobPacks.find((pack) => pack.selectedJobId === activeMockInterview.selectedJob.id)
      : undefined,
    [activeMockInterview, jobPacks],
  )
  const activeMockInterviewKnowledgePack = useMemo(
    () => activeMockInterview
      ? companyKnowledgePacks.find((pack) => pack.id === activeMockInterview.companyKnowledgePackId)
        || companyKnowledgePacks.find((pack) => pack.selectedJobId === activeMockInterview.selectedJob.id)
      : undefined,
    [activeMockInterview, companyKnowledgePacks],
  )
  const dailyAction = useMemo(
    () => buildDailyAction({
      jobPool,
      selectedJob,
      currentJobPack,
      currentKnowledgePack,
      mockInterviews,
      realInterviews,
      history: state.history,
      cvText: cvTextState,
    }),
    [jobPool, selectedJob, currentJobPack, currentKnowledgePack, mockInterviews, realInterviews, state.history, cvTextState],
  )
  const abilityTrend = useMemo(() => buildAbilityTrend(state.history, mockInterviews), [state.history, mockInterviews])
  const jobBattleBoard = useMemo(
    () => buildJobBattleBoard(jobPool, jobUserStatus),
    [jobPool, jobUserStatus],
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
  useEffect(() => { localStorage.setItem(PROVIDER_STATE_KEY, JSON.stringify(providerState)) }, [providerState])
  useEffect(() => { localStorage.setItem(REMOTE_JOB_DATA_KEY, JSON.stringify(remoteJobData)) }, [remoteJobData])

  useEffect(() => {
    void syncRemoteJobData({ silent: true })
    // Only run once on app boot. Manual sync is available in the materials page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedJob || currentJobPack || autoJobPackAttemptRef.current.has(selectedJob.id)) return
    autoJobPackAttemptRef.current.add(selectedJob.id)
    void generateJobPack(selectedJob)
    // Generate the internal interview context once for a restored or newly selected job.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJob?.id, currentJobPack?.id])

  useEffect(() => {
    if (
      !selectedJob ||
      !currentJobPack ||
      currentKnowledgePack ||
      companyKnowledgeLoading ||
      autoCompanyKnowledgeAttemptRef.current.has(selectedJob.id)
    ) return
    autoCompanyKnowledgeAttemptRef.current.add(selectedJob.id)
    void generateCompanyKnowledgePack({ silent: true })
    // Company knowledge is internal interview context, not a user-facing workflow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJob?.id, currentJobPack?.id, currentKnowledgePack?.id, companyKnowledgeLoading])

  function recordProviderCall(call: Omit<ProviderCallRecord, 'at'>) {
    const nextCall: ProviderCallRecord = { ...call, at: new Date().toISOString() }
    setProviderState((current) => ({
      lastTextCall: call.type === 'text' ? nextCall : current.lastTextCall,
      lastAsrCall: call.type === 'asr' ? nextCall : current.lastAsrCall,
      providerHistory: [nextCall, ...(current.providerHistory || [])].slice(0, 20),
    }))
  }

  useEffect(() => {
    if (activeView === 'diagnostics') void refreshProviderStatus()
  }, [activeView])

  useEffect(() => {
    window.scrollTo(0, 0)
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
    if (category === 'cv' || category === 'cv-zh' || category === 'cv-en') {
      parseStatus = canExtractPlainText(file.name, file.type) ? '已提取文本' : '需要文本版'
      if (parseStatus === '已提取文本') saveCvText(await file.text(), file.name, 'upload')
    }
    saveFileMeta(category, file, '已选择', parseStatus)
  }

  async function syncRemoteJobData(options: { silent?: boolean } = {}) {
    if (remoteJobSyncing) return
    setRemoteJobSyncing(true)
    if (!options.silent) setRemoteJobMessage('正在同步 GitHub 最新岗位库…')
    const checkedAt = new Date().toISOString()
    try {
      const manifest = await fetchRemoteManifest()
      const jobsUrl = resolveRemoteUrl(REMOTE_JOB_MANIFEST_URL, manifest.jobsUrl || './jobs.json')
      const unchanged = Boolean(manifest.hash && remoteJobData.hash === manifest.hash && jobPool.length > 0)

      if (unchanged) {
        setRemoteJobData((current) => ({
          ...current,
          status: 'unchanged',
          source: 'github_raw',
          manifestUrl: REMOTE_JOB_MANIFEST_URL,
          jobsUrl,
          dataVersion: manifest.dataVersion,
          updatedAt: manifest.updatedAt,
          jobsCount: manifest.jobsCount,
          newJobsCount: manifest.newJobsCount,
          updatedJobsCount: manifest.updatedJobsCount,
          removedJobsCount: manifest.removedJobsCount,
          hash: manifest.hash,
          lastCheckedAt: checkedAt,
          error: undefined,
        }))
        if (!options.silent) setRemoteJobMessage(`已是最新岗位库：${manifest.jobsCount || jobPool.length} 个岗位。`)
        return
      }

      const jobsPayload = await fetchJsonWithTimeout(jobsUrl)
      const remoteJobs = Array.isArray((jobsPayload as { jobs?: unknown }).jobs) ? (jobsPayload as { jobs: JobRecord[] }).jobs : []
      if (!remoteJobs.length) throw new Error('远程 jobs.json 没有 jobs 数组。')
      const normalizedJobs = remoteJobs.map(ensureNormalizedJob)
      setJobPool(normalizedJobs)
      setSelectedJob((current) => matchSelectedJobFromRemote(current, normalizedJobs))
      setJobError('')
      setJobMessage(`已同步 GitHub 岗位库：${normalizedJobs.length} 个岗位。`)
      setRemoteJobData({
        status: 'synced',
        source: 'github_raw',
        manifestUrl: REMOTE_JOB_MANIFEST_URL,
        jobsUrl,
        dataVersion: manifest.dataVersion,
        updatedAt: manifest.updatedAt,
        jobsCount: manifest.jobsCount || normalizedJobs.length,
        newJobsCount: manifest.newJobsCount,
        updatedJobsCount: manifest.updatedJobsCount,
        removedJobsCount: manifest.removedJobsCount,
        hash: manifest.hash,
        lastCheckedAt: checkedAt,
        lastSyncedAt: checkedAt,
      })
      if (!options.silent) setRemoteJobMessage(`已同步最新岗位库：${normalizedJobs.length} 个岗位。`)
    } catch (error) {
      try {
        const proxyResult = await fetchProxyJobData()
        const normalizedJobs = proxyResult.jobs.map(ensureNormalizedJob)
        if (!normalizedJobs.length) throw new Error('API 代理没有返回岗位数据。', { cause: error })
        setJobPool(normalizedJobs)
        setSelectedJob((current) => matchSelectedJobFromRemote(current, normalizedJobs))
        setJobMessage(`已通过服务端代理同步岗位库：${normalizedJobs.length} 个岗位。`)
        setRemoteJobData({
          status: 'synced',
          source: 'api_proxy',
          manifestUrl: '/api/job-data/latest',
          jobsUrl: '/api/job-data/latest?file=jobs',
          dataVersion: proxyResult.manifest.dataVersion,
          updatedAt: proxyResult.manifest.updatedAt,
          jobsCount: proxyResult.manifest.jobsCount || normalizedJobs.length,
          newJobsCount: proxyResult.manifest.newJobsCount,
          updatedJobsCount: proxyResult.manifest.updatedJobsCount,
          removedJobsCount: proxyResult.manifest.removedJobsCount,
          hash: proxyResult.manifest.hash,
          lastCheckedAt: checkedAt,
          lastSyncedAt: checkedAt,
        })
        if (!options.silent) setRemoteJobMessage(`已通过服务端代理同步：${normalizedJobs.length} 个岗位。`)
      } catch (proxyError) {
        const message = proxyError instanceof Error ? proxyError.message : error instanceof Error ? error.message : '同步失败'
        setRemoteJobData((current) => ({
          ...current,
          status: 'failed',
          lastCheckedAt: checkedAt,
          error: message,
        }))
        if (!options.silent) setRemoteJobMessage(`同步失败，已保留本地岗位库：${message}`)
      }
    } finally {
      setRemoteJobSyncing(false)
    }
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
    const replacedCategories = category === 'cv-zh' ? ['cv-zh', 'cv'] : [category]
    commitState((current) => ({
      ...current,
      uploadedFiles: [...current.uploadedFiles.filter((item) => !replacedCategories.includes(item.category)), meta],
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
      [job.id]: 'preparing',
    }))
    setJobPackMessage('')
    setActiveView('mockInterview')
  }

  function updateJobUserStatus(jobId: string, status: JobUserStatus) {
    setJobUserStatus((current) => ({ ...current, [jobId]: status }))
  }

  function saveMaterialsAndContinue() {
    const hasMaterials = Boolean(cvZhFile || cvEnFile || cvTextState.text || projectFile)
    if (!hasMaterials) {
      setMaterialsMessage('请先上传资料。')
      return
    }
    setMaterialsMessage('已保存。请选择一个今天要准备的岗位。')
    window.setTimeout(() => jobSelectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
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
    if (!currentJobPack || !currentKnowledgePack) {
      setMockInterviewMessage(jobPackLoading || companyKnowledgeLoading ? '面试资料正在后台准备，请稍候。' : '面试资料尚未准备完成，请重试。')
      if (!currentJobPack && !jobPackLoading) void generateJobPack(selectedJob)
      if (currentJobPack && !currentKnowledgePack && !companyKnowledgeLoading) void generateCompanyKnowledgePack({ silent: true })
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
      currentPhase: 'transcribing',
      answers: [answer, ...item.answers.filter((existing) => existing.questionId !== questionId)],
    } : item))
    window.setTimeout(() => {
      void autoProcessInterviewAnswer(session, question, answer)
    }, 0)
    setMockInterviewMessage('收到回答，正在转写和分析。')
  }

  async function autoProcessInterviewAnswer(session: MockInterviewSession, question: MockInterviewQuestion, answer: MockInterviewAnswer) {
    setMockInterviewLoading(`auto-${question.id}`)
    setMockInterviewMessage('系统正在整理你的回答。')
    setMockInterviews((current) => updateMockSessionPhase(updateMockAnswer(current, session.id, question.id, (item) => ({
      ...item,
      transcriptStatus: 'transcribing',
      aiFeedbackStatus: 'transcript_needed',
    })), session.id, 'transcribing'))
    try {
      const payload = {
        trainingRecordId: answer.id,
        trainingType: questionToTrainingType(question.type),
        audioMetadata: answer.audioMetadata,
        selectedJob: session.selectedJob,
        sourceType: 'mock_interview',
      }
      const blob = answer.recordingId ? await readRecordingBlob(answer.recordingId) : null
      const transcriptRequest: RequestInit = blob
        ? (() => {
          const form = new FormData()
          form.append('payload', JSON.stringify(payload))
          form.append('audio', blob, answer.recordingName || 'mock-answer.webm')
          return { method: 'POST', body: form }
        })()
        : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
      const transcriptResponse = await fetch('/api/transcribe', transcriptRequest)
      const transcriptResult = await transcriptResponse.json() as TranscribeResponse
      if (!transcriptResponse.ok || !transcriptResult.success) throw new Error(transcriptResult.success ? 'Transcribe failed.' : transcriptResult.error)
      recordProviderCall({
        type: 'asr',
        providerUsed: transcriptResult.providerUsed || transcriptResult.provider,
        model: transcriptResult.model,
        isFallback: Boolean(transcriptResult.isFallback || transcriptResult.provider === 'mock_fallback'),
        fallbackReason: transcriptResult.fallbackReason,
        latencyMs: transcriptResult.latencyMs,
        success: true,
      })
      const transcript: TranscriptData = {
        text: transcriptResult.transcript,
        source: transcriptResult.provider === 'mock' || transcriptResult.provider === 'mock_fallback' ? 'mock' : 'asr',
        updatedAt: transcriptResult.generatedAt,
        generatedAt: transcriptResult.generatedAt,
        provider: transcriptResult.provider,
        model: transcriptResult.model,
        language: transcriptResult.language,
        isFallback: transcriptResult.isFallback,
        fallbackReason: transcriptResult.fallbackReason,
        latencyMs: transcriptResult.latencyMs,
      }
      setMockInterviews((current) => updateMockSessionPhase(updateMockAnswer(current, session.id, question.id, (item) => ({
        ...item,
        transcript,
        transcriptStatus: transcript.source === 'mock' ? 'mock_ready' : 'completed',
        transcriptProvider: transcriptResult.providerUsed || transcriptResult.provider,
        transcriptModel: transcriptResult.model,
        transcriptIsFallback: Boolean(transcriptResult.isFallback || transcriptResult.provider === 'mock_fallback'),
        aiFeedbackStatus: 'ready_to_analyze',
      })), session.id, 'analyzing'))

      const feedbackResponse = await fetch('/api/analyze-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType: 'analyze_answer',
          trainingRecordId: answer.id,
          trainingType: questionToTrainingType(question.type),
          selectedJob: session.selectedJob,
          question,
          transcript: transcript.text,
          durationSeconds: answer.durationSeconds,
          targetSeconds: 90,
          cvText: cvTextState.text.slice(0, 6000),
          scriptText: question.question,
        }),
      })
      const feedbackResult = await feedbackResponse.json() as AnalyzeAnswerResponse
      if (!feedbackResponse.ok || !feedbackResult.success) throw new Error(feedbackResult.success ? 'Analyze failed.' : feedbackResult.error)
      recordProviderCall({
        type: 'text',
        providerUsed: feedbackResult.providerUsed || feedbackResult.provider,
        model: feedbackResult.model,
        isFallback: Boolean(feedbackResult.isFallback || feedbackResult.provider === 'mock_fallback'),
        fallbackReason: feedbackResult.fallbackReason || feedbackResult.rawProviderNote,
        latencyMs: feedbackResult.latencyMs,
        success: true,
      })
      const { success: _success, ...aiFeedback } = feedbackResult
      void _success
      const problemText = [aiFeedback.summary, ...aiFeedback.problems].join(' ')
      const needsFollowUp = question.type !== 'follow_up'
        && (aiFeedback.score < 70 || transcript.text.length < 80 || /too short|not answer|logic|role fit|unclear|no contribution|no data/.test(problemText))
      setMockInterviews((current) => updateMockSessionPhase(updateMockAnswer(current, session.id, question.id, (item) => ({
        ...item,
        aiFeedback,
        aiFeedbackStatus: 'completed',
        analysisProvider: feedbackResult.providerUsed || feedbackResult.provider,
        analysisModel: feedbackResult.model,
        analysisIsFallback: Boolean(feedbackResult.isFallback || feedbackResult.provider === 'mock_fallback'),
        autoAnalyzedAt: new Date().toISOString(),
        followUpDecision: needsFollowUp ? 'follow_up' : 'next_question',
        improvedShortVersion: aiFeedback.improvedShortVersion,
        improvedFullVersion: aiFeedback.improvedLongVersion,
      })), session.id, 'feedback_ready'))
      if (needsFollowUp) {
        try {
          const followResponse = await fetch('/api/generate-follow-up', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskType: 'generate_follow_up', selectedJob: session.selectedJob, question, transcript: transcript.text, aiFeedback }),
          })
          const followResult = await followResponse.json() as GenerateFollowUpResponse
          if (followResponse.ok && followResult.success) {
            window.setTimeout(() => {
              setMockInterviews((current) => current.map((item) => {
                if (item.id !== session.id) return item
                const insertAt = Math.min(item.currentQuestionIndex + 1, item.questions.length)
                return {
                  ...item,
                  questions: [...item.questions.slice(0, insertAt), followResult.followUpQuestion, ...item.questions.slice(insertAt)],
                  followUps: [...item.followUps, followResult.followUpQuestion],
                  currentQuestionIndex: insertAt,
                  currentPhase: 'follow_up',
                }
              }))
            }, 900)
          }
        } catch {
          window.setTimeout(() => {
            setMockInterviews((current) => current.map((item) => {
              if (item.id !== session.id) return item
              const nextIndex = Math.min(item.currentQuestionIndex + 1, item.questions.length - 1)
              return { ...item, currentQuestionIndex: nextIndex, currentPhase: nextIndex === item.currentQuestionIndex ? 'feedback_ready' : 'asking' }
            }))
          }, 900)
        }
      } else if (session.currentQuestionIndex < session.questions.length - 1) {
        window.setTimeout(() => {
          setMockInterviews((current) => current.map((item) => item.id === session.id ? {
            ...item,
            currentQuestionIndex: Math.min(item.currentQuestionIndex + 1, item.questions.length - 1),
            currentPhase: 'asking',
          } : item))
        }, 900)
      }
      setMockInterviewMessage(needsFollowUp ? '面试官正在准备追问。' : session.currentQuestionIndex < session.questions.length - 1 ? '面试官正在继续提问。' : '本轮面试已完成，可以挂断查看复盘。')
    } catch (error) {
      setMockInterviews((current) => updateMockSessionPhase(updateMockAnswer(current, session.id, question.id, (item) => ({
        ...item,
        transcriptStatus: item.transcript ? item.transcriptStatus : 'failed',
        aiFeedbackStatus: 'failed',
      })), session.id, 'feedback_ready'))
      setMockInterviewMessage(error instanceof Error ? error.message : '自动转写或分析失败。')
    } finally {
      setMockInterviewLoading('')
    }
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

  void generateInterviewAnswerTranscript
  void generateInterviewAnswerFeedback

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

  function enterMockInterviewRoom(sessionId: string) {
    setMockInterviews((current) => current.map((session) => session.id === sessionId ? {
      ...session,
      uiState: 'interview_room',
      startedAt: session.startedAt || new Date().toISOString(),
      currentPhase: 'asking',
    } : session))
  }

  function returnMockInterviewToBriefing(sessionId: string) {
    setMockInterviews((current) => current.map((session) => session.id === sessionId ? {
      ...session,
      uiState: 'waiting_room',
      currentPhase: 'asking',
    } : session))
  }

  async function finishMockInterview(sessionId: string) {
    const session = mockInterviews.find((item) => item.id === sessionId)
    if (!session) return
    if (!session.answers.length) {
      setMockInterviews((current) => current.map((item) => item.id === sessionId ? {
        ...item,
        status: 'completed',
        uiState: 'review_room',
        currentPhase: 'completed',
        completedAt: new Date().toISOString(),
      } : item))
      setMockInterviewMessage('面试已挂断。')
      return
    }
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

  async function generateCompanyKnowledgePack(options: { silent?: boolean } = {}) {
    const silent = Boolean(options.silent)
    if (!selectedJob) {
      if (!silent) {
        setCompanyKnowledgeMessage('请先选择目标岗位。')
        setActiveView('materials')
      }
      return
    }
    setCompanyKnowledgeLoading(true)
    if (!silent) setCompanyKnowledgeMessage('')
    try {
      const requestBody = {
        taskType: 'generate_company_knowledge_pack' as const,
        selectedJob: {
          id: selectedJob.id,
          companyName: selectedJob.companyName,
          jobTitle: selectedJob.jobTitle,
          city: selectedJob.city,
          jobType: selectedJob.jobType,
          priority: selectedJob.priority,
          mainTrack: selectedJob.mainTrack,
          companyBusiness: truncateText(selectedJob.companyBusiness || '', 800),
          jobContent: truncateText(selectedJob.jobContent || '', 1400),
          jobRequirements: truncateText(selectedJob.jobRequirements || '', 1400),
          businessDirection: truncateText(selectedJob.businessDirection || '', 600),
        },
        jobPack: currentJobPack?.jobPack ? {
          companySummary: truncateText(currentJobPack.jobPack.companySummary, 900),
          productAndBusiness: truncateText(currentJobPack.jobPack.productAndBusiness, 900),
          jobRequirementBreakdown: currentJobPack.jobPack.jobRequirementBreakdown.slice(0, 6).map((item) => truncateText(item, 220)),
          workContentPrediction: currentJobPack.jobPack.workContentPrediction.slice(0, 6).map((item) => truncateText(item, 220)),
          candidateFit: currentJobPack.jobPack.candidateFit.slice(0, 6).map((item) => truncateText(item, 220)),
          riskPoints: currentJobPack.jobPack.riskPoints.slice(0, 6).map((item) => truncateText(item, 220)),
          selfIntroductionStrategy: truncateText(currentJobPack.jobPack.selfIntroductionStrategy, 900),
          miroProjectStrategy: truncateText(currentJobPack.jobPack.miroProjectStrategy, 900),
          likelyQuestions: currentJobPack.jobPack.likelyQuestions.slice(0, 6).map((item) => ({
            question: truncateText(item.question, 220),
            whyItMatters: truncateText(item.whyItMatters, 220),
            framework: truncateText(item.framework, 120),
          })),
          fullScoreAnswerFrameworks: currentJobPack.jobPack.fullScoreAnswerFrameworks.slice(0, 4).map((item) => ({
            question: truncateText(item.question, 220),
            frameworkName: truncateText(item.frameworkName, 120),
            answerStructure: item.answerStructure.slice(0, 5).map((entry) => truncateText(entry, 180)),
            candidateEvidence: item.candidateEvidence.slice(0, 5).map((entry) => truncateText(entry, 180)),
            pitfalls: item.pitfalls.slice(0, 4).map((entry) => truncateText(entry, 180)),
          })),
          preparationTasks: currentJobPack.jobPack.preparationTasks.slice(0, 6).map((item) => truncateText(item, 180)),
        } : undefined,
        companySources: currentCompanySources
          .slice(0, 6)
          .map((source) => ({
            ...source,
            title: truncateText(source.title, 120),
            sourceName: truncateText(source.sourceName, 120),
            sourceUrl: source.sourceUrl ? truncateText(source.sourceUrl, 260) : undefined,
            text: truncateText(source.text, 2800),
          })),
        cvText: truncateText(cvTextState.text, 3200),
        realInterviewReviews: realInterviews
          .map((interview) => interview.reviewReport)
          .filter((review): review is RealInterviewReviewReport => Boolean(review))
          .slice(0, 3)
          .map((review) => ({
            overallSummary: truncateText(review.overallSummary, 360),
            interviewerFocus: review.interviewerFocus.slice(0, 5).map((item) => truncateText(item, 180)),
            strongestAnswer: truncateText(review.strongestAnswer, 240),
            weakestAnswer: truncateText(review.weakestAnswer, 240),
            missedPreparation: review.missedPreparation.slice(0, 5).map((item) => truncateText(item, 180)),
            unexpectedQuestions: review.unexpectedQuestions.slice(0, 5).map((item) => truncateText(item, 180)),
            answerQuality: truncateText(review.answerQuality, 280),
            roleFitAssessment: truncateText(review.roleFitAssessment, 280),
            nextTrainingTasks: review.nextTrainingTasks.slice(0, 5).map((item) => truncateText(item, 180)),
          })),
      }
      const response = await fetch('/api/generate-company-knowledge-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
      const result = await response.json() as GenerateCompanyKnowledgePackResponse
      if (!response.ok || !result.success) throw new Error(result.success ? '公司资料整理失败。' : result.error)
      recordProviderCall({
        type: 'text',
        providerUsed: result.provider,
        model: result.model,
        isFallback: result.provider === 'mock_fallback',
        fallbackReason: result.rawProviderNote,
        success: true,
      })
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
      if (!silent) {
        setCompanyKnowledgeMessage(
          result.provider === 'mock_fallback'
            ? `真实资料暂时未成功，已先生成模拟资料。${result.rawProviderNote ? ` ${result.rawProviderNote}` : ''}`
            : result.provider === 'mock'
              ? '已生成模拟面试资料。'
              : '面试资料已生成。'
        )
      }
    } catch (error) {
      if (silent) autoCompanyKnowledgeAttemptRef.current.delete(selectedJob.id)
      if (!silent) setCompanyKnowledgeMessage(error instanceof Error ? error.message : '面试资料生成失败。')
    } finally {
      setCompanyKnowledgeLoading(false)
    }
  }

  function deleteCompanySource(sourceId: string) {
    setCompanySources((current) => current.filter((source) => source.id !== sourceId))
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
      providerState,
      remoteJobData,
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
      setProviderState(normalizeProviderState(parsed.providerState))
      setRemoteJobData(normalizeRemoteJobData(parsed.remoteJobData))
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
    for (const key of [STORAGE_KEY, UPLOADED_FILES_KEY, JOB_POOL_KEY, SELECTED_JOB_KEY, LEGACY_TARGET_ROLE_KEY, CV_TEXT_KEY, SCRIPT_TEMPLATES_KEY, TRAINING_RECORDS_KEY, JOB_PACKS_KEY, MOCK_INTERVIEWS_KEY, REAL_INTERVIEWS_KEY, QUESTION_BANK_KEY, COMPANY_SOURCES_KEY, COMPANY_KNOWLEDGE_PACKS_KEY, JOB_USER_STATUS_KEY, PROVIDER_STATE_KEY, REMOTE_JOB_DATA_KEY]) {
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
    setProviderState({ providerHistory: [] })
    setRemoteJobData({ status: 'idle', source: 'github_raw', manifestUrl: REMOTE_JOB_MANIFEST_URL })
    setLegacyRole(null)
    setAudioPreviews({})
    setBackupMessage('已清空全部本地数据。')
  }

  async function generateJobPack(jobOverride?: JobRecord) {
    const targetJob = jobOverride || selectedJob
    if (!targetJob) {
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
          selectedJob: targetJob,
          companyKnowledgePack: companyKnowledgePacks.find((pack) => pack.selectedJobId === targetJob.id)?.companyKnowledgePack,
          cvText: cvTextState.text.slice(0, 8000),
          trainingRecords: state.history.slice(0, 20),
          aiFeedbackRecords: state.history.map((record) => record.aiFeedback).filter(Boolean),
          scriptTemplates,
        }),
      })
      const result = await response.json() as GenerateJobPackResponse
      if (!response.ok || !result.success) throw new Error(result.success ? '岗位准备包生成失败。' : result.error)
      const pack: StoredJobPack = {
        id: `${targetJob.id || targetJob.companyName}-${Date.now()}`,
        selectedJobId: targetJob.id,
        selectedJob: targetJob,
        provider: result.provider,
        model: result.model,
        generatedAt: result.generatedAt,
        jobPack: result.jobPack,
        rawProviderNote: result.rawProviderNote,
      }
      setJobPacks((current) => [pack, ...current.filter((item) => item.selectedJobId !== targetJob.id)].slice(0, 20))
      setJobPackMessage(result.provider === 'mock' || result.provider === 'mock_fallback' ? '面试资料已准备，当前使用模拟数据。' : '面试资料已准备。')
    } catch (error) {
      setJobPackMessage(error instanceof Error && error.name === 'AbortError' ? '请求超时，未覆盖已有准备包。' : error instanceof Error ? error.message : '岗位准备包生成失败。')
    } finally {
      clearTimeout(timeout)
      setJobPackLoading(false)
    }
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
          {primaryNavigation.map((item) => (
            <button className={activeView === item.id ? 'active' : ''} type="button" key={item.id} onClick={() => setActiveView(item.id)}>
              {item.icon}<span>{item.label}</span>
            </button>
          ))}
        </nav>
        <details className={`account-menu ${accountNavigation.some((item) => item.id === activeView) ? 'active' : ''}`}>
          <summary>
            <UserCircle size={18} />
            <span>我的</span>
            <ChevronDown size={15} />
          </summary>
          <div className="account-menu-panel">
            <div className="account-menu-header">
              <strong>{selectedJob ? selectedJob.jobTitle : '未选择岗位'}</strong>
              <span>{selectedJob ? selectedJob.companyName : '先从岗位库选择目标岗位'}</span>
            </div>
            {accountNavigation.map((item) => (
              <button className={activeView === item.id ? 'active' : ''} type="button" key={item.id} onClick={(event) => {
                setActiveView(item.id)
                event.currentTarget.closest('details')?.removeAttribute('open')
              }}>
                {item.icon}
                <span><strong>{item.label}</strong><em>{item.helper}</em></span>
              </button>
            ))}
          </div>
        </details>
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
                  <p>{selectedJob ? `${selectedJob.companyName} · ${selectedJob.city || '城市未写'}` : '岗位来自 GitHub 自动同步，不手填。'}</p>
                </div>
                <div>
                  <span>最近状态</span>
                  <strong>{getLatestActivityLabel(state.history, mockInterviews, realInterviews)}</strong>
                  <p>{currentJobPack ? '面试资料已就绪' : selectedJob ? '面试资料准备中' : '等待选择岗位'}</p>
                </div>
              </aside>
            </section>
            <section className="today-compact-status" aria-label="今日状态">
              <Metric label="今日模拟面试" value={`${todayMockCount}`} />
              <Metric label="面试题反馈" value={`${todayMockFeedbackCount}`} />
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
            <section className="daily-driver-grid" aria-label="Daily driver">
              <article className="job-battle-board" data-testid="job-battle-board">
                <div className="section-mini-heading"><span className="eyebrow">{'\u5c97\u4f4d\u4f5c\u6218\u677f'}</span><strong>{jobBattleBoard.total} {'\u4e2a\u5c97\u4f4d'} · {jobBattleBoard.activeCount} {'\u4e2a\u5728\u63a8\u8fdb'}</strong></div>
                <div className="battle-columns">{jobBattleBoard.columns.map((column) => (<div className="battle-column" key={column.status}><span>{column.label}</span><strong>{column.jobs.length}</strong>{column.jobs.slice(0, 3).map((job) => (<p key={job.id}>{job.companyName} · {job.jobTitle}</p>))}</div>))}</div>
              </article>
              <article className="ability-trend" data-testid="ability-trend">
                <div className="section-mini-heading"><span className="eyebrow">{'\u80fd\u529b\u8d8b\u52bf'}</span><strong>{abilityTrend.length ? '\u6700\u8fd1\u53cd\u9988\u63d0\u70bc' : '\u7b49\u5f85 AI \u53cd\u9988'}</strong></div>
                {abilityTrend.length ? abilityTrend.map((item) => (<div className="trend-row" key={item.id}><span>{item.label}</span><meter min={0} max={100} value={item.score} /><strong>{item.score}</strong><em>{item.action}</em></div>)) : <p className="empty-state compact">{'\u5b8c\u6210\u4e00\u6b21 AI \u53cd\u9988\u540e\uff0c\u8fd9\u91cc\u4f1a\u663e\u793a\u5c97\u4f4d\u5339\u914d\u3001\u8868\u8fbe\u3001\u9879\u76ee\u5177\u4f53\u6027\u7b49\u5f31\u9879\u8d8b\u52bf\u3002'}</p>}
              </article>
            </section>
          </Page>
        )}

        {activeView === 'materials' && (
          <Page title="资料与岗位" subtitle="补充个人资料，从 GitHub 岗位库选择目标岗位。">
            <section className="section-block material-flow">
              <SectionHeading icon={<Upload size={20} />} title="资料" />
              <div className="material-modules">
                <article className="material-module" data-testid="resume-material-module">
                  <div>
                    <strong>简历资料</strong>
                    <span>中文、英文简历分开保存，面试按场景调用。</span>
                  </div>
                  <div className="material-actions">
                    <div className="resume-upload-stack">
                      <UploadRow title="中文简历" hint="PDF / DOCX / TXT / Markdown" file={cvZhFile} button="上传中文简历" accept=".pdf,.doc,.docx,.txt,.md" onChange={(event) => void handleUpload('cv-zh', event)} onRemove={() => removeFile(cvZhFile?.category || 'cv-zh')} />
                      <UploadRow title="英文简历" hint="English CV / Resume" file={cvEnFile} button="上传英文简历" accept=".pdf,.doc,.docx,.txt,.md" onChange={(event) => void handleUpload('cv-en', event)} onRemove={() => removeFile('cv-en')} />
                    </div>
                    <details className="inline-details">
                      <summary>补充可解析文本</summary>
                      <UploadRow title="TXT / Markdown 文本版" hint="PDF / DOCX 暂未自动解析时再补充，可放中英合并版" file={cvTextState.fileName ? toCvTextMeta(cvTextState) : undefined} button="上传文本版" accept=".txt,.md,text/plain,text/markdown" onChange={(event) => void handleCvTextUpload(event)} onRemove={() => setCvTextState({ text: '', source: 'upload' })} />
                    </details>
                    <p className="quiet-status">{getResumeStatusText(cvZhFile, cvEnFile, cvTextState)}</p>
                  </div>
                </article>
                <article className="material-module" data-testid="project-material-module">
                  <div>
                    <strong>作品集 / 项目资料</strong>
                    <span>上传作品集、项目 PDF、项目网页或项目说明。</span>
                  </div>
                  <UploadRow title="作品集 / 项目资料" hint="PDF / HTML / Markdown / TXT / URL 说明" file={projectFile} button="上传项目资料" accept=".pdf,.doc,.docx,.txt,.md,.html" onChange={(event) => void handleUpload('project', event)} onRemove={() => removeFile('project')} />
                </article>
                <article className="material-module">
                  <div>
                    <strong>额外参考资料</strong>
                    <span>可选。你有官网文本、JD 或文章摘录时再补充，系统会在后台吸收这些信息。</span>
                  </div>
                  <div className="material-actions">
                    <details className="inline-details">
                      <summary>可选补充资料</summary>
                      <div className="inline-actions">
                        <label className="small-upload-button"><input type="file" accept=".txt,.md,.html,text/plain,text/markdown,text/html" onChange={(event) => void handleCompanySourceUpload('company_official', event)} /><Upload size={15} />公司资料</label>
                        <label className="small-upload-button"><input type="file" accept=".txt,.md,.html,text/plain,text/markdown,text/html" onChange={(event) => void handleCompanySourceUpload('job_description', event)} /><Upload size={15} />岗位 JD</label>
                        <label className="small-upload-button"><input type="file" accept=".txt,.md,.html,text/plain,text/markdown,text/html" onChange={(event) => void handleCompanySourceUpload('article', event)} /><Upload size={15} />文章文本</label>
                        <label className="small-upload-button"><input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={(event) => void handleCompanySourceUpload('portfolio', event)} /><Upload size={15} />作品集文本</label>
                      </div>
                      {currentCompanySources.length > 0 && <CompanySourcesList sources={currentCompanySources} onDelete={deleteCompanySource} />}
                    </details>
                    <p className="quiet-status">
                      {currentKnowledgePack
                        ? '面试资料已补齐'
                        : companyKnowledgeLoading
                          ? '补充资料正在后台吸收。'
                          : currentCompanySources.length
                            ? `${currentCompanySources.length} 份补充资料待吸收。`
                            : '没有额外资料也能先开始准备。'}
                    </p>
                    {companyKnowledgeMessage && <p className={companyKnowledgeMessage.includes('失败') || companyKnowledgeMessage.includes('请先') ? 'error-line' : 'success-line'}>{companyKnowledgeMessage}</p>}
                  </div>
                </article>
              </div>
              <div className="material-continue">
                <button className="primary-button" data-testid="save-materials-and-continue" type="button" onClick={saveMaterialsAndContinue} disabled={!cvZhFile && !cvEnFile && !cvTextState.text && !projectFile}>
                  保存并继续
                </button>
                <span>{materialsMessage || '岗位会自动从 GitHub 同步。'}</span>
              </div>
            </section>

            <section className="section-block" ref={jobSelectionRef}>
              <SectionHeading icon={<BriefcaseBusiness size={20} />} title="选择目标岗位" />
              {remoteJobMessage && <p className={remoteJobMessage.includes('失败') ? 'error-line' : 'success-line'}>{remoteJobMessage}</p>}
              <div className="job-upload-line simple">
                <div><strong>从 GitHub 岗位库选一个今天准备</strong><span>{jobPool.length ? `${getJobPoolSourceLabel(remoteJobData)} · ${jobPool.length} 个岗位` : '正在读取 GitHub latest/jobs.json；失败时点“同步最新岗位库”。'}</span></div>
                <button type="button" onClick={() => void syncRemoteJobData()} disabled={remoteJobSyncing}>
                  {remoteJobSyncing ? '同步中…' : '同步最新岗位库'}
                </button>
              </div>
              {jobMessage && <p className="success-line">{jobMessage}</p>}
              {jobError && <p className="error-line">{jobError}</p>}
              {selectedJob && <div className="selected-job"><span>当前岗位</span><strong>{selectedJob.companyName} · {selectedJob.jobTitle}</strong><p>{selectedJob.city || '城市未写'} · {selectedJob.mainTrack || '方向未写'}</p></div>}
              {jobPool.length > 0 ? (
                <>
                  <div className="job-simple-filters" data-testid="job-simple-filters">
                    <label className="job-search"><span>搜索</span><input value={filters.search} placeholder="公司、岗位、JD、城市、主线" onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></label>
                    <div className="job-filter-grid">
                      <FilterSelect label="岗位性质" value={filters.jobNature} options={filterOptions.jobNature} getLabel={(value) => `${value} · ${filterOptions.counts.jobNature[value] || 0}`} onChange={(value) => setFilters({ ...filters, jobNature: value })} />
                      <FilterSelect label="城市" value={filters.cityGroup} options={filterOptions.cityGroup} getLabel={(value) => `${value} · ${filterOptions.counts.cityGroup[value] || 0}`} onChange={(value) => setFilters({ ...filters, cityGroup: value })} />
                      <FilterSelect label="求职主线" value={filters.roleTrack} options={filterOptions.roleTrack} getLabel={(value) => `${shortTrackLabel(value)} · ${filterOptions.counts.roleTrack[value] || 0}`} onChange={(value) => setFilters({ ...filters, roleTrack: value })} />
                      <FilterSelect label="处理状态" value={filters.userStatus} options={JOB_USER_STATUS_OPTIONS.map((item) => item.value)} getLabel={(value) => jobUserStatusLabel(value)} onChange={(value) => setFilters({ ...filters, userStatus: value as JobUserStatus | '' })} />
                      <label><span>风险</span><select value={getRiskPreset(filters)} onChange={(event) => setFilters({ ...filters, ...riskPresetToFilterPatch(event.target.value as RiskPreset) })}><option value="recommended">推荐池</option><option value="all">全部岗位</option><option value="no-code">避开强技术</option><option value="no-sales-delivery">避开销售交付</option><option value="custom">自定义风险</option></select></label>
                      <label><span>排序</span><select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value as JobSortMode })}><option value="match">匹配度最高</option><option value="priority">优先级最高</option><option value="today">今日新增优先</option><option value="city">城市优先</option><option value="family">岗位族群</option></select></label>
                    </div>
                    <div className="job-filter-summary">
                      <span>已筛出 <strong>{filteredJobs.length}</strong> / {jobPool.length} 个岗位</span>
                      <button type="button" onClick={() => setFilters(defaultJobFilters())}>清空筛选</button>
                      <button type="button" onClick={() => setShowAdvancedJobFilters((value) => !value)}>{showAdvancedJobFilters ? '收起高级筛选' : '高级筛选'}</button>
                    </div>
                  </div>
                  {showAdvancedJobFilters && <div className="job-smart-filters" data-testid="advanced-job-filters">
                    <FilterSelect label="岗位族群" value={filters.roleFamily} options={filterOptions.roleFamily} onChange={(value) => setFilters({ ...filters, roleFamily: value })} />
                    <FilterSelect label="优先级" value={filters.priorityBucket} options={filterOptions.priorityBucket} onChange={(value) => setFilters({ ...filters, priorityBucket: value })} />
                  </div>}
                  {showAdvancedJobFilters && <div className="risk-filter-bar">
                    <RiskToggle label="隐藏强代码" checked={filters.hideStrongCode} onChange={(checked) => setFilters({ ...filters, hideStrongCode: checked })} />
                    <RiskToggle label="隐藏纯算法" checked={filters.hideAlgorithm} onChange={(checked) => setFilters({ ...filters, hideAlgorithm: checked })} />
                    <RiskToggle label="隐藏强销售" checked={filters.hideSales} onChange={(checked) => setFilters({ ...filters, hideSales: checked })} />
                    <RiskToggle label="隐藏长期驻场" checked={filters.hideOnsite} onChange={(checked) => setFilters({ ...filters, hideOnsite: checked })} />
                    <RiskToggle label="隐藏高频出差" checked={filters.hideTravel} onChange={(checked) => setFilters({ ...filters, hideTravel: checked })} />
                    <RiskToggle label="隐藏低薪" checked={filters.hideLowSalary} onChange={(checked) => setFilters({ ...filters, hideLowSalary: checked })} />
                    <RiskToggle label="隐藏高年限" checked={filters.hideHighExperience} onChange={(checked) => setFilters({ ...filters, hideHighExperience: checked })} />
                  </div>}
                  <div className="job-list">
                    {filteredJobs.slice(0, 30).map((job) => {
                      const status = getJobUserStatus(jobUserStatus, job.id)
                      const readiness = buildJobReadiness(job, { jobPacks, mockInterviews, realInterviews, history: state.history })
                      return (
                      <article className={`job-row ${selectedJob?.id === job.id ? 'selected' : ''}`} key={job.id}>
                        <div>
                          <strong>{job.companyName} · {job.jobTitle}</strong>
                          <span>{[job.city, job.jobType, job.salary, job.sourceSheet].filter(Boolean).join(' · ')}</span>
                          <div className="job-tags">
                            <em>{job.normalized.matchScore} 分推荐</em>
                            <em className="status">{jobUserStatusLabel(status)}</em>
                          </div>
                          <p>{job.normalized.matchReasons.slice(0, 1).join('；') || job.companyBusiness || '从已筛岗位中选择一个准备。'}</p>
                          <div className="job-readiness">
                            <strong>{readiness.nextStep}</strong>
                          </div>
                          <details className="job-detail-drawer">
                            <summary>查看详情</summary>
                            <div className="job-tags">
                              <em>{job.normalized.roleFamily}</em>
                              <em>{job.normalized.roleTrack}</em>
                              <em>{job.normalized.priorityBucket}</em>
                              {job.normalized.riskFlags.map((flag) => <em className="risk" key={flag}>{flag}</em>)}
                            </div>
                            <p>{job.normalized.matchReasons.join('；')}</p>
                          </details>
                        </div>
                        <div className="job-row-actions">
                          <select aria-label={`设置 ${job.jobTitle} 状态`} value={status} onChange={(event) => updateJobUserStatus(job.id, event.target.value as JobUserStatus)}>
                            {JOB_USER_STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                          </select>
                          <button type="button" onClick={() => updateJobUserStatus(job.id, 'shortlisted')}>我想投</button>
                          <button type="button" onClick={() => selectJob(job)}>{selectedJob?.id === job.id ? '当前岗位' : '选择面试'}</button>
                        </div>
                      </article>
                    )})}
                  </div>
                </>
              ) : <p className="empty-state">正在同步 GitHub 岗位库。同步失败时，请点“同步最新岗位库”。</p>}
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
          <Page title="面试记录" subtitle="录音、转写和 AI 反馈状态。">
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

        {activeView === 'mockInterview' && (
          <div className="mock-interview-screen">
            {!selectedJob ? (
              <section className="primary-flow compact-empty">
                <p className="empty-state">请先选择目标岗位。</p>
                <button className="primary-button" type="button" onClick={() => setActiveView('materials')}><BriefcaseBusiness size={17} />选择岗位</button>
              </section>
            ) : (
              <>
                {!activeMockInterview && <section className="interview-quick-start" data-testid="interview-room">
                  <div className="interview-ready-heading">
                    <div className="interview-ready-copy">
                      <span>模拟面试</span>
                      <strong>{selectedJob.companyName}</strong>
                      <p>{selectedJob.jobTitle}</p>
                    </div>
                    <button type="button" onClick={() => setActiveView('materials')}>更换岗位</button>
                  </div>
                  <div className="quick-meeting-window">
                    <article className="quick-interviewer" data-testid="virtual-interviewer">
                      <img src="/virtual-interviewer.png" alt="虚拟 AI 面试官" />
                      <div className="quick-interviewer-label">
                        <strong>面试官 · Helen</strong>
                        <span>AI 产品与结构化行为面试</span>
                      </div>
                    </article>
                    <aside className="candidate-window quick-candidate" data-testid="candidate-window">
                      <span>你</span>
                      <strong>设备待命</strong>
                      <div className="wave-bars" aria-hidden="true"><i /><i /><i /><i /></div>
                    </aside>
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
                    <div className="interview-entry">
                      <div className={`interview-prep-status ${currentJobPack && currentKnowledgePack ? 'ready' : jobPackMessage.includes('失败') || jobPackMessage.includes('超时') || companyKnowledgeMessage.includes('失败') ? 'error' : 'loading'}`}>
                        <span>{currentJobPack && currentKnowledgePack ? '面试资料已就绪' : jobPackMessage.includes('失败') || jobPackMessage.includes('超时') || companyKnowledgeMessage.includes('失败') ? '面试资料暂时没准备好' : '面试资料正在后台准备'}</span>
                        {(!currentJobPack || !currentKnowledgePack) && !jobPackMessage.includes('失败') && !jobPackMessage.includes('超时') && !companyKnowledgeMessage.includes('失败') && <i aria-hidden="true" />}
                      </div>
                      <button className="primary-button" type="button" onClick={() => void startMockInterview(selectedMockType)} disabled={Boolean(mockInterviewLoading) || jobPackLoading || companyKnowledgeLoading || !currentJobPack || !currentKnowledgePack}>
                        <MessagesSquare size={17} />{mockInterviewLoading === 'start' ? '正在载入面试…' : '开始模拟面试'}
                      </button>
                      {(!currentJobPack || !currentKnowledgePack) && (jobPackMessage.includes('失败') || jobPackMessage.includes('超时') || companyKnowledgeMessage.includes('失败')) && (
                        <button type="button" onClick={() => { if (selectedJob && !currentJobPack) void generateJobPack(selectedJob); if (selectedJob && currentJobPack && !currentKnowledgePack) void generateCompanyKnowledgePack({ silent: true }) }} disabled={jobPackLoading || companyKnowledgeLoading}>重新准备</button>
                      )}
                    </div>
                  </div>
                </section>}
                {recorderError && <p className="error-line">{recorderError}</p>}
                {mockInterviewMessage && (!activeMockInterview || mockInterviewMessage.includes('失败') || mockInterviewMessage.includes('缺少')) && (
                  <p className={mockInterviewMessage.includes('失败') || mockInterviewMessage.includes('缺少') ? 'error-line' : 'success-line'}>{mockInterviewMessage}</p>
                )}
                {activeMockInterview ? (
                  <MockInterviewPanel
                    session={activeMockInterview}
                    jobPack={activeMockInterviewJobPack}
                    knowledgePack={activeMockInterviewKnowledgePack}
                    currentQuestion={activeMockInterview.questions[activeMockInterview.currentQuestionIndex]}
                    currentAnswer={activeMockInterview.answers.find((answer) => answer.questionId === activeMockInterview.questions[activeMockInterview.currentQuestionIndex]?.id)}
                    loading={mockInterviewLoading}
                    recordingQuestionId={recordingInterviewQuestionId}
                    recordingSeconds={recordingSeconds}
                    onStartRecording={(questionId) => void startInterviewAnswerRecording(questionId)}
                    onStopRecording={stopRecording}
                    onFollowUp={(questionId) => void generateFollowUpQuestion(activeMockInterview.id, questionId)}
                    onEnterRoom={() => enterMockInterviewRoom(activeMockInterview.id)}
                    onReturnToBriefing={() => returnMockInterviewToBriefing(activeMockInterview.id)}
                    onFinish={() => void finishMockInterview(activeMockInterview.id)}
                    onRestart={() => void startMockInterview(activeMockInterview.interviewType)}
                    onDelete={() => deleteMockInterview(activeMockInterview.id)}
                  />
                ) : null}
              </>
            )}
          </div>
        )}

        {activeView === 'realInterview' && (
          <Page title="真实面试复盘" subtitle={selectedJob ? `${selectedJob.companyName} · ${selectedJob.jobTitle}` : '先选择目标岗位，再上传真实面试录音'}>
            {!selectedJob ? (
              <section className="primary-flow">
                <div>
                  <span className="eyebrow">需要目标岗位</span>
                  <h2>先在岗位库选择岗位</h2>
                  <p>真实面试复盘会把问题反补到该岗位的题库和下一轮准备。</p>
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

        {activeView === 'backup' && (
          <Page title="数据管理" subtitle="查看本地数据，导出备份，必要时恢复。">
            <section className="data-management-grid" data-testid="data-management">
              <Metric label="岗位" value={`${jobPool.length}`} />
              <Metric label="面试记录" value={`${state.history.length}`} />
              <Metric label="模拟面试" value={`${mockInterviews.length}`} />
              <Metric label="真实复盘" value={`${realInterviews.filter((item) => item.reviewReport).length}`} />
              <Metric label="公司资料" value={`${companySources.length}`} />
              <Metric label="准备包" value={`${jobPacks.length}`} />
              <Metric label="岗位库版本" value={remoteJobData.dataVersion || '本地'} />
            </section>
            <section className="storage-note">
              <strong>本地存储</strong>
              <p>JSON 备份包含岗位、面试记录、转写、AI 反馈、准备包、真实复盘和公司知识包。录音 Blob 仍保存在浏览器 IndexedDB，不会写入 JSON。</p>
              <span>{formatRemoteJobStatus(remoteJobData, jobPool.length)}</span>
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
              providerState={providerState}
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
  return <div className="page-view"><header className="page-heading sr-only"><h1>{title}</h1><p>{subtitle}</p></header>{children}</div>
}

function SectionHeading({ icon, title }: { icon: ReactNode; title: string }) {
  return <div className="section-heading">{icon}<h2>{title}</h2></div>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>
}

function DiagnosticsView({
  status,
  providerState,
  loading,
  message,
  onRefresh,
  onTestText,
  onTestAsr,
}: {
  status: ProviderStatusPayload | null
  providerState: ProviderState
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
            <ProviderSummaryCard
              title="公司知识包"
              provider={status.ai.taskProviders?.companyKnowledge || status.ai.provider}
              configured={Boolean(status.ai.availableProviders[status.ai.taskProviders?.companyKnowledge || status.ai.provider]?.configured)}
              fallbackMode={Boolean(status.ai.availableProviders[status.ai.taskProviders?.companyKnowledge || status.ai.provider]?.fallbackMode)}
            />
            <ProviderSummaryCard title="ASR_PROVIDER" provider={status.asr.provider} configured={status.asr.configured} fallbackMode={status.asr.fallbackMode} />
          </div>
          {status.ai.taskProviders?.companyKnowledge && (
            <p className="provider-note">任务分工：普通文本反馈走 {status.ai.provider}；公司/岗位面试知识包走 {status.ai.taskProviders.companyKnowledge}。</p>
          )}
          <ProviderCallList providerState={providerState} />
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

function ProviderCallList({ providerState }: { providerState: ProviderState }) {
  const calls = [providerState.lastTextCall, providerState.lastAsrCall].filter(Boolean) as ProviderCallRecord[]
  return (
    <section className="provider-call-list" data-testid="provider-call-list">
      <h3>最近调用</h3>
      {calls.length ? calls.map((call) => (
        <div className="provider-call-row" key={`${call.type}-${call.at}`}>
          <strong>{call.type === 'text' ? '文本模型' : '语音转写'}</strong>
          <span>{call.providerUsed || 'mock'} · {call.model || '默认模型'} · {call.isFallback ? 'fallback' : 'direct'}</span>
          <em>{call.success ? '成功' : '失败'}{call.latencyMs ? ` · ${call.latencyMs}ms` : ''}</em>
          {call.fallbackReason && <p>{call.fallbackReason}</p>}
        </div>
      )) : <p className="empty-state compact">还没有真实调用记录。完成一次转写或反馈后会显示 provider、模型和 fallback 原因。</p>}
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

function MockInterviewPanel({
  session,
  jobPack,
  knowledgePack,
  currentQuestion,
  currentAnswer,
  loading,
  recordingQuestionId,
  recordingSeconds,
  onStartRecording,
  onStopRecording,
  onFollowUp,
  onEnterRoom,
  onReturnToBriefing,
  onFinish,
  onRestart,
  onDelete,
}: {
  session: MockInterviewSession
  jobPack?: StoredJobPack
  knowledgePack?: StoredCompanyKnowledgePack
  currentQuestion?: MockInterviewQuestion
  currentAnswer?: MockInterviewAnswer
  loading: string
  recordingQuestionId: string | null
  recordingSeconds: number
  onStartRecording: (questionId: string) => void
  onStopRecording: () => void
  onFollowUp: (questionId: string) => void
  onEnterRoom: () => void
  onReturnToBriefing: () => void
  onFinish: () => void
  onRestart: () => void
  onDelete: () => void
}) {
  const roomRef = useRef<HTMLElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const lastSpokenQuestionIdRef = useRef('')
  const callActiveRef = useRef(false)
  const startRecordingRef = useRef(onStartRecording)
  const recordingQuestionIdRef = useRef(recordingQuestionId)
  const currentAnswerRef = useRef(currentAnswer)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [sidePanelOpen, setSidePanelOpen] = useState(false)
  const [sidePanelTab, setSidePanelTab] = useState<'dialogue' | 'feedback' | 'materials' | 'questions'>('dialogue')
  const [callStarted, setCallStarted] = useState(session.answers.length > 0 || session.currentPhase !== 'asking')
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const isRecording = currentQuestion ? recordingQuestionId === currentQuestion.id : false
  const typeLabel = session.interviewType === 'pressure_mock' ? '英文压力面试' : session.interviewType === 'quick_mock' ? '快速摸底面试' : 'AI 产品岗位面试'
  const phaseLabel: Record<InterviewPhase, string> = {
    asking: '对方发问',
    answering: '你在回答',
    transcribing: '整理回答',
    analyzing: '分析匹配',
    feedback_ready: '继续面试',
    follow_up: '继续追问',
    completed: '已挂断',
  }
  const displayedQuestion = session.currentPhase === 'follow_up' && session.followUps.length ? session.followUps[session.followUps.length - 1] : currentQuestion
  const questionTimer = isRecording ? recordingSeconds : currentAnswer?.durationSeconds || 0
  const briefingJobPack = jobPack?.jobPack
  const briefingKnowledge = knowledgePack?.companyKnowledgePack
  const companyAndRolePoints = compactBriefItems([
    briefingKnowledge?.companyCoreBusiness,
    briefingKnowledge?.roleContext,
    briefingJobPack?.companySummary,
    briefingJobPack?.productAndBusiness,
  ], 4, 140)
  const candidateTalkingPoints = compactBriefItems([
    ...(briefingJobPack?.candidateFit || []),
    briefingJobPack?.selfIntroductionStrategy,
  ], 4, 140)
  const projectBridgePoints = compactBriefItems([
    briefingJobPack?.miroProjectStrategy,
    ...(briefingJobPack?.workContentPrediction || []),
  ], 4, 140)
  const likelyFollowUps = compactBriefItems([
    ...(briefingJobPack?.likelyQuestions.map((item) => item.question) || []),
    ...(briefingKnowledge?.recommendedQuestions || []),
  ], 5, 120)
  const riskPoints = compactBriefItems([
    ...(briefingJobPack?.riskPoints || []),
    ...(briefingKnowledge?.risksAndUnknowns || []),
  ], 4, 110)
  const preparationTasks = compactBriefItems(briefingJobPack?.preparationTasks || [], 5, 120)
  const recentSignals = compactBriefItems(briefingKnowledge?.recentSignals || [], 4, 100)
  const interviewUseHints = compactBriefItems(briefingKnowledge?.howToUseInInterview || [], 4, 120)
  const visiblePhase = session.currentPhase === 'asking' && !currentAnswer ? '待回答' : phaseLabel[session.currentPhase]
  const panelAnswer = currentAnswer?.aiFeedback
    ? currentAnswer
    : [...session.answers].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).find((answer) => answer.aiFeedback)
  const feedbackSummary = panelAnswer?.aiFeedback
    ? truncateText(`${panelAnswer.aiFeedback.score} 分 · ${panelAnswer.aiFeedback.summary}`, 96)
    : ''
  const isBusy = session.currentPhase === 'transcribing' || session.currentPhase === 'analyzing' || loading.startsWith('auto-')
  const callConnected = callStarted && session.currentPhase !== 'completed'
  const showQuestion = callConnected && Boolean(displayedQuestion)
  const callStatusLabel = !callStarted
    ? '等待接入'
    : isRecording
      ? '通话中'
      : isBusy
        ? '后台整理'
        : session.currentPhase === 'feedback_ready'
          ? '继续沟通'
          : visiblePhase
  const showCandidateWindow = cameraEnabled || Boolean(cameraStream) || Boolean(cameraError)
  const dialogueBubbles: Array<{ id: string; speaker: 'interviewer' | 'candidate' | 'system'; label: string; text: string }> = []
  if (callConnected) {
    dialogueBubbles.push({
      id: `question-${displayedQuestion?.id || 'pending'}`,
      speaker: 'interviewer',
      label: session.currentPhase === 'follow_up' ? '追问' : '面试官',
      text: showQuestion ? displayedQuestion?.question || '' : '面试官正在接入...',
    })
    if (currentAnswer?.transcript?.text) {
      dialogueBubbles.push({
        id: `answer-${currentAnswer.id}`,
        speaker: 'candidate',
        label: '你',
        text: currentAnswer.transcript.text,
      })
    }
    if (isBusy) {
      dialogueBubbles.push({
        id: 'system-processing',
        speaker: 'system',
        label: '系统',
        text: session.currentPhase === 'transcribing' ? '正在整理你的回答...' : '正在分析并准备继续追问...',
      })
    }
    if (currentAnswer?.aiFeedback?.summary && !isBusy) {
      dialogueBubbles.push({
        id: `feedback-${currentAnswer.id}`,
        speaker: 'system',
        label: '反馈',
        text: truncateText(currentAnswer.aiFeedback.summary, 120),
      })
    }
  }

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

  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream
    }
  }, [cameraStream])

  useEffect(() => () => {
    cameraStream?.getTracks().forEach((track) => track.stop())
  }, [cameraStream])

  useEffect(() => {
    callActiveRef.current = callConnected
  }, [callConnected])

  useEffect(() => {
    startRecordingRef.current = onStartRecording
  }, [onStartRecording])

  useEffect(() => {
    recordingQuestionIdRef.current = recordingQuestionId
  }, [recordingQuestionId])

  useEffect(() => {
    currentAnswerRef.current = currentAnswer
  }, [currentAnswer])

  const stopInterviewerVoice = useCallback(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  }, [])

  const speakInterviewerQuestion = useCallback((text: string, onDone?: () => void) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) {
      onDone?.()
      return
    }
    stopInterviewerVoice()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = /[a-zA-Z]/.test(text) && !/[\u4e00-\u9fff]/.test(text) ? 'en-US' : 'zh-CN'
    utterance.rate = 0.92
    utterance.pitch = 0.96
    utterance.volume = 1
    utterance.onend = () => onDone?.()
    utterance.onerror = () => onDone?.()
    window.speechSynthesis.speak(utterance)
  }, [stopInterviewerVoice, voiceEnabled])

  useEffect(() => {
    if (!callConnected || !displayedQuestion?.id || !displayedQuestion.question) return
    if (lastSpokenQuestionIdRef.current === displayedQuestion.id) return
    lastSpokenQuestionIdRef.current = displayedQuestion.id
    speakInterviewerQuestion(displayedQuestion.question, () => {
      if (!callActiveRef.current) return
      if (recordingQuestionIdRef.current || currentAnswerRef.current) return
      startRecordingRef.current(displayedQuestion.id)
    })
    return () => stopInterviewerVoice()
  }, [callConnected, displayedQuestion?.id, displayedQuestion?.question, speakInterviewerQuestion, voiceEnabled, stopInterviewerVoice])

  useEffect(() => () => stopInterviewerVoice(), [stopInterviewerVoice])

  function closeCameraWindow() {
    cameraStream?.getTracks().forEach((track) => track.stop())
    setCameraStream(null)
    setCameraEnabled(false)
    setCameraError('')
  }

  async function toggleCamera() {
    if (cameraEnabled || cameraStream) {
      closeCameraWindow()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      setCameraStream(stream)
      setCameraEnabled(true)
      setCameraError('')
    } catch {
      setCameraError('摄像头未授权')
      setCameraEnabled(false)
    }
  }

  function startCall() {
    if (!currentQuestion || isBusy) return
    setCallStarted(true)
  }

  function hangUpCall() {
    setCallStarted(false)
    stopInterviewerVoice()
    if (isRecording) {
      onStopRecording()
      return
    }
    onFinish()
  }

  if (session.uiState === 'waiting_room') {
    return (
      <section className="interview-waiting-room interview-briefing-room" data-testid="interview-waiting-room">
        <header className="interview-briefing-hero">
          <div>
            <span className="eyebrow">面试前 60 秒</span>
            <h2>先过一遍这场面试重点</h2>
            <p>{session.selectedJob.companyName} · {session.selectedJob.jobTitle}</p>
          </div>
          <button className="danger-text" type="button" onClick={onDelete}><Trash2 size={15} />取消这轮</button>
        </header>

        <div className="interview-briefing-meta">
          <div><span>面试类型</span><strong>{typeLabel}</strong></div>
          <div><span>预计题数</span><strong>{session.questions.length} 题</strong></div>
          <div><span>预计时长</span><strong>{session.questions.length * 3} 分钟</strong></div>
          <div><span>资料状态</span><strong>{jobPack && knowledgePack ? '已就绪' : '准备中'}</strong></div>
        </div>

        <div className="interview-briefing-grid" data-testid="interview-prep-brief">
          <article className="briefing-card">
              <span>公司与岗位</span>
              <ul>
                {(companyAndRolePoints.length ? companyAndRolePoints : ['系统已按当前岗位整理公司业务、岗位职责和面试关注点。']).map((item) => <li key={item}>{item}</li>)}
              </ul>
          </article>
          <article className="briefing-card">
            <span>你要重点讲</span>
            <ul>
              {(candidateTalkingPoints.length ? candidateTalkingPoints : ['先讲清你的背景，再落到 AI 学习、项目证据和岗位匹配。']).map((item) => <li key={item}>{item}</li>)}
            </ul>
          </article>
          <article className="briefing-card">
            <span>项目怎么贴岗</span>
            <ul>
              {(projectBridgePoints.length ? projectBridgePoints : ['围绕用户、场景、AI 作用和你的实际贡献来讲项目。']).map((item) => <li key={item}>{item}</li>)}
            </ul>
          </article>
          <article className="briefing-card">
              <span>大概率会追问</span>
              <ul>
                {(likelyFollowUps.length ? likelyFollowUps : ['系统会围绕岗位理解、项目细节和岗位匹配继续追问。']).map((item) => <li key={item}>{item}</li>)}
              </ul>
          </article>
        </div>

        {!!riskPoints.length && (
          <section className="interview-briefing-risk">
            <span>这轮要小心</span>
            <div>
              {riskPoints.map((item) => <em key={item}>{item}</em>)}
            </div>
          </section>
        )}

        <details className="interview-briefing-detail">
          <summary>展开完整准备</summary>
          <div className="interview-briefing-detail-grid">
            <article>
              <span>自我介绍策略</span>
              <p>{briefingJobPack?.selfIntroductionStrategy || '系统会根据岗位和你的经历，优先强化开场定位、项目证据和岗位收束。'}</p>
            </article>
            <article>
              <span>Miro 项目讲法</span>
              <p>{briefingJobPack?.miroProjectStrategy || '优先讲用户问题、跨文化训练场景、AI 作用和 MVP 取舍。'}</p>
            </article>
            {!!preparationTasks.length && (
              <article>
                <span>开始前再看一眼</span>
                <ul>{preparationTasks.map((item) => <li key={item}>{item}</li>)}</ul>
              </article>
            )}
            {!!recentSignals.length && (
              <article>
                <span>公司近期信号</span>
                <ul>{recentSignals.map((item) => <li key={item}>{item}</li>)}</ul>
              </article>
            )}
            {!!interviewUseHints.length && (
              <article>
                <span>面试官会怎么追问</span>
                <ul>{interviewUseHints.map((item) => <li key={item}>{item}</li>)}</ul>
              </article>
            )}
          </div>
        </details>

        <div className="interview-briefing-actions">
          <div className={`interview-prep-status ${jobPack && knowledgePack ? 'ready' : 'loading'}`}>
            <span>{jobPack && knowledgePack ? '这场面试资料已就绪，会直接按公司、岗位和你的经历来追问。' : '面试资料还在后台整理，请稍候。'}</span>
          </div>
          <button className="primary-button" type="button" onClick={onEnterRoom}><Phone size={16} />看完了，进入面试</button>
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
          <div className="review-room-actions">
            <button className="primary-button" type="button" onClick={onRestart} disabled={loading === 'start'}><MessagesSquare size={16} />{loading === 'start' ? '正在准备下一轮' : '再来一轮模拟面试'}</button>
            <button className="danger-text" type="button" onClick={onDelete}><Trash2 size={15} />删除</button>
          </div>
        </header>
        {session.finalReport ? <InterviewFinalReportView finalReport={session.finalReport} answers={session.answers} questions={session.questions} /> : (
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
        <div><span>进度</span><strong>{callStarted ? `${session.currentQuestionIndex + 1} / ${session.questions.length}` : '待接入'}</strong></div>
        <div><span>通话</span><strong>{formatDuration(questionTimer)}</strong></div>
        <div><span>状态</span><strong>{callStatusLabel}</strong></div>
        <div className="meeting-status-actions">
          <button type="button" onClick={() => isFullscreen ? void exitFullscreen() : void enterFullscreen()}>
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}{isFullscreen ? '退出全屏' : '全屏'}
          </button>
          <button
            type="button"
            aria-label={sidePanelOpen ? '收起资料' : '资料'}
            title={sidePanelOpen ? '收起资料' : '资料'}
            onClick={() => setSidePanelOpen((value) => !value)}
          >
            {sidePanelOpen ? <X size={18} /> : <PanelRightOpen size={18} />}
          </button>
        </div>
      </header>

      <div className={`meeting-stage ${sidePanelOpen ? 'has-side-panel' : ''}`}>
        <article className={`interviewer-panel ${callConnected ? 'is-live' : 'is-waiting'}`} data-testid="virtual-interviewer">
          <img src="/virtual-interviewer.png" alt="虚拟 AI 面试官 Helen" />
          <div className="interviewer-screen-badge">
            <Sparkles size={15} />
            <span>{callConnected ? 'AI 面试官 · 通话中' : 'AI 面试官 · 等待接入'}</span>
          </div>
          {!callConnected ? (
            <div className="interview-call-prompt" data-testid="call-prejoin">
              <strong>准备接入面试</strong>
              <p>点击开始面试后，面试官会开始提问。</p>
              <button type="button" onClick={onReturnToBriefing}>先看面试要点</button>
            </div>
          ) : (
            <div className="meeting-dialogue-stream" data-testid="interview-dialogue">
              {dialogueBubbles.map((bubble) => (
                <div className={`meeting-bubble meeting-bubble--${bubble.speaker}`} key={bubble.id}>
                  <span>{bubble.label}</span>
                  <p>{bubble.text}</p>
                </div>
              ))}
            </div>
          )}
        </article>
        <div className="meeting-participant-rail" aria-hidden="true">
          <span className="participant-pill is-active">AI</span>
          <span className="participant-pill">你</span>
        </div>
        {showCandidateWindow && (
          <aside className={`candidate-window ${cameraEnabled ? 'camera-on' : ''}`} data-testid="candidate-window">
            <button className="candidate-window-close" type="button" aria-label="关闭我的窗口" onClick={closeCameraWindow}><X size={14} /></button>
            {cameraStream ? (
              <video ref={videoRef} autoPlay muted playsInline />
            ) : (
              <div className="candidate-avatar">
                <UserCircle size={36} />
                <span>{cameraError || '摄像头未开启'}</span>
              </div>
            )}
            <div className="candidate-meta">
              <strong>{callConnected ? '你' : '候选人'}</strong>
              <span>{cameraEnabled ? '摄像头已开' : cameraError || '已关闭'}</span>
            </div>
            <div className={`wave-bars ${isRecording ? 'active' : ''}`} aria-hidden="true"><i /><i /><i /><i /></div>
          </aside>
        )}
      </div>

      {currentQuestion && (
        <div className="meeting-control-bar" aria-label="bottom-controls">
          {!callStarted ? (
            <button className="call-start-button" type="button" onClick={startCall} disabled={!currentQuestion || Boolean(recordingQuestionId) || isBusy}>
              <Phone size={18} /><span className="call-start-label">开始面试</span>
            </button>
          ) : (
            <>
              <button className="icon-call-button" type="button" aria-label={cameraEnabled ? '关闭摄像头' : '开启摄像头'} title={cameraEnabled ? '关闭摄像头' : '开启摄像头'} onClick={() => void toggleCamera()}>
                {cameraEnabled ? <CameraOff size={18} /> : <Camera size={18} />}
              </button>
              <button className="icon-call-button" type="button" aria-label={isRecording ? '静音' : '继续通话'} title={isRecording ? '静音' : '继续通话'} onClick={() => isRecording ? onStopRecording() : currentQuestion && onStartRecording(currentQuestion.id)} disabled={isBusy}>
                {isRecording ? <Mic size={18} /> : <MicOff size={18} />}
              </button>
              <button
                className={`icon-call-button ${voiceEnabled ? 'is-active' : ''}`}
                type="button"
                aria-label={voiceEnabled ? '关闭面试官声音' : '开启面试官声音'}
                title={voiceEnabled ? '关闭面试官声音' : '开启面试官声音'}
                onClick={() => {
                  const next = !voiceEnabled
                  setVoiceEnabled(next)
                  if (!next) stopInterviewerVoice()
                  if (next) lastSpokenQuestionIdRef.current = ''
                }}
              >
                {voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
              <button className="icon-call-button" type="button" aria-label="更多" title="更多" onClick={() => setSidePanelOpen((value) => !value)}>
                <MoreHorizontal size={18} />
              </button>
              {isBusy && <span className="meeting-status-chip">{callStatusLabel}</span>}
              <button className="call-hangup-button icon-call-button" type="button" aria-label="挂断" title="挂断" onClick={hangUpCall} disabled={loading === 'report'}><PhoneOff size={20} /></button>
            </>
          )}
        </div>
      )}

      {sidePanelOpen && (
        <aside className="meeting-side-panel" data-testid="meeting-side-panel">
          <div className="meeting-side-tabs">
            {[
              ['dialogue', '对话'],
              ['feedback', '反馈'],
              ['materials', '资料'],
              ['questions', '题目'],
            ].map(([id, label]) => (
              <button key={id} className={sidePanelTab === id ? 'active' : ''} type="button" onClick={() => setSidePanelTab(id as typeof sidePanelTab)}>{label}</button>
            ))}
          </div>
          {sidePanelTab === 'dialogue' && (
            <div className="side-panel-section">
              <strong>对话记录</strong>
              <p>{displayedQuestion?.question}</p>
              {currentAnswer?.transcript ? <p>{currentAnswer.transcript.text}</p> : <span>候选人回答后会显示转写。</span>}
            </div>
          )}
          {sidePanelTab === 'feedback' && (
            <div className="side-panel-section" data-testid="interview-feedback-summary">
              {panelAnswer?.aiFeedback ? (
                <>
                  <strong>{feedbackSummary}</strong>
                  <div className="meeting-short-feedback" data-testid="meeting-short-feedback">
                    <span>最重要的问题</span>
                    <p>{panelAnswer.aiFeedback.problems[0] || '没有明显硬伤。'}</p>
                    <span>下一步</span>
                    <p>{panelAnswer.aiFeedback.nextTasks[0] || '等待面试官继续提问。'}</p>
                  </div>
                  {currentQuestion && <button type="button" onClick={() => onFollowUp(currentQuestion.id)} disabled={loading === `follow-${currentQuestion.id}`}>面试官追问</button>}
                  <details className="meeting-detail">
                    <summary>详细反馈</summary>
                    <AIFeedbackReport feedback={panelAnswer.aiFeedback} />
                  </details>
                </>
              ) : <span>生成反馈后会显示一句话评价和下一步动作。</span>}
            </div>
          )}
          {sidePanelTab === 'materials' && (
            <div className="side-panel-section">
              <strong>准备资料</strong>
              <p>{session.selectedJob.companyName} · {session.selectedJob.jobTitle}</p>
              <p>{session.selectedJob.companyBusiness || session.selectedJob.mainTrack || '面试会围绕岗位 JD、项目证据和岗位匹配追问。'}</p>
            </div>
          )}
          {sidePanelTab === 'questions' && (
            <div className="side-panel-section">
              <strong>题目</strong>
              <ol>{session.questions.map((question, index) => <li key={question.id}>{index + 1}. {question.question}</li>)}</ol>
            </div>
          )}
        </aside>
      )}
    </section>
  )
}

function InterviewFinalReportView({ finalReport, answers, questions }: { finalReport: NonNullable<MockInterviewSession['finalReport']>; answers?: MockInterviewAnswer[]; questions?: MockInterviewQuestion[] }) {
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
      {answers?.some((answer) => answer.aiFeedback) ? (
        <details className="meeting-detail review-detail">
          <summary>{'\u53ef\u80cc\u56de\u7b54\u7248\u672c'}</summary>
          <div className="answer-version-list">
            {answers.filter((answer) => answer.aiFeedback).map((answer) => {
              const question = questions?.find((item) => item.id === answer.questionId)
              return (
                <article key={answer.id}>
                  <strong>{question?.question || answer.questionId}</strong>
                  <p><b>30-45 {'\u79d2'}：</b>{answer.improvedShortVersion || answer.aiFeedback?.improvedShortVersion}</p>
                  <p><b>90-120 {'\u79d2'}：</b>{answer.improvedFullVersion || answer.aiFeedback?.improvedLongVersion}</p>
                </article>
              )
            })}
          </div>
        </details>
      ) : null}
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
          <FeedbackList title="反补面试任务" items={interview.reviewReport.nextTrainingTasks} />
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
  if (!sources.length) return <p className="empty-state">还没有额外参考资料。系统会先使用当前岗位和 GitHub 岗位库。</p>
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
  if (!records.length) return <p className="empty-state">还没有面试记录。</p>
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
      setMessage(error instanceof Error && error.name === 'AbortError' ? '请求超时，面试记录未丢失。' : error instanceof Error ? error.message : '反馈生成失败。')
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
        <FeedbackList title="下一步任务" items={topTasks.length ? topTasks : ['保持节奏，进入下一轮模拟面试。']} />
        <section><strong>是否建议重答</strong><p>{shouldRetry ? '建议重答一次，只看骨架讲。' : '可以继续本场面试。'}</p></section>
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
function readRemoteJobData(): RemoteJobDataState {
  try {
    const raw = localStorage.getItem(REMOTE_JOB_DATA_KEY)
    const parsed = raw ? JSON.parse(raw) as Partial<RemoteJobDataState> : {}
    return {
      status: parsed.status || 'idle',
      source: parsed.source || 'github_raw',
      manifestUrl: parsed.manifestUrl || REMOTE_JOB_MANIFEST_URL,
      jobsUrl: parsed.jobsUrl,
      dataVersion: parsed.dataVersion,
      updatedAt: parsed.updatedAt,
      jobsCount: parsed.jobsCount,
      newJobsCount: parsed.newJobsCount,
      updatedJobsCount: parsed.updatedJobsCount,
      removedJobsCount: parsed.removedJobsCount,
      hash: parsed.hash,
      lastCheckedAt: parsed.lastCheckedAt,
      lastSyncedAt: parsed.lastSyncedAt,
      error: parsed.error,
    }
  } catch {
    return { status: 'idle', source: 'github_raw', manifestUrl: REMOTE_JOB_MANIFEST_URL }
  }
}
function readCvTextState(): CvTextState { try { const raw = localStorage.getItem(CV_TEXT_KEY); return raw ? { text: '', source: 'upload', ...JSON.parse(raw) } : { text: '', source: 'upload' } } catch { return { text: '', source: 'upload' } } }
function readScriptTemplates(): ScriptTemplates { try { const raw = localStorage.getItem(SCRIPT_TEMPLATES_KEY); return raw ? JSON.parse(raw) : {} } catch { return {} } }
function readJobPacks() { return normalizeJobPacks(readArray<StoredJobPack>(JOB_PACKS_KEY)) }
function readMockInterviews() { return normalizeMockInterviews(readArray<MockInterviewSession>(MOCK_INTERVIEWS_KEY)) }
function readRealInterviews() { return normalizeRealInterviews(readArray<StoredRealInterview>(REAL_INTERVIEWS_KEY)) }
function readQuestionBank() { return normalizeQuestionBank(readArray<QuestionBankUpdate>(QUESTION_BANK_KEY)) }
function readCompanySources() { return normalizeCompanySources(readArray<CompanySourceInput>(COMPANY_SOURCES_KEY)) }
function readCompanyKnowledgePacks() { return normalizeCompanyKnowledgePacks(readArray<StoredCompanyKnowledgePack>(COMPANY_KNOWLEDGE_PACKS_KEY)) }
function readJobUserStatus() { return normalizeJobUserStatus(readObject<JobUserStatusMap>(JOB_USER_STATUS_KEY)) }
function readProviderState(): ProviderState {
  try {
    const raw = localStorage.getItem(PROVIDER_STATE_KEY)
    return normalizeProviderState(raw ? JSON.parse(raw) : undefined)
  } catch {
    return { providerHistory: [] }
  }
}
function readLegacyRole() { try { const raw = localStorage.getItem(LEGACY_TARGET_ROLE_KEY); return raw ? JSON.parse(raw) : null } catch { return null } }
function readArray<T>(key: string): T[] { try { const raw = localStorage.getItem(key); const parsed = raw ? JSON.parse(raw) : []; return Array.isArray(parsed) ? parsed : [] } catch { return [] } }
function readObject<T extends Record<string, unknown>>(key: string): Partial<T> { try { const raw = localStorage.getItem(key); const parsed = raw ? JSON.parse(raw) : {}; return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {} } catch { return {} } }

async function fetchRemoteManifest(): Promise<RemoteJobManifest> {
  const manifest = await fetchJsonWithTimeout(REMOTE_JOB_MANIFEST_URL)
  if (!manifest || typeof manifest !== 'object') throw new Error('远程 manifest.json 格式无效。')
  return manifest as RemoteJobManifest
}

async function fetchProxyJobData(): Promise<{ manifest: RemoteJobManifest; jobs: JobRecord[] }> {
  const payload = await fetchJsonWithTimeout('/api/job-data/latest')
  const data = payload as { success?: boolean; manifest?: RemoteJobManifest; jobs?: { jobs?: JobRecord[] } | JobRecord[]; error?: string }
  if (!data.success) throw new Error(data.error || '服务端岗位数据代理不可用。')
  const jobsPayload = data.jobs
  const jobs = Array.isArray(jobsPayload) ? jobsPayload : Array.isArray(jobsPayload?.jobs) ? jobsPayload.jobs : []
  return { manifest: data.manifest || {}, jobs }
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 8000): Promise<unknown> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal })
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
    return response.json()
  } finally {
    window.clearTimeout(timer)
  }
}

function resolveRemoteUrl(baseUrl: string, maybeRelative: string) {
  return new URL(maybeRelative, baseUrl).toString()
}

function matchSelectedJobFromRemote(current: JobRecord | null, jobs: JobRecord[]) {
  if (!current) return null
  const match = jobs.find((job) => job.id === current.id)
    || jobs.find((job) => (job as JobRecord & { stableId?: string }).stableId && (job as JobRecord & { stableId?: string }).stableId === (current as JobRecord & { stableId?: string }).stableId)
    || jobs.find((job) => job.companyName === current.companyName && job.jobTitle === current.jobTitle && job.city === current.city)
  return match ? { ...match, selectedAt: current.selectedAt || new Date().toISOString() } : current
}

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
  return (Array.isArray(sessions) ? sessions : []).filter((session) => session?.selectedJob && Array.isArray(session.questions)).map((session) => {
    const answers = Array.isArray(session.answers) ? session.answers.map((answer) => ({
      ...answer,
      transcriptStatus: answer.transcriptStatus || (answer.transcript ? answer.transcript.source === 'mock' ? 'mock_ready' : 'completed' : 'not_started'),
      aiFeedbackStatus: answer.aiFeedbackStatus || (answer.aiFeedback ? 'completed' : answer.transcript ? 'ready_to_analyze' : 'transcript_needed'),
      durationSeconds: answer.durationSeconds || answer.audioMetadata?.durationSeconds || 0,
      createdAt: answer.createdAt || new Date().toISOString(),
    })) : []
    const status = session.status || 'in_progress'
    const currentPhase = session.currentPhase || (status === 'completed' ? 'completed' : 'asking')
    const shouldReturnToBriefing = status === 'in_progress'
      && session.uiState === 'interview_room'
      && answers.length === 0
      && currentPhase === 'asking'
    return {
      ...session,
      id: session.id || `mock-interview-${Date.now()}`,
      status,
      uiState: shouldReturnToBriefing ? 'waiting_room' : session.uiState || (status === 'completed' ? 'review_room' : 'waiting_room'),
      currentPhase,
      createdAt: session.createdAt || new Date().toISOString(),
      startedAt: session.startedAt,
      interviewType: session.interviewType || 'job_pack_mock',
      companyKnowledgePackId: session.companyKnowledgePackId,
      currentQuestionIndex: Math.max(0, Math.min(session.currentQuestionIndex || 0, Math.max(0, session.questions.length - 1))),
      questions: session.questions,
      followUps: Array.isArray(session.followUps) ? session.followUps : [],
      answers,
    }
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
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

function normalizeProviderCall(input: unknown): ProviderCallRecord | undefined {
  if (!input || typeof input !== 'object') return undefined
  const call = input as Partial<ProviderCallRecord>
  const type = call.type === 'asr' ? 'asr' : call.type === 'text' ? 'text' : undefined
  if (!type) return undefined
  return {
    type,
    providerUsed: call.providerUsed,
    model: call.model,
    isFallback: Boolean(call.isFallback),
    fallbackReason: call.fallbackReason,
    latencyMs: typeof call.latencyMs === 'number' ? call.latencyMs : undefined,
    success: Boolean(call.success),
    error: call.error,
    at: call.at || new Date().toISOString(),
  }
}

function normalizeProviderState(input: unknown): ProviderState {
  if (!input || typeof input !== 'object') return { providerHistory: [] }
  const state = input as Partial<ProviderState>
  const history = Array.isArray(state.providerHistory)
    ? state.providerHistory.map(normalizeProviderCall).filter(Boolean).slice(0, 20) as ProviderCallRecord[]
    : []
  return {
    lastTextCall: normalizeProviderCall(state.lastTextCall),
    lastAsrCall: normalizeProviderCall(state.lastAsrCall),
    providerHistory: history,
  }
}

function normalizeRemoteJobData(input: unknown): RemoteJobDataState {
  if (!input || typeof input !== 'object') return { status: 'idle', source: 'github_raw', manifestUrl: REMOTE_JOB_MANIFEST_URL }
  const value = input as Partial<RemoteJobDataState>
  return {
    status: value.status || 'idle',
    source: value.source || 'github_raw',
    manifestUrl: value.manifestUrl || REMOTE_JOB_MANIFEST_URL,
    jobsUrl: value.jobsUrl,
    dataVersion: value.dataVersion,
    updatedAt: value.updatedAt,
    jobsCount: value.jobsCount,
    newJobsCount: value.newJobsCount,
    updatedJobsCount: value.updatedJobsCount,
    removedJobsCount: value.removedJobsCount,
    hash: value.hash,
    lastCheckedAt: value.lastCheckedAt,
    lastSyncedAt: value.lastSyncedAt,
    error: value.error,
  }
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
function getResumeStatusText(zhFile: UploadedFileMeta | undefined, enFile: UploadedFileMeta | undefined, cv: CvTextState) {
  const missing = [zhFile ? '' : '中文简历', enFile ? '' : '英文简历'].filter(Boolean)
  if (cv.text) return `已读取简历文本：${cv.fileName || '文本版'}。${missing.length ? `还可补充：${missing.join('、')}。` : '中英文简历已就位。'}`
  if (!zhFile && !enFile) return '尚未上传简历。建议先放中文简历，英文面试再补英文版。'
  if (zhFile?.parseStatus === '需要文本版' || enFile?.parseStatus === '需要文本版') return '简历文件已保存；PDF / DOCX 暂未自动解析，可补充 TXT / Markdown 文本版。'
  return missing.length ? `已保存简历。还可补充：${missing.join('、')}。` : '中英文简历已保存。'
}

function ensureNormalizedJob(job: JobRecord): JobRecord {
  return job.normalized ? job : { ...job, normalized: normalizeJobRecord(job) }
}

function defaultJobFilters(): JobFilters {
  return {
    search: '',
    jobNature: '',
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
  }
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
      && (!filters.jobNature || matchesJobNature(job, filters.jobNature))
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
  const countValues = (options: string[], matcher: (job: JobRecord, option: string) => boolean) => Object.fromEntries(options.map((option) => [option, normalizedJobs.filter((job) => matcher(job, option)).length]))
  const countedValues = (selector: (job: JobRecord) => string) => {
    const counts: Record<string, number> = {}
    for (const job of normalizedJobs) {
      const value = selector(job)
      if (value) counts[value] = (counts[value] || 0) + 1
    }
    return counts
  }
  const jobNature = ['实习', '正式', '校招', '社招'].filter((option) => normalizedJobs.some((job) => matchesJobNature(job, option)))
  return {
    jobNature,
    roleFamily: values((job) => job.normalized.roleFamily),
    roleTrack: values((job) => job.normalized.roleTrack),
    cityGroup: values((job) => job.normalized.cityGroup),
    priorityBucket: values((job) => job.normalized.priorityBucket),
    counts: {
      jobNature: countValues(jobNature, matchesJobNature),
      roleTrack: countedValues((job) => job.normalized.roleTrack),
      cityGroup: countedValues((job) => job.normalized.cityGroup),
    },
  }
}

function matchesJobNature(job: JobRecord, value: string): boolean {
  const text = `${job.normalized.jobNature} ${job.normalized.roleLevel} ${job.jobType} ${job.sourceSheet} ${job.jobTitle}`.toLowerCase()
  if (value === '实习') return text.includes('实习') || text.includes('intern')
  if (value === '校招') return text.includes('校招') || text.includes('应届') || job.sourceSheet.includes('校招')
  if (value === '社招') return text.includes('社招')
  if (value === '正式') return !matchesJobNature(job, '实习') && (text.includes('正式') || text.includes('全职') || text.includes('校招') || text.includes('社招') || job.sourceSheet.includes('正式'))
  return false
}

function shortTrackLabel(value: string) {
  return value.replace(/^主线[A-Z]：/, '').replace(/^备线[A-Z]：/, '').replace(/^次选[A-Z]：/, '').replace(/^排除[A-Z]：/, '')
}

function getRiskPreset(filters: JobFilters): RiskPreset {
  if (!filters.hideRejected && !filters.hideStrongCode && !filters.hideAlgorithm && !filters.hideSales && !filters.hideOnsite && !filters.hideTravel && !filters.hideLowSalary && !filters.hideHighExperience) return 'all'
  if (filters.hideRejected && filters.hideStrongCode && filters.hideAlgorithm && !filters.hideSales && !filters.hideOnsite && !filters.hideTravel) return 'no-code'
  if (filters.hideRejected && filters.hideSales && filters.hideOnsite && filters.hideTravel && !filters.hideStrongCode && !filters.hideAlgorithm) return 'no-sales-delivery'
  if (filters.hideRejected && !filters.hideStrongCode && !filters.hideAlgorithm && !filters.hideSales && !filters.hideOnsite && !filters.hideTravel && !filters.hideLowSalary && !filters.hideHighExperience) return 'recommended'
  return 'custom'
}

function riskPresetToFilterPatch(preset: RiskPreset): Partial<JobFilters> {
  if (preset === 'all') return { hideRejected: false, hideStrongCode: false, hideAlgorithm: false, hideSales: false, hideOnsite: false, hideTravel: false, hideLowSalary: false, hideHighExperience: false }
  if (preset === 'no-code') return { hideRejected: true, hideStrongCode: true, hideAlgorithm: true, hideSales: false, hideOnsite: false, hideTravel: false, hideLowSalary: false, hideHighExperience: false }
  if (preset === 'no-sales-delivery') return { hideRejected: true, hideStrongCode: false, hideAlgorithm: false, hideSales: true, hideOnsite: true, hideTravel: true, hideLowSalary: false, hideHighExperience: false }
  if (preset === 'recommended') return { hideRejected: true, hideStrongCode: false, hideAlgorithm: false, hideSales: false, hideOnsite: false, hideTravel: false, hideLowSalary: false, hideHighExperience: false }
  return {}
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
  const nextStep = !hasPack
    ? '面试资料正在后台准备'
    : !hasMock
      ? '资料已就绪，可以开始模拟面试'
      : !hasReal
        ? latestTraining
          ? `上次练习 ${formatDateTime(latestTraining.savedAt)}`
          : '已完成模拟面试，等待下一步'
        : '已形成完整面试记录'
  return { nextStep }
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
  return candidates.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())[0]?.label || '暂无面试练习'
}

function buildDailyAction(context: {
  jobPool: JobRecord[]
  selectedJob: JobRecord | null
  currentJobPack?: StoredJobPack
  currentKnowledgePack?: StoredCompanyKnowledgePack
  mockInterviews: MockInterviewSession[]
  realInterviews: StoredRealInterview[]
  history: TrainingRecord[]
  cvText: CvTextState
}): { title: string; detail: string; cta: string; view: ViewId; icon: ReactNode } {
  const latestRealNeedsReview = context.realInterviews.find((item) => !item.reviewReport)
  const latestMock = context.mockInterviews[0]
  if (!context.jobPool.length) return { title: '同步岗位库', detail: '打开网站会自动读取 GitHub latest/jobs.json。', cta: '同步岗位库', view: 'materials', icon: <BriefcaseBusiness size={17} /> }
  if (!context.selectedJob) return { title: '选择一个目标岗位', detail: '从岗位库里选一个今天要准备的岗位。', cta: '选择目标岗位', view: 'materials', icon: <BriefcaseBusiness size={17} /> }
  if (!context.currentJobPack || !context.currentKnowledgePack) return { title: '面试资料准备中', detail: '系统正在整理公司、岗位和你的匹配信息。', cta: '查看面试要点', view: 'mockInterview', icon: <Sparkles size={17} /> }
  if (!latestMock) return { title: '开始一轮模拟面试', detail: '进入面试舱，按一问一答完成今天的主要考察。', cta: '开始模拟面试', view: 'mockInterview', icon: <MessagesSquare size={17} /> }
  if (latestMock.status !== 'completed' || !latestMock.finalReport) return { title: '完成模拟面试复盘', detail: '把进行中的面试收尾，拿到下一轮准备任务。', cta: '查看复盘', view: 'mockInterview', icon: <BrainCircuit size={17} /> }
  if (latestRealNeedsReview) return { title: '生成真实面试复盘', detail: '真实面试录音已转写，下一步提取问题并反补题库。', cta: '生成真实复盘', view: 'realInterview', icon: <FileAudio size={17} /> }
  const missingFeedback = context.history.find((record) => record.transcript && !record.aiFeedback)
  if (missingFeedback) return { title: '补齐 AI 反馈', detail: `${missingFeedback.title} 已有转写，等待生成短报告。`, cta: '生成 AI 反馈', view: 'feedback', icon: <BrainCircuit size={17} /> }
  return { title: '继续模拟面试', detail: '所有考察都在面试舱里完成，系统会自动转写、分析和追问。', cta: '进入面试舱', view: 'mockInterview', icon: <MessagesSquare size={17} /> }
}

function buildDataStatusText(context: {
  jobPool: JobRecord[]
  selectedJob: JobRecord | null
  jobPacks: StoredJobPack[]
  mockInterviews: MockInterviewSession[]
  realInterviews: StoredRealInterview[]
  companySources: CompanySourceInput[]
}) {
  const preparationState = context.selectedJob
    ? context.jobPacks.some((pack) => pack.selectedJobId === context.selectedJob?.id) ? '面试资料已就绪' : '面试资料准备中'
    : '尚未选择岗位'
  return `岗位 ${context.jobPool.length} 个，${preparationState}，模拟面试 ${context.mockInterviews.length} 场，真实复盘 ${context.realInterviews.filter((item) => item.reviewReport).length} 份。`
}

function formatRemoteJobStatus(remote: RemoteJobDataState, localCount: number) {
  const source = remote.source === 'api_proxy' ? '服务端代理' : 'GitHub Raw'
  if (remote.status === 'failed') return `GitHub 同步失败。${remote.error || ''}`
  if (!remote.hash && !localCount) return '打开网站会自动读取 GitHub latest/jobs.json；私有仓库时走 /api/job-data/latest。'
  const version = remote.dataVersion ? `版本 ${remote.dataVersion}` : '版本未记录'
  const count = `${remote.jobsCount || localCount} 个岗位`
  const delta = typeof remote.newJobsCount === 'number' ? `今日新增 ${remote.newJobsCount}` : ''
  const hash = remote.hash ? `hash ${remote.hash.slice(0, 8)}` : ''
  const synced = remote.lastSyncedAt ? `同步 ${formatDateTime(remote.lastSyncedAt)}` : remote.lastCheckedAt ? `检查 ${formatDateTime(remote.lastCheckedAt)}` : ''
  return [source, version, count, delta, hash, synced].filter(Boolean).join(' · ')
}

function getJobPoolSourceLabel(remote: RemoteJobDataState) {
  if (remote.status === 'synced' || remote.status === 'unchanged') return remote.source === 'api_proxy' ? 'API 代理岗位库' : 'GitHub latest 岗位库'
  return 'GitHub 岗位库缓存'
}

function buildJobBattleBoard(
  jobs: JobRecord[],
  statusMap: JobUserStatusMap,
) {
  const columns: Array<{ status: JobUserStatus; label: string; jobs: JobRecord[] }> = [
    { status: 'shortlisted', label: '\u77ed\u540d\u5355', jobs: [] },
    { status: 'preparing', label: '\u51c6\u5907\u4e2d', jobs: [] },
    { status: 'interviewing', label: '\u9762\u8bd5\u4e2d', jobs: [] },
  ]
  for (const job of jobs) {
    const status = getJobUserStatus(statusMap, job.id)
    const column = columns.find((item) => item.status === status)
    if (column) column.jobs.push(job)
  }
  for (const column of columns) {
    column.jobs.sort((a, b) => b.normalized.matchScore - a.normalized.matchScore)
  }
  return {
    total: jobs.length,
    activeCount: columns.reduce((sum, column) => sum + column.jobs.length, 0),
    columns,
  }
}

function buildAbilityTrend(records: TrainingRecord[], interviews: MockInterviewSession[]) {
  const feedbacks: StoredAIFeedback[] = [
    ...records.map((record) => record.aiFeedback).filter(Boolean) as StoredAIFeedback[],
    ...interviews.flatMap((session) => session.answers.map((answer) => answer.aiFeedback).filter(Boolean) as StoredAIFeedback[]),
  ].slice(0, 20)
  if (!feedbacks.length) return []
  const dimensions = [
    { id: 'role-fit', label: '\u5c97\u4f4d\u5339\u914d', pick: (item: StoredAIFeedback) => `${item.roleFitFeedback} ${item.problems.join(' ')}`, action: '\u628a\u516c\u53f8\u4e1a\u52a1\u548c\u5c97\u4f4d\u5173\u952e\u8bcd\u653e\u8fdb\u5f00\u5934/\u7ed3\u5c3e\u3002' },
    { id: 'structure', label: '\u7ed3\u6784\u8868\u8fbe', pick: (item: StoredAIFeedback) => `${item.structureFeedback} ${item.summary}`, action: '\u6309\u80cc\u666f-\u884c\u52a8-\u7ed3\u679c-\u5c97\u4f4d\u5173\u7cfb\u91cd\u8bb2\u3002' },
    { id: 'specificity', label: '\u9879\u76ee\u5177\u4f53\u6027', pick: (item: StoredAIFeedback) => `${item.specificityFeedback} ${item.problems.join(' ')}`, action: '\u8865\u7528\u6237\u3001\u573a\u666f\u3001\u672c\u4eba\u8d21\u732e\u548c\u7ed3\u679c\u8bc1\u636e\u3002' },
    { id: 'english', label: '\u82f1\u6587\u8868\u8fbe', pick: (item: StoredAIFeedback) => `${item.expressionFeedback} ${item.fluencyFeedback}`, action: '\u5148\u6162\u8bfb\u518d\u5f55\uff0c\u51cf\u5c11\u590d\u6742\u4ece\u53e5\u3002' },
    { id: 'timing', label: '\u65f6\u957f\u63a7\u5236', pick: (item: StoredAIFeedback) => item.timingFeedback, action: '\u4fdd\u7559\u4e00\u6761\u4e3b\u7ebf\uff0c\u5220\u9664\u94fa\u57ab\u3002' },
  ]
  return dimensions.map((dimension) => {
    const hits = feedbacks.filter((item) => /short|unclear|risk|problem|need|weak|lack|over|confus/i.test(dimension.pick(item)))
    const baseScore = Math.round(feedbacks.reduce((sum, item) => sum + item.score, 0) / feedbacks.length)
    const penalty = Math.min(28, hits.length * 7)
    return { id: dimension.id, label: dimension.label, score: Math.max(42, baseScore - penalty), action: dimension.action }
  }).sort((a, b) => a.score - b.score).slice(0, 4)
}

function generateNextActions(jobPool: JobRecord[], selectedJob: JobRecord | null, cv: CvTextState, records: TrainingRecord[], jobPack?: StoredJobPack, mockInterviews: MockInterviewSession[] = []) {
  if (!jobPool.length) return ['同步 GitHub 最新岗位库。']
  if (!selectedJob) return ['从岗位库选择一个目标岗位。']
  if (!jobPack) return ['等待面试资料准备完成。']
  if (!mockInterviews.length) return ['开始一轮模拟面试。']
  if (!cv.text) return ['上传 TXT / Markdown 简历文本版。']
  const activeMock = mockInterviews.find((session) => session.status !== 'completed' || !session.finalReport)
  if (activeMock) return ['完成当前模拟面试，并生成整场复盘。']
  const withoutTranscript = records.find((record) => !record.transcript)
  if (withoutTranscript) return [`为${withoutTranscript.title}生成转写文本。`, '也可以使用模拟转写测试流程。']
  const withoutFeedback = records.find((record) => !record.aiFeedback)
  if (withoutFeedback) return [`为${withoutFeedback.title}生成 AI 反馈。`]
  const interviewTasks = mockInterviews.flatMap((session) => session.finalReport?.report.nextTrainingPlan || [])
  if (interviewTasks.length) return interviewTasks.slice(0, 3)
  return ['进入下一轮模拟面试。']
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
function compactBriefItems(items: Array<string | undefined>, limit = 4, maxLength = 120) {
  const deduped: string[] = []
  for (const item of items) {
    const compact = item?.replace(/\s+/g, ' ').trim()
    if (!compact) continue
    if (deduped.some((entry) => entry === compact)) continue
    deduped.push(truncateText(compact, maxLength))
    if (deduped.length >= limit) break
  }
  return deduped
}

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
