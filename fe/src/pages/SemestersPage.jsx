import { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  CalendarDays, Plus, Clock,
  Trash2, ChevronRight, Sparkles, Filter
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import './ServicePages.css'

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } }
}

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
  const [showCreateModal, setShowCreateModal] = useState(false)
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
    } catch (e) {
      toast.error(e.message || 'Không thể tải danh sách học kỳ.')
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
      toast.success(`Đã tạo học kỳ ${form.code} thành công!`)
      setForm({
        code: '',
        name: '',
        startDate: '',
        endDate: '',
        registrationDeadline: '',
        topicDeadline: '',
        mentorDeadline: ''
      })
      setShowCreateModal(false)
      await load()
    } catch (err) {
      toast.error(err.message || 'Lỗi khi tạo học kỳ.')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (id, code) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa học kỳ ${code}?`)) return
    try {
      await request(`/api/semesters/${id}`, { method: 'DELETE' })
      toast.success(`Đã xóa học kỳ ${code}`)
      await load()
    } catch (err) {
      toast.error(err.message || 'Không thể xóa học kỳ.')
    }
  }

  // Filter logic
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
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
    >
      {/* Header */}
      <motion.div className="section-heading" variants={fadeUp}>
        <div>
          <p className="eyebrow eyebrow-accent">SEMESTER TIMELINE</p>
          <h1>{isAdmin ? 'Quản lý Học kỳ' : 'Lịch trình Học kỳ'}</h1>
          <p>
            {isAdmin
              ? 'Khởi tạo và cấu hình các mốc thời gian cho toàn bộ kỳ học Capstone.'
              : 'Theo dõi các mốc quan trọng trong học kỳ của bạn.'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="count-chip">{displayList.length} học kỳ</span>
          {isAdmin && (
            <button
              className="btn btn-primary"
              onClick={() => setShowCreateModal(!showCreateModal)}
            >
              <Plus size={16} />
              <span>{showCreateModal ? 'Đóng form' : 'Thêm học kỳ'}</span>
            </button>
          )}
        </div>
      </motion.div>

      {/* Admin Form Collapsible/Modal */}
      {isAdmin && showCreateModal && (
        <motion.div
          className="glass-card semester-form"
          variants={fadeUp}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          style={{ marginBottom: 'var(--space-6)', overflow: 'hidden' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Sparkles size={20} className="gradient-text" />
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, margin: 0 }}>
              Tạo Học Kỳ Mới
            </h2>
          </div>

          <form onSubmit={handleCreate} className="product-form">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <div>
                <label className="input-label" style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary)' }}>
                  Mã học kỳ (Code) *
                </label>
                <input
                  required
                  className="input"
                  placeholder="Ví dụ: FA26, SP27"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>

              <div>
                <label className="input-label" style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary)' }}>
                  Tên học kỳ *
                </label>
                <input
                  required
                  className="input"
                  placeholder="Ví dụ: Fall 2026 - Khởi nghiệp"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div>
                <label className="input-label" style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary)' }}>
                  Thời gian bắt đầu *
                </label>
                <input
                  required
                  type="datetime-local"
                  className="input"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>

              <div>
                <label className="input-label" style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary)' }}>
                  Thời gian kết thúc *
                </label>
                <input
                  required
                  type="datetime-local"
                  className="input"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
            </div>

            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
              <p style={{ fontSize: 12, color: 'var(--accent-400)', fontWeight: 600, marginBottom: 12 }}>
                MỐC DEADLINE (TÙY CHỌN HOẶC ĐIỀN CẢ 3)
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary)' }}>
                    Hạn chót Đăng ký ghép nhóm
                  </label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={form.registrationDeadline}
                    onChange={(e) => setForm({ ...form, registrationDeadline: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary)' }}>
                    Hạn chót Chốt đề tài
                  </label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={form.topicDeadline}
                    onChange={(e) => setForm({ ...form, topicDeadline: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary)' }}>
                    Hạn chót Ghép Mentor
                  </label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={form.mentorDeadline}
                    onChange={(e) => setForm({ ...form, mentorDeadline: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowCreateModal(false)}
              >
                Hủy
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy}
              >
                {busy ? 'Đang lưu...' : 'Lưu học kỳ'} <ChevronRight size={16} />
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Filter Tabs */}
      <motion.div
        variants={fadeUp}
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 'var(--space-5)',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: 10
        }}
      >
        <button
          className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setFilter('all')}
        >
          <Filter size={14} style={{ marginRight: 6 }} />
          Tất cả ({semesters.length})
        </button>
        <button
          className={`btn btn-sm ${filter === 'active' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setFilter('active')}
        >
          Đang diễn ra ({semesters.filter((s) => s.isActive).length})
        </button>
        <button
          className={`btn btn-sm ${filter === 'ended' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setFilter('ended')}
        >
          Đã kết thúc ({semesters.filter((s) => new Date(s.endDate) < now).length})
        </button>
      </motion.div>

      {/* Semester Cards Grid */}
      <motion.div className="semester-cards" variants={fadeUp}>
        {displayList.map((item) => {
          const isActive = item.isActive
          const isEnded = new Date(item.endDate) < now
          return (
            <motion.article
              className="glass-card semester-card"
              key={item.id}
              whileHover={{ y: -4, borderColor: 'var(--border-strong)' }}
              transition={{ duration: 0.2 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      background: isActive
                        ? 'rgba(52, 211, 153, 0.12)'
                        : isEnded
                        ? 'rgba(148, 163, 184, 0.12)'
                        : 'rgba(139, 92, 246, 0.12)',
                      color: isActive
                        ? 'var(--success)'
                        : isEnded
                        ? 'var(--text-tertiary)'
                        : 'var(--accent-400)',
                      marginBottom: 8
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: 'currentColor'
                      }}
                    />
                    {isActive ? 'ĐANG KÍCH HOẠT' : isEnded ? 'ĐÃ KẾT THÚC' : 'SẮP TỚI'}
                  </span>
                  <p className="eyebrow" style={{ margin: '4px 0 2px' }}>
                    {item.code}
                  </p>
                  <h2>{item.name}</h2>
                </div>

                {isAdmin && (
                  <button
                    className="metric-more"
                    title="Xóa học kỳ"
                    onClick={() => handleDelete(item.id, item.code)}
                    style={{
                      color: 'var(--text-tertiary)',
                      transition: 'color var(--duration-fast)'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--error)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              <p style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 12, margin: '10px 0 16px' }}>
                <Clock size={14} color="var(--accent-400)" />
                {formatDate(item.startDate)} — {formatDate(item.endDate)}
              </p>

              <div className="mini-milestones">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Ghép nhóm:</span>
                  <strong style={{ color: 'var(--text-secondary)' }}>
                    {formatDate(item.registrationDeadline)}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Chốt đề tài:</span>
                  <strong style={{ color: 'var(--text-secondary)' }}>
                    {formatDate(item.topicDeadline)}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Ghép Mentor:</span>
                  <strong style={{ color: 'var(--text-secondary)' }}>
                    {formatDate(item.mentorDeadline)}
                  </strong>
                </div>
              </div>
            </motion.article>
          )
        })}

        {!displayList.length && !busy && (
          <div
            className="glass-card"
            style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              padding: 'var(--space-12) var(--space-6)'
            }}
          >
            <CalendarDays size={48} style={{ color: 'var(--accent-400)', opacity: 0.5, marginBottom: 12 }} />
            <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 6 }}>
              Không có học kỳ nào phù hợp
            </h3>
            <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
              {isAdmin ? 'Nhấn "Thêm học kỳ" để tạo học kỳ đầu tiên cho sinh viên.' : 'Chưa có lịch trình được công bố.'}
            </p>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
