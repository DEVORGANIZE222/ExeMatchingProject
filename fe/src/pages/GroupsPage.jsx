import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Layers, Users, Sparkles, CheckCircle2, UserPlus,
  Clock, ArrowRight, UserCheck, Flame, Search
} from 'lucide-react'
import toast from 'react-hot-toast'
import './ServicePages.css'

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } }
}

const mockGroups = [
  {
    id: 'grp-1',
    name: 'ExeMatching DevCore',
    topic: 'Nền tảng ghép nhóm sinh viên Capstone thông minh với AI',
    leader: 'Nguyễn Trần Quang Duy',
    members: [
      { name: 'Nguyễn Trần Quang Duy', role: 'Leader / Backend .NET', major: 'SE' },
      { name: 'Phan Minh Tuấn', role: 'Frontend React UI', major: 'SE' },
      { name: 'Trần Bảo Ngọc', role: 'AI / Algorithm', major: 'AI' },
      { name: 'Lê Hoàng Nam', role: 'DevOps & Cloud', major: 'SE' }
    ],
    maxMembers: 5,
    status: 'Đang tuyển 1 UI/UX / BA',
    statusType: 'recruiting',
    mentor: 'TS. Hoàng Văn Thông'
  },
  {
    id: 'grp-2',
    name: 'FinFlow - FinTech Startup',
    topic: 'Ứng dụng quản lý tài chính doanh nghiệp vừa và nhỏ tích hợp Open Banking',
    leader: 'Lê Thảo Vy',
    members: [
      { name: 'Lê Thảo Vy', role: 'Leader / Product Owner', major: 'IB' },
      { name: 'Đặng Quốc Huy', role: 'Fullstack Engineer', major: 'SE' },
      { name: 'Vũ Đức Trí', role: 'Security & Smart Contract', major: 'IA' },
      { name: 'Nguyễn Mai Anh', role: 'Marketing & Growth', major: 'MKT' },
      { name: 'Phạm Hồng Sơn', role: 'Mobile Flutter Dev', major: 'SE' }
    ],
    maxMembers: 5,
    status: 'Đã đủ thành viên',
    statusType: 'full',
    mentor: 'ThS. Nguyễn Quỳnh Nga'
  },
  {
    id: 'grp-3',
    name: 'MediSync AI Health',
    topic: 'Hệ thống gợi ý chẩn đoán hình ảnh sơ bộ và đặt lịch khám thông minh',
    leader: 'Bùi Gia Huy',
    members: [
      { name: 'Bùi Gia Huy', role: 'Leader / ML Engineer', major: 'AI' },
      { name: 'Trần Văn Mạnh', role: 'Backend Spring Boot', major: 'SE' },
      { name: 'Nguyễn Thu Trang', role: 'Business Analyst', major: 'IB' }
    ],
    maxMembers: 5,
    status: 'Đang tuyển 2 thành viên Frontend & AI',
    statusType: 'recruiting',
    mentor: 'Đang gửi yêu cầu'
  }
]

export default function GroupsPage() {
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'recruiting' | 'full'
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupTopic, setNewGroupTopic] = useState('')

  const handleCreateGroup = (e) => {
    e.preventDefault()
    if (!newGroupName.trim()) return
    toast.success(`Đã gửi đề xuất tạo nhóm "${newGroupName}". Đang cập nhật trạng thái...`)
    setShowCreateModal(false)
    setNewGroupName('')
    setNewGroupTopic('')
  }

  const filteredGroups = mockGroups.filter((g) => {
    const matchesTab =
      activeTab === 'all' ||
      (activeTab === 'recruiting' && g.statusType === 'recruiting') ||
      (activeTab === 'full' && g.statusType === 'full')
    const matchesSearch =
      g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.topic.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesTab && matchesSearch
  })

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
    >
      {/* Page Heading */}
      <motion.div className="section-heading" variants={fadeUp}>
        <div>
          <p className="eyebrow eyebrow-accent">CAPSTONE TEAM FORMATION</p>
          <h1>Nhóm & Ghép Đội Tự Động</h1>
          <p>
            Tìm kiếm đồng đội phù hợp theo chuyên ngành và kỹ năng, hoặc để thuật toán matching kết nối bạn với nhóm tối ưu.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-secondary"
            onClick={() => toast('Tính năng ghép nhóm ngẫu nhiên (Random Matching) sẽ mở khi hết hạn ghép tự do.')}
          >
            <Sparkles size={16} />
            <span>Random Matching</span>
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <UserPlus size={16} />
            <span>Tạo Nhóm Mới</span>
          </button>
        </div>
      </motion.div>

      {/* Stats banner */}
      <motion.section
        variants={fadeUp}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)'
        }}
      >
        {[
          { label: 'Tổng nhóm đã hình thành', val: '72', icon: Layers, tone: 'purple' },
          { label: 'Sinh viên đã có nhóm', val: '176 / 200', icon: UserCheck, tone: 'green' },
          { label: 'Đang tìm thành viên', val: '18 nhóm', icon: Flame, tone: 'amber' },
          { label: 'Thời gian ghép tự do', val: 'Còn 4 ngày', icon: Clock, tone: 'cyan' },
        ].map((item, idx) => (
          <div key={idx} className="metric-card">
            <div className={`metric-icon ${item.tone}`}>
              <item.icon size={18} />
            </div>
            <div>
              <span className="metric-value">{item.val}</span>
              <span className="metric-label">{item.label}</span>
            </div>
          </div>
        ))}
      </motion.section>

      {/* Search & Filter Bar */}
      <motion.div
        variants={fadeUp}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          marginBottom: 'var(--space-5)'
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`btn btn-sm ${activeTab === 'all' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('all')}
          >
            Tất cả ({mockGroups.length})
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'recruiting' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('recruiting')}
          >
            Đang tuyển thành viên
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'full' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('full')}
          >
            Đã đủ người
          </button>
        </div>

        <div style={{ position: 'relative', minWidth: 260 }}>
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
            placeholder="Tìm theo tên nhóm, đề tài..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: 34 }}
          />
        </div>
      </motion.div>

      {/* Group List Grid */}
      <motion.div
        variants={fadeUp}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 'var(--space-5)'
        }}
      >
        {filteredGroups.map((group) => {
          const isFull = group.statusType === 'full'
          return (
            <motion.article
              key={group.id}
              className="glass-card"
              whileHover={{ y: -4, borderColor: 'var(--border-strong)' }}
              transition={{ duration: 0.2 }}
              style={{ display: 'flex', flexDirection: 'column' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-full)',
                    background: isFull ? 'rgba(148, 163, 184, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                    color: isFull ? 'var(--text-tertiary)' : 'var(--warning)'
                  }}
                >
                  {group.status}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600 }}>
                  {group.members.length}/{group.maxMembers} SV
                </span>
              </div>

              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 6 }}>
                {group.name}
              </h2>

              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 16, flex: 1 }}>
                {group.topic}
              </p>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12, marginTop: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Trưởng nhóm:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{group.leader}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 14 }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Mentor phụ trách:</span>
                  <span style={{ color: 'var(--accent-400)', fontWeight: 600 }}>{group.mentor}</span>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => setSelectedGroup(group)}
                  >
                    Xem chi tiết
                  </button>
                  {!isFull && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => toast.success(`Đã gửi yêu cầu xin gia nhập nhóm "${group.name}"!`)}
                    >
                      Xin gia nhập
                    </button>
                  )}
                </div>
              </div>
            </motion.article>
          )
        })}
      </motion.div>

      {/* Feature explanation showcase */}
      <motion.section
        variants={fadeUp}
        className="glass-card"
        style={{ marginTop: 'var(--space-8)', padding: 'var(--space-6)' }}
      >
        <p className="eyebrow eyebrow-accent">QUY TRÌNH SERVICE 2 & 3</p>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 12 }}>
          Lộ trình Matching & Mentor Khởi Nghiệp
        </h2>
        <div className="feature-preview-grid" style={{ margin: 0, maxWidth: '100%' }}>
          <div className="feature-preview-card">
            <div className="feature-icon" style={{ background: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent-400)' }}>
              <Users size={22} />
            </div>
            <h3>1. Tự do ghép đội</h3>
            <p>Sinh viên tự tìm nhóm theo chuyên môn SE, AI, IA, MKT, IB. Tối đa 5 thành viên/nhóm.</p>
          </div>

          <div className="feature-preview-card">
            <div className="feature-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)' }}>
              <Sparkles size={22} />
            </div>
            <h3>2. Random Matching AI</h3>
            <p>Khi hết hạn, thuật toán tự động ghép các sinh viên lẻ thành nhóm cân bằng chuyên ngành.</p>
          </div>

          <div className="feature-preview-card">
            <div className="feature-icon" style={{ background: 'rgba(52, 211, 153, 0.15)', color: 'var(--success)' }}>
              <CheckCircle2 size={22} />
            </div>
            <h3>3. Đăng ký & Ghép Mentor</h3>
            <p>Nhóm nộp đề tài khởi nghiệp Capstone và gửi yêu cầu mời giảng viên mentor hướng dẫn.</p>
          </div>
        </div>
      </motion.section>

      {/* Group Detail Modal */}
      <AnimatePresence>
        {selectedGroup && (
          <div
            className="modal-backdrop"
            onClick={() => setSelectedGroup(null)}
          >
            <motion.div
              className="glass-card modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 540 }}
            >
              <p className="eyebrow eyebrow-accent">CHI TIẾT NHÓM</p>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, margin: '6px 0 12px' }}>
                {selectedGroup.name}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
                {selectedGroup.topic}
              </p>

              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                Thành viên trong nhóm ({selectedGroup.members.length}/{selectedGroup.maxMembers})
              </h3>
              <div style={{ display: 'grid', gap: 10, marginBottom: 24 }}>
                {selectedGroup.members.map((m, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    <div>
                      <strong style={{ display: 'block', fontSize: 13 }}>{m.name}</strong>
                      <small style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{m.role}</small>
                    </div>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(139, 92, 246, 0.15)',
                        color: 'var(--accent-400)',
                        fontSize: 11,
                        fontWeight: 700
                      }}
                    >
                      {m.major}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setSelectedGroup(null)}
                >
                  Đóng
                </button>
                {selectedGroup.statusType === 'recruiting' && (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      toast.success(`Đã gửi yêu cầu gia nhập ${selectedGroup.name}!`)
                      setSelectedGroup(null)
                    }}
                  >
                    Gửi yêu cầu xin gia nhập
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Group Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div
            className="modal-backdrop"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              className="glass-card modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 500 }}
            >
              <p className="eyebrow eyebrow-accent">KHỞI TẠO ĐỘI NGŨ</p>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, margin: '6px 0 16px' }}>
                Tạo Nhóm Khởi Nghiệp Mới
              </h2>
              <form onSubmit={handleCreateGroup} className="product-form">
                <div>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary)' }}>
                    Tên nhóm *
                  </label>
                  <input
                    required
                    className="input"
                    placeholder="Ví dụ: AI HealthTech Core"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary)' }}>
                    Ý tưởng / Đề tài khởi nghiệp dự kiến *
                  </label>
                  <textarea
                    required
                    className="input"
                    rows={3}
                    placeholder="Mô tả ngắn gọn hướng đi, bài toán giải quyết và công nghệ cốt lõi..."
                    value={newGroupTopic}
                    onChange={(e) => setNewGroupTopic(e.target.value)}
                    style={{ resize: 'vertical' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Hủy
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Tạo nhóm <ArrowRight size={15} />
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
