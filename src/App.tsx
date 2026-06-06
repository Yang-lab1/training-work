import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  BriefcaseBusiness,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  Mic,
  Play,
  RotateCcw,
  Save,
  Square,
  Trash2,
  Upload,
} from 'lucide-react'
import { parseJobWorkbook } from './jobParser'
import type { JobRecord } from './jobParser'
import type {
  AnalyzeAnswerResponse,
  StoredAIFeedback,
  TrainingType,
  TranscriptData,
} from './lib/ai/types'
import './App.css'

const APP_VERSION = '0.2A'
const STORAGE_KEY = 'interview-os-personal-mvp-v1'
const UPLOADED_FILES_KEY = 'interview_os_uploaded_files'
const JOB_POOL_KEY = 'interview_os_job_pool'
const SELECTED_JOB_KEY = 'interview_os_selected_job'
const LEGACY_TARGET_ROLE_KEY = 'interview_os_target_role'
const CV_TEXT_KEY = 'interview_os_cv_text'
const SCRIPT_TEMPLATES_KEY = 'interview_os_script_templates'
const TRAINING_RECORDS_KEY = 'interview_os_training_records'
const RECORDING_DB_NAME = 'interview-os-recordings'
const RECORDING_STORE = 'recordings'

type UploadCategory = 'cv' | 'project' | 'job' | 'job-map'
type CvParseStatus = '未上传' | '已上传，未解析' | '已提取文本' | '需要文本版'
type TaskId = 'cn-intro' | 'en-intro' | 'miro-project'
type ScriptTemplateKey = 'chineseIntro' | 'englishIntro' | 'miroProject'
type NextActionChoice = '可以继续下一段' | '需要重练一次' | '明天再练' | '需要改稿' | ''
type RecordingKind = 'answer' | 'voice-note'

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

interface VoiceNoteMetadata {
  recordingId: string
  recordingName: string
  durationSeconds: number
  createdAt: string
}

interface TrainingReview {
  selfScore?: number
  issueTags: string[]
  nextActionChoice: NextActionChoice
  voiceNoteMetadata?: VoiceNoteMetadata
  createdAt?: string
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
  review: TrainingReview
  lastMessage?: string
}

interface TrainingRecord {
  id: string
  taskId: TaskId
  title: string
  savedAt: string
  durationSeconds: number
  targetSeconds: number
  recordingId?: string
  recordingName?: string
  hasDownload: boolean
  review: TrainingReview
  transcript?: TranscriptData
  aiFeedback?: StoredAIFeedback
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
}

interface RecordingContext {
  kind: RecordingKind
  taskId: TaskId
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
}

const issueTags = [
  '超时',
  '卡顿',
  '停顿太多',
  '逻辑混乱',
  '太像背稿',
  '岗位匹配弱',
  '项目不够具体',
  '例子不够清楚',
  '英文不流畅',
  '发音不自信',
  '语速太快',
  '语速太慢',
  '开头不清楚',
  '结尾不够有力',
]

const nextActionChoices: NextActionChoice[] = [
  '可以继续下一段',
  '需要重练一次',
  '明天再练',
  '需要改稿',
]

const emptyReview: TrainingReview = {
  issueTags: [],
  nextActionChoice: '',
}

const defaultTasks: TrainingTask[] = [
  {
    id: 'cn-intro',
    scriptKey: 'chineseIntro',
    title: '中文自我介绍',
    subtitle: '60-90 秒',
    prompt: '面向当前岗位，讲清你的背景、AI 学习、产品/设计经历和岗位匹配。',
    targetSeconds: 90,
    memorySkeleton: ['开头定位', 'AI 与产品/设计背景', '最相关项目', '岗位匹配收尾'],
    defaultReferenceTemplate:
      '大家好，我正在准备【公司名称】的【XXX岗位】。我的背景结合了 AI 学习、产品体验和工业设计训练，能够把用户问题、业务目标与可落地方案连接起来。围绕【岗位相关业务/产品方向】，我会重点讲 Miro 项目、小米项目和环保科技项目中如何理解用户、拆解需求并推进方案。',
    done: false,
    review: emptyReview,
  },
  {
    id: 'en-intro',
    scriptKey: 'englishIntro',
    title: '英文自我介绍',
    subtitle: '60-90 秒',
    prompt: 'Introduce your background and explain why it matches the selected role.',
    targetSeconds: 90,
    memorySkeleton: ['Positioning', 'AI and product background', 'Relevant project proof', 'Role fit'],
    defaultReferenceTemplate:
      'Hi, I am preparing for the [XXX role] opportunity at 【公司名称】. My background combines AI study, product experience, and industrial design. For [business/product direction], I can connect user needs, business goals, and practical product solutions.',
    done: false,
    review: emptyReview,
  },
  {
    id: 'miro-project',
    scriptKey: 'miroProject',
    title: 'Miro 项目讲解',
    subtitle: '3 分钟',
    prompt: '结合当前岗位，讲清项目问题、你的角色、关键方案、结果和反思。',
    targetSeconds: 180,
    memorySkeleton: ['项目背景', '我的角色', '关键决策', '结果与反思'],
    defaultReferenceTemplate:
      '这个 Miro 项目适合用于【公司名称】的【XXX岗位】面试。重点不是展示界面，而是说明我如何围绕【岗位相关业务/产品方向】发现协作痛点、判断优先级、组织信息结构，并把方案推进到可验证的 MVP。',
    done: false,
    review: emptyReview,
  },
]

const defaultState: StoredMvpState = {
  uploadedFiles: [],
  tasks: defaultTasks,
  history: [],
}

function App() {
  const [state, setState] = useState<StoredMvpState>(readStoredState)
  const [jobPool, setJobPool] = useState<JobRecord[]>(readJobPool)
  const [selectedJob, setSelectedJob] = useState<JobRecord | null>(readSelectedJob)
  const [cvTextState, setCvTextState] = useState<CvTextState>(readCvTextState)
  const [scriptTemplates, setScriptTemplates] = useState<ScriptTemplates>(readScriptTemplates)
  const [legacyRole, setLegacyRole] = useState(readLegacyRole)
  const [jobError, setJobError] = useState('')
  const [jobMessage, setJobMessage] = useState('')
  const [backupMessage, setBackupMessage] = useState('')
  const [importError, setImportError] = useState('')
  const [recorderError, setRecorderError] = useState('')
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null)
  const [advancedScriptId, setAdvancedScriptId] = useState<TaskId | null>(null)
  const [scriptDraft, setScriptDraft] = useState('')
  const [advancedCvOpen, setAdvancedCvOpen] = useState(false)
  const [legacyCvDraft, setLegacyCvDraft] = useState(cvTextState.text)
  const [recordingContext, setRecordingContext] = useState<RecordingContext | null>(null)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [audioPreviews, setAudioPreviews] = useState<Record<string, AudioPreview>>({})
  const [filters, setFilters] = useState({
    company: '',
    title: '',
    city: '',
    jobType: '',
    priority: '',
    mainTrack: '',
    salary: '',
    today: '',
  })
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const startedAtRef = useRef(0)

  const cvFile = getFileByCategory(state.uploadedFiles, 'cv')
  const projectFile = getFileByCategory(state.uploadedFiles, 'project')
  const jobFile = getFileByCategory(state.uploadedFiles, 'job')
  const jobMapFile = getFileByCategory(state.uploadedFiles, 'job-map')
  const todayRecords = state.history.filter((record) => isToday(record.savedAt))
  const recentHistory = state.history.slice(0, 5)
  const completedCount = defaultTasks.filter((task) => todayRecords.some((record) => record.taskId === task.id)).length
  const filteredJobs = useMemo(() => filterJobs(jobPool, filters), [jobPool, filters])
  const filterOptions = useMemo(() => buildFilterOptions(jobPool), [jobPool])
  const nextActions = generateNextActions(jobPool, selectedJob, cvTextState, defaultTasks, todayRecords)
  const flowSteps = getFlowSteps(jobPool, selectedJob, cvTextState, todayRecords)
  const jobKeywords = selectedJob ? extractJobKeywords(selectedJob) : []
  const jobTip = selectedJob ? buildJobTip(selectedJob) : ''

  function commitState(updater: (current: StoredMvpState) => StoredMvpState) {
    setState((current) => ({
      ...updater(current),
      lastSavedAt: new Date().toISOString(),
    }))
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    window.localStorage.setItem(UPLOADED_FILES_KEY, JSON.stringify(state.uploadedFiles))
    window.localStorage.setItem(TRAINING_RECORDS_KEY, JSON.stringify(state.history))
  }, [state])

  useEffect(() => {
    window.localStorage.setItem(JOB_POOL_KEY, JSON.stringify(jobPool))
  }, [jobPool])

  useEffect(() => {
    if (selectedJob) window.localStorage.setItem(SELECTED_JOB_KEY, JSON.stringify(selectedJob))
    else window.localStorage.removeItem(SELECTED_JOB_KEY)
  }, [selectedJob])

  useEffect(() => {
    window.localStorage.setItem(CV_TEXT_KEY, JSON.stringify(cvTextState))
  }, [cvTextState])

  useEffect(() => {
    window.localStorage.setItem(SCRIPT_TEMPLATES_KEY, JSON.stringify(scriptTemplates))
  }, [scriptTemplates])

  useEffect(() => {
    let disposed = false
    async function loadAudio() {
      const previews: Record<string, AudioPreview> = {}
      for (const task of state.tasks) {
        if (task.recordingId) {
          const blob = await readRecordingBlob(task.recordingId)
          if (blob && !disposed) previews[`answer-${task.id}`] = createPreview(blob)
        }
        if (task.review.voiceNoteMetadata?.recordingId) {
          const blob = await readRecordingBlob(task.review.voiceNoteMetadata.recordingId)
          if (blob && !disposed) previews[`note-${task.id}`] = createPreview(blob)
        }
      }
      if (!disposed) setAudioPreviews(previews)
    }
    void loadAudio()
    return () => {
      disposed = true
    }
  }, [state.tasks])

  useEffect(() => {
    if (!recordingContext) return undefined
    const timer = window.setInterval(() => {
      setRecordingSeconds(Math.floor((new Date().getTime() - startedAtRef.current) / 1000))
    }, 250)
    return () => window.clearInterval(timer)
  }, [recordingContext])

  useEffect(() => () => stopStream(), [])

  async function handleUpload(category: UploadCategory, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (category === 'job' && file.name.toLowerCase().endsWith('.xlsx')) {
      if (file.size > 10 * 1024 * 1024) {
        setJobError('岗位表不能超过 10 MB，请精简后重新上传。')
        return
      }
      try {
        setJobError('')
        const parsedJobs = await parseJobWorkbook(file)
        if (!parsedJobs.length) {
          setJobError('没有识别到岗位。请检查 Excel 是否包含公司名称和岗位名称列。')
          return
        }
        setJobPool(parsedJobs)
        setSelectedJob(null)
        setJobMessage(`已解析 ${parsedJobs.length} 个岗位。`)
        saveFileMeta(category, file, '已解析')
      } catch {
        setJobError('岗位表解析失败，请重新上传有效的 job.xlsx。')
      }
      return
    }

    if (category === 'job-map') {
      saveFileMeta(category, file, '未解析')
      setJobMessage('交互地图已上传。当前版本优先解析 job.xlsx，HTML 解析将在后续支持。')
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
    if (!file) return
    if (!canExtractPlainText(file.name, file.type)) return
    saveCvText(await file.text(), file.name, 'upload')
  }

  function saveCvText(text: string, fileName: string, source: CvTextState['source']) {
    setCvTextState({
      text: text.trim(),
      source,
      fileName,
      updatedAt: new Date().toISOString(),
    })
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
    document.getElementById('training-entry')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function updateTaskReview(taskId: TaskId, updater: (review: TrainingReview) => TrainingReview) {
    commitState((current) => ({
      ...current,
      tasks: current.tasks.map((task) => task.id === taskId ? { ...task, review: updater(task.review) } : task),
      history: current.history.map((record, index) => (
        record.taskId === taskId && index === current.history.findIndex((item) => item.taskId === taskId)
          ? { ...record, review: updater(record.review) }
          : record
      )),
    }))
  }

  function updateTrainingRecord(recordId: string, updater: (record: TrainingRecord) => TrainingRecord) {
    commitState((current) => ({
      ...current,
      history: current.history.map((record) => record.id === recordId ? updater(record) : record),
    }))
  }

  async function startRecording(kind: RecordingKind, taskId: TaskId) {
    if (recordingContext) return
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
      startedAtRef.current = new Date().getTime()
      setRecordingContext({ kind, taskId })
      setRecordingSeconds(0)
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size) chunksRef.current.push(event.data)
      })
      recorder.addEventListener('stop', () => {
        const duration = Math.max(1, Math.round((new Date().getTime() - startedAtRef.current) / 1000))
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        void finishRecording(kind, taskId, blob, duration)
        stopStream()
        mediaRecorderRef.current = null
        chunksRef.current = []
        setRecordingContext(null)
        setRecordingSeconds(0)
      })
      recorder.start()
    } catch (error) {
      stopStream()
      setRecordingContext(null)
      setRecorderError(error instanceof Error ? error.message : '录音权限被拒绝。')
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
  }

  async function finishRecording(kind: RecordingKind, taskId: TaskId, blob: Blob, duration: number) {
    const task = state.tasks.find((item) => item.id === taskId)
    const recordingId = `${kind}-${taskId}-${new Date().getTime()}`
    const recordingName = `${task?.title ?? '训练'}-${kind === 'answer' ? '回答' : '语音备注'}-${formatDateForFile(new Date())}.webm`
    await saveRecordingBlob(recordingId, blob)
    setAudioPreviews((current) => ({
      ...current,
      [`${kind === 'answer' ? 'answer' : 'note'}-${taskId}`]: createPreview(blob),
    }))
    if (kind === 'answer') {
      saveTrainingRecord(taskId, duration, recordingId, recordingName)
    } else {
      updateTaskReview(taskId, (review) => ({
        ...review,
        voiceNoteMetadata: {
          recordingId,
          recordingName,
          durationSeconds: duration,
          createdAt: new Date().toISOString(),
        },
        createdAt: review.createdAt || new Date().toISOString(),
      }))
    }
  }

  function saveTrainingRecord(taskId: TaskId, duration?: number, recordingId?: string, recordingName?: string) {
    const now = new Date().toISOString()
    commitState((current) => {
      const task = current.tasks.find((item) => item.id === taskId)
      if (!task) return current
      const finalDuration = duration ?? task.durationSeconds ?? 0
      const finalReview = {
        ...task.review,
        issueTags: finalDuration > task.targetSeconds && !task.review.issueTags.includes('超时')
          ? [...task.review.issueTags, '超时']
          : task.review.issueTags,
        createdAt: task.review.createdAt || now,
      }
      const updatedTask = {
        ...task,
        done: true,
        savedAt: now,
        durationSeconds: finalDuration,
        recordingId: recordingId ?? task.recordingId,
        recordingName: recordingName ?? task.recordingName,
        review: finalReview,
        lastMessage: finalReview.selfScore
          ? '已保存，本次训练已计入今日进度。'
          : '已保存。点击 1-5 分和问题标签即可完成复盘。',
      }
      const record: TrainingRecord = {
        id: `${taskId}-${new Date().getTime()}`,
        taskId,
        title: task.title,
        savedAt: now,
        durationSeconds: finalDuration,
        targetSeconds: task.targetSeconds,
        recordingId: updatedTask.recordingId,
        recordingName: updatedTask.recordingName,
        hasDownload: Boolean(updatedTask.recordingId),
        review: finalReview,
      }
      return {
        ...current,
        tasks: current.tasks.map((item) => item.id === taskId ? updatedTask : item),
        history: [record, ...current.history].slice(0, 50),
      }
    })
  }

  async function deleteVoiceNote(taskId: TaskId) {
    const task = state.tasks.find((item) => item.id === taskId)
    const id = task?.review.voiceNoteMetadata?.recordingId
    if (id) await deleteRecordingBlob(id)
    updateTaskReview(taskId, (review) => ({ ...review, voiceNoteMetadata: undefined }))
    setAudioPreviews((current) => {
      const next = { ...current }
      delete next[`note-${taskId}`]
      return next
    })
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
      delete next[`answer-${taskId}`]
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

  function clearLegacyData() {
    window.localStorage.removeItem(LEGACY_TARGET_ROLE_KEY)
    setLegacyRole(null)
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
      if (!isValidBackup(parsed)) {
        setImportError('导入失败：JSON 字段不完整。')
        return
      }
      if (!window.confirm('导入会覆盖当前本地训练数据，确认继续？')) return
      const records = normalizeTrainingRecords(parsed.trainingRecords)
      setJobPool(parsed.jobPool)
      setSelectedJob(parsed.selectedJob)
      setCvTextState(parsed.cvText)
      setScriptTemplates(parsed.scriptTemplates)
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
            review: latest.review,
          } : task
        }),
        history: records,
        lastSavedAt: new Date().toISOString(),
      })
      setBackupMessage('导入成功，页面状态已更新。')
      setImportError('')
    } catch {
      setImportError('导入失败：不是有效 JSON。')
    }
  }

  async function clearAllData() {
    if (!window.confirm('确认清空全部本地数据？此操作不可恢复。')) return
    for (const key of [
      STORAGE_KEY,
      UPLOADED_FILES_KEY,
      JOB_POOL_KEY,
      SELECTED_JOB_KEY,
      LEGACY_TARGET_ROLE_KEY,
      CV_TEXT_KEY,
      SCRIPT_TEMPLATES_KEY,
      TRAINING_RECORDS_KEY,
    ]) window.localStorage.removeItem(key)
    await deleteRecordingDatabase()
    setState(defaultState)
    setJobPool([])
    setSelectedJob(null)
    setCvTextState({ text: '', source: 'upload' })
    setScriptTemplates({})
    setLegacyRole(null)
    setAudioPreviews({})
    setBackupMessage('已清空全部本地数据。')
  }

  return (
    <main className="mvp-shell">
      <header className="mvp-hero">
        <div className="brand-line"><span className="brand-dot">IO</span><span>Interview OS · V0.2A</span></div>
        <h1>上传岗位库，选择岗位，直接开口练</h1>
        <p className="hero-copy">主流程不需要填写岗位、个人背景或长篇复盘。</p>
      </header>

      <section className="mvp-grid">
        <section className="flow-panel full-section">
          <SectionTitle step="今日" title="训练流程" icon={<CheckCircle2 size={22} />} />
          <div className="flow-list">
            {flowSteps.map((step, index) => (
              <div className={`flow-row status-${step.status}`} key={step.label}>
                <span>{index + 1}</span><strong>{step.label}</strong><em>{step.status}</em>
              </div>
            ))}
          </div>
        </section>

        <section className="upload-panel full-section">
          <SectionTitle step="第 1 步" title="资料状态" icon={<Upload size={22} />} />
          <div className="upload-list">
            <UploadRow title="CV 文件" hint="PDF / DOCX 仅保存文件状态；TXT / MD 可直接读取" file={cvFile} button="上传 CV" accept=".pdf,.doc,.docx,.txt,.md" onChange={(event) => void handleUpload('cv', event)} onRemove={() => removeFile('cv')} />
            <UploadRow title="CV 文本版" hint="推荐上传 TXT / Markdown，不需要粘贴" file={cvTextState.fileName ? toCvTextMeta(cvTextState) : undefined} button="上传文本版" accept=".txt,.md,text/plain,text/markdown" onChange={(event) => void handleCvTextUpload(event)} onRemove={() => setCvTextState({ text: '', source: 'upload' })} />
            <UploadRow title="项目资料" hint="用于保留项目文件名和训练上下文" file={projectFile} button="上传项目资料" accept=".pdf,.doc,.docx,.txt,.md" onChange={(event) => void handleUpload('project', event)} onRemove={() => removeFile('project')} />
            <UploadRow title="交互地图 HTML" hint="本版保存 metadata，不假装解析岗位" file={jobMapFile} button="上传 HTML" accept=".html,text/html" onChange={(event) => void handleUpload('job-map', event)} onRemove={() => removeFile('job-map')} />
          </div>
          <div className="cv-status">
            <strong>CV 内容状态</strong>
            <p>{getCvStatusText(cvFile, cvTextState)}</p>
            {cvTextState.text ? <div className="cv-preview"><span>{countCharacters(cvTextState.text)} 字 · {formatDateTime(cvTextState.updatedAt || new Date().toISOString())}</span><p>{cvTextState.text.slice(0, 300)}</p></div> : null}
          </div>
          <details className="advanced-details" open={advancedCvOpen} onToggle={(event) => setAdvancedCvOpen(event.currentTarget.open)}>
            <summary><ChevronDown size={16} />高级：手动粘贴 CV 文本</summary>
            <p>仅用于兼容旧数据。推荐上传 TXT / Markdown。</p>
            <textarea value={legacyCvDraft} onChange={(event) => setLegacyCvDraft(event.target.value)} rows={6} />
            <button className="secondary-button" type="button" onClick={() => saveCvText(legacyCvDraft, '手动粘贴', 'manual')}>保存高级文本</button>
          </details>
        </section>

        <section className="job-panel full-section">
          <SectionTitle step="第 2 步" title="岗位库与岗位选择" icon={<BriefcaseBusiness size={22} />} />
          <div className="job-upload-line">
            <div><strong>job.xlsx</strong><span>{jobFile ? `${jobFile.name} · 已解析 ${jobPool.length} 个岗位` : '请上传岗位表后选择岗位'}</span></div>
            <label className="small-upload-button"><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void handleUpload('job', event)} /><Upload size={15} />{jobFile ? '重新上传' : '上传 job.xlsx'}</label>
          </div>
          {jobMessage ? <p className="success-line">{jobMessage}</p> : null}
          {jobError ? <p className="error-line">{jobError}</p> : null}
          {selectedJob ? (
            <div className="selected-job">
              <span>当前训练岗位</span>
              <strong>{selectedJob.companyName}｜{selectedJob.jobTitle}｜{selectedJob.city || '城市未写'}</strong>
              <p>{selectedJob.mainTrack || selectedJob.companyBusiness || '岗位方向未写'}</p>
            </div>
          ) : null}
          {jobPool.length ? (
            <>
              <div className="job-filters">
                <FilterSelect label="公司" value={filters.company} options={filterOptions.company} onChange={(value) => setFilters({ ...filters, company: value })} />
                <FilterSelect label="岗位" value={filters.title} options={filterOptions.title} onChange={(value) => setFilters({ ...filters, title: value })} />
                <FilterSelect label="城市" value={filters.city} options={filterOptions.city} onChange={(value) => setFilters({ ...filters, city: value })} />
                <FilterSelect label="类型" value={filters.jobType} options={filterOptions.jobType} onChange={(value) => setFilters({ ...filters, jobType: value })} />
                <FilterSelect label="优先级" value={filters.priority} options={filterOptions.priority} onChange={(value) => setFilters({ ...filters, priority: value })} />
                <FilterSelect label="主线" value={filters.mainTrack} options={filterOptions.mainTrack} onChange={(value) => setFilters({ ...filters, mainTrack: value })} />
                <FilterSelect label="薪资" value={filters.salary} options={filterOptions.salary} onChange={(value) => setFilters({ ...filters, salary: value })} />
                <FilterSelect label="今日新增" value={filters.today} options={['是', '否']} onChange={(value) => setFilters({ ...filters, today: value })} />
              </div>
              <p className="list-count">显示 {Math.min(filteredJobs.length, 30)} / {filteredJobs.length} 个匹配岗位</p>
              <div className="job-list">
                {filteredJobs.slice(0, 30).map((job) => (
                  <article className={`job-row ${selectedJob?.id === job.id ? 'selected' : ''}`} key={job.id}>
                    <div><strong>{job.companyName} · {job.jobTitle}</strong><span>{[job.city, job.jobType, job.priority, job.salary].filter(Boolean).join(' · ')}</span><p>{job.mainTrack || job.companyBusiness}</p></div>
                    <button className={selectedJob?.id === job.id ? 'selected-button' : 'secondary-button'} type="button" onClick={() => selectJob(job)}>{selectedJob?.id === job.id ? '已选择' : '选择岗位'}</button>
                  </article>
                ))}
              </div>
            </>
          ) : <p className="empty-state">尚未解析岗位。主流程不提供手填岗位替代入口。</p>}
          {legacyRole ? <div className="legacy-notice"><span>检测到 V0.1.4 旧手填岗位数据，仅作兼容提示，不用于当前训练。</span><button type="button" onClick={clearLegacyData}>清理旧手填数据</button></div> : null}
        </section>

        <section className="training-panel full-section" id="training-entry">
          <SectionTitle step="第 3-5 步" title={selectedJob ? '当前岗位训练' : '通用训练'} icon={<Mic size={22} />} />
          <div className="task-summary"><strong>{completedCount} / 3</strong><span>{selectedJob ? `${selectedJob.companyName}｜${selectedJob.jobTitle}` : '请先选择岗位，再开始岗位定向训练'}</span></div>
          {selectedJob ? <div className="job-training-hint"><strong>岗位关键词</strong><div className="tag-list">{jobKeywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div><p>{jobTip}</p></div> : <p className="role-hint">未选择岗位。仍可继续通用训练，但参考稿不会带入岗位信息。</p>}
          {recorderError ? <p className="error-line">{recorderError}</p> : null}
          <div className="task-list">
            {state.tasks.map((task) => {
              const answerPreview = audioPreviews[`answer-${task.id}`]
              const notePreview = audioPreviews[`note-${task.id}`]
              const rawScript = scriptTemplates[task.scriptKey] || task.defaultReferenceTemplate
              const renderedScript = selectedJob ? renderScript(rawScript, selectedJob) : '请先从岗位库选择本次训练岗位。'
              const isAnswerRecording = recordingContext?.kind === 'answer' && recordingContext.taskId === task.id
              const isNoteRecording = recordingContext?.kind === 'voice-note' && recordingContext.taskId === task.id
              return (
                <article className={`task-card ${task.done ? 'done' : ''}`} key={task.id}>
                  <div className="task-heading"><div><strong>{task.title}</strong><span>{task.subtitle} · {selectedJob ? `面向 ${selectedJob.jobTitle}` : '通用训练'}</span></div>{task.done ? <CheckCircle2 size={20} /> : null}</div>
                  <p>{task.prompt}</p>
                  <div className="training-detail"><div><span>记忆骨架</span><ul>{task.memorySkeleton.map((item) => <li key={item}>{item}</li>)}</ul></div><div><span>参考稿</span><p>{renderedScript}</p></div></div>
                  <details className="advanced-details">
                    <summary onClick={() => beginScriptEdit(task)}><ChevronDown size={16} />高级：编辑参考稿</summary>
                    {advancedScriptId === task.id ? <div className="script-editor"><textarea value={scriptDraft} onChange={(event) => setScriptDraft(event.target.value)} rows={7} /><div className="inline-actions"><button type="button" className="primary-button" onClick={() => saveScript(task)}>保存参考稿</button><button type="button" onClick={() => restoreScript(task)}>恢复默认稿</button></div></div> : null}
                  </details>
                  <ReviewPicker review={task.review} onChange={(review) => updateTaskReview(task.id, () => review)} />
                  <div className="voice-note">
                    <span>可选语音备注（10-60 秒）</span>
                    <div className="recorder-controls">
                      <button type="button" onClick={() => void startRecording('voice-note', task.id)} disabled={Boolean(recordingContext)}><Mic size={15} />{isNoteRecording ? `录制中 ${formatDuration(recordingSeconds)}` : '开始语音备注'}</button>
                      <button type="button" onClick={stopRecording} disabled={!isNoteRecording}><Square size={14} />停止</button>
                      {notePreview ? <audio controls src={notePreview.url} /> : null}
                      {task.review.voiceNoteMetadata ? <button type="button" className="danger-text" onClick={() => void deleteVoiceNote(task.id)}><Trash2 size={14} />删除</button> : null}
                    </div>
                  </div>
                  <div className="recorder-controls">
                    <button type="button" className="primary-button" onClick={() => void startRecording('answer', task.id)} disabled={Boolean(recordingContext)}><Mic size={16} />{isAnswerRecording ? `录音中 ${formatDuration(recordingSeconds)}` : '开始录音'}</button>
                    <button type="button" onClick={stopRecording} disabled={!isAnswerRecording}><Square size={15} />停止录音</button>
                    <button type="button" onClick={() => saveTrainingRecord(task.id)} disabled={Boolean(recordingContext)}><Save size={15} />保存记录</button>
                    <button type="button" onClick={() => void resetTask(task.id)}><RotateCcw size={15} />重练</button>
                  </div>
                  {task.lastMessage ? <p className="success-line">{task.lastMessage}</p> : null}
                  {answerPreview ? <div className="audio-result"><audio controls src={answerPreview.url} /><a href={answerPreview.url} download={task.recordingName}><Download size={15} />下载录音</a><span>{formatDuration(task.durationSeconds || 0)} · {formatFileSize(answerPreview.size)}</span></div> : null}
                </article>
              )
            })}
          </div>
        </section>

        <section className="next-panel full-section">
          <SectionTitle step="下一步" title="练习建议" icon={<Play size={22} />} />
          <ol className="next-list">{nextActions.map((action) => <li key={action}>{action}</li>)}</ol>
        </section>

        <section className="history-panel full-section">
          <SectionTitle step="最近 5 条" title="训练历史" icon={<FileText size={22} />} />
          {recentHistory.length ? (
            <div className="history-list">
              {recentHistory.map((record) => (
                <HistoryRow
                  key={record.id}
                  record={record}
                  selectedJob={selectedJob}
                  cvText={cvTextState.text}
                  scriptText={getScriptTextForTask(record.taskId, state.tasks, scriptTemplates, selectedJob)}
                  expanded={expandedHistoryId === record.id}
                  onToggle={() => setExpandedHistoryId(expandedHistoryId === record.id ? null : record.id)}
                  onUpdate={(updater) => updateTrainingRecord(record.id, updater)}
                  onDelete={() => commitState((current) => ({
                    ...current,
                    history: current.history.filter((item) => item.id !== record.id),
                  }))}
                />
              ))}
            </div>
          ) : <p className="empty-state">还没有训练记录。</p>}
        </section>

        <section className="backup-panel full-section">
          <SectionTitle step="备份" title="本地数据" icon={<Download size={22} />} />
          <div className="backup-actions"><button className="primary-button" type="button" onClick={exportBackup}>导出 JSON</button><label className="small-upload-button"><input type="file" accept=".json,application/json" onChange={(event) => void importBackup(event)} />导入 JSON</label><button className="danger-text" type="button" onClick={() => void clearAllData()}>清空全部本地数据</button></div>
          {backupMessage ? <p className="success-line">{backupMessage}</p> : null}
          {importError ? <p className="error-line">{importError}</p> : null}
        </section>
      </section>
    </main>
  )
}

function SectionTitle({ step, title, icon }: { step: string; title: string; icon: React.ReactNode }) {
  return <div className="section-title">{icon}<div><span>{step}</span><h2>{title}</h2></div></div>
}

function UploadRow({ title, hint, file, button, accept, onChange, onRemove }: { title: string; hint: string; file?: UploadedFileMeta; button: string; accept: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void; onRemove: () => void }) {
  return <div className={`upload-row ${file ? 'uploaded' : ''}`}><div className="upload-main"><strong>{title}</strong><span>{file ? `${file.name} · ${file.status}` : hint}</span></div><label className="small-upload-button"><input type="file" accept={accept} onChange={onChange} /><Upload size={15} />{file ? '替换' : button}</label>{file ? <button className="icon-button" type="button" onClick={onRemove} aria-label={`删除 ${title}`}><Trash2 size={16} /></button> : null}</div>
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}><option value="">全部</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
}

function ReviewPicker({ review, onChange }: { review: TrainingReview; onChange: (review: TrainingReview) => void }) {
  const toggleTag = (tag: string) => onChange({ ...review, issueTags: review.issueTags.includes(tag) ? review.issueTags.filter((item) => item !== tag) : [...review.issueTags, tag], createdAt: review.createdAt || new Date().toISOString() })
  return <div className="review-picker"><div><span>自评分</span><div className="score-buttons">{[1, 2, 3, 4, 5].map((score) => <button className={review.selfScore === score ? 'active' : ''} type="button" key={score} onClick={() => onChange({ ...review, selfScore: score, createdAt: review.createdAt || new Date().toISOString() })}>{score}</button>)}</div></div><div><span>本次问题标签</span><div className="issue-tags">{issueTags.map((tag) => <button className={review.issueTags.includes(tag) ? 'active' : ''} type="button" key={tag} onClick={() => toggleTag(tag)}>{tag}</button>)}</div></div><div><span>本次状态</span><div className="choice-buttons">{nextActionChoices.map((choice) => <button className={review.nextActionChoice === choice ? 'active' : ''} type="button" key={choice} onClick={() => onChange({ ...review, nextActionChoice: choice, createdAt: review.createdAt || new Date().toISOString() })}>{choice}</button>)}</div></div></div>
}

function HistoryRow({
  record,
  selectedJob,
  cvText,
  scriptText,
  expanded,
  onToggle,
  onUpdate,
  onDelete,
}: {
  record: TrainingRecord
  selectedJob: JobRecord | null
  cvText: string
  scriptText: string
  expanded: boolean
  onToggle: () => void
  onUpdate: (updater: (record: TrainingRecord) => TrainingRecord) => void
  onDelete: () => void
}) {
  const [transcriptDraft, setTranscriptDraft] = useState(record.transcript?.text || '')
  const [transcriptSource, setTranscriptSource] = useState<'manual' | 'mock'>(record.transcript?.source || 'manual')
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState('')

  function saveTranscript() {
    const text = transcriptDraft.trim()
    if (!text) {
      setFeedbackMessage('请先粘贴回答文本，或使用模拟文本。')
      return
    }
    const transcript: TranscriptData = {
      text,
      source: transcriptSource,
      updatedAt: new Date().toISOString(),
    }
    onUpdate((current) => ({
      ...current,
      transcript,
      aiFeedback: current.transcript?.text === text ? current.aiFeedback : undefined,
    }))
    setFeedbackMessage('回答文本已保存。')
  }

  function useMockTranscript() {
    const text = createMockTranscript(record, selectedJob)
    const transcript: TranscriptData = {
      text,
      source: 'mock',
      updatedAt: new Date().toISOString(),
    }
    setTranscriptDraft(text)
    setTranscriptSource('mock')
    onUpdate((current) => ({ ...current, transcript, aiFeedback: undefined }))
    setFeedbackMessage('已载入模拟文本，可直接生成反馈。')
  }

  function clearTranscript() {
    setTranscriptDraft('')
    setTranscriptSource('manual')
    onUpdate((current) => ({ ...current, transcript: undefined, aiFeedback: undefined }))
    setFeedbackMessage('回答文本和旧反馈已清空。')
  }

  async function generateFeedback() {
    const text = transcriptDraft.trim()
    if (!text) {
      setFeedbackMessage('请先粘贴回答文本，或使用模拟文本。')
      return
    }
    setFeedbackLoading(true)
    setFeedbackMessage('')
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 25_000)
    try {
      const transcript: TranscriptData = {
        text,
        source: transcriptSource,
        updatedAt: new Date().toISOString(),
      }
      const response = await fetch('/api/analyze-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          taskType: 'analyze_answer',
          trainingRecordId: record.id,
          trainingType: taskIdToTrainingType(record.taskId),
          selectedJob,
          transcript: text,
          durationSeconds: record.durationSeconds,
          targetSeconds: record.targetSeconds,
          review: record.review,
          cvText: cvText.slice(0, 6000),
          scriptText: scriptText.slice(0, 8000),
        }),
      })
      const result = await response.json() as AnalyzeAnswerResponse
      if (!response.ok || !result.success) {
        throw new Error(result.success ? '反馈生成失败。' : result.error)
      }
      const { success: _success, ...aiFeedback } = result
      void _success
      try {
        window.localStorage.setItem('interview_os_feedback_save_probe', JSON.stringify({ transcript, aiFeedback }))
        window.localStorage.removeItem('interview_os_feedback_save_probe')
      } catch {
        setFeedbackMessage('反馈已生成，但浏览器本地空间不足，未能保存。请先导出备份并清理旧记录。')
        return
      }
      onUpdate((current) => ({ ...current, transcript, aiFeedback }))
      setFeedbackMessage('AI 反馈已保存到本条训练记录。')
    } catch (error) {
      setFeedbackMessage(
        error instanceof Error && error.name === 'AbortError'
          ? '请求超时，请稍后重试。训练记录没有丢失。'
          : error instanceof Error
            ? error.message
            : '反馈生成失败，请稍后重试。',
      )
    } finally {
      window.clearTimeout(timeout)
      setFeedbackLoading(false)
    }
  }

  return (
    <article className="history-row">
      <div className="history-main">
        <strong>{record.title}</strong>
        <span>
          {formatDateTime(record.savedAt)} · {formatDuration(record.durationSeconds)} ·
          {record.review.selfScore ? ` ${record.review.selfScore} 分` : ' 未评分'} ·
          {record.review.issueTags.join('、') || '无标签'}
        </span>
        <span className={record.aiFeedback ? 'feedback-status ready' : 'feedback-status'}>
          {record.aiFeedback
            ? `已生成 AI 反馈 · ${record.aiFeedback.score} 分 · ${record.aiFeedback.provider}`
            : '未生成反馈'}
        </span>
        {expanded ? (
          <div className="history-detail">
            <p>状态：{record.review.nextActionChoice || '未选择'}</p>
            <p>语音备注：{record.review.voiceNoteMetadata ? `${formatDuration(record.review.voiceNoteMetadata.durationSeconds)}，保存在本地浏览器` : '无'}</p>
            {record.review.legacyBiggestProblem ? <p>旧版最大问题：{record.review.legacyBiggestProblem}</p> : null}
            {record.review.legacyNextImprovement ? <p>旧版下次改进：{record.review.legacyNextImprovement}</p> : null}
            <p>音频长期保存以下载文件为准，本地仅保存训练记录。</p>

            <section className="ai-analysis">
              <div className="ai-analysis-heading">
                <BrainCircuit size={20} />
                <div><strong>回答文本与 AI 反馈</strong><span>当前暂未自动转写录音，可粘贴文本或使用模拟文本。</span></div>
              </div>
              <textarea
                value={transcriptDraft}
                onChange={(event) => {
                  setTranscriptDraft(event.target.value)
                  setTranscriptSource('manual')
                }}
                rows={7}
                maxLength={20_000}
                placeholder="粘贴这次回答的转写文本"
              />
              <div className="inline-actions">
                <button type="button" onClick={saveTranscript}>保存文本</button>
                <button type="button" onClick={useMockTranscript}>使用模拟文本</button>
                <button type="button" className="danger-text" onClick={clearTranscript}>清空文本</button>
                <button type="button" className="primary-button" onClick={() => void generateFeedback()} disabled={feedbackLoading}>
                  <BrainCircuit size={15} />{feedbackLoading ? '正在分析…' : '生成 AI 反馈'}
                </button>
              </div>
              {feedbackMessage ? <p className={feedbackMessage.includes('失败') || feedbackMessage.includes('超时') ? 'error-line' : 'success-line'}>{feedbackMessage}</p> : null}
              {record.aiFeedback ? <AIFeedbackReport feedback={record.aiFeedback} /> : null}
            </section>
          </div>
        ) : null}
      </div>
      <div className="history-actions">
        <button type="button" onClick={onToggle}>{expanded ? '收起' : '查看详情'}</button>
        <button className="danger-text" type="button" onClick={onDelete}>删除记录</button>
      </div>
    </article>
  )
}

function AIFeedbackReport({ feedback }: { feedback: StoredAIFeedback }) {
  const isMock = feedback.provider === 'mock' || feedback.provider === 'mock_fallback'
  return (
    <div className="ai-report">
      <header>
        <div><span>总分</span><strong>{feedback.score}</strong></div>
        <p>{feedback.summary}</p>
        <em>{feedback.provider} · {feedback.model}</em>
      </header>
      {isMock ? <p className="mock-notice">当前为模拟反馈，仅用于测试流程。接入真实模型后会生成真实分析。</p> : null}
      {feedback.rawProviderNote ? <p className="provider-note">{feedback.rawProviderNote}</p> : null}
      <div className="feedback-columns">
        <FeedbackList title="做得好的地方" items={feedback.strengths} />
        <FeedbackList title="主要问题" items={feedback.problems} />
      </div>
      <dl className="feedback-detail-list">
        <div><dt>岗位匹配</dt><dd>{feedback.roleFitFeedback}</dd></div>
        <div><dt>结构</dt><dd>{feedback.structureFeedback}</dd></div>
        <div><dt>表达</dt><dd>{feedback.expressionFeedback}</dd></div>
        <div><dt>时长</dt><dd>{feedback.timingFeedback}</dd></div>
      </dl>
      <details>
        <summary>查看 30 秒优化版</summary>
        <p>{feedback.improvedShortVersion}</p>
      </details>
      <details>
        <summary>查看 90 秒优化版</summary>
        <p>{feedback.improvedLongVersion}</p>
      </details>
      <FeedbackList title="下一步任务" items={feedback.nextTasks} />
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
    return { uploadedFiles: normalizeFiles(parsed.uploadedFiles ?? readArray(UPLOADED_FILES_KEY)), tasks: normalizeTasks(parsed.tasks), history: normalizeTrainingRecords(parsed.history ?? readArray(TRAINING_RECORDS_KEY)), lastSavedAt: parsed.lastSavedAt }
  } catch { return defaultState }
}

function readJobPool() { return readArray<JobRecord>(JOB_POOL_KEY) }
function readSelectedJob() { try { const raw = localStorage.getItem(SELECTED_JOB_KEY); return raw ? JSON.parse(raw) as JobRecord : null } catch { return null } }
function readCvTextState(): CvTextState { try { const raw = localStorage.getItem(CV_TEXT_KEY); return raw ? { text: '', source: 'upload', ...JSON.parse(raw) } : { text: '', source: 'upload' } } catch { return { text: '', source: 'upload' } } }
function readScriptTemplates(): ScriptTemplates { try { const raw = localStorage.getItem(SCRIPT_TEMPLATES_KEY); return raw ? JSON.parse(raw) : {} } catch { return {} } }
function readLegacyRole() { try { const raw = localStorage.getItem(LEGACY_TARGET_ROLE_KEY); return raw ? JSON.parse(raw) : null } catch { return null } }
function readArray<T>(key: string): T[] { try { const raw = localStorage.getItem(key); const parsed = raw ? JSON.parse(raw) : []; return Array.isArray(parsed) ? parsed : [] } catch { return [] } }

function normalizeTasks(tasks?: TrainingTask[]) {
  return defaultTasks.map((defaultTask) => {
    const saved = tasks?.find((task) => task.id === defaultTask.id)
    return { ...defaultTask, ...saved, defaultReferenceTemplate: defaultTask.defaultReferenceTemplate, review: normalizeReview(saved?.review) }
  })
}

function normalizeTrainingRecords(records?: TrainingRecord[]) {
  return (Array.isArray(records) ? records : []).map((record) => ({ ...record, review: normalizeReview(record.review) })).sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
}

function normalizeReview(review?: Partial<TrainingReview> & {
  isOvertime?: boolean
  hasStuck?: boolean
  isLogicMessy?: boolean
  soundsMemorized?: boolean
  weakRoleFit?: boolean
  notSpecificEnough?: boolean
  englishNotFluent?: boolean
  biggestProblem?: string
  nextImprovement?: string
}): TrainingReview {
  const legacyTags = [
    review?.isOvertime ? '超时' : '',
    review?.hasStuck ? '卡顿' : '',
    review?.isLogicMessy ? '逻辑混乱' : '',
    review?.soundsMemorized ? '太像背稿' : '',
    review?.weakRoleFit ? '岗位匹配弱' : '',
    review?.notSpecificEnough ? '项目不够具体' : '',
    review?.englishNotFluent ? '英文不流畅' : '',
  ].filter(Boolean)
  return {
    selfScore: typeof review?.selfScore === 'number' ? review.selfScore : undefined,
    issueTags: Array.isArray(review?.issueTags) ? review.issueTags : legacyTags,
    nextActionChoice: typeof review?.nextActionChoice === 'string' ? review.nextActionChoice as NextActionChoice : '',
    voiceNoteMetadata: review?.voiceNoteMetadata as VoiceNoteMetadata | undefined,
    createdAt: typeof review?.createdAt === 'string' ? review.createdAt : undefined,
    legacyBiggestProblem: typeof review?.biggestProblem === 'string' ? review.biggestProblem : review?.legacyBiggestProblem,
    legacyNextImprovement: typeof review?.nextImprovement === 'string' ? review.nextImprovement : review?.legacyNextImprovement,
  }
}

function normalizeFiles(files?: UploadedFileMeta[]) { return (Array.isArray(files) ? files : []).map((file, index) => ({ ...file, category: file.category ?? (index === 0 ? 'cv' : 'project') })) }
function getFileByCategory(files: UploadedFileMeta[], category: UploadCategory) { return files.find((file) => file.category === category) }
function getDefaultTask(id: TaskId) { return defaultTasks.find((task) => task.id === id) || defaultTasks[0] }
function canExtractPlainText(name: string, type: string) { const ext = getFileExtension(name).toLowerCase(); return ext === '.txt' || ext === '.md' || type.startsWith('text/') }
function toCvTextMeta(cv: CvTextState): UploadedFileMeta { return { id: 'cv-text', name: cv.fileName || 'CV 文本', size: new Blob([cv.text]).size, type: 'text/plain', uploadedAt: cv.updatedAt || new Date().toISOString(), status: '已解析', category: 'cv', parseStatus: '已提取文本' } }
function getCvStatusText(file: UploadedFileMeta | undefined, cv: CvTextState) { if (cv.text) return `已读取 CV 文本：${cv.fileName || '文本版'}。`; if (!file) return '尚未上传 CV。'; if (file.parseStatus === '需要文本版') return 'CV 文件已上传，但当前版本暂未解析此格式。请上传 TXT / Markdown 文本版。'; return 'CV 已上传，但暂未解析内容。' }

function filterJobs(jobs: JobRecord[], filters: Record<string, string>) {
  return jobs.filter((job) =>
    (!filters.company || job.companyName === filters.company) &&
    (!filters.title || job.jobTitle === filters.title) &&
    (!filters.city || job.city === filters.city) &&
    (!filters.jobType || job.jobType === filters.jobType) &&
    (!filters.priority || job.priority === filters.priority) &&
    (!filters.mainTrack || job.mainTrack === filters.mainTrack) &&
    (!filters.salary || job.salary === filters.salary) &&
    (!filters.today || (filters.today === '是' ? job.isTodayNew : !job.isTodayNew))
  )
}

function buildFilterOptions(jobs: JobRecord[]) {
  const values = (key: keyof JobRecord) => Array.from(new Set(jobs.map((job) => String(job[key] || '')).filter(Boolean))).sort()
  return { company: values('companyName'), title: values('jobTitle'), city: values('city'), jobType: values('jobType'), priority: values('priority'), mainTrack: values('mainTrack'), salary: values('salary') }
}

function renderScript(template: string, job: JobRecord) {
  const direction = job.companyBusiness || job.mainTrack || job.businessDirection || '相关业务'
  return template.replaceAll('【XXX岗位】', job.jobTitle).replaceAll('【公司名称】', job.companyName).replaceAll('【岗位相关业务/产品方向】', direction).replaceAll('[XXX role]', job.jobTitle).replaceAll('[business/product direction]', direction)
}

function extractJobKeywords(job: JobRecord) {
  const text = `${job.jobTitle} ${job.jobContent} ${job.jobRequirements} ${job.mainTrack}`
  const candidates = ['AI', '用户研究', '用户体验', '产品体验', '智能硬件', 'AIoT', '解决方案', '项目管理', '原型', '算法', 'B端', '跨团队', '数据', '英文']
  const matched = candidates.filter((item) => text.toLowerCase().includes(item.toLowerCase()))
  return (matched.length ? matched : [job.mainTrack, job.jobType, job.priority]).filter(Boolean).slice(0, 5)
}

function buildJobTip(job: JobRecord) {
  const title = job.jobTitle
  if (/硬件|智能硬件|AIoT/i.test(title + job.mainTrack)) return '回答中突出小米耳机、硬件项目、B 端设备和软硬件结合能力。'
  if (/用户研究/.test(title)) return '回答中突出用户洞察、调研、体验分析和跨文化用户场景。'
  if (/产品体验/.test(title)) return '回答中突出设计背景、用户体验、原型和产品机制。'
  if (/解决方案|项目/.test(title)) return '回答中突出 B 端项目、客户需求、跨团队协作和方案落地。'
  if (/AI/i.test(title)) return '回答中明确讲 AI 项目、Miro 项目和 AI 应用落地。'
  return `回答中围绕“${job.mainTrack || job.companyBusiness || job.jobTitle}”解释你的匹配证据。`
}

function generateNextActions(jobPool: JobRecord[], selectedJob: JobRecord | null, cv: CvTextState, tasks: TrainingTask[], records: TrainingRecord[]) {
  const actions: string[] = []
  if (!jobPool.length) actions.push('上传 job.xlsx，选择本次训练岗位。')
  else if (!selectedJob) actions.push('从岗位库选择一个目标岗位。')
  if (!cv.text) actions.push('上传 TXT / Markdown 简历文本版，方便后续训练。')
  const missing = tasks.filter((task) => !records.some((record) => record.taskId === task.id))
  if (missing.length) actions.push(`完成剩余录音：${missing.map((task) => task.title).join('、')}。`)
  for (const record of records) {
    const tags = record.review.issueTags
    if (tags.includes('超时')) actions.push(`重练${record.title}，把时长压到目标范围内。`)
    if (tags.includes('逻辑混乱')) actions.push('只看骨架重讲一次，不看全文。')
    if (tags.includes('太像背稿')) actions.push('关闭参考稿，只看关键词讲一次。')
    if (tags.includes('岗位匹配弱')) actions.push(`重练开头和结尾，把${selectedJob?.jobTitle || '当前岗位'}和公司业务讲进去。`)
    if (tags.includes('项目不够具体')) actions.push('补充项目里的用户、场景、功能和 MVP 取舍。')
    if (tags.includes('英文不流畅')) actions.push('慢速读英文稿 3 遍，再录一次。')
    if (tags.includes('开头不清楚')) actions.push('只练开头 30 秒。')
    if (tags.includes('结尾不够有力')) actions.push('重练最后 20 秒，总结自己和岗位的匹配点。')
  }
  if (!actions.length && tasks.every((task) => records.some((record) => record.taskId === task.id))) actions.push('明天进入岗位定向问题训练。')
  return Array.from(new Set(actions)).slice(0, 3)
}

function getFlowSteps(jobPool: JobRecord[], selectedJob: JobRecord | null, cv: CvTextState, records: TrainingRecord[]) {
  const has = (id: TaskId) => records.some((record) => record.taskId === id)
  const reviewed = records.length > 0 && records.every((record) => record.review.selfScore && record.review.nextActionChoice)
  return [
    { label: '上传资料', status: cv.text ? '已完成' : '需要补充' },
    { label: '解析岗位库', status: jobPool.length ? '已完成' : '需要补充' },
    { label: '选择目标岗位', status: selectedJob ? '已完成' : '未开始' },
    { label: '录中文自我介绍', status: has('cn-intro') ? '已完成' : '未开始' },
    { label: '录英文自我介绍', status: has('en-intro') ? '已完成' : '未开始' },
    { label: '录 Miro 项目讲解', status: has('miro-project') ? '已完成' : '未开始' },
    { label: '点击标签复盘', status: reviewed ? '已完成' : '未开始' },
    { label: '查看下一步任务', status: records.length === 3 ? '已完成' : '未开始' },
  ]
}

function taskIdToTrainingType(taskId: TaskId): TrainingType {
  if (taskId === 'en-intro') return 'englishIntro'
  if (taskId === 'miro-project') return 'miroProject'
  return 'chineseIntro'
}

function getScriptTextForTask(
  taskId: TaskId,
  tasks: TrainingTask[],
  templates: ScriptTemplates,
  selectedJob: JobRecord | null,
) {
  const task = tasks.find((item) => item.id === taskId) || getDefaultTask(taskId)
  const template = templates[task.scriptKey] || task.defaultReferenceTemplate
  return selectedJob ? renderScript(template, selectedJob) : template
}

function createMockTranscript(record: TrainingRecord, selectedJob: JobRecord | null) {
  const company = selectedJob?.companyName || '目标公司'
  const role = selectedJob?.jobTitle || '目标岗位'
  if (record.taskId === 'en-intro') {
    return `Hi, I am preparing for the ${role} role at ${company}. My background combines AI learning, product experience, and industrial design. In the Miro project, I identified a collaboration problem, defined the core user scenario, and turned the idea into a testable MVP. I hope to bring this combination of user insight and practical delivery to the role.`
  }
  if (record.taskId === 'miro-project') {
    return `Miro 项目关注多人协作时信息分散、讨论难以转成行动的问题。我负责梳理用户场景、确定功能优先级并设计 MVP。方案中加入了 AI 辅助整理，但我没有把 AI 当作装饰，而是明确它在信息归纳和下一步行动生成中的作用。完成原型后，我根据用户反馈调整了信息结构。这个项目能证明我与${company}${role}所需的用户理解、产品拆解和验证能力匹配。`
  }
  return `我正在准备${company}的${role}。我的背景结合了 AI 学习、产品体验和工业设计。在 Miro 项目中，我从用户协作痛点出发，完成需求拆解、原型设计和 MVP 验证；在硬件项目中，我也积累了跨团队沟通和落地经验。我希望把这种复合能力用于目标岗位，连接用户需求、业务目标和可执行的产品方案。`
}

function createPreview(blob: Blob): AudioPreview { return { url: URL.createObjectURL(blob), size: blob.size } }
function getSupportedAudioMimeType() { return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type)) || '' }
function openRecordingDb(): Promise<IDBDatabase> { return new Promise((resolve, reject) => { const request = indexedDB.open(RECORDING_DB_NAME, 1); request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(RECORDING_STORE)) request.result.createObjectStore(RECORDING_STORE) }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) }) }
async function saveRecordingBlob(id: string, blob: Blob) { const db = await openRecordingDb(); await new Promise<void>((resolve, reject) => { const tx = db.transaction(RECORDING_STORE, 'readwrite'); tx.objectStore(RECORDING_STORE).put(blob, id); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) }); db.close() }
async function readRecordingBlob(id: string) { const db = await openRecordingDb(); const blob = await new Promise<Blob | null>((resolve, reject) => { const request = db.transaction(RECORDING_STORE, 'readonly').objectStore(RECORDING_STORE).get(id); request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null); request.onerror = () => reject(request.error) }); db.close(); return blob }
async function deleteRecordingBlob(id: string) { const db = await openRecordingDb(); await new Promise<void>((resolve) => { const tx = db.transaction(RECORDING_STORE, 'readwrite'); tx.objectStore(RECORDING_STORE).delete(id); tx.oncomplete = () => resolve(); tx.onerror = () => resolve() }); db.close() }
async function deleteRecordingDatabase() { await new Promise<void>((resolve) => { const request = indexedDB.deleteDatabase(RECORDING_DB_NAME); request.onsuccess = () => resolve(); request.onerror = () => resolve(); request.onblocked = () => resolve() }) }

function isValidBackup(payload: Partial<BackupPayload>): payload is BackupPayload { return Boolean(Array.isArray(payload.uploadedFiles) && Array.isArray(payload.jobPool) && Array.isArray(payload.trainingRecords) && payload.cvText && payload.scriptTemplates) }
function downloadJson(payload: unknown, name: string) { const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url) }
function isToday(value: string) { const date = new Date(value); const now = new Date(); return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate() }
function formatFileSize(bytes: number) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1024 / 1024).toFixed(1)} MB` }
function formatDateTime(value: string) { return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }
function formatDuration(seconds: number) { return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}` }
function formatDateForFile(date: Date) { return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}` }
function formatDateForFileName(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
function getFileExtension(name: string) { const extension = name.split('.').pop(); return extension ? `.${extension}` : '未知格式' }
function countCharacters(text: string) { return Array.from(text.trim()).length }

export default App
