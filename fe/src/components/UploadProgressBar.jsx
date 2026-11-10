import { CheckCircle2, AlertCircle } from 'lucide-react'

export default function UploadProgressBar({ progress }) {
  if (!progress) return null

  const { phase, percent = 0, label = '', detail = '' } = progress
  const isDone = phase === 'done'
  const isError = phase === 'error'
  const isProcessing = phase === 'processing'

  const trackColor = isError ? '#fee2e2' : '#e2e8f0'
  const barColor = isError ? '#dc2626' : isProcessing ? '#0284c7' : '#15803d'
  const boxBg = isError ? '#fef2f2' : isDone ? '#f0fdf4' : '#f8fafc'
  const boxBorder = isError ? '#fecaca' : isDone ? '#bbf7d0' : '#cbd5e1'

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        marginTop: 12,
        padding: '10px 12px',
        borderRadius: 8,
        backgroundColor: boxBg,
        border: `1px solid ${boxBorder}`
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: isError ? '#b91c1c' : isDone ? '#15803d' : 'var(--text-main)' }}>
          {isDone && <CheckCircle2 size={14} color="#15803d" />}
          {isError && <AlertCircle size={14} color="#dc2626" />}
          <span>{label}</span>
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: barColor }}>
          {isError ? 'Lỗi' : `${Math.round(percent)}%`}
        </span>
      </div>

      <div style={{ width: '100%', height: 8, backgroundColor: trackColor, borderRadius: 999, overflow: 'hidden' }}>
        <div
          style={{
            width: `${Math.max(0, Math.min(100, percent))}%`,
            height: '100%',
            backgroundColor: barColor,
            borderRadius: 999,
            transition: 'width 200ms ease, background-color 200ms ease'
          }}
        />
      </div>

      {detail && (
        <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--text-secondary)' }}>
          {detail}
        </div>
      )}
    </div>
  )
}

