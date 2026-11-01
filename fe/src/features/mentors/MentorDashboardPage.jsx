import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Layers, Inbox, CheckCircle2, XCircle, ArrowRight, FileText,
  Clock, ShieldAlert, Sparkles
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../hooks/useAuth'
import './MentorPages.css'

export default function MentorDashboardPage() {
  const {
    account,
    mentorProfile,
    mentorRequests,
    assignedGroups,
    acceptMentorRequest,
    rejectMentorRequest
  } = useAuth()
  const navigate = useNavigate()

  // Modals state
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [decisionModalType, setDecisionModalType] = useState(null) // 'accept' | 'reject' | 'view'
  const [decisionNote, setDecisionNote] = useState('')

  const currentCount = mentorProfile?.currentAssigned || assignedGroups.length
  const maxQuota = mentorProfile?.maxQuota || 4
  const remainingQuota = Math.max(0, maxQuota - currentCount)
  const quotaPercent = Math.min(100, Math.round((currentCount / maxQuota) * 100))
  const isQuotaFull = currentCount >= maxQuota

  const pendingRequests = mentorRequests.filter((r) => r.status === 'Pending')

  const handleOpenDecision = (req, type) => {
    setSelectedRequest(req)
    setDecisionModalType(type)
    setDecisionNote('')
  }

  const handleConfirmDecision = () => {
    if (!selectedRequest) return

    try {
      if (decisionModalType === 'accept') {
        acceptMentorRequest(selectedRequest.id, decisionNote.trim())
        toast.success(`Đã chấp nhận hướng dẫn nhóm "${selectedRequest.groupName}"!`)
      } else if (decisionModalType === 'reject') {
        rejectMentorRequest(selectedRequest.id, decisionNote.trim())
        toast.success(`Đã từ chối yêu cầu từ nhóm "${selectedRequest.groupName}".`)
      }
      setDecisionModalType(null)
      setSelectedRequest(null)
    } catch (err) {
      toast.error(err.message || 'Không thể thực hiện thao tác.')
    }
  }

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Không gian Cố vấn Khởi nghiệp</h1>
          <p className="page-subtitle">
            Kính chào {account?.username || 'Thầy/Cô'}, quản lý hạn ngạch cố vấn, xem xét đề tài khởi nghiệp và đồng hành cùng các đội ngũ sinh viên.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/mentor/requests')}
          >
            <Inbox size={16} />
            <span>Xem tất cả yêu cầu ({pendingRequests.length} chờ duyệt)</span>
          </button>
        </div>
      </div>

      {/* ── Quota Hero Banner ── */}
      <div className="quota-hero-card">
        <div className="quota-hero-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="badge badge-teal" style={{ fontSize: 11, padding: '3px 10px' }}>
              Giảng viên Mentor Chính thức
            </span>
            <span className="badge badge-neutral" style={{ fontSize: 11, padding: '3px 10px' }}>
              {mentorProfile?.department || 'Khoa Công nghệ thông tin'}
            </span>
          </div>

          <h2 className="quota-hero-title">
            {mentorProfile?.fullName || account?.username || 'TS. Hoàng Văn Thông'}
          </h2>

          <p className="quota-hero-subtitle">
            Phụ trách định hướng công nghệ, mô hình giải pháp và thẩm định tính khả thi cho các dự án khởi nghiệp sinh viên học kỳ Fall 2026.
          </p>

          <div className="quota-expertise-tags">
            <span className="expertise-pill">Trí tuệ nhân tạo (AI)</span>
            <span className="expertise-pill">DeepTech & Big Data</span>
            <span className="expertise-pill">Kiến trúc hệ thống</span>
            <span className="expertise-pill">Mô hình Lean Startup</span>
          </div>
        </div>

        {/* Quota Gauge Box */}
        <div className="quota-gauge-box">
          <div className="quota-gauge-header">
            <span className="quota-gauge-label">Hạn ngạch nhận nhóm (Quota)</span>
            <span className={`badge ${isQuotaFull ? 'badge-neutral' : 'badge-green'}`}>
              {isQuotaFull ? 'Đã đủ hạn ngạch' : `Còn ${remainingQuota} suất trống`}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div className="quota-gauge-numbers">
              <span className="highlight">{currentCount}</span> / {maxQuota} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>nhóm</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: isQuotaFull ? 'var(--text-muted)' : 'var(--primary)' }}>
              {quotaPercent}% công suất
            </span>
          </div>

          <div className="quota-progress-track">
            <div
              className={`quota-progress-fill ${isQuotaFull ? 'full' : quotaPercent >= 75 ? 'amber' : 'green'}`}
              style={{ width: `${quotaPercent}%` }}
            />
          </div>

          <div className="quota-gauge-footer">
            <span>Đang hướng dẫn: {currentCount} nhóm</span>
            <span>Hạn mức tối đa: {maxQuota} nhóm</span>
          </div>
        </div>
      </div>

      {/* ── 4 Key KPI Metrics ── */}
      <div className="dashboard-metrics-grid">
        <div className="metric-card-clean">
          <div className="metric-icon-box" style={{ color: 'var(--primary)', backgroundColor: 'var(--primary-light)' }}>
            <Layers size={20} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Hạn ngạch tối đa</span>
            <span className="metric-number">{maxQuota} nhóm</span>
            <span className="metric-subtext">Quy định học kỳ EXE</span>
          </div>
        </div>

        <div className="metric-card-clean">
          <div className="metric-icon-box" style={{ color: '#0F766E', backgroundColor: '#CCFBF1' }}>
            <CheckCircle2 size={20} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Đang hướng dẫn</span>
            <span className="metric-number">{currentCount} nhóm</span>
            <span className="metric-subtext">Đã khóa danh sách đồng hành</span>
          </div>
        </div>

        <div className="metric-card-clean">
          <div className="metric-icon-box" style={{ color: '#B26A00', backgroundColor: '#FEF3C7' }}>
            <Inbox size={20} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Yêu cầu chờ duyệt</span>
            <span className="metric-number">{pendingRequests.length} nhóm</span>
            <span className="metric-subtext">{pendingRequests.length > 0 ? 'Cần phản hồi sớm' : 'Đã duyệt hết'}</span>
          </div>
        </div>

        <div className="metric-card-clean">
          <div className="metric-icon-box" style={{ color: '#475569', backgroundColor: '#F1F5F9' }}>
            <Sparkles size={20} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Suất còn trống</span>
            <span className="metric-number">{remainingQuota} suất</span>
            <span className="metric-subtext">{isQuotaFull ? 'Không thể nhận thêm' : 'Sẵn sàng nhận thêm'}</span>
          </div>
        </div>
      </div>

      {/* ── Main Two-Column Layout ── */}
      <div className="dashboard-main-grid" style={{ marginTop: 'var(--space-6)' }}>
        {/* Left Column: Incoming Pending Requests */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>Yêu cầu mời hướng dẫn mới</span>
                  {pendingRequests.length > 0 && (
                    <span className="badge badge-warning" style={{ fontSize: 11 }}>
                      {pendingRequests.length} chờ xử lý
                    </span>
                  )}
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Các nhóm sinh viên đã hoàn thành đề cương dự án và gửi thư mời Thầy làm Mentor
                </p>
              </div>

              <Link to="/mentor/requests" className="btn btn-ghost btn-sm">
                Xem tất cả ({mentorRequests.length}) <ArrowRight size={14} />
              </Link>
            </div>

            {pendingRequests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-secondary)' }}>
                <CheckCircle2 size={36} color="var(--primary)" style={{ margin: '0 auto 10px' }} />
                <div style={{ fontWeight: 600, fontSize: 14 }}>Không còn yêu cầu nào chờ duyệt</div>
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>
                  Tất cả hồ sơ gửi đến đã được phản hồi đầy đủ.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {pendingRequests.slice(0, 2).map((req) => (
                  <div key={req.id} className="proposal-card" style={{ padding: 18 }}>
                    <div className="proposal-card-top">
                      <div>
                        <div className="proposal-group-name">
                          <span>{req.groupName}</span>
                          <span className="badge badge-teal" style={{ fontSize: 11 }}>{req.industry}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                          Nhóm trưởng: <strong style={{ color: 'var(--text-main)' }}>{req.leader}</strong> · Gửi lúc {new Date(req.createdAt).toLocaleDateString('vi-VN')}
                        </div>
                      </div>
                      <span className="badge badge-warning">Chờ Thầy duyệt</span>
                    </div>

                    <div className="proposal-topic-title" style={{ fontSize: 13.5, marginBottom: 10 }}>
                      💡 {req.topic}
                    </div>

                    {/* Team letter */}
                    <div className="team-pitch-quote" style={{ margin: '8px 0 12px', fontSize: 12 }}>
                      "{req.message.slice(0, 160)}..."
                    </div>

                    {/* Actions */}
                    <div className="proposal-actions-bar" style={{ paddingTop: 10 }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleOpenDecision(req, 'view')}
                        style={{ padding: '4px 8px' }}
                      >
                        <FileText size={14} />
                        <span>Xem toàn bộ đề cương</span>
                      </button>

                      <div className="decision-buttons-group">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenDecision(req, 'reject')}
                          style={{ color: 'var(--error)' }}
                        >
                          <XCircle size={14} />
                          <span>Từ chối</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={isQuotaFull}
                          title={isQuotaFull ? 'Hạn ngạch đã đầy' : 'Chấp nhận hướng dẫn nhóm'}
                          onClick={() => handleOpenDecision(req, 'accept')}
                        >
                          <CheckCircle2 size={14} />
                          <span>Chấp nhận hướng dẫn</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Mentored Groups */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>
                  Nhóm đang đồng hành hướng dẫn ({assignedGroups.length})
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Theo dõi mốc triển khai MVP và lịch họp cố vấn định kỳ
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {assignedGroups.map((grp) => (
                <div
                  key={grp.id}
                  style={{
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px 18px',
                    backgroundColor: '#FFFFFF'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>
                        {grp.name}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {grp.topic}
                      </div>
                    </div>
                    <span className="badge badge-green" style={{ fontSize: 11 }}>
                      Đang hướng dẫn
                    </span>
                  </div>

                  <div style={{ margin: '10px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{grp.milestone}</span>
                      <span style={{ color: 'var(--primary)' }}>{grp.milestoneProgress}%</span>
                    </div>
                    <div style={{ height: 6, width: '100%', backgroundColor: '#E2E8F0', borderRadius: 9999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${grp.milestoneProgress}%`, backgroundColor: 'var(--primary)', borderRadius: 9999 }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-muted)', paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Clock size={13} color="var(--primary)" />
                      <strong style={{ color: 'var(--text-main)' }}>Lịch họp tới:</strong> {grp.nextMeeting}
                    </span>
                    <span>Trưởng nhóm: {grp.leader}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Quota Guideline & Quick Schedule */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Quota Rules Card */}
          <div className="card">
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldAlert size={17} color="var(--primary)" />
              <span>Quy chế Quota Cố vấn EXE</span>
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
              Tiêu chuẩn phân bổ giảng viên hướng dẫn của Hội đồng Khởi nghiệp Đại học FPT:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
              <div style={{ display: 'flex', gap: 10, fontSize: 12.5, lineHeight: 1.5 }}>
                <span style={{ color: 'var(--primary)', fontWeight: 700 }}>•</span>
                <span><strong>Hạn mức tối đa:</strong> Mỗi giảng viên hướng dẫn tối đa <strong>4 - 5 nhóm</strong> trong cùng một học kỳ để đảm bảo chất lượng cố vấn sâu sát.</span>
              </div>
              <div style={{ display: 'flex', gap: 10, fontSize: 12.5, lineHeight: 1.5 }}>
                <span style={{ color: 'var(--primary)', fontWeight: 700 }}>•</span>
                <span><strong>Cam kết số buổi:</strong> Tối thiểu 10 buổi cố vấn trực tiếp (1 buổi/tuần) và ký biên bản nghiệm thu từng giai đoạn.</span>
              </div>
              <div style={{ display: 'flex', gap: 10, fontSize: 12.5, lineHeight: 1.5 }}>
                <span style={{ color: 'var(--primary)', fontWeight: 700 }}>•</span>
                <span><strong>Quyền tự quyết:</strong> Mentor có toàn quyền duyệt đề tài phù hợp với chuyên môn hoặc từ chối kèm góp ý xây dựng cho nhóm.</span>
              </div>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="card">
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', marginBottom: 12 }}>
              Lối tắt tác vụ
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link to="/mentor/requests" className="quick-action-link">
                <span>Duyệt danh sách yêu cầu ({pendingRequests.length} chờ)</span>
                <ArrowRight size={14} color="var(--text-muted)" />
              </Link>
              <Link to="/groups" className="quick-action-link">
                <span>Xem tất cả nhóm khởi nghiệp toàn trường</span>
                <ArrowRight size={14} color="var(--text-muted)" />
              </Link>
              <Link to="/semesters" className="quick-action-link">
                <span>Theo dõi các mốc bảo vệ học kỳ</span>
                <ArrowRight size={14} color="var(--text-muted)" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal: Accept / Reject / View Proposal ── */}
      {selectedRequest && decisionModalType && (
        <div className="modal-backdrop" onClick={() => setDecisionModalType(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: decisionModalType === 'view' ? 680 : 520 }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)' }}>
                {decisionModalType === 'accept' && `Chấp nhận hướng dẫn: ${selectedRequest.groupName}`}
                {decisionModalType === 'reject' && `Từ chối yêu cầu: ${selectedRequest.groupName}`}
                {decisionModalType === 'view' && `Hồ sơ đề cương: ${selectedRequest.groupName}`}
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setDecisionModalType(null)} style={{ padding: 4 }}>
                <XCircle size={18} />
              </button>
            </div>

            {/* Modal Content for Accept */}
            {decisionModalType === 'accept' && (
              <div>
                <div className="alert alert-success" style={{ marginBottom: 16 }}>
                  <span>Sau khi chấp thuận, nhóm sẽ chính thức được ghi nhận vào Quota của Thầy ({currentCount + 1}/{maxQuota} nhóm).</span>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label className="input-label">Lời nhắn / Hướng dẫn ban đầu gửi tới nhóm (tùy chọn):</label>
                  <textarea
                    className="textarea"
                    rows={3}
                    placeholder="VD: Thầy đồng ý hướng dẫn nhóm. Nhóm trưởng liên hệ qua Zalo hoặc gặp Thầy vào sáng Thứ Năm tại phòng Co-working nhé!"
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                  <button className="btn btn-secondary" onClick={() => setDecisionModalType(null)}>Hủy bỏ</button>
                  <button className="btn btn-primary" onClick={handleConfirmDecision}>
                    <CheckCircle2 size={16} />
                    <span>Xác nhận chấp nhận</span>
                  </button>
                </div>
              </div>
            )}

            {/* Modal Content for Reject */}
            {decisionModalType === 'reject' && (
              <div>
                <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 14 }}>
                  Vui lòng gửi lý do hoặc lời khuyên mang tính góp ý để nhóm sinh viên có thể cải thiện đề tài hoặc tìm giảng viên phù hợp hơn:
                </p>
                <div style={{ marginBottom: 14 }}>
                  <label className="input-label">Lý do từ chối & Lời khuyên định hướng *</label>
                  <textarea
                    required
                    className="textarea"
                    rows={3}
                    placeholder="VD: Đề tài của nhóm rất tiềm năng, tuy nhiên học kỳ này lịch hướng dẫn của Thầy đã kín chuyên môn sâu. Thầy khuyên nhóm liên hệ Thầy Tuấn (Khoa HTTT) sẽ phù hợp hơn nhé."
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                  <button className="btn btn-secondary" onClick={() => setDecisionModalType(null)}>Hủy bỏ</button>
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

            {/* Modal Content for Full View */}
            {decisionModalType === 'view' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="proposal-highlight-grid">
                  <div className="proposal-highlight-box">
                    <div className="proposal-highlight-label">Lĩnh vực & Mô hình</div>
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
                  <div className="proposal-highlight-label">Vấn đề giải quyết</div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {selectedRequest.problemStatement}
                  </p>
                </div>

                <div>
                  <div className="proposal-highlight-label">Giải pháp & Điểm sáng tạo</div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {selectedRequest.solutionOverview}
                  </p>
                </div>

                <div>
                  <div className="proposal-highlight-label">Đội ngũ sinh viên ({selectedRequest.members?.length} thành viên)</div>
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

                <div className="team-pitch-quote" style={{ marginTop: 8 }}>
                  <strong>Thư từ nhóm:</strong> "{selectedRequest.message}"
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 12, borderTop: '1px solid var(--border-default)' }}>
                  <span style={{ fontSize: 12.5, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                    <FileText size={15} />
                    <span>{selectedRequest.pitchDeckName}</span>
                  </span>

                  <button className="btn btn-secondary btn-sm" onClick={() => setDecisionModalType(null)}>
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
