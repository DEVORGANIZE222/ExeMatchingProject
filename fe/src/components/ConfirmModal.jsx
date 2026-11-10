import { AlertTriangle, X } from 'lucide-react'

export default function ConfirmModal({
  open,
  title = 'Xác nhận thao tác',
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  tone = 'primary', // 'primary' | 'danger' | 'warning'
  busy = false,
  onConfirm,
  onCancel
}) {
  if (!open) return null

  const confirmStyle = tone === 'danger'
    ? { backgroundColor: '#dc2626', color: '#fff', borderColor: '#dc2626' }
    : tone === 'warning'
      ? { backgroundColor: '#d97706', color: '#fff', borderColor: '#d97706' }
      : undefined

  return (
    <div
      className="modal-backdrop"
      style={{ zIndex: 1100 }}
      onClick={() => !busy && onCancel?.()}
    >
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 440 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-main)' }}>
            {tone === 'danger' || tone === 'warning' ? (
              <AlertTriangle size={18} color={tone === 'danger' ? '#dc2626' : '#d97706'} />
            ) : null}
            <span>{title}</span>
          </h2>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onCancel?.()}
            disabled={busy}
            style={{ padding: 4 }}
            aria-label="Đóng hộp thoại xác nhận"
          >
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 18 }}>
          {message}
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onCancel?.()}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={confirmStyle}
            onClick={() => onConfirm?.()}
            disabled={busy}
          >
            {busy ? 'Đang xử lý...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

