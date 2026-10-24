import { useState, useCallback, useEffect } from 'react'
import {
  Calendar, Plus, Clock, Trash2, X
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import './ServicePages.css'

const toUtc = (value) => (value ? new Date(value).toISOString() : null)
const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  } catch {
    return dateStr
  }
}

export default function SemestersPage() {
  const { request, account, isAdmin } = useAuth()
  const [semesters, setSemesters] = useState([])
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('all') // 'all' | 'active' | 'ended'
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    code: '',
    name: '',
    startDate: '',
    endDate: '',
    registrationDeadline: '',
    topicDeadline: '',
    mentorDeadline: ''
  })

  const load = useCallback(async () => {
    setBusy(true)
    try {
      const data = await request('/api/semesters?page=1&pageSize=50&sortBy=startDate&descending=true')
      setSemesters(data.items || [])
    } catch {
      toast.error('Không thể tải danh sách học kỳ.')
    } finally {
      setBusy(false)
    }
  }, [request])

  useEffect(() => {
    const id = setTimeout(load, 0)
    return () => clearTimeout(id)
  }, [load])

  const handleCreate = async (e) => {
    e.preventDefault()
    const milestones = [form.registrationDeadline, form.topicDeadline, form.mentorDeadline]
    const filledCount = milestones.filter(Boolean).length
    if (filledCount > 0 && filledCount < 3) {
      toast.error('Vui lòng điền đủ 3 mốc deadline hoặc để trống cả 3.')
      return
    }

    try {
      setBusy(true)
      await request('/api/semesters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          startDate: toUtc(form.startDate),
          endDate: toUtc(form.endDate),
          registrationDeadline: toUtc(form.registrationDeadline),
          topicDeadline: toUtc(form.topicDeadline),
          mentorDeadline: toUtc(form.mentorDeadline)
        })
      })
      toast.success(`Đã tạo học kỳ ${form.code} thành công.`)
      setForm({
        code: '',
        name: '',
        startDate: '',
        endDate: '',
        registrationDeadline: '',
        topicDeadline: '',
        mentorDeadline: ''
      })
      setShowModal(false)
      await load()
    } catch (err) {
      toast.error(err.message || 'Lỗi khi tạo học kỳ.')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (id, code) => {
    if (!window.confirm(`Xác nhận xóa học kỳ ${code}?`)) return
    try {
      await request(`/api/semesters/${id}`, { method: 'DELETE' })
      toast.success(`Đã xóa học kỳ ${code}`)
      await load()
    } catch {
      toast.error('Không thể xóa học kỳ này.')
    }
  }

  const now = new Date()
  const displayList = semesters
    .filter((s) => {
      if (account?.student?.semesterCode) {
        return s.code === account.student.semesterCode
      }
      return true
    })
    .filter((s) => {
      if (filter === 'active') return s.isActive
      if (filter === 'ended') return new Date(s.endDate) < now
      return true
    })

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAdmin ? 'Quản lý Học kỳ' : 'Lịch trình Học kỳ'}</h1>
          <p className="page-subtitle">
            {isAdmin
              ? 'Khởi tạo các mốc thời gian ghép nhóm, duyệt đề tài và phân công mentor cho học kỳ.'
              : 'Theo dõi các mốc quan trọng trong học kỳ Capstone của bạn.'}
          </p>
        </div>

        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} />
            <span>Tạo học kỳ mới</span>
          </button>
        )}
      </div>

      {/* ── Filter Tab Bar ── */}
      <div className="filter-tab-bar">
        <button
          className={`tab-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Tất cả ({semesters.length})
        </button>
        <button
          className={`tab-btn ${filter === 'active' ? 'active' : ''}`}
          onClick={() => setFilter('active')}
        >
          Đang diễn ra ({semesters.filter((s) => s.isActive).length})
        </button>
        <button
          className={`tab-btn ${filter === 'ended' ? 'active' : ''}`}
          onClick={() => setFilter('ended')}
        >
          Đã kết thúc ({semesters.filter((s) => new Date(s.endDate) < now).length})
        </button>
      </div>

      {/* ── Semester Cards Grid ── */}
      <div className="semesters-grid">
        {displayList.map((item) => {
          const isActive = item.isActive
          const isEnded = new Date(item.endDate) < now

          return (
            <div className="semester-clean-card" key={item.id}>
              <div className="semester-card-header">
                <div>
                  <span className="semester-code-tag">{item.code}</span>
                  <h2 className="semester-card-title">{item.name}</h2>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isActive ? (
                    <span className="badge badge-teal">Đang kích hoạt</span>
                  ) : isEnded ? (
                    <span className="badge badge-neutral">Đã kết thúc</span>
                  ) : (
                    <span className="badge badge-neutral">Sắp tới</span>
                  )}

                  {isAdmin && (
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ padding: 4, color: 'var(--text-muted)' }}
                      onClick={() => handleDelete(item.id, item.code)}
                      title="Xóa học kỳ"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>

              <div className="semester-dates-row">
                <Clock size={14} color="var(--text-muted)" />
                <span>{formatDate(item.startDate)} — {formatDate(item.endDate)}</span>
              </div>

              <div className="milestones-box">
                <div className="milestone-item">
                  <span>Hạn ghép nhóm:</span>
                  <strong>{formatDate(item.registrationDeadline)}</strong>
                </div>
                <div className="milestone-item">
                  <span>Hạn chốt đề tài:</span>
                  <strong>{formatDate(item.topicDeadline)}</strong>
                </div>
                <div className="milestone-item">
                  <span>Hạn ghép Mentor:</span>
                  <strong>{formatDate(item.mentorDeadline)}</strong>
                </div>
              </div>
            </div>
          )
        })}

        {!displayList.length && !busy && (
          <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 20px' }}>
            <Calendar size={36} color="var(--text-muted)" style={{ margin: '0 auto 10px' }} />
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Không tìm thấy học kỳ nào</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              {isAdmin ? 'Nhấn "Tạo học kỳ mới" để bắt đầu thiết lập mốc thời gian.' : 'Chưa có lịch trình được mở.'}
            </p>
          </div>
        )}
      </div>

      {/* ── Create Semester Modal ── */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)' }}>
                Tạo học kỳ mới
              </h2>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowModal(false)}
                style={{ padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label className="input-label">Mã học kỳ *</label>
                  <input
                    required
                    className="input"
                    placeholder="VD: FA26"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                  />
                </div>
                <div>
                  <label className="input-label">Tên học kỳ *</label>
                  <input
                    required
                    className="input"
                    placeholder="VD: Fall 2026 - Capstone Khởi nghiệp"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label className="input-label">Ngày bắt đầu *</label>
                  <input
                    required
                    type="datetime-local"
                    className="input"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="input-label">Ngày kết thúc *</label>
                  <input
                    required
                    type="datetime-local"
                    className="input"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: 14, marginBottom: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
                  CÁC MỐC HẠN CHÓT (TÙY CHỌN)
                </p>

                <div style={{ display: 'grid', gap: 10 }}>
                  <div>
                    <label className="input-label">Hạn chốt Đăng ký ghép nhóm</label>
                    <input
                      type="datetime-local"
                      className="input"
                      value={form.registrationDeadline}
                      onChange={(e) => setForm({ ...form, registrationDeadline: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="input-label">Hạn chốt Đề tài khởi nghiệp</label>
                    <input
                      type="datetime-local"
                      className="input"
                      value={form.topicDeadline}
                      onChange={(e) => setForm({ ...form, topicDeadline: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="input-label">Hạn chốt Ghép Mentor</label>
                    <input
                      type="datetime-local"
                      className="input"
                      value={form.mentorDeadline}
                      onChange={(e) => setForm({ ...form, mentorDeadline: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'Đang lưu...' : 'Lưu học kỳ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
