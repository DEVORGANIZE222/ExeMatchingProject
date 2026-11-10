import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft, Calendar, CheckCircle2, Copy, Inbox,
  MessageSquareText, Search, User, XCircle
} from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../hooks/useAuth'
import './MentorPages.css'

const requestStatus = {
  0: { label: 'Chờ duyệt', className: 'badge-warning' },
  1: { label: 'Đã chấp thuận', className: 'badge-green' },
  2: { label: 'Đã từ chối', className: 'badge-error' }
}

const shortGroupCode = (groupId) => (groupId ? `#${String(groupId).slice(0, 8)}` : '#N/A')

export default function MentorRequestsPage() {
  const { request } = useAuth()
  const [mentor, setMentor] = useState(null)
  const [requests, setRequests] = useState([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [decision, setDecision] = useState(null)
  const [decisionReason, setDecisionReason] = useState('')

  const loadRequests = useCallback(async () => {
    const [profile, items] = await Promise.all([
      request('/api/mentors/me'),
      request('/api/mentor-requests/mine')
    ])
    setMentor(profile)
    setRequests(items)
  }, [request])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadRequests().catch((error) => toast.error(error.message || 'Không thể tải yêu cầu mentor.'))
    }, 0)
    return () => clearTimeout(timer)
  }, [loadRequests])

  const counts = {
    all: requests.length,
    pending: requests.filter((item) => item.status === 0).length,
    approved: requests.filter((item) => item.status === 1).length,
    rejected: requests.filter((item) => item.status === 2).length
  }
  const query = search.trim().toLocaleLowerCase()
  const filtered = requests.filter((item) => {
    const statusMatches = filter === 'all' || item.status === Number(filter)
    const textMatches = `${item.groupName} ${item.topic} ${item.requesterName} ${item.message}`.toLocaleLowerCase().includes(query)
    return statusMatches && textMatches
  })

  const submitDecision = async (event) => {
    event.preventDefault()
    if (!selected || decision === null) return
    try {
      await request('/api/mentor-requests/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: selected.id,
          isAccepted: decision,
          decisionReason: decisionReason.trim()
        })
      })
      toast.success(decision ? 'Đã chấp nhận hướng dẫn nhóm.' : 'Đã từ chối yêu cầu.')
      setSelected(null)
      setDecision(null)
      setDecisionReason('')
      await loadRequests()
    } catch (error) {
      toast.error(error.message || 'Không thể phản hồi yêu cầu.')
    }
  }

  const copyGroupId = async (groupId) => {
    if (!groupId) return
    try {
      await navigator.clipboard.writeText(String(groupId))
      toast.success(`Đã sao chép mã nhóm ${shortGroupCode(groupId)}.`, { id: 'copy-group-id' })
    } catch {
      toast.error('Không thể sao chép mã nhóm.')
    }
  }

  const assignedCount = mentor?.currentAssigned ?? 0
  const maxQuota = mentor?.maxQuota ?? 0
  const remainingQuota = Math.max(0, maxQuota - assignedCount)
  const quotaPercent = maxQuota > 0 ? Math.min(100, Math.round((assignedCount / maxQuota) * 100)) : 0

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Link to="/" className="btn btn-ghost btn-sm" style={{ paddingLeft: 0 }}>
          <ArrowLeft size={14} /> Về trang Tổng quan
        </Link>
      </div>
      <div className="page-header" style={{ alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Yêu cầu hướng dẫn</h1>
          <p className="page-subtitle">Xem xét và phản hồi lời mời từ các nhóm sinh viên.</p>
        </div>
        {mentor && (
          <div
            className="mentor-mini-quota"
            title={`Hạn ngạch còn lại: ${remainingQuota} suất hướng dẫn`}
          >
            <div className="mentor-mini-quota-top">
              <span>Đang nhận: <strong>{assignedCount}/{maxQuota} nhóm</strong></span>
              <span style={{ color: '#166534', fontWeight: 600 }}>Còn {remainingQuota} suất</span>
            </div>
            <div className="mentor-mini-quota-track">
              <div
                className="mentor-mini-quota-fill"
                style={{ width: `${quotaPercent}%`, minWidth: assignedCount > 0 ? 6 : 0 }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="mentor-request-toolbar">
        <div className="proposal-filter-tabs" style={{ margin: 0, border: 0, paddingBottom: 0 }}>
          {[
            ['all', `Tất cả (${counts.all})`],
            ['0', `Chờ duyệt (${counts.pending})`],
            ['1', `Đã chấp thuận (${counts.approved})`],
            ['2', `Đã từ chối (${counts.rejected})`]
          ].map(([value, label]) => (
            <button
              type="button"
              className={`proposal-tab-btn ${filter === value ? 'active' : ''}`}
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="mentor-search">
          <Search size={15} className="mentor-search-icon" />
          <input
            className="input input-sm"
            placeholder="Tìm nhóm hoặc đề tài..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="card mentor-empty-state">
          <div className="mentor-empty-icon"><Inbox size={22} /></div>
          <strong>Không có yêu cầu phù hợp</strong>
          <span>Thử đổi bộ lọc trạng thái hoặc từ khóa tìm kiếm khác.</span>
        </div>
      ) : (
        <div className="proposal-card-grid">
          {filtered.map((item) => (
            <article className={`proposal-card ${item.status === 1 ? 'approved' : item.status === 2 ? 'rejected' : ''}`} key={item.id}>
              <div className="proposal-card-top">
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h2 className="proposal-group-name">{item.groupName || 'Nhóm sinh viên'}</h2>
                    <span className="mentor-meta-code">{shortGroupCode(item.groupId)}</span>
                  </div>
                  <p className="proposal-topic-title">
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500, marginRight: 6 }}>Đề tài:</span>
                    {item.topic || 'Chưa có mô tả đề tài.'}
                  </p>
                </div>
                <span className={`badge ${requestStatus[item.status]?.className || 'badge-neutral'}`}>
                  {requestStatus[item.status]?.label || 'Không xác định'}
                </span>
              </div>

              <div className="team-pitch-quote">
                <span className="team-pitch-label">
                  <MessageSquareText size={13} />
                  <span>Lời nhắn từ sinh viên</span>
                </span>
                <div>{item.message}</div>
              </div>

              {item.decisionReason && (
                <div className={`mentor-feedback-box ${item.status === 2 ? 'rejected' : item.status === 1 ? 'approved' : ''}`}>
                  <span className="mentor-feedback-label">
                    {item.status === 2 ? 'Lý do từ chối:' : 'Phản hồi từ Giảng viên:'}
                  </span>
                  <span>{item.decisionReason}</span>
                </div>
              )}

              <div className="mentor-request-meta">
                <span className="mentor-meta-cell">
                  <User size={13} />
                  <span>Người đại diện: <strong style={{ color: 'var(--text-main)' }}>{item.requesterName || 'Trưởng nhóm'}</strong></span>
                </span>
                <span className="mentor-meta-cell">
                  <span>Mã nhóm:</span>
                  <span className="mentor-meta-code">{shortGroupCode(item.groupId)}</span>
                  <button
                    type="button"
                    className="mentor-copy-id-btn"
                    onClick={() => copyGroupId(item.groupId)}
                    title="Sao chép mã đầy đủ"
                    aria-label="Sao chép mã nhóm đầy đủ"
                  >
                    <Copy size={12} />
                  </button>
                </span>
                <span className="mentor-meta-cell" style={{ justifyContent: 'flex-end' }}>
                  <Calendar size={13} />
                  <span>Gửi ngày: {new Date(item.createdAt).toLocaleDateString('vi-VN')}</span>
                </span>
              </div>

              {item.status === 0 && (
                <div className="decision-buttons-group" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setSelected(item); setDecision(false); setDecisionReason('') }}>
                    <XCircle size={14} /> Từ chối
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={mentor?.currentAssigned >= mentor?.maxQuota}
                    onClick={() => { setSelected(item); setDecision(true); setDecisionReason('') }}
                  >
                    <CheckCircle2 size={14} /> Chấp nhận
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {selected && decision !== null && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <form className="modal-dialog" onSubmit={submitDecision} onClick={(event) => event.stopPropagation()}>
            <h2>{decision ? 'Chấp nhận hướng dẫn nhóm?' : 'Từ chối yêu cầu hướng dẫn?'}</h2>
            <p className="page-subtitle">Nhóm: {selected.groupName}</p>
            <label className="mentor-field" style={{ marginTop: 16 }}>
              {decision ? 'Lời nhắn chào mừng / Ghi chú hướng dẫn' : 'Lý do từ chối *'}
              <textarea
                className="textarea"
                required={!decision}
                rows={4}
                maxLength={2000}
                placeholder={decision ? 'Ghi chú lịch gặp đầu tiên hoặc định hướng đề tài...' : 'Nhập lý do từ chối để sinh viên nắm được thông tin...'}
                value={decisionReason}
                onChange={(event) => setDecisionReason(event.target.value)}
              />
            </label>
            <div className="decision-buttons-group" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setSelected(null)}>Hủy</button>
              <button
                type="submit"
                className="btn btn-primary"
                style={!decision ? { backgroundColor: '#dc2626', borderColor: '#dc2626' } : undefined}
              >
                {decision ? 'Xác nhận nhận nhóm' : 'Xác nhận từ chối'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
