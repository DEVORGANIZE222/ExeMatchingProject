import { useCallback, useEffect, useState } from 'react'
import {
  GraduationCap, Layers, Users, Plus, Search,
  CheckCircle2, X
} from 'lucide-react'
import toast from 'react-hot-toast'
import '../../components/ServicePages.css'
import { useAuth } from '../../hooks/useAuth'

const TEAM_ROLES = ['Frontend', 'Backend', 'Mobile', 'UIUX', 'BusinessAnalysis', 'QualityAssurance', 'DataAI']

export default function GroupsPage() {
  const { account, request } = useAuth()
  const [groups, setGroups] = useState([])
  const [filter, setFilter] = useState('all') // 'all' | 'recruiting' | 'full'
  const [search, setSearch] = useState('')
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupTopic, setNewGroupTopic] = useState('')
  const [newRecruitmentNeeds, setNewRecruitmentNeeds] = useState([])
  const [semesterCode, setSemesterCode] = useState('')
  const [mentors, setMentors] = useState([])
  const [mentorRequestGroup, setMentorRequestGroup] = useState(null)
  const [mentorRequestId, setMentorRequestId] = useState('')
  const [mentorRequestMessage, setMentorRequestMessage] = useState('')
  const [sendingMentorRequest, setSendingMentorRequest] = useState(false)

  const mapGroup = useCallback((group) => {
    const leader = group.members?.find((member) => member.role === 1 || member.role === 'Leader')
    const memberCount = group.memberCount ?? group.members?.length ?? 0
    return {
      ...group,
      name: group.groupName,
      topic: group.topicTitle || 'Chưa đăng ký đề tài',
      projectDescription: group.projectDescription || 'Chưa có mô tả dự án.',
      recruitmentNeeds: group.recruitmentNeeds || [],
      leader: leader?.fullName || 'Chưa bầu trưởng nhóm',
      members: (group.members || []).map((member) => ({
        ...member,
        name: member.fullName,
        role: member.role === 1 || member.role === 'Leader' ? 'Trưởng nhóm' : 'Thành viên',
        major: member.studentCode
      })),
      maxMembers: 5,
      statusText: group.status === 2 || group.status === 'Locked'
        ? 'Đã khóa nhóm'
        : memberCount >= 5 ? 'Đã đủ thành viên' : `Cần thêm ${5 - memberCount} thành viên`,
      statusType: memberCount >= 5 || group.status === 2 || group.status === 'Locked' ? 'full' : 'recruiting',
      canRequestMentor: (group.status === 2 || group.status === 'Locked') && Boolean(group.topicTitle),
      isCurrentLeader: Boolean(account?.student?.id && group.leaderStudentId === account.student.id),
      mentor: 'Chưa kết nối Mentor'
    }
  }, [account])

  const loadGroups = useCallback(async () => {
    let code = account?.student?.semesterCode
    if (!code) {
      const semesters = await request('/api/semesters?isActive=true&page=1&pageSize=100&sortBy=code')
      code = semesters.items?.[0]?.code
    }
    if (!code) {
      setGroups([])
      return
    }
    setSemesterCode(code)
    const result = await request(`/api/groups?semesterCode=${encodeURIComponent(code)}&page=1&pageSize=100`)
    setGroups((result.items || []).map(mapGroup))
  }, [account, mapGroup, request])

  // Synchronize the existing card UI with the remote GroupMatching resource.
  useEffect(() => {
    const id = setTimeout(() => {
      loadGroups().catch((error) => {
        toast.error(error.message || 'Không thể tải danh sách nhóm.')
      })
    }, 0)
    return () => clearTimeout(id)
  }, [loadGroups])

  useEffect(() => {
    if (account?.role !== 'Student') return
    const timer = setTimeout(() => {
      request('/api/mentors')
        .then((items) => setMentors(items.filter((mentor) => mentor.currentAssigned < mentor.maxQuota)))
        .catch((error) => toast.error(error.message || 'Không thể tải danh sách mentor.'))
    }, 0)
    return () => clearTimeout(timer)
  }, [account?.role, request])

  const handleRequestMentor = async (event) => {
    event.preventDefault()
    if (!mentorRequestGroup || !mentorRequestId) return
    setSendingMentorRequest(true)
    try {
      await request('/api/mentor-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: mentorRequestGroup.id,
          mentorId: mentorRequestId,
          groupName: mentorRequestGroup.name,
          topic: mentorRequestGroup.topic,
          message: mentorRequestMessage.trim()
        })
      })
      toast.success('Đã gửi yêu cầu hướng dẫn tới mentor.')
      setMentorRequestGroup(null)
      setMentorRequestMessage('')
      setMentorRequestId('')
    } catch (error) {
      toast.error(error.message || 'Không thể gửi yêu cầu mentor.')
    } finally {
      setSendingMentorRequest(false)
    }
  }

  const handleCreateGroup = async (e) => {
    e.preventDefault()
    if (!newGroupName.trim() || !semesterCode) return
    try {
      await request('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupName: newGroupName.trim(), semesterCode,
          projectDescription: newGroupTopic.trim(),
          recruitmentNeeds: newRecruitmentNeeds.map((roleCode) => ({ roleCode, slots: 1 }))
        })
      })
      toast.success(`Đã khởi tạo nhóm "${newGroupName}".`)
      setShowCreateModal(false)
      setNewGroupName('')
      setNewGroupTopic('')
      setNewRecruitmentNeeds([])
      await loadGroups()
    } catch (error) {
      toast.error(error.message || 'Không thể tạo nhóm.')
    }
  }

  const handleJoin = async (group) => {
    try {
      await request(`/api/groups/${group.id}/members`, { method: 'POST' })
      toast.success(`Đã tham gia nhóm "${group.name}".`)
      setSelectedGroup(null)
      await loadGroups()
    } catch (error) {
      toast.error(error.message || 'Không thể tham gia nhóm.')
    }
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

        <button className="btn btn-primary" onClick={() => { setNewGroupName(''); setNewGroupTopic(''); setNewRecruitmentNeeds([]); setShowCreateModal(true) }}>
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
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 12 }}>{group.projectDescription}</p>
              {!!group.recruitmentNeeds.length && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>{group.recruitmentNeeds.map((need) => <span className="badge badge-warning" key={need.roleCode}>{need.roleCode} · {need.slots}</span>)}</div>}

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
                    onClick={() => handleJoin(group)}
                  >
                    Xin gia nhập
                  </button>
                )}
                {account?.role === 'Student' && group.isCurrentLeader && group.canRequestMentor && (
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => {
                      setMentorRequestGroup(group)
                      setMentorRequestId(mentors[0]?.id || '')
                    }}
                    disabled={mentors.length === 0}
                    title={mentors.length === 0 ? 'Hiện chưa có mentor còn hạn ngạch' : undefined}
                  >
                    <GraduationCap size={14} /> Xin mentor hướng dẫn
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
              {selectedGroup.projectDescription}
            </p>

            {!!selectedGroup.recruitmentNeeds.length && <div style={{ marginBottom: 16 }}><strong style={{ fontSize: 13 }}>Đang cần tuyển</strong><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>{selectedGroup.recruitmentNeeds.map((need) => <span className="badge badge-warning" key={need.roleCode}>{need.roleCode} · {need.slots} vị trí</span>)}</div></div>}

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
                  onClick={() => handleJoin(selectedGroup)}
                >
                  Gửi yêu cầu xin gia nhập
                </button>
              )}
              {account?.role === 'Student' && selectedGroup.isCurrentLeader && selectedGroup.canRequestMentor && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={mentors.length === 0}
                  onClick={() => {
                    setMentorRequestGroup(selectedGroup)
                    setMentorRequestId(mentors[0]?.id || '')
                    setSelectedGroup(null)
                  }}
                >
                  <GraduationCap size={14} /> Mời Mentor
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

              <div style={{ marginBottom: 18 }}>
                <label className="input-label">Đang cần tuyển role nào? <span style={{ color: 'var(--text-muted)' }}>(tối đa 4)</span></label>
                <div role="group" aria-label="Role nhóm đang cần tuyển" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {TEAM_ROLES.map((role) => {
                    const selected = newRecruitmentNeeds.includes(role)
                    return <button key={role} type="button" aria-pressed={selected} className={`btn btn-sm ${selected ? 'btn-primary' : 'btn-outline'}`} onClick={() => setNewRecruitmentNeeds((roles) => selected ? roles.filter((item) => item !== role) : roles.length < 4 ? [...roles, role] : roles)}>{role}</button>
                  })}
                </div>
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

      {mentorRequestGroup && (
        <div className="modal-backdrop" onClick={() => setMentorRequestGroup(null)}>
          <form className="modal-dialog" onSubmit={handleRequestMentor} onClick={(event) => event.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Mời mentor hướng dẫn</h2>
            <p className="page-subtitle" style={{ marginBottom: 16 }}>{mentorRequestGroup.name}</p>
            <label className="input-label">Chọn mentor *
              <select className="select" required value={mentorRequestId} onChange={(event) => setMentorRequestId(event.target.value)}>
                <option value="" disabled>Chọn mentor còn nhận nhóm</option>
                {mentors.map((mentor) => (
                  <option key={mentor.id} value={mentor.id}>
                    {mentor.fullName} · {mentor.department} · còn {mentor.maxQuota - mentor.currentAssigned} suất
                  </option>
                ))}
              </select>
            </label>
            <label className="input-label" style={{ display: 'block', marginTop: 14 }}>Lời mời *
              <textarea className="textarea" required minLength={10} maxLength={2000} rows={4} value={mentorRequestMessage} onChange={(event) => setMentorRequestMessage(event.target.value)} placeholder="Giới thiệu đề tài và mong muốn được mentor hỗ trợ..." />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setMentorRequestGroup(null)}>Hủy</button>
              <button type="submit" className="btn btn-primary" disabled={sendingMentorRequest || !mentorRequestId}>
                {sendingMentorRequest ? 'Đang gửi...' : 'Gửi lời mời'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
