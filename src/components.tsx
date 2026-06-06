import type { CSSProperties, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  Check,
  CircleDot,
  ClipboardCheck,
  FileText,
  Mic,
  Upload,
} from 'lucide-react'
import type {
  FrameworkTemplate,
  MissionCardData,
  TargetJob,
  TrainingDay,
  VaultDocument,
} from './types'

const taskCategoryLabels = {
  Must: '必做',
  Should: '建议',
  Could: '可选',
  Review: '复盘',
} as const

interface IconButtonProps {
  children: ReactNode
  icon?: LucideIcon
  variant?: 'primary' | 'secondary' | 'ghost'
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
}

export function IconButton({
  children,
  icon: Icon,
  variant = 'secondary',
  onClick,
  type = 'button',
  disabled = false,
}: IconButtonProps) {
  return (
    <button className={`icon-button ${variant}`} onClick={onClick} type={type} disabled={disabled}>
      {Icon ? <Icon size={17} strokeWidth={2.1} aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  )
}

export function GlassCard({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <section className={`glass-card ${className}`}>{children}</section>
}

export function StagePill({ label }: { label: string }) {
  return (
    <div className="stage-pill">
      <CircleDot size={15} aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

export function ScoreRing({
  label,
  score,
  helper,
}: {
  label: string
  score: number
  helper: string
}) {
  return (
    <div className="score-ring-wrap">
      <div className="score-ring" style={{ '--score': `${score * 3.6}deg` } as CSSProperties}>
        <div>
          <strong>{score}</strong>
          <span>/100</span>
        </div>
      </div>
      <div>
        <p className="eyebrow">{label}</p>
        <p className="muted">{helper}</p>
      </div>
    </div>
  )
}

export function StatTile({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="stat-tile">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </div>
  )
}

export function SkillBar({
  label,
  value,
  target,
}: {
  label: string
  value: number
  target?: number
}) {
  return (
    <div className="skill-bar">
      <div className="skill-bar-head">
        <span>{label}</span>
        <strong>{value}{target ? ` / ${target}` : ''}</strong>
      </div>
      <div className="skill-track">
        <span style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
        {target ? <i style={{ left: `${Math.min(100, target)}%` }} /> : null}
      </div>
    </div>
  )
}

export function MissionCard({
  mission,
  completed,
  onComplete,
  onPractice,
}: {
  mission: MissionCardData
  completed: boolean
  onComplete: () => void
  onPractice: () => void
}) {
  return (
    <article className={`mission-card ${completed ? 'complete' : ''}`}>
      <div className="mission-card-top">
        <span>{mission.minutes} 分钟</span>
        {completed ? <Check size={18} aria-label="已完成" /> : <ClipboardCheck size={18} aria-hidden="true" />}
      </div>
      <h3>{mission.title}</h3>
      <p>{mission.why}</p>
      <div className="evidence-line">
        <FileText size={16} aria-hidden="true" />
        <span>{mission.evidence}</span>
      </div>
      <div className="button-row">
        <IconButton icon={Check} variant={completed ? 'ghost' : 'secondary'} onClick={onComplete}>
          {completed ? '证据已保存' : '标记完成'}
        </IconButton>
        <IconButton icon={ArrowRight} variant="primary" onClick={onPractice}>
          开始练习
        </IconButton>
      </div>
    </article>
  )
}

export function FrameworkBadge({ framework }: { framework: FrameworkTemplate }) {
  return (
    <div className="framework-badge">
      <strong>{framework.name}</strong>
      <span>{framework.question_type}</span>
    </div>
  )
}

export function TrainingTimeline({
  days,
  compact = false,
}: {
  days: TrainingDay[]
  compact?: boolean
}) {
  return (
    <div className={`training-timeline ${compact ? 'compact' : ''}`}>
      {days.map((day) => (
        <article key={day.day} className="timeline-day">
          <div className="timeline-marker">{day.day}</div>
          <div className="timeline-content">
            <h3>{day.focus}</h3>
            <p>DTS 目标 {day.dts_target}。{day.adjustment_rule}</p>
            {!compact ? (
              <ul>
                {day.tasks.map((task) => (
                  <li key={task.task_id}>
                    <strong>{taskCategoryLabels[task.category]}</strong>
                    <span>{task.title}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  )
}

export function TargetJobCard({
  job,
  selected = false,
  onSelect,
}: {
  job: TargetJob
  selected?: boolean
  onSelect?: () => void
}) {
  return (
    <article className={`job-card level-${job.abc_level.toLowerCase()} ${selected ? 'selected' : ''}`}>
      <div className="job-card-head">
        <span className="abc-chip">{job.abc_level}</span>
        <span>{job.city}</span>
      </div>
      <h3>{job.role_title}</h3>
      <p>{job.jd_text}</p>
      <SkillBar label="准备度" value={job.readiness_score} target={job.abc_level === 'A' ? 88 : job.abc_level === 'B' ? 80 : 70} />
      <div className="tag-row">
        {job.risk_tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <div className="card-footer">
        <small>{job.next_action}</small>
        {onSelect ? (
          <IconButton icon={ArrowRight} variant={selected ? 'ghost' : 'secondary'} onClick={onSelect}>
            {selected ? '已选择' : '使用'}
          </IconButton>
        ) : null}
      </div>
    </article>
  )
}

export function VaultDocumentCard({ doc }: { doc: VaultDocument }) {
  const statuses = [
    ['已上传', doc.uploaded],
    ['待解析', doc.pending_parse],
    ['已解析', doc.parsed],
    ['已索引', doc.indexed],
    ['已用于训练', doc.used_in_generation],
    ['需要更新', doc.needs_update],
  ] as const
  return (
    <article className="vault-card">
      <div className="vault-icon">
        <Upload size={18} aria-hidden="true" />
      </div>
      <div>
        <p className="eyebrow">{doc.type}</p>
        <h3>{doc.title}</h3>
        <div className="status-grid">
          {statuses.map(([label, active]) => (
            <span key={label} className={active ? 'on' : ''}>
              {label}
            </span>
          ))}
        </div>
      </div>
    </article>
  )
}

export function AnswerPanel({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="answer-panel">
      <div className="answer-panel-title">
        <Mic size={17} aria-hidden="true" />
        <strong>{title}</strong>
      </div>
      {children}
    </div>
  )
}
