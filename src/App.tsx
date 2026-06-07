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
  MessagesSquare,
  Mic,
  RotateCcw,
  Save,
  Sparkles,
  Square,
  Trash2,
  Upload,
} from 'lucide-react'
import { parseJobWorkbook } from './jobParser'
import type { JobRecord } from './jobParser'
import type {
  AIFeedbackStatus,
  AnalyzeAnswerResponse,
  GenerateFollowUpResponse,
  GenerateInterviewReportResponse,
  GenerateJobPackResponse,
  GenerateMockInterviewResponse,
  InterviewFinalReport,
  JobPackContent,
  MockInterviewQuestion,
  MockInterviewType,
  StoredAIFeedback,
  TrainingType,
  TranscriptData,
  TranscriptStatus,
} from './lib/ai/types'
import type { TranscribeResponse } from './lib/asr/types'
import './App.css'

const APP_VERSION = '0.6A'
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
const RECORDING_DB_NAME = 'interview-os-recordings'
const RECORDING_STORE = 'recordings'

type ViewId = 'today' | 'materials' | 'training' | 'history' | 'feedback' | 'jobPack' | 'mockInterview' | 'backup'
type UploadCategory = 'cv' | 'project' | 'job' | 'job-map'
type CvParseStatus = '未上传' | '已上传，未解析' | '已提取文本' | '需要文本版'
type TaskId = 'cn-intro' | 'en-intro' | 'miro-project'
type ScriptTemplateKey = 'chineseIntro' | 'englishIntro' | 'miroProject'

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
  status: 'not_started' | 'in_progress' | 'completed'
  createdAt: string
  completedAt?: string
  interviewType: MockInterviewType
  currentQuestionIndex: number
  questions: MockInterviewQuestion[]
  answers: MockInterviewAnswer[]
  finalReport?: {
    provider: string
    model: string
    generatedAt: string
    report: InterviewFinalReport
    rawProviderNote?: string
  }
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
  { id: 'backup', label: '数据备份', icon: <Archive size={17} /> },
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
  const [filters, setFilters] = useState({ company: '', title: '', city: '', jobType: '', priority: '', mainTrack: '' })
  const [jobPackMessage, setJobPackMessage] = useState('')
  const [jobPackLoading, setJobPackLoading] = useState(false)
  const [mockInterviewMessage, setMockInterviewMessage] = useState('')
  const [mockInterviewLoading, setMockInterviewLoading] = useState('')
  const [recordingInterviewQuestionId, setRecordingInterviewQuestionId] = useState<string | null>(null)
  const [interviewAudioPreviews, setInterviewAudioPreviews] = useState<Record<string, AudioPreview>>({})
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
  const filteredJobs = useMemo(() => filterJobs(jobPool, filters), [jobPool, filters])
  const filterOptions = useMemo(() => buildFilterOptions(jobPool), [jobPool])
  const nextActions = generateNextActions(jobPool, selectedJob, cvTextState, todayRecords)
  const currentJobPack = useMemo(
    () => selectedJob ? jobPacks.find((pack) => pack.selectedJobId === selectedJob.id) : undefined,
    [jobPacks, selectedJob],
  )
  const activeMockInterview = useMemo(
    () => mockInterviews.find((session) => session.status === 'in_progress') || mockInterviews[0],
    [mockInterviews],
  )

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
    setActiveView('training')
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
        status: 'in_progress',
        createdAt: new Date().toISOString(),
        interviewType,
        currentQuestionIndex: 0,
        questions: result.questions,
        answers: [],
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
    setMockInterviews((current) => updateMockAnswer(current, sessionId, questionId, (item) => ({ ...item, transcriptStatus: 'transcribing' })))
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
      setMockInterviews((current) => updateMockAnswer(current, sessionId, questionId, (item) => ({
        ...item,
        transcript,
        transcriptStatus: transcript.source === 'mock' ? 'mock_ready' : 'completed',
        aiFeedback: undefined,
        aiFeedbackStatus: 'ready_to_analyze',
      })))
      setMockInterviewMessage(transcript.source === 'mock' ? '已生成模拟转写。' : '本题转写完成。')
    } catch (error) {
      setMockInterviews((current) => updateMockAnswer(current, sessionId, questionId, (item) => ({ ...item, transcriptStatus: 'failed', aiFeedbackStatus: 'transcript_needed' })))
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
    setMockInterviews((current) => updateMockAnswer(current, sessionId, questionId, (item) => ({ ...item, aiFeedbackStatus: 'analyzing' })))
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
      setMockInterviews((current) => updateMockAnswer(current, sessionId, questionId, (item) => ({ ...item, aiFeedback, aiFeedbackStatus: 'completed' })))
      setMockInterviewMessage('本题 AI 反馈已保存。')
    } catch (error) {
      setMockInterviews((current) => updateMockAnswer(current, sessionId, questionId, (item) => ({ ...item, aiFeedbackStatus: 'failed' })))
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
      setMockInterviews((current) => current.map((item) => item.id === sessionId ? { ...item, questions: [...item.questions, result.followUpQuestion], currentQuestionIndex: item.questions.length } : item))
      setMockInterviewMessage('已生成追问。')
    } catch (error) {
      setMockInterviewMessage(error instanceof Error ? error.message : '追问生成失败。')
    } finally {
      setMockInterviewLoading('')
    }
  }

  function nextInterviewQuestion(sessionId: string) {
    setMockInterviews((current) => current.map((session) => session.id === sessionId ? { ...session, currentQuestionIndex: Math.min(session.currentQuestionIndex + 1, session.questions.length - 1) } : session))
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
    for (const key of [STORAGE_KEY, UPLOADED_FILES_KEY, JOB_POOL_KEY, SELECTED_JOB_KEY, LEGACY_TARGET_ROLE_KEY, CV_TEXT_KEY, SCRIPT_TEMPLATES_KEY, TRAINING_RECORDS_KEY, JOB_PACKS_KEY, MOCK_INTERVIEWS_KEY]) {
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
          <Page title="今天完成一轮岗位训练" subtitle={selectedJob ? `${selectedJob.companyName} · ${selectedJob.jobTitle}` : '先上传岗位表并选择目标岗位'}>
            <section className="today-overview">
              <Metric label="今日录音" value={`${completedCount}/3`} />
              <Metric label="已完成 AI 反馈" value={`${analyzedToday}/${todayRecords.length || 0}`} />
              <Metric label="待处理" value={`${todayRecords.filter((item) => item.aiFeedbackStatus !== 'completed').length}`} />
            </section>
            <section className="primary-flow">
              <div>
                <span className="eyebrow">当前岗位</span>
                <h2>{selectedJob ? selectedJob.jobTitle : '尚未选择岗位'}</h2>
                <p>{selectedJob ? `${selectedJob.companyName} · ${selectedJob.city || '城市未写'}` : '岗位必须来自 job.xlsx。'}</p>
              </div>
              <button className="primary-button" type="button" onClick={() => setActiveView(selectedJob ? 'training' : 'materials')}>
                {selectedJob ? <Mic size={17} /> : <Upload size={17} />}
                {selectedJob ? '开始训练' : '上传岗位表'}
              </button>
            </section>
            <section className="training-shortcuts">
              {defaultTasks.map((task) => {
                const latest = todayRecords.find((record) => record.taskId === task.id)
                return (
                  <button type="button" key={task.id} onClick={() => setActiveView('training')}>
                    <span>{latest ? <Check size={17} /> : <Mic size={17} />}</span>
                    <strong>{task.title}</strong>
                    <em>{latest ? statusLabel(latest.aiFeedbackStatus) : task.subtitle}</em>
                  </button>
                )
              })}
            </section>
            <section className="next-actions">
              <SectionHeading icon={<Sparkles size={20} />} title="下一步" />
              <ol>{nextActions.map((action) => <li key={action}>{action}</li>)}</ol>
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
                  <div className="job-filters">
                    <FilterSelect label="公司" value={filters.company} options={filterOptions.company} onChange={(value) => setFilters({ ...filters, company: value })} />
                    <FilterSelect label="岗位" value={filters.title} options={filterOptions.title} onChange={(value) => setFilters({ ...filters, title: value })} />
                    <FilterSelect label="城市" value={filters.city} options={filterOptions.city} onChange={(value) => setFilters({ ...filters, city: value })} />
                    <FilterSelect label="类型" value={filters.jobType} options={filterOptions.jobType} onChange={(value) => setFilters({ ...filters, jobType: value })} />
                    <FilterSelect label="优先级" value={filters.priority} options={filterOptions.priority} onChange={(value) => setFilters({ ...filters, priority: value })} />
                    <FilterSelect label="主线" value={filters.mainTrack} options={filterOptions.mainTrack} onChange={(value) => setFilters({ ...filters, mainTrack: value })} />
                  </div>
                  <div className="job-list">
                    {filteredJobs.slice(0, 30).map((job) => (
                      <article className={`job-row ${selectedJob?.id === job.id ? 'selected' : ''}`} key={job.id}>
                        <div><strong>{job.companyName} · {job.jobTitle}</strong><span>{[job.city, job.jobType, job.priority, job.salary].filter(Boolean).join(' · ')}</span><p>{job.mainTrack || job.companyBusiness}</p></div>
                        <button type="button" onClick={() => selectJob(job)}>{selectedJob?.id === job.id ? '已选择' : '选择岗位'}</button>
                      </article>
                    ))}
                  </div>
                </>
              ) : <p className="empty-state">上传 job.xlsx 后，岗位会显示在这里。</p>}
              {legacyRole && <div className="legacy-notice"><span>检测到旧版手填岗位数据，仅作兼容提示。</span><button type="button" onClick={() => { localStorage.removeItem(LEGACY_TARGET_ROLE_KEY); setLegacyRole(null) }}>清理旧数据</button></div>}
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
          <Page title="模拟面试" subtitle={selectedJob ? `${selectedJob.companyName} · ${selectedJob.jobTitle}` : '先从岗位库选择目标岗位'}>
            {!selectedJob ? (
              <section className="primary-flow">
                <div>
                  <span className="eyebrow">尚未选择岗位</span>
                  <h2>先选择目标岗位</h2>
                  <p>模拟面试必须基于 job.xlsx 中的岗位。</p>
                </div>
                <button className="primary-button" type="button" onClick={() => setActiveView('materials')}><BriefcaseBusiness size={17} />去选择岗位</button>
              </section>
            ) : (
              <>
                <section className="primary-flow">
                  <div>
                    <span className="eyebrow">岗位定向模拟</span>
                    <h2>{selectedJob.companyName} · {selectedJob.jobTitle}</h2>
                    <p>{currentJobPack ? '已读取岗位准备包。' : '建议先生成岗位准备包，也可以直接用岗位信息开始。'}</p>
                  </div>
                  <div className="inline-actions">
                    <button className="primary-button" type="button" onClick={() => void startMockInterview('job_pack_mock')} disabled={Boolean(mockInterviewLoading)}><MessagesSquare size={17} />{mockInterviewLoading === 'start' ? '生成中…' : '开始一轮模拟面试'}</button>
                    {!currentJobPack && <button type="button" onClick={() => setActiveView('jobPack')}>先生成准备包</button>}
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
                    onFinish={() => void finishMockInterview(activeMockInterview.id)}
                    onDelete={() => deleteMockInterview(activeMockInterview.id)}
                  />
                ) : <p className="empty-state">还没有模拟面试。点击上方按钮生成问题。</p>}
              </>
            )}
          </Page>
        )}

        {activeView === 'backup' && (
          <Page title="数据备份" subtitle="备份包含资料 metadata、岗位、转写状态和 AI 反馈；不包含音频 Blob。">
            <section className="backup-actions">
              <button className="primary-button" type="button" onClick={exportBackup}><Download size={16} />导出 JSON</button>
              <label className="small-upload-button"><input type="file" accept=".json,application/json" onChange={(event) => void importBackup(event)} /><Upload size={16} />导入 JSON</label>
              <button className="danger-text" type="button" onClick={() => void clearAllData()}><Trash2 size={16} />清空本地数据</button>
            </section>
            {backupMessage && <p className="success-line">{backupMessage}</p>}
            {importError && <p className="error-line">{importError}</p>}
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

function UploadRow({ title, hint, file, button, accept, onChange, onRemove }: { title: string; hint: string; file?: UploadedFileMeta; button: string; accept: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void; onRemove: () => void }) {
  return <div className="upload-row"><div className="upload-main"><strong>{title}</strong><span>{file ? `${file.name} · ${file.status}` : hint}</span></div><label className="small-upload-button"><input type="file" accept={accept} onChange={onChange} /><Upload size={15} />{file ? '替换' : button}</label>{file && <button className="icon-button" type="button" onClick={onRemove} aria-label={`删除 ${title}`}><Trash2 size={16} /></button>}</div>
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}><option value="">全部</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
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
  onFinish: () => void
  onDelete: () => void
}) {
  const isRecording = currentQuestion ? recordingQuestionId === currentQuestion.id : false
  const canGoNext = session.currentQuestionIndex < session.questions.length - 1
  return (
    <section className="mock-interview-panel">
      <header>
        <div>
          <span className="eyebrow">{session.status === 'completed' ? '已完成' : '进行中'} · {session.currentQuestionIndex + 1}/{session.questions.length}</span>
          <h2>{session.selectedJob.companyName} · {session.selectedJob.jobTitle}</h2>
          <p>{session.interviewType === 'pressure_mock' ? '压力追问' : session.interviewType === 'quick_mock' ? '快速模拟' : '岗位准备包模拟'}</p>
        </div>
        <button className="danger-text" type="button" onClick={onDelete}><Trash2 size={15} />删除 session</button>
      </header>
      {currentQuestion && (
        <article className="interview-question">
          <span>{currentQuestion.type} · {currentQuestion.source}</span>
          <h3>{currentQuestion.question}</h3>
          <p>{currentQuestion.expectedFocus}</p>
        </article>
      )}
      {currentQuestion && (
        <div className="recorder-controls">
          <button className="primary-button" type="button" onClick={() => onStartRecording(currentQuestion.id)} disabled={Boolean(recordingQuestionId)}>
            <Mic size={16} />{isRecording ? `录音中 ${formatDuration(recordingSeconds)}` : '回答本题'}
          </button>
          <button type="button" onClick={onStopRecording} disabled={!isRecording}><Square size={15} />停止</button>
          <button type="button" onClick={() => onTranscript(currentQuestion.id)} disabled={!currentAnswer || loading === `transcript-${currentQuestion.id}`}>
            <FileText size={15} />{loading === `transcript-${currentQuestion.id}` ? '转写中…' : '生成转写'}
          </button>
          <button type="button" onClick={() => onFeedback(currentQuestion.id)} disabled={!currentAnswer?.transcript || loading === `feedback-${currentQuestion.id}`}>
            <BrainCircuit size={15} />{loading === `feedback-${currentQuestion.id}` ? '分析中…' : '生成单题反馈'}
          </button>
        </div>
      )}
      {preview && currentAnswer && <div className="audio-result"><audio controls src={preview.url} /><a href={preview.url} download={currentAnswer.recordingName}><Download size={15} />下载</a><span>{formatDuration(currentAnswer.durationSeconds)} · {formatFileSize(preview.size)}</span></div>}
      {currentAnswer?.transcript && <div className="transcript-preview"><span>{transcriptStatusLabel(currentAnswer.transcriptStatus)} · {currentAnswer.transcript.provider || currentAnswer.transcript.source}</span><p>{currentAnswer.transcript.text}</p></div>}
      {currentAnswer?.aiFeedback && <AIFeedbackReport feedback={currentAnswer.aiFeedback} />}
      <div className="inline-actions">
        {currentQuestion && <button type="button" onClick={() => onFollowUp(currentQuestion.id)} disabled={!currentAnswer?.aiFeedback || loading === `follow-${currentQuestion.id}`}>生成追问</button>}
        <button type="button" onClick={onNext} disabled={!canGoNext}>下一题</button>
        <button className="primary-button" type="button" onClick={onFinish} disabled={loading === 'report' || !session.answers.length}><Sparkles size={15} />{loading === 'report' ? '复盘中…' : '结束并生成整场复盘'}</button>
      </div>
      {session.finalReport && <InterviewFinalReportView finalReport={session.finalReport} />}
    </section>
  )
}

function InterviewFinalReportView({ finalReport }: { finalReport: NonNullable<MockInterviewSession['finalReport']> }) {
  const isMock = finalReport.provider === 'mock' || finalReport.provider === 'mock_fallback'
  return (
    <article className="ai-report">
      <header>
        <div><span>整场分数</span><strong>{finalReport.report.overallScore}</strong></div>
        <p>{finalReport.report.summary}</p>
        <em>{finalReport.provider} · {finalReport.model} · {formatDateTime(finalReport.generatedAt)}</em>
      </header>
      {isMock && <p className="mock-notice">当前为模拟复盘，仅用于测试流程。</p>}
      {finalReport.rawProviderNote && <p className="provider-note">{finalReport.rawProviderNote}</p>}
      <dl className="feedback-detail-list">
        <div><dt>最强回答</dt><dd>{finalReport.report.strongestAnswer}</dd></div>
        <div><dt>最弱回答</dt><dd>{finalReport.report.weakestAnswer}</dd></div>
        <div><dt>岗位匹配</dt><dd>{finalReport.report.roleFitAssessment}</dd></div>
        <div><dt>沟通表达</dt><dd>{finalReport.report.communicationAssessment}</dd></div>
        <div><dt>项目深度</dt><dd>{finalReport.report.projectDepthAssessment}</dd></div>
        <div><dt>英文</dt><dd>{finalReport.report.englishAssessment}</dd></div>
      </dl>
      <FeedbackList title="反复出现的问题" items={finalReport.report.recurringProblems} />
      <FeedbackList title="下一轮训练计划" items={finalReport.report.nextTrainingPlan} />
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
  const legacyReview = record.review
  const hasLegacyReview = Boolean(legacyReview && (
    legacyReview.selfScore
    || legacyReview.issueTags?.length
    || legacyReview.nextActionChoice
    || legacyReview.biggestProblem
    || legacyReview.nextImprovement
    || legacyReview.legacyBiggestProblem
    || legacyReview.legacyNextImprovement
  ))

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

          {hasLegacyReview && (
            <details className="legacy-review">
              <summary>旧版自评数据</summary>
              <p>仅为兼容旧记录展示，不参与 AI 评价。</p>
              {legacyReview?.selfScore && <p>旧自评分：{legacyReview.selfScore}</p>}
              {legacyReview?.issueTags?.length && <p>旧问题标签：{legacyReview.issueTags.join('、')}</p>}
              {legacyReview?.nextActionChoice && <p>旧状态：{legacyReview.nextActionChoice}</p>}
              {(legacyReview?.biggestProblem || legacyReview?.legacyBiggestProblem) && <p>旧最大问题：{legacyReview.biggestProblem || legacyReview.legacyBiggestProblem}</p>}
              {(legacyReview?.nextImprovement || legacyReview?.legacyNextImprovement) && <p>旧改进：{legacyReview.nextImprovement || legacyReview.legacyNextImprovement}</p>}
            </details>
          )}
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
  return (
    <div className="ai-report">
      <header><div><span>总分</span><strong>{feedback.score}</strong></div><p>{feedback.summary}</p><em>{providerLabel} · {feedback.model} · {formatDateTime(feedback.generatedAt)}</em></header>
      {isMock && <p className="mock-notice">{providerLabel}</p>}
      {feedback.rawProviderNote && <p className="provider-note">{feedback.rawProviderNote}</p>}
      <div className="feedback-columns"><FeedbackList title="做得好的地方" items={feedback.strengths} /><FeedbackList title="主要问题" items={feedback.problems} /></div>
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
      <FeedbackList title="下一步任务" items={feedback.nextTasks} />
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

function readJobPool() { return readArray<JobRecord>(JOB_POOL_KEY) }
function readSelectedJob() { try { const raw = localStorage.getItem(SELECTED_JOB_KEY); return raw ? JSON.parse(raw) as JobRecord : null } catch { return null } }
function readCvTextState(): CvTextState { try { const raw = localStorage.getItem(CV_TEXT_KEY); return raw ? { text: '', source: 'upload', ...JSON.parse(raw) } : { text: '', source: 'upload' } } catch { return { text: '', source: 'upload' } } }
function readScriptTemplates(): ScriptTemplates { try { const raw = localStorage.getItem(SCRIPT_TEMPLATES_KEY); return raw ? JSON.parse(raw) : {} } catch { return {} } }
function readJobPacks() { return normalizeJobPacks(readArray<StoredJobPack>(JOB_PACKS_KEY)) }
function readMockInterviews() { return normalizeMockInterviews(readArray<MockInterviewSession>(MOCK_INTERVIEWS_KEY)) }
function readLegacyRole() { try { const raw = localStorage.getItem(LEGACY_TARGET_ROLE_KEY); return raw ? JSON.parse(raw) : null } catch { return null } }
function readArray<T>(key: string): T[] { try { const raw = localStorage.getItem(key); const parsed = raw ? JSON.parse(raw) : []; return Array.isArray(parsed) ? parsed : [] } catch { return [] } }

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
    createdAt: session.createdAt || new Date().toISOString(),
    interviewType: session.interviewType || 'job_pack_mock',
    currentQuestionIndex: Math.max(0, Math.min(session.currentQuestionIndex || 0, Math.max(0, session.questions.length - 1))),
    questions: session.questions,
    answers: Array.isArray(session.answers) ? session.answers.map((answer) => ({
      ...answer,
      transcriptStatus: answer.transcriptStatus || (answer.transcript ? answer.transcript.source === 'mock' ? 'mock_ready' : 'completed' : 'not_started'),
      aiFeedbackStatus: answer.aiFeedbackStatus || (answer.aiFeedback ? 'completed' : answer.transcript ? 'ready_to_analyze' : 'transcript_needed'),
      durationSeconds: answer.durationSeconds || answer.audioMetadata?.durationSeconds || 0,
      createdAt: answer.createdAt || new Date().toISOString(),
    })) : [],
  })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
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

function filterJobs(jobs: JobRecord[], filters: Record<string, string>) {
  return jobs.filter((job) =>
    (!filters.company || job.companyName === filters.company)
    && (!filters.title || job.jobTitle === filters.title)
    && (!filters.city || job.city === filters.city)
    && (!filters.jobType || job.jobType === filters.jobType)
    && (!filters.priority || job.priority === filters.priority)
    && (!filters.mainTrack || job.mainTrack === filters.mainTrack))
}

function buildFilterOptions(jobs: JobRecord[]) {
  const values = (selector: (job: JobRecord) => string) => [...new Set(jobs.map(selector).filter(Boolean))].sort()
  return { company: values((job) => job.companyName), title: values((job) => job.jobTitle), city: values((job) => job.city), jobType: values((job) => job.jobType), priority: values((job) => job.priority), mainTrack: values((job) => job.mainTrack) }
}

function generateNextActions(jobPool: JobRecord[], selectedJob: JobRecord | null, cv: CvTextState, records: TrainingRecord[]) {
  if (!jobPool.length) return ['上传 job.xlsx，建立岗位库。']
  if (!selectedJob) return ['从岗位库选择一个目标岗位。']
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

function statusLabel(status: AIFeedbackStatus) { return status === 'completed' ? 'AI 反馈完成' : status === 'ready_to_analyze' ? '待 AI 分析' : '等待转写' }
function createPreview(blob: Blob): AudioPreview { return { url: URL.createObjectURL(blob), size: blob.size, type: blob.type } }
function getSupportedAudioMimeType() { return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type)) || '' }
function getFileExtension(name: string) { const index = name.lastIndexOf('.'); return index >= 0 ? name.slice(index) : '' }
function isToday(value: string) { const date = new Date(value); const now = new Date(); return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate() }
function formatDateTime(value: string) { return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }
function formatDuration(seconds: number) { const minutes = Math.floor(seconds / 60); const rest = seconds % 60; return `${minutes}:${String(rest).padStart(2, '0')}` }
function formatFileSize(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB` }
function formatDateForFile(date: Date) { return date.toISOString().replace(/[:.]/g, '-').slice(0, 19) }
function formatDateForFileName(date: Date) { return date.toISOString().slice(0, 10) }
function downloadJson(payload: unknown, name: string) { const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url) }

function openRecordingDb(): Promise<IDBDatabase> { return new Promise((resolve, reject) => { const request = indexedDB.open(RECORDING_DB_NAME, 1); request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(RECORDING_STORE)) request.result.createObjectStore(RECORDING_STORE) }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) }) }
async function saveRecordingBlob(id: string, blob: Blob) { const db = await openRecordingDb(); await new Promise<void>((resolve, reject) => { const tx = db.transaction(RECORDING_STORE, 'readwrite'); tx.objectStore(RECORDING_STORE).put(blob, id); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) }); db.close() }
async function readRecordingBlob(id: string) { const db = await openRecordingDb(); const blob = await new Promise<Blob | null>((resolve, reject) => { const request = db.transaction(RECORDING_STORE, 'readonly').objectStore(RECORDING_STORE).get(id); request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null); request.onerror = () => reject(request.error) }); db.close(); return blob }
async function deleteRecordingBlob(id: string) { const db = await openRecordingDb(); await new Promise<void>((resolve) => { const tx = db.transaction(RECORDING_STORE, 'readwrite'); tx.objectStore(RECORDING_STORE).delete(id); tx.oncomplete = () => resolve(); tx.onerror = () => resolve() }); db.close() }
async function deleteRecordingDatabase() { await new Promise<void>((resolve) => { const request = indexedDB.deleteDatabase(RECORDING_DB_NAME); request.onsuccess = () => resolve(); request.onerror = () => resolve(); request.onblocked = () => resolve() }) }
function isValidBackup(payload: Partial<BackupPayload>): payload is BackupPayload { return Boolean(Array.isArray(payload.uploadedFiles) && Array.isArray(payload.jobPool) && Array.isArray(payload.trainingRecords) && payload.cvText && payload.scriptTemplates) }

export default App
