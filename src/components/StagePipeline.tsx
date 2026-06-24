import type { StageWithDept } from '../lib/types'
import { stagePhase, type StagePhase } from '../lib/status'

function Marker({ phase }: { phase: StagePhase }) {
  const base = 'flex h-6 w-6 items-center justify-center rounded-full border text-[11px]'
  if (phase === 'done') {
    return (
      <span className={`${base} border-green-500 bg-green-500/20 text-green-400`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-3.5 w-3.5">
          <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    )
  }
  if (phase === 'current') {
    return <span className={`${base} border-amber-500 bg-amber-500/20`}><span className="h-2 w-2 rounded-full bg-amber-400" /></span>
  }
  if (phase === 'rejected') {
    return (
      <span className={`${base} border-red-500 bg-red-500/20 text-red-400`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-3 w-3">
          <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
        </svg>
      </span>
    )
  }
  return <span className={`${base} border-slate-600 bg-slate-800`}><span className="h-1.5 w-1.5 rounded-full bg-slate-600" /></span>
}

export function StagePipeline({ stages }: { stages: StageWithDept[] }) {
  const sorted = [...stages].sort((a, b) => a.sequence - b.sequence)
  return (
    <div className="flex items-start gap-1 overflow-x-auto pb-1">
      {sorted.map((stage, i) => (
        <div key={stage.id} className="flex shrink-0 items-start">
          {i > 0 && <span className="mt-3 h-px w-4 bg-slate-700 sm:w-6" />}
          <div className="flex w-16 flex-col items-center gap-1">
            <Marker phase={stagePhase(stage.status)} />
            <span className="line-clamp-2 text-center text-[10px] leading-tight text-slate-400">
              {stage.department?.name}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
