import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, ChevronDown, ChevronUp, Clipboard,
  FolderOpen, Inbox, Layers, Mail, MessageSquare, Pencil, Save, Star, Users, X
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../hooks/useAuth'
import './MentorPages.css'

const emptyProfile = { fullName: '', department: '', expertise: '', phone: '' }

export default function MentorDashboardPage() {
  const { account, request, updateMentorProfile } = useAuth()
  const [profile, setProfile] = useState(null)
  const [profileDraft, setProfileDraft] = useState(emptyProfile)
  const [groups, setGroups] = useState([])
  const [groupDrafts, setGroupDrafts] = useState({})
  const [expandedGroupId, setExpandedGroupId] = useState(null)
  const [groupDetails, setGroupDetails] = useState({})
  const [loadingGroupId, setLoadingGroupId] = useState(null)
  const [groupDetailErrors, setGroupDetailErrors] = useState({})
  const [requests, setRequests] = useState([])
  const [editingProfile, setEditingProfile] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadWorkspace = useCallback(async () => {
    const [mentor, assignedGroups, mentorRequests] = await Promise.all([
      request('/api/mentors/me'),
      request('/api/mentors/me/groups'),
      request('/api/mentor-requests/mine')
    ])
    setProfile(mentor)
    updateMentorProfile(mentor)
    setProfileDraft({ fullName: mentor.fullName, department: mentor.department, expertise: mentor.expertise, phone: mentor.phone || '' })
    setGroups(assignedGroups)
    setGroupDrafts(Object.fromEntries(assignedGroups.map((group) => [group.groupId, {
      milestone: group.milestone,
      progress: group.progress,
      feedback: group.feedback
    }])))
    setRequests(mentorRequests)
  }, [request, updateMentorProfile])

  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      loadWorkspace()
        .catch((error) => toast.error(error.message || 'Không thể tải không gian mentor.'))
        .finally(() => { if (active) setLoading(false) })
    }, 0)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [loadWorkspace])

  const pendingCount = requests.filter((item) => item.status === 0).length
  const feedbackNeededCount = groups.filter((group) => !group.feedback?.trim() || group.progress < 100).length
  const quota = profile?.maxQuota || 0
  const assigned = profile?.currentAssigned || 0
  const availableSlots = Math.max(0, quota - assigned)
  const quotaPercent = quota ? Math.min(100, Math.round(assigned / quota * 100)) : 0

  const saveProfile = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      const updated = await request('/api/mentors/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileDraft)
      })
      setProfile(updated)
      updateMentorProfile(updated)
      setEditingProfile(false)
      toast.success('Đã cập nhật hồ sơ giảng viên.')
    } catch (error) {
      toast.error(error.message || 'Không thể lưu hồ sơ.')
    } finally {
      setSaving(false)
    }
  }

  const saveProgress = async (groupId, draft) => {
    try {
      const updated = await request(`/api/mentors/me/groups/${groupId}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft)
      })
      setGroups((current) => current.map((group) => group.groupId === groupId ? updated : group))
      setGroupDrafts((current) => ({ ...current, [groupId]: {
        milestone: updated.milestone,
        progress: updated.progress,
        feedback: updated.feedback
      } }))
      toast.success('Đã cập nhật tiến độ và nhận xét.')
    } catch (error) {
      toast.error(error.message || 'Không thể cập nhật tiến độ.')
    }
  }

  const toggleGroupDetails = async (groupId) => {
    if (expandedGroupId === groupId) {
      setExpandedGroupId(null)
      return
    }
    setExpandedGroupId(groupId)
    if (groupDetails[groupId]) return

    setLoadingGroupId(groupId)
    setGroupDetailErrors((current) => ({ ...current, [groupId]: '' }))
    try {
      const details = await request(`/api/mentors/me/groups/${groupId}/details`)
      setGroupDetails((current) => ({ ...current, [groupId]: details }))
    } catch (error) {
      setGroupDetailErrors((current) => ({
        ...current,
        [groupId]: error.message || 'Không thể tải danh sách thành viên.'
      }))
    } finally {
      setLoadingGroupId(null)
    }
  }

  const teamEmails = (groupId) => {
    const details = groupDetails[groupId]
    if (!details) return []
    const orderedMembers = [
      ...details.members.filter((member) => member.studentId === details.leaderStudentId),
      ...details.members.filter((member) => member.studentId !== details.leaderStudentId)
    ]
    return [...new Set(orderedMembers
      .map((member) => member.contactEmail?.trim())
      .filter((email) => email?.includes('@')))]
  }

  const copyTeamEmails = async (groupId) => {
    const emails = teamEmails(groupId)
    if (!emails.length) {
      toast.error('Nhóm chưa có địa chỉ email để sao chép.')
      return
    }
    try {
      await navigator.clipboard.writeText(emails.join(', '))
      toast.success(`Đã sao chép ${emails.length} địa chỉ email.`)
    } catch (error) {
      toast.error(error.message || 'Không thể sao chép địa chỉ email.')
    }
  }

  if (loading) {
    return <div className="card" role="status">Đang tải không gian mentor...</div>
  }

  if (!profile) {
    return (
      <div className="card">
        <h1 className="page-title">Chưa có hồ sơ mentor</h1>
        <p className="page-subtitle">Vui lòng đăng nhập bằng tài khoản mentor đã được Admin kích hoạt.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header" style={{ alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Không gian Giảng viên hướng dẫn</h1>
          <p className="page-subtitle" style={{ color: 'var(--text-secondary)' }}>
            Xin chào {profile.fullName || account?.username}. Theo dõi nhóm, phản hồi tiến độ và quản lý hồ sơ tại đây.
          </p>
        </div>
        <Link
          to="/mentor/requests"
          className={pendingCount > 0 ? 'btn btn-primary' : 'btn btn-outline btn-sm'}
          style={pendingCount > 0 ? undefined : { color: 'var(--text-secondary)' }}
        >
          <Inbox size={16} />
          <span>{pendingCount > 0 ? `${pendingCount} yêu cầu chờ duyệt` : 'Xem yêu cầu (0 chờ)'}</span>
          {pendingCount > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 20,
                height: 20,
                padding: '0 6px',
                borderRadius: 9999,
                backgroundColor: '#EA580C',
                color: '#FFFFFF',
                fontSize: 11,
                fontWeight: 700
              }}
            >
              {pendingCount}
            </span>
          )}
        </Link>
      </div>

      <div className="dashboard-metrics-grid mentor-metrics-grid" style={{ marginBottom: 24 }}>
        <Link
          to="/mentor/requests"
          className="metric-card-clean metric-card-link"
          style={pendingCount > 0 ? { borderColor: '#FDBA74', backgroundColor: '#FFFBEB' } : undefined}
        >
          <div
            className="metric-icon-box"
            style={pendingCount > 0 ? { backgroundColor: '#FEF3C7', color: '#B45309' } : undefined}
          >
            <Inbox size={20} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Yêu cầu chờ duyệt</span>
            <span className="metric-number">{pendingCount}</span>
          </div>
        </Link>
        <div className="metric-card-clean">
          <div className="metric-icon-box"><Layers size={20} /></div>
          <div className="metric-info"><span className="metric-label">Nhóm đang hướng dẫn</span><span className="metric-number">{groups.length}</span></div>
        </div>
        <div className="metric-card-clean">
          <div className="metric-icon-box"><MessageSquare size={20} /></div>
          <div className="metric-info"><span className="metric-label">Cột mốc cần phản hồi</span><span className="metric-number">{feedbackNeededCount}</span></div>
        </div>
      </div>

      <section className="quota-hero-card">
        <div className="quota-hero-left">
          <div className="quota-hero-top-row">
            <span className="badge badge-teal">Giảng viên hướng dẫn</span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setEditingProfile((value) => !value)}
              title="Chỉnh sửa thông tin hồ sơ giảng viên"
            >
              {editingProfile ? <X size={13} /> : <Pencil size={13} />}
              <span>{editingProfile ? 'Đóng' : 'Chỉnh sửa hồ sơ'}</span>
            </button>
          </div>
          <h2 className="quota-hero-title">{profile.fullName}</h2>
          <p className="quota-hero-subtitle">{profile.department} · {profile.email}</p>
          {profile.phone && <p className="quota-hero-subtitle">{profile.phone}</p>}
          <p className="quota-hero-subtitle">{profile.expertise || 'Chưa cập nhật chuyên môn.'}</p>
        </div>
        <div className="quota-gauge-box">
          <div className="quota-gauge-header">
            <span className="quota-gauge-label">Hạn ngạch hướng dẫn</span>
            <span className="badge badge-green">Còn {availableSlots} suất</span>
          </div>
          <div className="quota-gauge-numbers"><span className="highlight">{assigned}</span> / {quota} nhóm</div>
          <div className="quota-progress-track">
            <div
              className={`quota-progress-fill ${quotaPercent >= 100 ? 'full' : quotaPercent >= 75 ? 'amber' : 'green'}`}
              style={{
                width: `${quotaPercent}%`,
                minWidth: assigned > 0 ? 10 : 0
              }}
            />
          </div>
          <div className="quota-gauge-footer">
            <span>Đang hướng dẫn {assigned}/{quota} nhóm</span>
            <span>{quotaPercent}% công suất</span>
          </div>
        </div>
      </section>

      {editingProfile && (
        <form className="card" onSubmit={saveProfile} style={{ marginBottom: 24 }}>
          <h2 style={{ marginBottom: 16 }}>Hồ sơ chuyên môn</h2>
          <div className="mentor-workspace-form-grid">
            <label className="mentor-field">Họ tên
              <input className="input" required maxLength={200} value={profileDraft.fullName} onChange={(e) => setProfileDraft({ ...profileDraft, fullName: e.target.value })} />
            </label>
            <label className="mentor-field">Khoa / đơn vị
              <input className="input" required maxLength={200} value={profileDraft.department} onChange={(e) => setProfileDraft({ ...profileDraft, department: e.target.value })} />
            </label>
            <label className="mentor-field">Điện thoại liên hệ
              <input className="input" maxLength={40} value={profileDraft.phone} onChange={(e) => setProfileDraft({ ...profileDraft, phone: e.target.value })} />
            </label>
            <label className="mentor-field mentor-field-wide">Chuyên môn
              <textarea className="textarea" rows={3} maxLength={1000} value={profileDraft.expertise} onChange={(e) => setProfileDraft({ ...profileDraft, expertise: e.target.value })} />
            </label>
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: 14 }}>
            <Save size={15} /><span>{saving ? 'Đang lưu...' : 'Lưu hồ sơ'}</span>
          </button>
        </form>
      )}

      <div className="mentor-workspace-grid">
        <section className="card">
          <div className="mentor-section-heading">
            <div><h2>Nhóm hướng dẫn</h2><p>Cập nhật mốc hiện tại, phần trăm tiến độ và nhận xét cho từng nhóm.</p></div>
          </div>
          {groups.length === 0 ? (
            <div className="mentor-empty-state">
              <div className="mentor-empty-icon"><FolderOpen size={22} /></div>
              <strong>Chưa có nhóm được phân công</strong>
              <span>Khi bạn chấp thuận lời mời từ các nhóm sinh viên, danh sách tiến độ và thành viên sẽ xuất hiện tại đây.</span>
              <Link to="/mentor/requests" className="btn btn-outline btn-sm" style={{ marginTop: 4 }}>
                <span>Duyệt nhóm & Đề tài</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <div className="mentor-workspace-list">
              {groups.map((group) => {
                const draft = groupDrafts[group.groupId] || group
                const setDraft = (key, value) => setGroupDrafts((current) => ({
                  ...current,
                  [group.groupId]: { ...draft, [key]: value }
                }))
                return (
                  <article className="mentor-workspace-item" key={group.groupId}>
                    <h3>{group.groupName}</h3>
                    <p>{group.topic || 'Chưa có mô tả đề tài.'}</p>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    aria-expanded={expandedGroupId === group.groupId}
                    onClick={() => toggleGroupDetails(group.groupId)}
                    style={{ marginTop: 10 }}
                  >
                    <Users size={14} />
                    <span>{expandedGroupId === group.groupId ? 'Ẩn thành viên' : 'Xem nhóm và thành viên'}</span>
                    {expandedGroupId === group.groupId ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {expandedGroupId === group.groupId && (
                    <div className="mentor-team-details" aria-live="polite">
                      {loadingGroupId === group.groupId && <p role="status">Đang tải thông tin nhóm...</p>}
                      {groupDetailErrors[group.groupId] && <p className="mentor-team-error" role="alert">{groupDetailErrors[group.groupId]}</p>}
                      {groupDetails[group.groupId] && (
                        <>
                          <div className="mentor-team-summary">
                            <span>Mã nhóm: {groupDetails[group.groupId].groupCode}</span>
                            <span>{groupDetails[group.groupId].status === 2 ? 'Đã khóa' : 'Đang thành lập'}</span>
                            <span>{groupDetails[group.groupId].memberCount}/{groupDetails[group.groupId].capacity} thành viên</span>
                          </div>
                          <p>{groupDetails[group.groupId].topic || 'Chưa đăng ký đề tài.'}</p>
                          <ul className="mentor-team-members">
                            {groupDetails[group.groupId].members.map((member) => (
                              <li key={member.studentId}>
                                <span>
                                  {member.fullName}
                                  {member.studentId === groupDetails[group.groupId].leaderStudentId && (
                                    <strong className="mentor-team-leader"><Star size={12} /> Trưởng nhóm</strong>
                                  )}
                                  {member.isDemo && <strong className="mentor-team-demo">DEMO</strong>}
                                </span>
                                <small>{member.studentCode}{member.contactEmail ? ` · ${member.contactEmail}` : ''}</small>
                              </li>
                            ))}
                          </ul>
                          {!groupDetails[group.groupId].members.length && <p>Nhóm chưa có thành viên.</p>}
                        </>
                      )}
                    </div>
                  )}
                  <div className="mentor-progress-edit">
                    <label className="mentor-field">Mốc hiện tại
                      <input className="input" maxLength={200} value={draft.milestone} onChange={(event) => setDraft('milestone', event.target.value)} />
                    </label>
                    <label className="mentor-field">Tiến độ: {draft.progress}%
                      <input type="range" min="0" max="100" value={draft.progress} onChange={(event) => setDraft('progress', Number(event.target.value))} />
                    </label>
                  </div>
                  <label className="mentor-field">Nhận xét / việc cần làm tiếp theo
                    <textarea className="textarea" rows={2} maxLength={2000} value={draft.feedback} onChange={(event) => setDraft('feedback', event.target.value)} />
                  </label>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => saveProgress(group.groupId, draft)}
                    style={{ marginTop: 10 }}
                  >
                    <Save size={14} /><span>Lưu tiến độ</span>
                  </button>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <div className="mentor-workspace-side">
          <section className="card">
            <div className="mentor-section-heading">
              <div><h2>Gửi email cho nhóm</h2><p>Mở Gmail để soạn thư cho thành viên, hoặc sao chép địa chỉ email.</p></div>
            </div>
            <div className="mentor-workspace-list">
              {groups.map((group) => {
                const emails = teamEmails(group.groupId)
                const details = groupDetails[group.groupId]
                const composeUrl = emails.length
                  ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(emails.join(','))}&su=${encodeURIComponent(`[${details.groupCode}] ${details.groupName}`)}`
                  : ''
                return (
                  <article className="mentor-contact-item" key={group.groupId}>
                    <strong>{group.groupName}</strong>
                    <span>{emails.length ? `${emails.length} email thành viên` : 'Chưa tải địa chỉ thành viên'}</span>
                    {!emails.length ? (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={loadingGroupId === group.groupId}
                        onClick={() => toggleGroupDetails(group.groupId)}
                      >
                        <Users size={14} />
                        {loadingGroupId === group.groupId ? 'Đang tải...' : 'Tải email nhóm'}
                      </button>
                    ) : (
                      <div className="mentor-contact-actions">
                        <a className="btn btn-primary btn-sm" href={composeUrl} target="_blank" rel="noreferrer">
                          <Mail size={14} /> Gửi Gmail
                        </a>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => copyTeamEmails(group.groupId)}>
                          <Clipboard size={14} /> Sao chép
                        </button>
                      </div>
                    )}
                    {groupDetailErrors[group.groupId] && <small className="mentor-team-error" role="alert">{groupDetailErrors[group.groupId]}</small>}
                  </article>
                )
              })}
              {groups.length === 0 && (
                <div className="mentor-empty-state">
                  <div className="mentor-empty-icon"><Mail size={20} /></div>
                  <strong>Chưa có danh sách email liên hệ</strong>
                  <span>Sau khi nhận hướng dẫn nhóm, bạn có thể mở Gmail gửi cả nhóm hoặc sao chép email nhanh tại đây.</span>
                  <Link to="/mentor/requests" className="btn btn-outline btn-sm" style={{ marginTop: 4 }}>
                    <span>Xem lời mời hướng dẫn</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
