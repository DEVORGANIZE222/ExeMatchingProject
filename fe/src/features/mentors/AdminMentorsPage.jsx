import { useEffect, useState } from 'react'
import {
  GraduationCap, Users, Plus, Search,
  Sliders, CheckCircle2, Sparkles, X, Mail, Pencil, Trash2, Phone
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../hooks/useAuth'
import ConfirmModal from '../../components/ConfirmModal'
import './MentorPages.css'

const DEPARTMENT_OPTIONS = [
  'Khoa Công nghệ thông tin',
  'Viện Quản trị Kinh doanh',
  'Khoa Hệ thống thông tin',
  'Khoa Digital Marketing & Truyền thông',
  'Khoa Thiết kế mỹ thuật số',
  'Khoa An toàn thông tin',
  'Software Engineering'
]

export default function AdminMentorsPage() {
  const { request } = useAuth()
  const [mentorsList, setMentorsList] = useState([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all') // 'all' | 'available' | 'full'

  // Modal States
  const [selectedMentorForQuota, setSelectedMentorForQuota] = useState(null)
  const [newQuotaValue, setNewQuotaValue] = useState(4)

  const [editingMentor, setEditingMentor] = useState(null)
  const [editMentorForm, setEditMentorForm] = useState({
    fullName: '',
    department: 'Khoa Công nghệ thông tin',
    expertise: '',
    phone: '',
    maxQuota: 4
  })
  const [savingMentor, setSavingMentor] = useState(false)

  const [mentorToDelete, setMentorToDelete] = useState(null)
  const [deletingMentor, setDeletingMentor] = useState(false)

  const [showAddMentorModal, setShowAddMentorModal] = useState(false)
  const [newMentorForm, setNewMentorForm] = useState({
    fullName: '',
    email: '',
    department: 'Khoa Công nghệ thông tin',
    expertise: '',
    phone: '',
    maxQuota: 4
  })

  useEffect(() => {
    let active = true
    // Admin overview aggregates quota across every mentor, so load the largest page allowed.
    request('/api/mentors?pageSize=100')
      .then((mentors) => {
        if (active) setMentorsList(mentors.map((mentor) => ({ ...mentor, avatar: mentor.fullName.charAt(0).toUpperCase() })))
      })
      .catch((error) => toast.error(error.message || 'Không thể tải danh sách mentor.'))
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [request])

  // Summary Metrics
  const totalMentors = mentorsList.length
  const totalMaxQuota = mentorsList.reduce((acc, m) => acc + m.maxQuota, 0)
  const totalAssigned = mentorsList.reduce((acc, m) => acc + m.currentAssigned, 0)
  const totalRemaining = Math.max(0, totalMaxQuota - totalAssigned)
  const overallPercentage = totalMaxQuota > 0 ? Math.round((totalAssigned / totalMaxQuota) * 100) : 0

  const filteredMentors = mentorsList.filter((m) => {
    const isFull = m.currentAssigned >= m.maxQuota
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'available' && !isFull) ||
      (filterStatus === 'full' && isFull)

    const q = search.toLowerCase()
    const matchesSearch =
      m.fullName.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.department.toLowerCase().includes(q) ||
      m.expertise.toLowerCase().includes(q)

    return matchesStatus && matchesSearch
  })

  const handleOpenEditQuota = (mentor) => {
    setSelectedMentorForQuota(mentor)
    setNewQuotaValue(mentor.maxQuota)
  }

  const handleOpenEditMentor = (mentor) => {
    setEditingMentor(mentor)
    setEditMentorForm({
      fullName: mentor.fullName || '',
      department: mentor.department || 'Khoa Công nghệ thông tin',
      expertise: mentor.expertise || '',
      phone: mentor.phone || '',
      maxQuota: mentor.maxQuota || 4
    })
  }

  const handleSaveMentorInfo = async (e) => {
    e.preventDefault()
    if (!editingMentor) return
    if (!editMentorForm.fullName.trim()) {
      toast.error('Vui lòng nhập họ tên giảng viên.')
      return
    }

    setSavingMentor(true)
    try {
      const updatedMentor = await request(`/api/mentors/${editingMentor.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: editMentorForm.fullName.trim(),
          department: editMentorForm.department.trim(),
          expertise: editMentorForm.expertise.trim(),
          phone: editMentorForm.phone.trim(),
          maxQuota: Number(editMentorForm.maxQuota)
        })
      })
      setMentorsList((current) =>
        current.map((mentor) =>
          mentor.id === updatedMentor.id
            ? { ...updatedMentor, avatar: updatedMentor.fullName.charAt(0).toUpperCase() }
            : mentor
        )
      )
      toast.success(`Đã cập nhật thông tin giảng viên ${updatedMentor.fullName}.`)
      setEditingMentor(null)
    } catch (err) {
      toast.error(err.message || 'Không thể cập nhật thông tin giảng viên.')
    } finally {
      setSavingMentor(false)
    }
  }

  const handleRequestDeleteMentor = (mentor) => {
    if (mentor.currentAssigned > 0) {
      toast.error(`${mentor.fullName} đang hướng dẫn ${mentor.currentAssigned} nhóm nên chưa thể xóa.`)
      return
    }
    setMentorToDelete(mentor)
  }

  const handleConfirmDeleteMentor = async () => {
    if (!mentorToDelete) return
    setDeletingMentor(true)
    try {
      await request(`/api/mentors/${mentorToDelete.id}`, { method: 'DELETE' })
      setMentorsList((current) => current.filter((mentor) => mentor.id !== mentorToDelete.id))
      toast.success(`Đã xóa giảng viên ${mentorToDelete.fullName}.`)
      setMentorToDelete(null)
    } catch (err) {
      toast.error(err.message || 'Không thể xóa giảng viên.')
    } finally {
      setDeletingMentor(false)
    }
  }

  const handleSaveQuota = async (e) => {
    e.preventDefault()
    if (!selectedMentorForQuota) return

    try {
      const updatedMentor = await request(`/api/mentors/${selectedMentorForQuota.id}/quota`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxQuota: newQuotaValue })
      })
      setMentorsList((current) => current.map((mentor) => mentor.id === updatedMentor.id ? { ...updatedMentor, avatar: updatedMentor.fullName.charAt(0).toUpperCase() } : mentor))
      toast.success(`Đã cập nhật hạn ngạch của ${selectedMentorForQuota.fullName} thành ${newQuotaValue} nhóm.`)
      setSelectedMentorForQuota(null)
    } catch (err) {
      toast.error(err.message || 'Không thể cập nhật hạn ngạch.')
    }
  }

  const handleCreateMentor = async (e) => {
    e.preventDefault()
    if (!newMentorForm.fullName.trim() || !newMentorForm.email.trim()) {
      toast.error('Vui lòng điền đầy đủ họ tên và email.')
      return
    }

    try {
      const account = await request('/api/admin/mentors/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newMentorForm.email.trim() })
      })
      const mentor = await request('/api/mentors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: account.id,
          fullName: newMentorForm.fullName.trim(),
          email: account.email,
          department: newMentorForm.department.trim(),
          expertise: newMentorForm.expertise.trim(),
          phone: newMentorForm.phone.trim(),
          maxQuota: Number(newMentorForm.maxQuota)
        })
      })
      setMentorsList((current) => [{ ...mentor, avatar: mentor.fullName.charAt(0).toUpperCase() }, ...current])
      toast.success(`Đã kích hoạt ${mentor.email} làm mentor. Tài khoản cần đăng nhập lại.`)
      setShowAddMentorModal(false)
      setNewMentorForm({
        fullName: '',
        email: '',
        department: 'Khoa Công nghệ thông tin',
        expertise: '',
        phone: '',
        maxQuota: 4
      })
    } catch (err) {
      toast.error(err.message || 'Không thể thêm giảng viên.')
    }
  }

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Quản lý Giảng viên Mentor & Quota</h1>
          <p className="page-subtitle">
            Điều phối danh sách cố vấn khởi nghiệp, cấu hình hạn ngạch tối đa và giám sát tỷ lệ nhận nhóm trong học kỳ Khởi nghiệp EXE.
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setShowAddMentorModal(true)}>
          <Plus size={16} />
          <span>Thêm Mentor mới</span>
        </button>
      </div>

      {/* ── Overall Quota Metrics ── */}
      <div className="dashboard-metrics-grid" style={{ marginBottom: 24 }}>
        <div className="metric-card-clean">
          <div className="metric-icon-box" style={{ color: 'var(--primary)', backgroundColor: 'var(--primary-light)' }}>
            <GraduationCap size={20} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Tổng số Mentor</span>
            <span className="metric-number">{totalMentors} giảng viên</span>
            <span className="metric-subtext">Đã phân bổ cho học kỳ FA26</span>
          </div>
        </div>

        <div className="metric-card-clean">
          <div className="metric-icon-box" style={{ color: '#0F766E', backgroundColor: '#CCFBF1' }}>
            <Users size={20} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Tổng hạn ngạch (Max Quota)</span>
            <span className="metric-number">{totalMaxQuota} nhóm</span>
            <span className="metric-subtext">Hạn mức toàn trường</span>
          </div>
        </div>

        <div className="metric-card-clean">
          <div className="metric-icon-box" style={{ color: '#B26A00', backgroundColor: '#FEF3C7' }}>
            <CheckCircle2 size={20} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Đã được nhận</span>
            <span className="metric-number">{totalAssigned} nhóm</span>
            <span className="metric-subtext">{overallPercentage}% tỷ lệ lấp đầy</span>
          </div>
        </div>

        <div className="metric-card-clean">
          <div className="metric-icon-box" style={{ color: '#475569', backgroundColor: '#F1F5F9' }}>
            <Sparkles size={20} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Suất trống toàn trường</span>
            <span className="metric-number">{totalRemaining} suất</span>
            <span className="metric-subtext">Sẵn sàng ghép thêm nhóm</span>
          </div>
        </div>
      </div>

      {/* ── Filter & Search Toolbar ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
        <div className="proposal-filter-tabs" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
          <button
            type="button"
            className={`proposal-tab-btn ${filterStatus === 'all' ? 'active' : ''}`}
            onClick={() => setFilterStatus('all')}
          >
            <span>Tất cả ({mentorsList.length})</span>
          </button>

          <button
            type="button"
            className={`proposal-tab-btn ${filterStatus === 'available' ? 'active' : ''}`}
            onClick={() => setFilterStatus('available')}
          >
            <span>Còn nhận nhóm</span>
            <span className="badge badge-green" style={{ fontSize: 11, padding: '1px 6px' }}>
              {mentorsList.filter((m) => m.currentAssigned < m.maxQuota).length}
            </span>
          </button>

          <button
            type="button"
            className={`proposal-tab-btn ${filterStatus === 'full' ? 'active' : ''}`}
            onClick={() => setFilterStatus('full')}
          >
            <span>Đã đủ Quota</span>
            <span className="badge badge-neutral" style={{ fontSize: 11, padding: '1px 6px' }}>
              {mentorsList.filter((m) => m.currentAssigned >= m.maxQuota).length}
            </span>
          </button>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', width: 300 }}>
          <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input input-sm"
            placeholder="Tìm theo tên, email, chuyên môn..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 34, width: '100%' }}
          />
        </div>
      </div>

      {/* ── Mentors Cards Grid ── */}
      {filteredMentors.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-secondary)' }}>
          <GraduationCap size={40} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontWeight: 600, fontSize: 15 }}>Không tìm thấy giảng viên nào</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái.
          </p>
        </div>
      ) : (
        <div className="mentor-admin-grid">
          {filteredMentors.map((mentor) => {
            const isFull = mentor.currentAssigned >= mentor.maxQuota
            const percent = Math.min(100, Math.round((mentor.currentAssigned / mentor.maxQuota) * 100))
            const openSlots = Math.max(0, mentor.maxQuota - mentor.currentAssigned)

            return (
              <div key={mentor.id} className="mentor-admin-card">
                <div>
                  {/* Card Header */}
                  <div className="mentor-card-top">
                    <div className="mentor-avatar-box">
                      {mentor.avatar || mentor.fullName.charAt(0)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="mentor-info-name">{mentor.fullName}</div>
                      <div className="mentor-info-dept">{mentor.department}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <Mail size={12} />
                        <span>{mentor.email}</span>
                      </div>
                      {mentor.phone && (
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <Phone size={12} />
                          <span>{mentor.phone}</span>
                        </div>
                      )}
                    </div>
                    <span className={`badge ${isFull ? 'badge-neutral' : 'badge-green'}`} style={{ fontSize: 11 }}>
                      {isFull ? 'Đã đủ' : `Còn ${openSlots} suất`}
                    </span>
                  </div>

                  {/* Expertise Tags */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                      Chuyên môn cố vấn:
                    </div>
                    <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                      {mentor.expertise}
                    </p>
                  </div>

                  {/* Quota Progress Bar Widget */}
                  <div className="quota-mini-stat">
                    <div className="quota-mini-row">
                      <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Hạn ngạch nhận nhóm:</span>
                      <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                        <span style={{ color: isFull ? 'var(--text-secondary)' : 'var(--primary)' }}>
                          {mentor.currentAssigned}
                        </span> / {mentor.maxQuota} nhóm
                      </span>
                    </div>

                    <div className="quota-progress-track" style={{ height: 6 }}>
                      <div
                        className={`quota-progress-fill ${isFull ? 'full' : percent >= 75 ? 'amber' : 'green'}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                      <span>Tỷ lệ: {percent}%</span>
                      <span>Hạn mức tối đa: {mentor.maxQuota}</span>
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8, marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleOpenEditMentor(mentor)}
                  >
                    <Pencil size={13} />
                    <span>Cập nhật</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleOpenEditQuota(mentor)}
                  >
                    <Sliders size={13} />
                    <span>Quota</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => handleRequestDeleteMentor(mentor)}
                    title={mentor.currentAssigned > 0 ? 'Không thể xóa mentor đang hướng dẫn nhóm' : 'Xóa giảng viên'}
                    style={{
                      backgroundColor: '#fff1f2',
                      color: '#be123c',
                      border: '1px solid #fecdd3'
                    }}
                  >
                    <Trash2 size={13} />
                    <span>Xóa</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {loading && (
        <div className="card" role="status" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          Đang tải danh sách mentor...
        </div>
      )}

      {!loading && mentorsList.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          Chưa có mentor nào. Tài khoản cần đăng nhập Google ít nhất một lần trước khi Admin kích hoạt.
        </div>
      )}

      {/* ── Modal: Edit Quota ── */}
      {selectedMentorForQuota && (
        <div className="modal-backdrop" onClick={() => setSelectedMentorForQuota(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)' }}>
                Điều chỉnh Hạn ngạch Quota
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedMentorForQuota(null)} style={{ padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveQuota}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Giảng viên: <strong style={{ color: 'var(--text-main)' }}>{selectedMentorForQuota.fullName}</strong>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 16 }}>
                  Số nhóm đang hướng dẫn hiện tại: <strong>{selectedMentorForQuota.currentAssigned} nhóm</strong>
                </div>

                <label className="input-label">Hạn mức số nhóm tối đa (Max Quota) *</label>
                <input
                  type="number"
                  min={selectedMentorForQuota.currentAssigned || 1}
                  max={50}
                  className="input"
                  value={newQuotaValue}
                  onChange={(e) => setNewQuotaValue(parseInt(e.target.value, 10) || 1)}
                  required
                />
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  Hạn ngạch không được nhỏ hơn số nhóm đã nhận ({selectedMentorForQuota.currentAssigned} nhóm).
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedMentorForQuota(null)}>
                  Hủy bỏ
                </button>
                <button type="submit" className="btn btn-primary">
                  <CheckCircle2 size={16} />
                  <span>Lưu hạn ngạch</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Edit Mentor Info ── */}
      {editingMentor && (
        <div className="modal-backdrop" onClick={() => !savingMentor && setEditingMentor(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)' }}>
                Cập nhật thông tin Giảng viên
              </h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setEditingMentor(null)}
                disabled={savingMentor}
                style={{ padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveMentorInfo}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label className="input-label">Họ tên & Học hàm/Học vị *</label>
                  <input
                    required
                    className="input"
                    value={editMentorForm.fullName}
                    onChange={(e) => setEditMentorForm({ ...editMentorForm, fullName: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label className="input-label">Email đăng nhập</label>
                    <input
                      disabled
                      className="input"
                      value={editingMentor.email}
                      style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
                    />
                  </div>

                  <div>
                    <label className="input-label">Số điện thoại liên hệ</label>
                    <input
                      className="input"
                      placeholder="0912 xxx xxx"
                      value={editMentorForm.phone}
                      onChange={(e) => setEditMentorForm({ ...editMentorForm, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 10 }}>
                  <div>
                    <label className="input-label">Khoa / Bộ môn *</label>
                    <select
                      className="select"
                      value={editMentorForm.department}
                      onChange={(e) => setEditMentorForm({ ...editMentorForm, department: e.target.value })}
                    >
                      {editMentorForm.department && !DEPARTMENT_OPTIONS.includes(editMentorForm.department) && (
                        <option value={editMentorForm.department}>{editMentorForm.department}</option>
                      )}
                      {DEPARTMENT_OPTIONS.map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="input-label">Hạn ngạch Quota tối đa</label>
                    <input
                      type="number"
                      min={editingMentor.currentAssigned || 1}
                      max={50}
                      className="input"
                      value={editMentorForm.maxQuota}
                      onChange={(e) => setEditMentorForm({ ...editMentorForm, maxQuota: parseInt(e.target.value, 10) || 1 })}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="input-label">Chuyên môn & Lĩnh vực hướng dẫn *</label>
                  <textarea
                    required
                    className="textarea"
                    rows={2}
                    value={editMentorForm.expertise}
                    onChange={(e) => setEditMentorForm({ ...editMentorForm, expertise: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingMentor(null)}
                  disabled={savingMentor}
                >
                  Hủy bỏ
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingMentor}>
                  <CheckCircle2 size={16} />
                  <span>{savingMentor ? 'Đang lưu...' : 'Lưu thông tin'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Add New Mentor ── */}
      {showAddMentorModal && (
        <div className="modal-backdrop" onClick={() => setShowAddMentorModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)' }}>
                Thêm Giảng viên Mentor vào Học kỳ
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddMentorModal(false)} style={{ padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateMentor}>
              <div className="alert alert-warning" style={{ marginBottom: 14 }}>
                Tài khoản cần đăng nhập bằng Google và được whitelist trước. Sau khi kích hoạt, giảng viên đăng nhập lại để sử dụng không gian Mentor.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label className="input-label">Họ tên & Học hàm/Học vị *</label>
                  <input
                    required
                    className="input"
                    placeholder="VD: TS. Nguyễn Văn A hoặc ThS. Lê Thị B"
                    value={newMentorForm.fullName}
                    onChange={(e) => setNewMentorForm({ ...newMentorForm, fullName: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label className="input-label">Email FPT (@fpt.edu.vn) *</label>
                    <input
                      required
                      type="email"
                      className="input"
                      placeholder="email@fpt.edu.vn"
                      value={newMentorForm.email}
                      onChange={(e) => setNewMentorForm({ ...newMentorForm, email: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="input-label">Số điện thoại liên hệ</label>
                    <input
                      className="input"
                      placeholder="0912 xxx xxx"
                      value={newMentorForm.phone}
                      onChange={(e) => setNewMentorForm({ ...newMentorForm, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 10 }}>
                  <div>
                    <label className="input-label">Khoa / Bộ môn *</label>
                    <select
                      className="select"
                      value={newMentorForm.department}
                      onChange={(e) => setNewMentorForm({ ...newMentorForm, department: e.target.value })}
                    >
                      {DEPARTMENT_OPTIONS.map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="input-label">Hạn ngạch Quota ban đầu</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      className="input"
                      value={newMentorForm.maxQuota}
                      onChange={(e) => setNewMentorForm({ ...newMentorForm, maxQuota: parseInt(e.target.value, 10) || 4 })}
                    />
                  </div>
                </div>

                <div>
                  <label className="input-label">Chuyên môn & Lĩnh vực hướng dẫn *</label>
                  <textarea
                    required
                    className="textarea"
                    rows={2}
                    placeholder="VD: Trí tuệ nhân tạo, Big Data, Khởi nghiệp ứng dụng công nghệ, Xử lý ngôn ngữ tự nhiên..."
                    value={newMentorForm.expertise}
                    onChange={(e) => setNewMentorForm({ ...newMentorForm, expertise: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddMentorModal(false)}>
                  Hủy bỏ
                </button>
                <button type="submit" className="btn btn-primary">
                  <CheckCircle2 size={16} />
                  <span>Xác nhận thêm Mentor</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirm Delete Mentor ── */}
      <ConfirmModal
        open={Boolean(mentorToDelete)}
        title="Xác nhận xóa giảng viên"
        message={
          mentorToDelete
            ? `Bạn có chắc chắn muốn xóa hồ sơ mentor "${mentorToDelete.fullName}" (${mentorToDelete.email})? Thao tác này sẽ xóa hồ sơ mentor, hạn ngạch và dữ liệu liên quan trong không gian mentor.`
            : ''
        }
        confirmLabel="Xóa giảng viên"
        cancelLabel="Hủy bỏ"
        tone="danger"
        busy={deletingMentor}
        onConfirm={handleConfirmDeleteMentor}
        onCancel={() => setMentorToDelete(null)}
      />
    </div>
  )
}
