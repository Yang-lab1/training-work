import type {
  MaterialImportId,
  NavKey,
  WorkflowStage,
  WorkflowStageId,
  WorkflowState,
} from './types'

export const workflowStorageKey = 'interview-os-state-v4-workflow-zh'

export const workflowStageOrder: WorkflowStageId[] = [
  '0_welcome',
  '1_import_materials',
  '2_baseline',
  '3_generate_bootcamp',
  '4_daily_training',
  '5_readiness_check',
  '6_select_target_job',
  '7_company_prep',
  '8_interview_room',
  '9_review',
  '10_feedback_loop',
]

export const workflowStages: WorkflowStage[] = [
  {
    id: '0_welcome',
    step: 0,
    label: '欢迎与路径说明',
    shortLabel: '欢迎',
    description: '先建档，再摸底，最后进入训练。',
    primaryActionLabel: '开始建立我的训练档案',
    todayRequiredAction: '选择一种方式建立训练档案',
    estimatedMinutes: 3,
    evidence: ['确认训练路径', '选择资料导入方式', '进入资料导入阶段'],
    unlockRequirement: '首次进入系统时显示。',
    navKey: 'today',
  },
  {
    id: '1_import_materials',
    step: 1,
    label: '导入资料',
    shortLabel: '导入资料',
    description: '先补齐身份、项目和目标方向。',
    primaryActionLabel: '开始导入资料',
    todayRequiredAction: '导入 CV、项目资料和目标岗位方向',
    estimatedMinutes: 12,
    evidence: ['CV 或个人经历资料', '项目资料', '目标岗位方向'],
    unlockRequirement: '完成欢迎引导后解锁。',
    navKey: 'vault',
  },
  {
    id: '2_baseline',
    step: 2,
    label: '能力摸底',
    shortLabel: '能力摸底',
    description: '建立第一版面试能力基线。',
    primaryActionLabel: '开始能力摸底',
    todayRequiredAction: '完成第一轮语音能力摸底',
    estimatedMinutes: 25,
    evidence: ['中文自我介绍', '英文自我介绍', '项目讲解', '压力题回答'],
    unlockRequirement: '请先导入 CV、项目资料和目标岗位方向。',
    navKey: 'baseline',
  },
  {
    id: '3_generate_bootcamp',
    step: 3,
    label: '生成训练计划',
    shortLabel: '生成计划',
    description: '把摸底结果转成每日训练安排。',
    primaryActionLabel: '生成训练计划',
    todayRequiredAction: '生成第一版训练营计划',
    estimatedMinutes: 5,
    evidence: ['训练天数', '今日主任务', '辅助任务', 'DTS 目标'],
    unlockRequirement: '请先完成第一轮语音能力摸底。',
    navKey: 'bootcamp',
  },
  {
    id: '4_daily_training',
    step: 4,
    label: '今日训练',
    shortLabel: '今日训练',
    description: '按 Today 派发的语音卡完成训练。',
    primaryActionLabel: '开始今日训练',
    todayRequiredAction: '完成 Today 派发的语音训练卡',
    estimatedMinutes: 40,
    evidence: ['语音回答', '模拟转写', '内容/表达/语言评分', '下一次重练任务'],
    unlockRequirement: '请先生成训练计划。',
    navKey: 'practice',
  },
  {
    id: '5_readiness_check',
    step: 5,
    label: '阶段达标检测',
    shortLabel: '达标检测',
    description: '用小型语音模拟判断是否达标。',
    primaryActionLabel: '开始阶段达标检测',
    todayRequiredAction: '完成一场小型语音模拟检测',
    estimatedMinutes: 18,
    evidence: ['IRS 是否达到目标', '卡壳/超时记录', '是否进入岗位定向'],
    unlockRequirement: '请先完成今日训练任务。',
    navKey: 'today',
  },
  {
    id: '6_select_target_job',
    step: 6,
    label: '选择目标岗位',
    shortLabel: '选择岗位',
    description: '只选一个本轮目标岗位。',
    primaryActionLabel: '选择目标岗位',
    todayRequiredAction: '选择一个 A/B/C 目标岗位',
    estimatedMinutes: 10,
    evidence: ['目标公司', '岗位级别', 'JD 风险点', '下一步准备动作'],
    unlockRequirement: '请先通过阶段达标检测。',
    navKey: 'targets',
  },
  {
    id: '7_company_prep',
    step: 7,
    label: '公司定向准备',
    shortLabel: '公司准备',
    description: '学习准备包，并通过语音抽查。',
    primaryActionLabel: '进入公司定向准备',
    todayRequiredAction: '阅读准备包并完成语音抽查',
    estimatedMinutes: 20,
    evidence: ['公司画像', '岗位要求拆解', '自我介绍策略', '语音抽查通过'],
    unlockRequirement: '请选择一个目标岗位。',
    navKey: 'targets',
  },
  {
    id: '8_interview_room',
    step: 8,
    label: '线上面试舱',
    shortLabel: '面试舱',
    description: '完成一场定向模拟面试。',
    primaryActionLabel: '进入面试舱',
    todayRequiredAction: '完成一场线上模拟面试',
    estimatedMinutes: 25,
    evidence: ['虚拟面试官灵活提问', '候选人语音回答', '追问', '单题评分'],
    unlockRequirement: '请先阅读公司准备包，并通过进入面试舱前的语音抽查。',
    navKey: 'interview',
  },
  {
    id: '9_review',
    step: 9,
    label: '面试复盘',
    shortLabel: '复盘报告',
    description: '提取问题、评分并生成复盘。',
    primaryActionLabel: '查看复盘报告',
    todayRequiredAction: '读取模拟面试记录并生成复盘',
    estimatedMinutes: 15,
    evidence: ['问题提取', '命中率', '新问题率', '下一轮训练任务'],
    unlockRequirement: '请先完成一场模拟面试。',
    navKey: 'review',
  },
  {
    id: '10_feedback_loop',
    step: 10,
    label: '题库反补与下一轮训练',
    shortLabel: '反补训练',
    description: '把新问题写回题库，开启下一轮。',
    primaryActionLabel: '生成下一轮训练',
    todayRequiredAction: '把复盘结果反补到下一轮训练',
    estimatedMinutes: 4,
    evidence: ['题库更新', '成长地图更新', 'Today 更新', '目标岗位准备度更新'],
    unlockRequirement: '请先生成复盘报告。',
    navKey: 'today',
  },
]

export const requiredMaterialIds: MaterialImportId[] = ['cv', 'project', 'target']

export const defaultWorkflowState: WorkflowState = deriveWorkflowState({
  currentStage: '1_import_materials',
  completedStages: ['0_welcome'],
  unlockedStages: ['0_welcome', '1_import_materials'],
  lockedStages: workflowStageOrder.filter((id) => !['0_welcome', '1_import_materials'].includes(id)),
  nextRequiredAction: '上传 CV',
  todayRequiredAction: '上传 CV / 个人经历资料',
  currentProgressPercent: 0,
  onboardingCompleted: true,
  profileImported: false,
  baselineCompleted: false,
  trainingPlanGenerated: false,
  todayPracticeCompleted: false,
  readinessPassed: false,
  targetJobSelected: false,
  companyBriefGenerated: false,
  companyBriefReviewed: false,
  companyBriefVoiceCheckPassed: false,
  targetInterviewUnlocked: false,
  companyPrepCompleted: false,
  mockInterviewCompleted: false,
  reviewCompleted: false,
  feedbackLoopCompleted: false,
  importedMaterials: ['project', 'target'],
  todayPracticeCompletedIds: [],
  updated_at: new Date(0).toISOString(),
})

export function getWorkflowStage(id: WorkflowStageId) {
  return workflowStages.find((stage) => stage.id === id) ?? workflowStages[0]
}

export function normalizeWorkflowState(partial?: Partial<WorkflowState>): WorkflowState {
  return deriveWorkflowState({
    ...defaultWorkflowState,
    ...partial,
    completedStages: partial?.completedStages ?? [],
    unlockedStages: partial?.unlockedStages ?? ['0_welcome'],
    lockedStages: partial?.lockedStages ?? workflowStageOrder.filter((id) => id !== '0_welcome'),
    importedMaterials: partial?.importedMaterials ?? [],
    todayPracticeCompletedIds: partial?.todayPracticeCompletedIds ?? [],
    updated_at: partial?.updated_at ?? new Date().toISOString(),
  })
}

export function deriveWorkflowState(state: WorkflowState): WorkflowState {
  const currentStage = resolveCurrentStage(state)
  const completedStages = resolveCompletedStages(state)
  const unlockedStages = resolveUnlockedStages(state)
  const lockedStages = workflowStageOrder.filter((id) => !unlockedStages.includes(id))
  const stage = getWorkflowStage(currentStage)
  const progressCompleted = completedStages.filter((id) => id !== '0_welcome').length

  return {
    ...state,
    currentStage,
    completedStages,
    unlockedStages,
    lockedStages,
    nextRequiredAction: stage.primaryActionLabel,
    todayRequiredAction: stage.todayRequiredAction,
    currentProgressPercent: Math.min(100, Math.round((progressCompleted / 10) * 100)),
  }
}

export function advanceWorkflowState(current: WorkflowState, patch: Partial<WorkflowState>): WorkflowState {
  return normalizeWorkflowState({
    ...current,
    ...patch,
    importedMaterials: patch.importedMaterials ?? current.importedMaterials,
    todayPracticeCompletedIds: patch.todayPracticeCompletedIds ?? current.todayPracticeCompletedIds,
    updated_at: new Date().toISOString(),
  })
}

export function hasRequiredMaterials(importedMaterials: MaterialImportId[]) {
  return requiredMaterialIds.every((id) => importedMaterials.includes(id))
}

export function getStageAccess(id: WorkflowStageId, workflow: WorkflowState) {
  const stage = getWorkflowStage(id)
  if (workflow.unlockedStages.includes(id)) {
    return { locked: false, reason: '' }
  }
  return { locked: true, reason: stage.unlockRequirement }
}

export function getNavAccess(key: NavKey, workflow: WorkflowState) {
  if (key === 'today' || key === 'settings') return { locked: false, reason: '' }
  if (key === 'vault') {
    return { locked: false, reason: '' }
  }
  if (key === 'baseline') {
    return workflow.profileImported
      ? { locked: false, reason: '' }
      : { locked: true, reason: '请先导入 CV、项目资料和目标岗位方向，系统需要先知道你是谁。' }
  }
  if (key === 'bootcamp') {
    return workflow.baselineCompleted
      ? { locked: false, reason: '' }
      : { locked: true, reason: '请先完成第一轮语音能力摸底，系统才能判断真实短板。' }
  }
  if (key === 'practice') {
    return workflow.trainingPlanGenerated
      ? { locked: false, reason: '' }
      : { locked: true, reason: '你已经完成摸底后，需要先生成训练计划，再进入日常训练。' }
  }
  if (key === 'growth') {
    return workflow.trainingPlanGenerated
      ? { locked: false, reason: '' }
      : { locked: true, reason: '成长地图需要训练计划和训练记录支撑，请先完成摸底并生成计划。' }
  }
  if (key === 'targets') {
    return workflow.readinessPassed
      ? { locked: false, reason: '' }
      : { locked: true, reason: '当前准备度还不足，请先完成通用训练和阶段达标检测。' }
  }
  if (key === 'interview') {
    return workflow.targetInterviewUnlocked && workflow.companyBriefVoiceCheckPassed
      ? { locked: false, reason: '' }
      : { locked: true, reason: '请先阅读公司与岗位准备包，并通过语音抽查。面试舱不会把准备包当固定题库。' }
  }
  if (key === 'review') {
    return workflow.mockInterviewCompleted
      ? { locked: false, reason: '' }
      : { locked: true, reason: '完成一场模拟面试后，系统会生成复盘报告。' }
  }
  return { locked: false, reason: '' }
}

export function getNavKeyForCurrentStage(workflow: WorkflowState): NavKey {
  return getWorkflowStage(workflow.currentStage).navKey
}

export function getNavKeyForStage(id: WorkflowStageId): NavKey {
  return getWorkflowStage(id).navKey
}

function resolveCurrentStage(state: WorkflowState): WorkflowStageId {
  if (!state.profileImported) return '1_import_materials'
  if (!state.baselineCompleted) return '2_baseline'
  if (!state.trainingPlanGenerated) return '3_generate_bootcamp'
  if (!state.todayPracticeCompleted) return '4_daily_training'
  if (!state.readinessPassed) return '5_readiness_check'
  if (!state.targetJobSelected) return '6_select_target_job'
  if (!state.targetInterviewUnlocked || !state.companyBriefVoiceCheckPassed) return '7_company_prep'
  if (!state.mockInterviewCompleted) return '8_interview_room'
  if (!state.reviewCompleted) return '9_review'
  if (!state.feedbackLoopCompleted) return '10_feedback_loop'
  return '4_daily_training'
}

function resolveCompletedStages(state: WorkflowState): WorkflowStageId[] {
  const completed: WorkflowStageId[] = []
  if (state.onboardingCompleted) completed.push('0_welcome')
  if (state.profileImported) completed.push('1_import_materials')
  if (state.baselineCompleted) completed.push('2_baseline')
  if (state.trainingPlanGenerated) completed.push('3_generate_bootcamp')
  if (state.todayPracticeCompleted) completed.push('4_daily_training')
  if (state.readinessPassed) completed.push('5_readiness_check')
  if (state.targetJobSelected) completed.push('6_select_target_job')
  if (state.targetInterviewUnlocked && state.companyBriefVoiceCheckPassed) completed.push('7_company_prep')
  if (state.mockInterviewCompleted) completed.push('8_interview_room')
  if (state.reviewCompleted) completed.push('9_review')
  if (state.feedbackLoopCompleted) completed.push('10_feedback_loop')
  return completed
}

function resolveUnlockedStages(state: WorkflowState): WorkflowStageId[] {
  const unlocked: WorkflowStageId[] = ['0_welcome', '1_import_materials']
  if (state.profileImported) unlocked.push('2_baseline')
  if (state.baselineCompleted) unlocked.push('3_generate_bootcamp')
  if (state.trainingPlanGenerated) unlocked.push('4_daily_training')
  if (state.todayPracticeCompleted) unlocked.push('5_readiness_check')
  if (state.readinessPassed) unlocked.push('6_select_target_job')
  if (state.targetJobSelected) unlocked.push('7_company_prep')
  if (state.targetInterviewUnlocked && state.companyBriefVoiceCheckPassed) unlocked.push('8_interview_room')
  if (state.mockInterviewCompleted) unlocked.push('9_review')
  if (state.reviewCompleted) unlocked.push('10_feedback_loop')
  return unlocked
}
