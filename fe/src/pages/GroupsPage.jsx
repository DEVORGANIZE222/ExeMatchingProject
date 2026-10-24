import { useState } from 'react'
import {
  Layers, Users, Plus, Search,
  CheckCircle2, X
} from 'lucide-react'
import toast from 'react-hot-toast'
import './ServicePages.css'

const initialGroups = [
  {
    id: 'grp-1',
    name: 'ExeMatching DevCore',
    topic: 'Nền tảng ghép nhóm sinh viên Khởi nghiệp EXE thông minh tích hợp đề xuất thuật toán',
    leader: 'Nguyễn Trần Quang Duy',
    members: [
      { name: 'Nguyễn Trần Quang Duy', role: 'Trưởng nhóm / Backend', major: 'SE' },
      { name: 'Phan Minh Tuấn', role: 'Frontend React', major: 'SE' },
      { name: 'Trần Bảo Ngọc', role: 'Machine Learning', major: 'AI' },
      { name: 'Lê Hoàng Nam', role: 'DevOps & Cloud', major: 'SE' }
    ],
    maxMembers: 5,
    statusText: 'Cần thêm 1 thành viên (UI/UX)',
    statusType: 'recruiting',
    mentor: 'TS. Hoàng Văn Thông'
  },
  {
    id: 'grp-2',
    name: 'FinFlow - FinTech Startup',
    topic: 'Ứng dụng quản lý tài chính doanh nghiệp vừa và nhỏ tích hợp Open Banking',
    leader: 'Lê Thảo Vy',
    members: [
      { name: 'Lê Thảo Vy', role: 'Trưởng nhóm / Product Owner', major: 'IB' },
      { name: 'Đặng Quốc Huy', role: 'Fullstack Engineer', major: 'SE' },
      { name: 'Vũ Đức Trí', role: 'Bảo mật & Smart Contract', major: 'IA' },
      { name: 'Nguyễn Mai Anh', role: 'Marketing & Tăng trưởng', major: 'MKT' },
      { name: 'Phạm Hồng Sơn', role: 'Mobile Flutter Dev', major: 'SE' }
    ],
    maxMembers: 5,
    statusText: 'Đã đủ thành viên',
    statusType: 'full',
    mentor: 'ThS. Nguyễn Quỳnh Nga'
  },
  {
    id: 'grp-3',
    name: 'MediSync AI Health',
    topic: 'Hệ thống gợi ý chẩn đoán sơ bộ qua hình ảnh y tế và hỗ trợ đặt lịch khám',
    leader: 'Bùi Gia Huy',
    members: [
      { name: 'Bùi Gia Huy', role: 'Trưởng nhóm / Data Scientist', major: 'AI' },
      { name: 'Trần Văn Mạnh', role: 'Backend Spring Boot', major: 'SE' },
      { name: 'Nguyễn Thu Trang', role: 'Business Analyst', major: 'IB' }
    ],
    maxMembers: 5,
    statusText: 'Cần thêm 2 thành viên (Frontend & AI)',
    statusType: 'recruiting',
    mentor: 'Đang liên hệ Mentor'
  }
]

export default function GroupsPage() {
  const [groups, setGroups] = useState(initialGroups)
  const [filter, setFilter] = useState('all') // 'all' | 'recruiting' | 'full'
  const [search, setSearch] = useState('')
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupTopic, setNewGroupTopic] = useState('')

  const handleCreateGroup = (e) => {
    e.preventDefault()
    if (!newGroupName.trim()) return

    const newGroup = {
      id: 'grp-' + Date.now(),
      name: newGroupName.trim(),
      topic: newGroupTopic.trim(),
      leader: 'Bạn (Trưởng nhóm)',
      members: [{ name: 'Bạn', role: 'Trưởng nhóm', major: 'SE' }],
      maxMembers: 5,
      statusText: 'Cần thêm 4 thành viên',
      statusType: 'recruiting',
      mentor: 'Chưa phân công'
    }

    setGroups([newGroup, ...groups])
    toast.success(`Đã khởi tạo nhóm "${newGroupName}".`)
    setShowCreateModal(false)
    setNewGroupName('')
    setNewGroupTopic('')
  }

  const filteredGroups = groups.filter((g) => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'recruiting' && g.statusType === 'recruiting') ||
      (filter === 'full' && g.statusType === 'full')

    const q = search.toLowerCase()
    const matchesSearch =
      g.name.toLowerCase().includes(q) ||
      g.topic.toLowerCase().includes(q) ||
      g.leader.toLowerCase().includes(q)

    return matchesFilter && matchesSearch
  })

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Nhóm & Đề tài Khởi nghiệp</h1>
          <p className="page-subtitle">
            Khám phá danh sách các nhóm Khởi nghiệp, tìm đồng đội bù trừ kỹ năng hoặc đăng ký đề tài mới.
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={16} />
          <span>Tạo nhóm mới</span>
        </button>
      </div>

      {/* ── Search & Filter Tabs ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 'var(--space-6)' }}>
        <div className="filter-tab-bar" style={{ margin: 0 }}>
          <button
            className={`tab-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Tất cả ({groups.length})
          </button>
          <button
            className={`tab-btn ${filter === 'recruiting' ? 'active' : ''}`}
            onClick={() => setFilter('recruiting')}
          >
            Đang tìm thành viên ({groups.filter((g) => g.statusType === 'recruiting').length})
          </button>
          <button
            className={`tab-btn ${filter === 'full' ? 'active' : ''}`}
            onClick={() => setFilter('full')}
          >
            Đã đủ người ({groups.filter((g) => g.statusType === 'full').length})
          </button>
        </div>

        <div style={{ position: 'relative', minWidth: 260 }}>
          <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            className="input input-sm"
            placeholder="Tìm theo tên nhóm, đề tài..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 34 }}
          />
        </div>
      </div>

      {/* ── Group Cards Grid ── */}
      <div className="groups-grid">
        {filteredGroups.map((group) => {
          const isFull = group.statusType === 'full'

          return (
            <div className="group-clean-card" key={group.id}>
              <div className="group-status-header">
                {isFull ? (
                  <span className="badge badge-teal">
                    <CheckCircle2 size={13} /> {group.statusText}
                  </span>
                ) : (
                  <span className="badge badge-warning">
                    <Users size={13} /> {group.statusText}
                  </span>
                )}
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {group.members.length}/{group.maxMembers} thành viên
                </span>
              </div>

              <h2 className="group-title">{group.name}</h2>
              <p className="group-topic">{group.topic}</p>

              {/* Members List */}
              <div className="group-members-list">
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginRight: 2 }}>Đội ngũ:</span>
                {group.members.slice(0, 4).map((m, idx) => (
                  <span key={idx} className="member-avatar-pill" title={`${m.name} (${m.role})`}>
                    <span className="avatar avatar-sm avatar-primary" style={{ width: 20, height: 20, fontSize: 10 }}>
                      {m.name.charAt(0)}
                    </span>
                    <strong>{m.major}</strong>
                  </span>
                ))}
                {group.members.length > 4 && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{group.members.length - 4}</span>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
                <span>Trưởng nhóm: <strong style={{ color: 'var(--text-main)' }}>{group.leader}</strong></span>
                <span>Mentor: <strong style={{ color: 'var(--primary)' }}>{group.mentor}</strong></span>
              </div>

              {/* Action Buttons: Outlined for View Details, Primary Green for Join */}
              <div className="group-actions-footer">
                <button
                  className="btn btn-outline btn-sm"
                  style={{ flex: 1 }}
                  onClick={() => setSelectedGroup(group)}
                >
                  Xem chi tiết
                </button>

                {!isFull && (
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => toast.success(`Đã gửi yêu cầu xin gia nhập nhóm "${group.name}".`)}
                  >
                    Xin gia nhập
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {!filteredGroups.length && (
          <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 20px' }}>
            <Layers size={36} color="var(--text-muted)" style={{ margin: '0 auto 10px' }} />
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Không tìm thấy nhóm phù hợp</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              Bạn có thể tạo nhóm mới hoặc điều chỉnh bộ lọc tìm kiếm.
            </p>
          </div>
        )}
      </div>

      {/* ── Detail Modal ── */}
      {selectedGroup && (
        <div className="modal-backdrop" onClick={() => setSelectedGroup(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <span className="badge badge-green" style={{ marginBottom: 6 }}>Chi tiết nhóm</span>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  {selectedGroup.name}
                </h2>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedGroup(null)} style={{ padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
              {selectedGroup.topic}
            </p>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                <span>Thành viên hiện tại</span>
                <span>{selectedGroup.members.length} / {selectedGroup.maxMembers}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedGroup.members.map((m, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-subtle)',
                      borderRadius: 'var(--radius-sm)'
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: 13, color: 'var(--text-main)' }}>{m.name}</strong>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>{m.role}</span>
                    </div>
                    <span className="badge badge-neutral" style={{ fontSize: 11 }}>{m.major}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: 12, marginBottom: 16, fontSize: 13 }}>
              <span>Giảng viên hướng dẫn: </span>
              <strong style={{ color: 'var(--primary)' }}>{selectedGroup.mentor}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedGroup(null)}>
                Đóng
              </button>
              {selectedGroup.statusType === 'recruiting' && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    toast.success(`Đã gửi yêu cầu gia nhập ${selectedGroup.name}!`)
                    setSelectedGroup(null)
                  }}
                >
                  Gửi yêu cầu xin gia nhập
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Create Team Modal ── */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)' }}>
                Tạo nhóm Khởi nghiệp mới
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreateModal(false)} style={{ padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateGroup}>
              <div style={{ marginBottom: 14 }}>
                <label className="input-label">Tên nhóm / Tên dự án *</label>
                <input
                  required
                  className="input"
                  placeholder="Ví dụ: AI HealthTech Core"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label className="input-label">Mô tả tóm tắt đề tài khởi nghiệp *</label>
                <textarea
                  required
                  rows={3}
                  className="textarea"
                  placeholder="Nêu ngắn gọn bài toán giải quyết, đối tượng khách hàng và công nghệ cốt lõi..."
                  value={newGroupTopic}
                  onChange={(e) => setNewGroupTopic(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  Tạo nhóm & Mở tuyển
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
