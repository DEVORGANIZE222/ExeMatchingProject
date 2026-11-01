import { useState } from 'react'
import {
  GraduationCap, Users, Plus, Search,
  Sliders, CheckCircle2, Sparkles, X, Mail
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../hooks/useAuth'
import './MentorPages.css'

export default function AdminMentorsPage() {
  const { mentorsList, updateMentorQuota, addMentor } = useAuth()

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all') // 'all' | 'available' | 'full'

  // Modal States
  const [selectedMentorForQuota, setSelectedMentorForQuota] = useState(null)
  const [newQuotaValue, setNewQuotaValue] = useState(4)

  const [showAddMentorModal, setShowAddMentorModal] = useState(false)
  const [newMentorForm, setNewMentorForm] = useState({
    fullName: '',
    email: '',
    department: 'Khoa Công nghệ thông tin',
    expertise: '',
    phone: '',
    maxQuota: 4
  })

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

  const handleSaveQuota = (e) => {
    e.preventDefault()
    if (!selectedMentorForQuota) return

    try {
      updateMentorQuota(selectedMentorForQuota.id, newQuotaValue)
      toast.success(`Đã cập nhật hạn ngạch của ${selectedMentorForQuota.fullName} thành ${newQuotaValue} nhóm.`)
      setSelectedMentorForQuota(null)
    } catch (err) {
      toast.error(err.message || 'Không thể cập nhật hạn ngạch.')
    }
  }

  const handleCreateMentor = (e) => {
    e.preventDefault()
    if (!newMentorForm.fullName.trim() || !newMentorForm.email.trim()) {
      toast.error('Vui lòng điền đầy đủ họ tên và email.')
      return
    }

    try {
      addMentor(newMentorForm)
      toast.success(`Đã thêm giảng viên "${newMentorForm.fullName}" vào danh sách học kỳ!`)
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
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleOpenEditQuota(mentor)}
                  >
                    <Sliders size={13} />
                    <span>Điều chỉnh Quota</span>
                  </button>
                </div>
              </div>
            )
          })}
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
                  max={10}
                  className="input"
                  value={newQuotaValue}
                  onChange={(e) => setNewQuotaValue(parseInt(e.target.value, 10))}
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
                      <option value="Khoa Công nghệ thông tin">Khoa Công nghệ thông tin</option>
                      <option value="Viện Quản trị Kinh doanh">Viện Quản trị Kinh doanh</option>
                      <option value="Khoa Hệ thống thông tin">Khoa Hệ thống thông tin</option>
                      <option value="Khoa Digital Marketing & Truyền thông">Khoa Digital Marketing & Truyền thông</option>
                      <option value="Khoa Thiết kế mỹ thuật số">Khoa Thiết kế mỹ thuật số</option>
                      <option value="Khoa An toàn thông tin">Khoa An toàn thông tin</option>
                    </select>
                  </div>

                  <div>
                    <label className="input-label">Hạn ngạch Quota ban đầu</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
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
    </div>
  )
}
