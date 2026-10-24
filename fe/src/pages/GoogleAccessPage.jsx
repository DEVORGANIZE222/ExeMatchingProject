import { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  KeyRound, Upload, Search, Trash2,
  FileSpreadsheet, ShieldAlert, ArrowRight, ShieldCheck
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import './ServicePages.css'

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } }
}

export default function GoogleAccessPage() {
  const { request, token, isAdmin } = useAuth()
  const [items, setItems] = useState([])
  const [file, setFile] = useState(null)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const load = useCallback(async () => {
    if (!token || !isAdmin) return
    setBusy(true)
    try {
      const data = await request('/api/google-access')
      setItems(data || [])
    } catch (err) {
      toast.error(err.message || 'Không thể tải danh sách email Google.')
    } finally {
      setBusy(false)
    }
  }, [isAdmin, request, token])

  useEffect(() => {
    const id = setTimeout(load, 0)
    return () => clearTimeout(id)
  }, [load])

  const handleUpload = async (e) => {
    e?.preventDefault()
    if (!file) {
      toast.error('Chọn tệp .xlsx có cột Email trước khi tải lên.')
      return
    }

    setBusy(true)
    try {
      const form = new FormData()
      form.append('file', file)

      const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
      const response = await fetch(`${apiBase}/api/google-access/import/excel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.message || 'Import không thành công.')

      setFile(null)
      toast.success(
        `Đã thêm ${body.data?.importedCount || 0} email mới (${body.data?.existingCount || 0} email đã tồn tại).`
      )
      await load()
    } catch (err) {
      toast.error(err.message || 'Lỗi khi import file Excel.')
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async (id, email) => {
    if (!window.confirm(`Gỡ quyền đăng nhập Google cho tài khoản "${email}"?`)) return
    try {
      await request(`/api/google-access/${id}`, { method: 'DELETE' })
      toast.success(`Đã xóa ${email} khỏi whitelist.`)
      await load()
    } catch (err) {
      toast.error(err.message || 'Không thể gỡ email. Vui lòng thử lại.')
    }
  }

  const filteredItems = items.filter((item) =>
    item.email?.toLowerCase().includes(search.toLowerCase())
  )

  if (!isAdmin) {
    return (
      <div className="glass-card login-required">
        <ShieldAlert size={48} style={{ color: 'var(--accent-400)', margin: '0 auto 16px' }} />
        <h2>Quyền hạn không đủ</h2>
        <p>Chỉ tài khoản Quản trị viên (Admin) mới có quyền truy cập và quản lý Google Access Whitelist.</p>
      </div>
    )
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
    >
      {/* Intro Header */}
      <motion.div className="access-intro" variants={fadeUp}>
        <div className="access-icon">
          <KeyRound size={28} />
        </div>
        <div>
          <p className="eyebrow eyebrow-accent">BẢO MẬT & XÁC THỰC</p>
          <h1>Google Access Whitelist</h1>
          <p>
            Chỉ những email FPT University nằm trong danh sách này mới có thể đăng nhập Google vào hệ thống.
          </p>
        </div>
      </motion.div>

      {/* Grid: Upload & Allowed List */}
      <motion.div className="access-grid" variants={fadeUp}>
        {/* Step 1: Upload */}
        <article className="glass-card upload-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                background: 'rgba(139, 92, 246, 0.15)',
                color: 'var(--accent-400)',
                fontSize: 11,
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              BƯỚC 1
            </span>
            <p className="eyebrow" style={{ margin: 0 }}>
              IMPORT WHITELIST
            </p>
          </div>
          <h2>Thêm email từ Excel</h2>
          <p>
            Tải lên file danh sách sinh viên hoặc giảng viên. Hệ thống tự động nhận diện cột{' '}
            <code>Email</code> hoặc <code>Gmail</code> (tối đa 2.000 email/lần).
          </p>

          <label
            className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0])
            }}
            style={{
              borderColor: dragOver ? 'var(--accent-400)' : file ? 'var(--accent-500)' : undefined,
              background: dragOver ? 'rgba(139, 92, 246, 0.08)' : undefined
            }}
          >
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file ? (
              <FileSpreadsheet size={32} style={{ color: 'var(--accent-400)' }} />
            ) : (
              <Upload size={28} />
            )}
            <strong>{file ? file.name : 'Chọn tệp danh sách Excel (.xlsx)'}</strong>
            <span>
              {file
                ? `${(file.size / 1024).toFixed(1)} KB · Sẵn sàng tải lên`
                : 'Kéo thả file vào đây hoặc bấm để duyệt từ máy tính'}
            </span>
          </label>

          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            {file && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setFile(null)}
              >
                Hủy chọn
              </button>
            )}
            <button
              className="btn btn-primary"
              disabled={busy || !file}
              onClick={handleUpload}
              style={{ flex: 1 }}
            >
              {busy ? 'Đang xử lý import...' : 'Tiến hành Import Email'} <ArrowRight size={16} />
            </button>
          </div>
        </article>

        {/* Step 2: Allowed list */}
        <article className="glass-card allowed-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    background: 'rgba(52, 211, 153, 0.15)',
                    color: 'var(--success)',
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)'
                  }}
                >
                  BƯỚC 2
                </span>
                <p className="eyebrow" style={{ margin: 0 }}>
                  KIỂM TRA DANH SÁCH
                </p>
              </div>
              <h2>Email Được Phép Truy Cập</h2>
            </div>
            <span className="count-chip">{items.length} email</span>
          </div>

          {/* Search filter */}
          <div style={{ position: 'relative', marginTop: 14, marginBottom: 8 }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-tertiary)'
              }}
            />
            <input
              type="text"
              className="input input-sm"
              placeholder="Tìm kiếm email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 34 }}
            />
          </div>

          <div className="allowed-list">
            {filteredItems.map((item) => (
              <div className="allowed-row" key={item.id}>
                <span className="email-dot" />
                <span title={item.email}>{item.email}</span>
                <button
                  title={`Gỡ ${item.email}`}
                  aria-label={`Gỡ ${item.email}`}
                  onClick={() => handleRemove(item.id, item.email)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}

            {!filteredItems.length && (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-tertiary)' }}>
                {search ? (
                  <p>Không tìm thấy email khớp với "{search}"</p>
                ) : (
                  <>
                    <ShieldCheck size={36} style={{ color: 'var(--accent-400)', opacity: 0.4, margin: '0 auto 8px' }} />
                    <p>Chưa có email nào trong danh sách whitelist.</p>
                  </>
                )}
              </div>
            )}
          </div>
        </article>
      </motion.div>
    </motion.div>
  )
}
