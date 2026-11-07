import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell, CalendarDays, Check, Clock3, Layers,
  Pencil, Plus, Save, Users, X
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../hooks/useAuth'
import './MentorPages.css'

const emptyProfile = { fullName: '', department: '', expertise: '', phone: '' }
const emptyAppointment = { title: '', groupId: '', startsAt: '', notes: '' }

function localDateTime(value) {
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function displayDate(value) {
  return new Date(value).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function MentorDashboardPage() {
  const { account, request } = useAuth()
  const [profile, setProfile] = useState(null)
  const [profileDraft, setProfileDraft] = useState(emptyProfile)
  const [groups, setGroups] = useState([])
  const [groupDrafts, setGroupDrafts] = useState({})
  const [requests, setRequests] = useState([])
  const [appointments, setAppointments] = useState([])
  const [notifications, setNotifications] = useState([])
  const [appointmentDraft, setAppointmentDraft] = useState(emptyAppointment)
  const [editingAppointmentId, setEditingAppointmentId] = useState(null)
  const [editingProfile, setEditingProfile] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadWorkspace = useCallback(async () => {
    const [mentor, assignedGroups, mentorRequests, meetings, alerts] = await Promise.all([
      request('/api/mentors/me'),
      request('/api/mentors/me/groups'),
      request('/api/mentor-requests/mine'),
      request('/api/mentors/me/appointments'),
      request('/api/mentors/me/notifications')
    ])
    setProfile(mentor)
    setProfileDraft({ fullName: mentor.fullName, department: mentor.department, expertise: mentor.expertise, phone: mentor.phone || '' })
    setGroups(assignedGroups)
    setGroupDrafts(Object.fromEntries(assignedGroups.map((group) => [group.groupId, {
      milestone: group.milestone,
      progress: group.progress,
      feedback: group.feedback
    }])))
    setRequests(mentorRequests)
    setAppointments(meetings)
    setNotifications(alerts)
  }, [request])

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
  const unreadCount = notifications.filter((item) => !item.isRead).length
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
      setEditingProfile(false)
      toast.success('Đã cập nhật hồ sơ mentor.')
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

  const createAppointment = async (event) => {
    event.preventDefault()
    try {
      const saved = await request(`/api/mentors/me/appointments${editingAppointmentId ? `/${editingAppointmentId}` : ''}`, {
        method: editingAppointmentId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...appointmentDraft,
          groupId: appointmentDraft.groupId || null,
          startsAt: new Date(appointmentDraft.startsAt).toISOString()
        })
      })
      setAppointments((current) => [
        ...current.filter((item) => item.id !== saved.id),
        saved
      ].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)))
      setAppointmentDraft(emptyAppointment)
      setEditingAppointmentId(null)
      toast.success(editingAppointmentId ? 'Đã cập nhật lịch tư vấn.' : 'Đã tạo lịch tư vấn.')
    } catch (error) {
      toast.error(error.message || 'Không thể tạo lịch tư vấn.')
    }
  }

  const deleteAppointment = async (id) => {
    try {
      await request(`/api/mentors/me/appointments/${id}`, { method: 'DELETE' })
      setAppointments((current) => current.filter((item) => item.id !== id))
      if (editingAppointmentId === id) {
        setEditingAppointmentId(null)
        setAppointmentDraft(emptyAppointment)
      }
      toast.success('Đã xóa lịch tư vấn.')
    } catch (error) {
      toast.error(error.message || 'Không thể xóa lịch.')
    }
  }

  const markAllRead = async () => {
    try {
      await request('/api/mentors/me/notifications/read-all', { method: 'PUT' })
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })))
    } catch (error) {
      toast.error(error.message || 'Không thể cập nhật thông báo.')
    }
  }

  const markRead = async (id) => {
    try {
      await request(`/api/mentors/me/notifications/${id}/read`, { method: 'PUT' })
      setNotifications((current) => current.map((item) => item.id === id ? { ...item, isRead: true } : item))
    } catch (error) {
      toast.error(error.message || 'Không thể cập nhật thông báo.')
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
      <div className="page-header">
        <div>
          <h1 className="page-title">Không gian Mentor</h1>
          <p className="page-subtitle">Xin chào {profile.fullName || account?.username}. Theo dõi nhóm, lịch tư vấn và cập nhật hồ sơ tại đây.</p>
        </div>
        <Link to="/mentor/requests" className="btn btn-primary">
          <Users size={16} />
          <span>{pendingCount} yêu cầu đang chờ</span>
        </Link>
      </div>

      <section className="quota-hero-card">
        <div className="quota-hero-left">
          <span className="badge badge-teal" style={{ width: 'fit-content' }}>Giảng viên Mentor</span>
          <h2 className="quota-hero-title">{profile.fullName}</h2>
          <p className="quota-hero-subtitle">{profile.department} · {profile.email}</p>
          {profile.phone && <p className="quota-hero-subtitle">{profile.phone}</p>}
          <p className="quota-hero-subtitle">{profile.expertise || 'Chưa cập nhật chuyên môn.'}</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingProfile((value) => !value)}>
            {editingProfile ? <X size={14} /> : <Pencil size={14} />}
            <span>{editingProfile ? 'Đóng chỉnh sửa' : 'Cập nhật hồ sơ'}</span>
          </button>
        </div>
        <div className="quota-gauge-box">
          <div className="quota-gauge-header">
            <span className="quota-gauge-label">Hạn ngạch hướng dẫn</span>
            <span className="badge badge-green">Còn {availableSlots} suất</span>
          </div>
          <div className="quota-gauge-numbers"><span className="highlight">{assigned}</span> / {quota} nhóm</div>
          <div className="quota-progress-track">
            <div className={`quota-progress-fill ${quotaPercent >= 100 ? 'full' : quotaPercent >= 75 ? 'amber' : 'green'}`} style={{ width: `${quotaPercent}%` }} />
          </div>
          <div className="quota-gauge-footer"><span>Đang hướng dẫn</span><span>{quotaPercent}% công suất</span></div>
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

      <div className="dashboard-metrics-grid" style={{ marginBottom: 24 }}>
        <div className="metric-card-clean">
          <div className="metric-icon-box"><Layers size={20} /></div>
          <div className="metric-info"><span className="metric-label">Nhóm đang hướng dẫn</span><span className="metric-number">{groups.length}</span></div>
        </div>
        <div className="metric-card-clean">
          <div className="metric-icon-box"><CalendarDays size={20} /></div>
          <div className="metric-info"><span className="metric-label">Lịch tư vấn sắp tới</span><span className="metric-number">{appointments.filter((item) => new Date(item.startsAt) >= new Date()).length}</span></div>
        </div>
        <div className="metric-card-clean">
          <div className="metric-icon-box"><Bell size={20} /></div>
          <div className="metric-info"><span className="metric-label">Thông báo chưa đọc</span><span className="metric-number">{unreadCount}</span></div>
        </div>
      </div>

      <div className="mentor-workspace-grid">
        <section className="card">
          <div className="mentor-section-heading">
            <div><h2>Nhóm hướng dẫn</h2><p>Cập nhật mốc hiện tại, phần trăm tiến độ và nhận xét.</p></div>
          </div>
          {groups.length === 0 ? <p className="mentor-empty-state">Chưa có nhóm được phân công.</p> : (
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
              <div><h2>Lịch tư vấn</h2><p>Tạo và quản lý lịch hẹn với nhóm.</p></div>
            </div>
            <form onSubmit={createAppointment} className="mentor-workspace-form">
              <label className="mentor-field">Tên buổi tư vấn
                <input className="input" required maxLength={200} value={appointmentDraft.title} onChange={(e) => setAppointmentDraft({ ...appointmentDraft, title: e.target.value })} />
              </label>
              <label className="mentor-field">Nhóm
                <select className="input" value={appointmentDraft.groupId} onChange={(e) => setAppointmentDraft({ ...appointmentDraft, groupId: e.target.value })}>
                  <option value="">Lịch chung</option>
                  {groups.map((group) => <option key={group.groupId} value={group.groupId}>{group.groupName}</option>)}
                </select>
              </label>
              <label className="mentor-field">Thời gian
                <input className="input" type="datetime-local" required value={appointmentDraft.startsAt} onChange={(e) => setAppointmentDraft({ ...appointmentDraft, startsAt: e.target.value })} />
              </label>
              <label className="mentor-field">Ghi chú
                <textarea className="textarea" rows={2} maxLength={2000} value={appointmentDraft.notes} onChange={(e) => setAppointmentDraft({ ...appointmentDraft, notes: e.target.value })} />
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary btn-sm"><Plus size={14} /><span>{editingAppointmentId ? 'Lưu lịch' : 'Tạo lịch'}</span></button>
                {editingAppointmentId && <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setEditingAppointmentId(null); setAppointmentDraft(emptyAppointment) }}>Hủy sửa</button>}
              </div>
            </form>
            <div className="mentor-workspace-list" style={{ marginTop: 18 }}>
              {appointments.map((item) => (
                <div className="mentor-appointment" key={item.id}>
                  <div><strong>{item.title}</strong><span><Clock3 size={13} /> {displayDate(item.startsAt)}</span>{item.notes && <p>{item.notes}</p>}</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button type="button" className="btn btn-ghost btn-sm" aria-label={`Sửa lịch ${item.title}`} onClick={() => {
                      setEditingAppointmentId(item.id)
                      setAppointmentDraft({
                        title: item.title,
                        groupId: item.groupId || '',
                        startsAt: localDateTime(item.startsAt),
                        notes: item.notes
                      })
                    }}><Pencil size={14} /></button>
                    <button type="button" className="btn btn-ghost btn-sm" aria-label={`Xóa lịch ${item.title}`} onClick={() => deleteAppointment(item.id)}><X size={15} /></button>
                  </div>
                </div>
              ))}
              {appointments.length === 0 && <p className="mentor-empty-state">Chưa có lịch tư vấn.</p>}
            </div>
          </section>

          <section className="card">
            <div className="mentor-section-heading">
              <div><h2>Thông báo</h2><p>{unreadCount} thông báo chưa đọc</p></div>
              {unreadCount > 0 && <button className="btn btn-ghost btn-sm" onClick={markAllRead} type="button"><Check size={14} /> Đánh dấu đã đọc</button>}
            </div>
            <div className="mentor-workspace-list">
              {notifications.slice(0, 8).map((notification) => (
                <button type="button" className={`mentor-notification ${notification.isRead ? '' : 'unread'}`} key={notification.id} onClick={() => !notification.isRead && markRead(notification.id)}>
                  <strong>{notification.title}</strong><span>{notification.message}</span><small>{displayDate(notification.createdAt)}</small>
                </button>
              ))}
              {notifications.length === 0 && <p className="mentor-empty-state">Bạn chưa có thông báo.</p>}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
