import { useState } from 'react'
import {
  Inbox, CheckCircle2, XCircle, Search,
  FileText, ArrowLeft, Download, Eye
} from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../hooks/useAuth'
import './MentorPages.css'

export default function MentorRequestsPage() {
  const {
    mentorProfile,
    mentorRequests,
    acceptMentorRequest,
    rejectMentorRequest
  } = useAuth()

  const [filter, setFilter] = useState('Pending') // 'all' | 'Pending' | 'Approved' | 'Rejected'
  const [search, setSearch] = useState('')
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [modalType, setModalType] = useState(null) // 'accept' | 'reject' | 'view'
  const [decisionNote, setDecisionNote] = useState('')

  const currentCount = mentorProfile?.currentAssigned || 0
  const maxQuota = mentorProfile?.maxQuota || 4
  const remainingQuota = Math.max(0, maxQuota - currentCount)
  const isQuotaFull = currentCount >= maxQuota

  const counts = {
    all: mentorRequests.length,
    Pending: mentorRequests.filter((r) => r.status === 'Pending').length,
    Approved: mentorRequests.filter((r) => r.status === 'Approved').length,
    Rejected: mentorRequests.filter((r) => r.status === 'Rejected').length
  }

  const filteredRequests = mentorRequests.filter((r) => {
    const matchesFilter = filter === 'all' || r.status === filter
    const q = search.toLowerCase()
    const matchesSearch =
      r.groupName.toLowerCase().includes(q) ||
      r.topic.toLowerCase().includes(q) ||
      r.leader.toLowerCase().includes(q) ||
      r.industry.toLowerCase().includes(q)
    return matchesFilter && matchesSearch
  })

  const handleOpenModal = (req, type) => {
    setSelectedRequest(req)
    setModalType(type)
    setDecisionNote('')
  }

  const handleConfirmDecision = () => {
    if (!selectedRequest) return
    try {
      if (modalType === 'accept') {
        acceptMentorRequest(selectedRequest.id, decisionNote.trim())
        toast.success(`Đã chấp thuận hướng dẫn nhóm "${selectedRequest.groupName}"!`)
      } else if (modalType === 'reject') {
        rejectMentorRequest(selectedRequest.id, decisionNote.trim())
        toast.success(`Đã từ chối yêu cầu từ nhóm "${selectedRequest.groupName}".`)
      }
      setModalType(null)
      setSelectedRequest(null)
    } catch (err) {
      toast.error(err.message || 'Thao tác không thành công.')
    }
  }

  return (
    <div>
      {/* ── Breadcrumb / Back Link ── */}
      <div style={{ marginBottom: 12 }}>
        <Link to="/mentor/dashboard" className="btn btn-ghost btn-sm" style={{ paddingLeft: 0, gap: 4 }}>
          <ArrowLeft size={14} />
          <span>Về Không gian Cố vấn</span>
        </Link>
      </div>

      {/* ── Page Header ── */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Hồ sơ Đề tài & Yêu cầu Hướng dẫn</h1>
          <p className="page-subtitle">
            Xem xét các ý tưởng khởi nghiệp sinh viên gửi tới, đánh giá tính khả thi và quyết định nhận nhóm theo hạn ngạch.
          </p>
        </div>

        {/* Quota Mini Indicator Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--border-default)',
          padding: '8px 16px',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-xs)'
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Hạn ngạch hiện tại
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)' }}>
              <span style={{ color: 'var(--primary)' }}>{currentCount}</span> / {maxQuota} nhóm
            </div>
          </div>
          <span className={`badge ${isQuotaFull ? 'badge-neutral' : 'badge-green'}`} style={{ fontSize: 11 }}>
            {isQuotaFull ? 'Đã đủ Quota' : `Còn ${remainingQuota} suất`}
          </span>
        </div>
      </div>

      {/* ── Filter Tabs & Search Bar ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
        <div className="proposal-filter-tabs" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
          <button
            type="button"
            className={`proposal-tab-btn ${filter === 'Pending' ? 'active' : ''}`}
            onClick={() => setFilter('Pending')}
          >
            <span>Chờ Thầy duyệt</span>
            <span className="badge badge-warning" style={{ fontSize: 11, padding: '1px 6px' }}>{counts.Pending}</span>
          </button>

          <button
            type="button"
            className={`proposal-tab-btn ${filter === 'Approved' ? 'active' : ''}`}
            onClick={() => setFilter('Approved')}
          >
            <span>Đã chấp thuận</span>
            <span className="badge badge-green" style={{ fontSize: 11, padding: '1px 6px' }}>{counts.Approved}</span>
          </button>

          <button
            type="button"
            className={`proposal-tab-btn ${filter === 'Rejected' ? 'active' : ''}`}
            onClick={() => setFilter('Rejected')}
          >
            <span>Đã từ chối</span>
            <span className="badge badge-neutral" style={{ fontSize: 11, padding: '1px 6px' }}>{counts.Rejected}</span>
          </button>

          <button
            type="button"
            className={`proposal-tab-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            <span>Tất cả ({counts.all})</span>
          </button>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', width: 280 }}>
          <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input input-sm"
            placeholder="Tìm theo tên nhóm, đề tài..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 34, width: '100%' }}
          />
        </div>
      </div>

      {/* ── Proposal Cards List ── */}
      {filteredRequests.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-secondary)' }}>
          <Inbox size={40} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontWeight: 600, fontSize: 15 }}>Không tìm thấy yêu cầu nào</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Không có hồ sơ nào phù hợp với bộ lọc hiện tại.
          </p>
        </div>
      ) : (
        <div className="proposal-card-grid">
          {filteredRequests.map((req) => (
            <div
              key={req.id}
              className={`proposal-card ${req.status === 'Approved' ? 'approved' : req.status === 'Rejected' ? 'rejected' : ''}`}
            >
              {/* Card Top */}
              <div className="proposal-card-top">
                <div>
                  <div className="proposal-group-name">
                    <span>{req.groupName}</span>
                    <span className="badge badge-teal">{req.industry}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>
                    Trưởng nhóm: <strong style={{ color: 'var(--text-main)' }}>{req.leader}</strong> ({req.leaderEmail} · {req.leaderPhone})
                  </div>
                </div>

                <div>
                  {req.status === 'Pending' && <span className="badge badge-warning">Chờ duyệt</span>}
                  {req.status === 'Approved' && <span className="badge badge-green">Đã chấp thuận</span>}
                  {req.status === 'Rejected' && <span className="badge badge-neutral">Đã từ chối</span>}
                </div>
              </div>

              {/* Topic Headline */}
              <div className="proposal-topic-title">
                💡 {req.topic}
              </div>

              {/* 2-Column Highlight Grid */}
              <div className="proposal-highlight-grid">
                <div className="proposal-highlight-box">
                  <div className="proposal-highlight-label">Vấn đề thị trường giải quyết</div>
                  <div className="proposal-highlight-text">{req.problemStatement}</div>
                </div>
                <div className="proposal-highlight-box">
                  <div className="proposal-highlight-label">Giải pháp công nghệ & Điểm sáng tạo</div>
                  <div className="proposal-highlight-text">{req.solutionOverview}</div>
                </div>
              </div>

              {/* Roster & Members */}
              <div className="proposal-roster-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  <span>Thành viên ({req.members?.length || 4}):</span>
                </div>
                <div className="roster-members-list">
                  {req.members?.map((m, idx) => (
                    <span key={idx} className="roster-member-chip">
                      <span>{m.name}</span>
                      <span className={`major-badge-tiny ${m.major}`}>{m.major}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({m.role})</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Pitch Letter from Group */}
              <div className="team-pitch-quote">
                <strong>Thư ngỏ gửi Mentor:</strong> "{req.message}"
              </div>

              {/* If already decided, show feedback note */}
              {req.decisionReason && (
                <div style={{
                  padding: '10px 14px',
                  backgroundColor: req.status === 'Approved' ? '#F0FDF4' : '#F8FAFC',
                  border: `1px solid ${req.status === 'Approved' ? '#DCFCE7' : '#E2E8F0'}`,
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 12.5,
                  marginBottom: 14
                }}>
                  <strong style={{ color: req.status === 'Approved' ? '#15803D' : '#475569' }}>
                    Phản hồi của Thầy ({new Date(req.decidedAt || req.createdAt).toLocaleDateString('vi-VN')}):
                  </strong>{' '}
                  <span style={{ color: 'var(--text-secondary)' }}>{req.decisionReason}</span>
                </div>
              )}

              {/* Card Actions Footer */}
              <div className="proposal-actions-bar">
                <button
                  type="button"
                  className="deck-link-btn"
                  onClick={() => toast.success(`Đang tải tài liệu ${req.pitchDeckName}...`)}
                >
                  <FileText size={15} />
                  <span>{req.pitchDeckName}</span>
                  <Download size={13} style={{ marginLeft: 2 }} />
                </button>

                <div className="decision-buttons-group">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleOpenModal(req, 'view')}
                  >
                    <Eye size={14} />
                    <span>Hồ sơ chi tiết</span>
                  </button>

                  {req.status === 'Pending' && (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ color: 'var(--error)' }}
                        onClick={() => handleOpenModal(req, 'reject')}
                      >
                        <XCircle size={14} />
                        <span>Từ chối</span>
                      </button>

                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={isQuotaFull}
                        title={isQuotaFull ? 'Hạn ngạch đã kín' : 'Chấp thuận hướng dẫn nhóm'}
                        onClick={() => handleOpenModal(req, 'accept')}
                      >
                        <CheckCircle2 size={14} />
                        <span>Chấp nhận hướng dẫn</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Action Modals ── */}
      {selectedRequest && modalType && (
        <div className="modal-backdrop" onClick={() => setModalType(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: modalType === 'view' ? 680 : 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)' }}>
                {modalType === 'accept' && `Chấp nhận hướng dẫn: ${selectedRequest.groupName}`}
                {modalType === 'reject' && `Từ chối yêu cầu: ${selectedRequest.groupName}`}
                {modalType === 'view' && `Chi tiết đề tài: ${selectedRequest.groupName}`}
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalType(null)} style={{ padding: 4 }}>
                <XCircle size={18} />
              </button>
            </div>

            {/* Accept Modal */}
            {modalType === 'accept' && (
              <div>
                <div className="alert alert-success" style={{ marginBottom: 16 }}>
                  <span>
                    Sau khi xác nhận, hạn ngạch của Thầy sẽ tăng lên <strong>{currentCount + 1}/{maxQuota} nhóm</strong>.
                    Nhóm sinh viên sẽ nhận được thông báo chấp thuận chính thức.
                  </span>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label className="input-label">Lời nhắn chào mừng & Lịch họp ban đầu (tùy chọn):</label>
                  <textarea
                    className="textarea"
                    rows={3}
                    placeholder="VD: Chào nhóm, Thầy đánh giá cao ý tưởng này. Các em tạo nhóm Zalo và gửi link cho Thầy qua email để chuẩn bị cho buổi kickoff nhé."
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                  <button className="btn btn-secondary" onClick={() => setModalType(null)}>Hủy bỏ</button>
                  <button className="btn btn-primary" onClick={handleConfirmDecision}>
                    <CheckCircle2 size={16} />
                    <span>Xác nhận chấp nhận</span>
                  </button>
                </div>
              </div>
            )}

            {/* Reject Modal */}
            {modalType === 'reject' && (
              <div>
                <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 14 }}>
                  Nhập lý do hoặc lời khuyên mang tính xây dựng để nhóm sinh viên có thể cải thiện hoặc tìm mentor phù hợp:
                </p>
                <div style={{ marginBottom: 14 }}>
                  <label className="input-label">Lý do từ chối & Lời khuyên định hướng *</label>
                  <textarea
                    required
                    className="textarea"
                    rows={3}
                    placeholder="VD: Đề tài của nhóm hướng mạnh về FinTech, trong khi chuyên môn của Thầy chuyên sâu về AI & Dữ liệu lớn. Thầy gợi ý nhóm liên hệ Cô Nga (Viện QTKD) sẽ hỗ trợ tốt hơn nhé."
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                  <button className="btn btn-secondary" onClick={() => setModalType(null)}>Hủy bỏ</button>
                  <button
                    className="btn btn-primary"
                    style={{ backgroundColor: 'var(--error)' }}
                    onClick={handleConfirmDecision}
                  >
                    <span>Gửi phản hồi từ chối</span>
                  </button>
                </div>
              </div>
            )}

            {/* View Full Dossier Modal */}
            {modalType === 'view' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="proposal-highlight-grid">
                  <div className="proposal-highlight-box">
                    <div className="proposal-highlight-label">Lĩnh vực & Mô hình doanh thu</div>
                    <div className="proposal-highlight-text">
                      <strong>{selectedRequest.industry}</strong><br />
                      {selectedRequest.revenueModel}
                    </div>
                  </div>
                  <div className="proposal-highlight-box">
                    <div className="proposal-highlight-label">Thị trường mục tiêu</div>
                    <div className="proposal-highlight-text">{selectedRequest.targetMarket}</div>
                  </div>
                </div>

                <div>
                  <div className="proposal-highlight-label">Vấn đề thực tế</div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {selectedRequest.problemStatement}
                  </p>
                </div>

                <div>
                  <div className="proposal-highlight-label">Giải pháp & Công nghệ sử dụng</div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {selectedRequest.solutionOverview}
                  </p>
                </div>

                <div>
                  <div className="proposal-highlight-label">Đội ngũ sáng lập ({selectedRequest.members?.length} thành viên)</div>
                  <div className="roster-members-list" style={{ marginTop: 6 }}>
                    {selectedRequest.members?.map((m, idx) => (
                      <span key={idx} className="roster-member-chip">
                        <span>{m.name}</span>
                        <span className={`major-badge-tiny ${m.major}`}>{m.major}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({m.role})</span>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="team-pitch-quote">
                  <strong>Thư từ nhóm:</strong> "{selectedRequest.message}"
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 12, borderTop: '1px solid var(--border-default)' }}>
                  <span style={{ fontSize: 12.5, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                    <FileText size={15} />
                    <span>{selectedRequest.pitchDeckName}</span>
                  </span>

                  <button className="btn btn-secondary btn-sm" onClick={() => setModalType(null)}>
                    Đóng cửa sổ
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
