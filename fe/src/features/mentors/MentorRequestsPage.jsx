import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2, Inbox, Search, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../hooks/useAuth'
import './MentorPages.css'

const requestStatus = {
  0: { label: 'Chờ duyệt', className: 'badge-warning' },
  1: { label: 'Đã chấp thuận', className: 'badge-green' },
  2: { label: 'Đã từ chối', className: 'badge-neutral' }
}

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

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Link to="/mentor/dashboard" className="btn btn-ghost btn-sm" style={{ paddingLeft: 0 }}>
          <ArrowLeft size={14} /> Về không gian mentor
        </Link>
      </div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Yêu cầu hướng dẫn</h1>
          <p className="page-subtitle">Xem xét và phản hồi lời mời từ các nhóm sinh viên.</p>
        </div>
        {mentor && <span className="badge badge-teal">{mentor.currentAssigned}/{mentor.maxQuota} nhóm</span>}
      </div>

      <div className="mentor-request-toolbar">
        <div className="proposal-filter-tabs" style={{ margin: 0, border: 0 }}>
          {[
            ['all', `Tất cả (${counts.all})`],
            ['0', `Chờ duyệt (${counts.pending})`],
            ['1', `Đã chấp thuận (${counts.approved})`],
            ['2', `Đã từ chối (${counts.rejected})`]
          ].map(([value, label]) => (
            <button type="button" className={`proposal-tab-btn ${filter === value ? 'active' : ''}`} key={value} onClick={() => setFilter(value)}>
              {label}
            </button>
          ))}
        </div>
        <label className="mentor-search">
          <Search size={15} />
          <input className="input input-sm" placeholder="Tìm nhóm hoặc đề tài" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="card mentor-empty-state">
          <Inbox size={34} />
          <strong>Không có yêu cầu phù hợp</strong>
          <span>Thử đổi bộ lọc hoặc từ khóa tìm kiếm.</span>
        </div>
      ) : (
        <div className="proposal-card-grid">
          {filtered.map((item) => (
            <article className={`proposal-card ${item.status === 1 ? 'approved' : item.status === 2 ? 'rejected' : ''}`} key={item.id}>
              <div className="proposal-card-top">
                <div>
                  <h2 className="proposal-group-name">{item.groupName || 'Nhóm sinh viên'}</h2>
                  <p className="proposal-topic-title">{item.topic || 'Chưa có mô tả đề tài.'}</p>
                </div>
                <span className={`badge ${requestStatus[item.status]?.className || 'badge-neutral'}`}>
                  {requestStatus[item.status]?.label || 'Không xác định'}
                </span>
              </div>
              <p className="team-pitch-quote">{item.message}</p>
              <div className="mentor-request-meta">
                <span>Người gửi: {item.requesterName || 'Trưởng nhóm'}</span>
                <span>Mã nhóm: {item.groupId}</span>
                <span>Gửi ngày {new Date(item.createdAt).toLocaleDateString('vi-VN')}</span>
              </div>
              {item.decisionReason && <p className="mentor-decision-note">Phản hồi: {item.decisionReason}</p>}
              {item.status === 0 && (
                <div className="decision-buttons-group">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setSelected(item); setDecision(false) }}>
                    <XCircle size={14} /> Từ chối
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={mentor?.currentAssigned >= mentor?.maxQuota}
                    onClick={() => { setSelected(item); setDecision(true) }}
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
            <h2>{decision ? 'Chấp nhận hướng dẫn nhóm?' : 'Từ chối yêu cầu?'}</h2>
            <p className="page-subtitle">{selected.groupName}</p>
            <label className="mentor-field" style={{ marginTop: 16 }}>Lời nhắn phản hồi
              <textarea className="textarea" rows={4} maxLength={2000} value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} />
            </label>
            <div className="decision-buttons-group" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setSelected(null)}>Hủy</button>
              <button type="submit" className="btn btn-primary">{decision ? 'Xác nhận nhận nhóm' : 'Xác nhận từ chối'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
