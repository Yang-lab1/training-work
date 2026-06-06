import type { LucideIcon } from 'lucide-react'

export type NavKey =
  | 'today'
  | 'baseline'
  | 'bootcamp'
  | 'practice'
  | 'interview'
  | 'review'
  | 'targets'
  | 'growth'
  | 'vault'
  | 'settings'

export interface NavItem {
  key: NavKey
  label: string
  icon: LucideIcon
}

export type WorkflowStageId =
  | '0_welcome'
  | '1_import_materials'
  | '2_baseline'
  | '3_generate_bootcamp'
  | '4_daily_training'
  | '5_readiness_check'
  | '6_select_target_job'
  | '7_company_prep'
  | '8_interview_room'
  | '9_review'
  | '10_feedback_loop'

export type MaterialImportId = 'cv' | 'portfolio' | 'project' | 'target' | 'teaching'

export interface WorkflowStage {
  id: WorkflowStageId
  step: number
  label: string
  shortLabel: string
  description: string
  primaryActionLabel: string
  todayRequiredAction: string
  estimatedMinutes: number
  evidence: string[]
  unlockRequirement: string
  navKey: NavKey
}

export interface WorkflowState {
  currentStage: WorkflowStageId
  completedStages: WorkflowStageId[]
  unlockedStages: WorkflowStageId[]
  lockedStages: WorkflowStageId[]
  nextRequiredAction: string
  todayRequiredAction: string
  currentProgressPercent: number
  onboardingCompleted: boolean
  profileImported: boolean
  baselineCompleted: boolean
  trainingPlanGenerated: boolean
  todayPracticeCompleted: boolean
  readinessPassed: boolean
  targetJobSelected: boolean
  companyBriefGenerated: boolean
  companyBriefReviewed: boolean
  companyBriefVoiceCheckPassed: boolean
  targetInterviewUnlocked: boolean
  companyPrepCompleted: boolean
  mockInterviewCompleted: boolean
  reviewCompleted: boolean
  feedbackLoopCompleted: boolean
  importedMaterials: MaterialImportId[]
  todayPracticeCompletedIds: string[]
  updated_at: string
}

export interface UserProfile {
  user_id: string
  name: string
  current_stage: string
  education_background: string
  career_background: string
  target_roles: string[]
  target_locations: string[]
  target_markets: string[]
  daily_available_time: number
  job_search_strategy: string
  constraints: string[]
  preferred_language: string
  created_at: string
  updated_at: string
}

export interface ResumeProfile {
  resume_id: string
  user_id: string
  title: string
  language: string
  target_role_type: string
  content: string
  uploaded_file_status: string
  parsed_status: string
  indexed_status: string
  last_updated: string
}

export interface PortfolioProfile {
  portfolio_id: string
  user_id: string
  title: string
  type: string
  url: string
  content_summary: string
  uploaded_file_status: string
  parsed_status: string
  indexed_status: string
  last_updated: string
}

export interface ProjectProfile {
  project_id: string
  user_id: string
  title: string
  project_type: string
  role: string
  background: string
  user_or_business_problem: string
  key_decisions: string[]
  solution: string
  result: string
  reflection: string
  transferable_skills: string[]
  related_role_templates: string[]
  evidence_links: string[]
  indexed_status: string
}

export interface RoleTemplate {
  role_template_id: string
  role_name: string
  role_category: string
  core_competencies: string[]
  common_question_types: string[]
  scoring_weights: Record<string, number>
  recommended_frameworks: string[]
  training_modules: string[]
}

export interface TargetCompany {
  company_id: string
  user_id: string
  company_name: string
  industry: string
  company_type: string
  location: string
  company_summary: string
  source_url: string
  notes: string
}

export interface TargetJob {
  job_id: string
  user_id: string
  company_id: string
  role_title: string
  role_template_id: string
  city: string
  job_type: string
  level: string
  salary_range: string
  jd_text: string
  job_status: string
  abc_level: 'A' | 'B' | 'C'
  application_status: string
  risk_tags: string[]
  resume_version: string
  readiness_score: number
  next_action: string
  notes: string
}

export interface CompanyPrepQuestionStrategy {
  id: string
  question: string
  interviewerIntent: string
  recommendedFramework: string
  answerStructure: string[]
  usableExperience: string[]
  pitfalls: string[]
  thirtySecondVersion: string
  twoMinuteVersion: string
  followUpStrategy: string
}

export interface CompanyPrepBrief {
  brief_id: string
  target_job_id: string
  company_id: string
  generated_at: string
  disclaimer: string
  companyOverview: {
    whatTheyDo: string
    industry: string
    customers: string
    businessModel: string
    locationAndFootprint: string
  }
  productsAndBusiness: {
    coreProducts: string[]
    coreServices: string[]
    businessLines: string[]
    roleRelevantBusiness: string
    whyThisRoleMatters: string
  }
  recentSignals: string[]
  dailyWork: string[]
  intensityAndRisks: string[]
  careerPath: string[]
  selfIntroStrategy: {
    openingPositioning: string
    frontLoadedExperience: string[]
    keyProjects: string[]
    aiMasterBridge: string
    hardwareDesignBridge: string
    differentiator: string
  }
  highProbabilityQuestions: CompanyPrepQuestionStrategy[]
  mustRememberLines: string[]
  interviewerPrinciples: string[]
}

export interface InterviewReviewPackage {
  actualQuestions: string[]
  preparedDirectionHits: string[]
  liveExtensions: string[]
  strongAnswers: string[]
  missedCompanyOrRolePoints: string[]
  frameworkFit: string[]
  confusedAnswers: string[]
  scriptedAnswers: string[]
  companyUnderstandingToAdd: string[]
  thirtySecondFixes: string[]
  twoMinuteFixes: string[]
  mustRetryQuestions: string[]
  nextInterviewerFocus: string[]
  shouldUpdatePrepBrief: boolean
  shouldUpdateQuestionWeights: boolean
  shouldMockAgain: boolean
  readyForRealInterview: boolean
}

export interface LanguageProfile {
  user_id: string
  language: string
  current_level: string
  target_level: string
  weakness_tags: string[]
  latest_score: number
  practice_count: number
}

export interface ConstraintProfile {
  user_id: string
  cannot_accept: string[]
  prefer: string[]
  salary_floor: string
  commute_limit: string
  overtime_tolerance: string
  travel_tolerance: string
  location_preference: string[]
}

export interface DimensionScores {
  career_positioning: number
  cv_portfolio_support: number
  project_storytelling: number
  ai_product_application: number
  language_expression: number
  role_fit: number
  pressure_handling: number
  evidence_integrity: number
}

export interface BaselineAssessment {
  assessment_id: string
  user_id: string
  date: string
  overall_irs: number
  dimension_scores: DimensionScores
  top_weaknesses: string[]
  recommended_bootcamp_days: number
  recommended_strategy: string
}

export interface TrainingTask {
  task_id: string
  title: string
  category: 'Must' | 'Should' | 'Could' | 'Review'
  minutes: number
  evidence_required: string
  framework: string
}

export interface TrainingDay {
  day: number
  focus: string
  tasks: TrainingTask[]
  dts_target: number
  adjustment_rule: string
}

export interface TrainingPlan {
  plan_id: string
  user_id: string
  source_assessment_id: string
  duration_days: number
  daily_available_minutes: number
  target_score: number
  plan_status: string
  days: TrainingDay[]
}

export interface VoiceSourceMap {
  personal: string
  market: string
  knowledge: string
  real: string
}

export interface PracticePrompt {
  type: string
  question: string
  framework: string
  time_limit_seconds: number
  source_map: VoiceSourceMap
  next_task: string
}

export interface BaselinePrompt {
  id: string
  type: string
  question: string
  time_limit_seconds: number
  language: string
}

export interface VoiceScoreBreakdown {
  content: number
  expression: number
  language: number
}

export interface VoiceTurnResult {
  turn_id: string
  question: string
  transcript: string
  duration_seconds: number
  stuck: boolean
  over_time: boolean
  score: VoiceScoreBreakdown
  feedback: string[]
  created_at: string
}

export interface PracticeSession {
  session_id: string
  user_id: string
  practice_type: string
  question: string
  answer_text: string
  audio_placeholder: string
  framework_used: string
  score: number
  score_breakdown: VoiceScoreBreakdown
  duration_seconds: number
  source_map: VoiceSourceMap
  review: string
  next_task: string
  feedback: string[]
  next_retry_date: string
  created_at: string
}

export type InterviewRoomState =
  | 'ready'
  | 'interviewer_speaking'
  | 'user_thinking'
  | 'user_answering'
  | 'transcribing'
  | 'follow_up'
  | 'paused'
  | 'finished'

export interface MockInterviewTurn {
  question: string
  transcript: string
  duration_seconds: number
  score: VoiceScoreBreakdown
  feedback: string[]
  stuck: boolean
  over_time: boolean
  question_source?: string
  prep_direction?: string
  is_follow_up?: boolean
}

export interface MockInterview {
  mock_id: string
  user_id: string
  target_job_id: string
  interview_type: string
  questions: string[]
  turns: MockInterviewTurn[]
  score: number
  feedback: string[]
  generated_from_sources: string[]
  prep_brief_id?: string
  status: 'finished'
  created_at: string
}

export interface RealInterviewReview {
  review_id: string
  user_id: string
  target_job_id: string
  company_name: string
  role_title: string
  interview_round: string
  interviewer_type: string
  transcript_text: string
  extracted_questions: string[]
  simulated_question_match_rate: number
  new_question_rate: number
  review_type: '模拟面试复盘' | '真实面试复盘'
  source_record_id?: string
  feedback: string[]
  next_training_tasks: string[]
  review_package?: InterviewReviewPackage
  created_at: string
}

export interface QuestionBankItem {
  question_id: string
  user_id: string
  question_text: string
  normalized_question: string
  question_type: string
  source: string
  related_role_template: string
  related_project_id: string
  frequency: number
  difficulty: number
  user_performance_score: number
  priority_weight: number
}

export interface GrowthMapItem {
  user_id: string
  skill_name: string
  category: string
  current_score: number
  target_score: number
  evidence_count: number
  latest_feedback: string
  next_task: string
}

export interface VaultDocument {
  id: string
  type: string
  title: string
  uploaded: boolean
  pending_parse: boolean
  parsed: boolean
  indexed: boolean
  used_in_generation: boolean
  needs_update: boolean
}

export interface KnowledgeDatabase {
  id: string
  name: string
  purpose: string
  sources: string[]
  status: string
  training_usage: string
}

export interface UploadIntakeOption {
  id: string
  title: string
  description: string
  target_database: string
  accepted: string
}

export interface MissionCardData {
  id: string
  title: string
  why: string
  minutes: number
  evidence: string
  linked_practice: string
}

export interface FrameworkTemplate {
  id: string
  name: string
  question_type: string
  steps: string[]
  best_for: string[]
  correction_prompt: string
}

export interface StrategyTemplate {
  id: string
  name: string
  summary: string
  cadence: string
}
