'use client'
import { DangerTriangleLinear as AlertTriangle } from '@solar-icons/react-perf'

interface AnomalyBadgeProps {
  count: number
  onClick?: () => void
}

export function AnomalyBadge({ count, onClick }: AnomalyBadgeProps) {
  if (count === 0) return null
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ background: '#FFF8E6', color: '#B45309', border: '1px solid #FDE68A' }}
    >
      <AlertTriangle size={10} />
      {count} anomaly{count > 1 ? 'ies' : ''}
    </button>
  )
}
