import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Users, Layers, FileText, Calendar,
  ChevronRight, ArrowRight, CheckCircle2, AlertCircle, Sparkles, Edit3
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import SemesterTimelineProgress from '../../components/SemesterTimelineProgress'
import StudentCoreModal from '../../components/StudentCoreModal'
import { getTeamRoleLabel } from '../../config/teamRoles'
import './DashboardPage.css'

function getMilestoneCountdown(dateStr) {
  if (!dateStr) return { text: 'Chưa thiết lập', subtext: 'Chưa cài đặt thời hạn', status: 'none', badge: 'Chưa đặt', badgeClass: 'badge-neutral', days: null }
  const deadline = new Date(dateStr)
  const now = new Date()
  const diffMs = deadline - now
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  const formatted = deadline.toLocaleDateString('vi-VN')

  if (diffDays > 0) {
    return {
      text: `Còn ${diffDays} ngày`,
      subtext: `Hạn chót: ${formatted}`,
      status: diffDays <= 3 ? 'urgent' : 'active',
      badge: diffDays <= 3 ? 'Sắp hết hạn' : 'Đang diễn ra',
      badgeClass: diffDays <= 3 ? 'badge-warning' : 'badge-green',
      days: diffDays
    }
  } else if (diffDays === 0) {
    return {
      text: 'Hạn là hôm nay',
      subtext: `Hạn chót: ${formatted}`,
      status: 'urgent',
      badge: 'Hôm nay',
      badgeClass: 'badge-warning',
      days: 0
    }
  } else {
    return {
      text: 'Đã hết hạn',
      subtext: `Đã đóng ngày ${formatted}`,
      status: 'ended',
      badge: 'Đã đóng',
      badgeClass: 'badge-neutral',
      days: diffDays
    }
  }
}

export default function DashboardPage() {
  const { account, request, isAdmin, isMentor, isStudent } = useAuth()
  const navigate = useNavigate()

  const [semesters, setSemesters] = useState([])
  const [selectedSemesterCode, setSelectedSemesterCode] = useState('')
  const [metrics, setMetrics] = useState({
    totalStudents: 0,
    matchedStudents: 0,
    unmatchedStudents: 0,
    totalGroups: 0,
    fullGroups: 0,
    topicCount: 0,
    registrationDeadlineText: 'Chưa thiết lập',
    daysLeft: null
  })
  const [currentSemester, setCurrentSemester] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showCoreModal, setShowCoreModal] = useState(false)

  // Determine fixed student semester or selectable admin semester
  const studentSemesterCode = account?.student?.semesterCode

  // 1. Load Semesters
  useEffect(() => {
    const fetchSemesters = async () => {
      try {
        const semData = await request('/api/semesters?page=1&pageSize=50&sortBy=startDate&descending=true')
        const items = semData.items || []
        setSemesters(items)

        if (isAdmin || isMentor) {
          if (items.length > 0 && !selectedSemesterCode) {
            const defaultSem = items.find((s) => s.isActive) || items[0]
            setSelectedSemesterCode(defaultSem.code)
          }
        } else {
          // Student is strictly tied to their own semester set by Admin, fallback to active
          const semCode = studentSemesterCode || (items.find((s) => s.isActive)?.code || items[0]?.code || '')
          setSelectedSemesterCode(semCode)
        }
      } catch {
        // ignore
      }
    }
    fetchSemesters()
  }, [account, isAdmin, isMentor, request, studentSemesterCode])

  // 2. Load Realtime Metrics when Semester Changes
  const loadMetrics = useCallback(async () => {
    const targetCode = isStudent && studentSemesterCode ? studentSemesterCode : selectedSemesterCode
    if (!targetCode) return

    setLoading(true)
    try {
      // Find current semester object
      const semObj = semesters.find((s) => s.code === targetCode)
      setCurrentSemester(semObj || null)

      // Calculate days left to registration deadline
      let daysLeft = null
      let regText = 'Chưa thiết lập'
      if (semObj?.registrationDeadline) {
        const deadline = new Date(semObj.registrationDeadline)
        const now = new Date()
        const diffMs = deadline - now
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
        if (diffDays > 0) {
          daysLeft = diffDays
          regText = `Còn ${diffDays} ngày`
        } else if (diffDays === 0) {
          regText = 'Hôm nay'
        } else {
          regText = 'Đã hết hạn'
        }
      }

      // Fetch Student Metrics (Admin only)
      let totalStudents = 0
      let unmatchedStudents = 0
      if (isAdmin) {
        try {
          const allStudentsRes = await request(`/api/students?semesterCode=${encodeURIComponent(targetCode)}&page=1&pageSize=1`)
          totalStudents = allStudentsRes?.totalCount || 0

          const unmatchedRes = await request(`/api/students?semesterCode=${encodeURIComponent(targetCode)}&hasGroup=false&page=1&pageSize=1`)
          unmatchedStudents = unmatchedRes?.totalCount || 0
        } catch {
          // ignore
        }
      }

      // Fetch Groups Metrics
      let totalGroups = 0
      let fullGroups = 0
      let topicCount = 0
      try {
        const groupsRes = await request(`/api/groups?semesterCode=${encodeURIComponent(targetCode)}&page=1&pageSize=100`)
        const items = groupsRes?.items || []
        totalGroups = groupsRes?.totalCount || items.length
        fullGroups = items.filter((g) => g.status === 2 || g.status === 'Locked' || (g.members?.length >= 5)).length
        topicCount = items.filter((g) => Boolean(g.topicTitle)).length
      } catch {
        // ignore
      }

      const matchedStudents = Math.max(0, totalStudents - unmatchedStudents)

      setMetrics({
        totalStudents,
        matchedStudents,
        unmatchedStudents,
        totalGroups,
        fullGroups,
        topicCount,
        registrationDeadlineText: regText,
        daysLeft
      })
    } finally {
      setLoading(false)
    }
  }, [isAdmin, request, selectedSemesterCode, semesters, studentSemesterCode])

  useEffect(() => {
    loadMetrics()
  }, [loadMetrics])

  const activeCode = isStudent ? (studentSemesterCode || selectedSemesterCode) : selectedSemesterCode
  const regCountdown = getMilestoneCountdown(currentSemester?.registrationDeadline)
  const topicCountdown = getMilestoneCountdown(currentSemester?.topicDeadline)
  const mentorCountdown = getMilestoneCountdown(currentSemester?.mentorDeadline)

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Tổng quan học kỳ</h1>
          <p className="page-subtitle">
            Chào {account?.username || 'Bạn'}, theo dõi tiến độ ghép nhóm, phê duyệt đề tài và lịch trình học kỳ Khởi nghiệp.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isAdmin || isMentor ? (
            // Admin & Mentor can choose semester
            <select
              className="select input-sm"
              value={selectedSemesterCode}
              onChange={(e) => setSelectedSemesterCode(e.target.value)}
              style={{ width: 'auto', fontWeight: 600, minWidth: 170 }}
            >
              {semesters.map((s) => (
                <option key={s.id} value={s.code}>
                  {s.code} · {s.name} {s.isActive ? '(Đang mở)' : ''}
                </option>
              ))}
            </select>
          ) : (
            // Student is fixed to their assigned semester
            <div className="badge badge-teal" style={{ fontSize: 13, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={14} />
              <span>
                Học kỳ của bạn: <strong>{currentSemester ? `${currentSemester.code} · ${currentSemester.name}` : (studentSemesterCode || 'Chưa xếp kỳ')}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Warning Banner if Student has no semester assigned */}
      {!isAdmin && !isMentor && !studentSemesterCode && (
        <div className="card" style={{ marginBottom: 'var(--space-6)', backgroundColor: '#FEFCE8', borderColor: '#FEF08A', display: 'flex', alignItems: 'center', gap: 12 }}>
          <AlertCircle size={22} color="#CA8A04" style={{ flexShrink: 0 }} />
          <div>
            <strong style={{ color: '#854D0E', fontSize: 14 }}>Tài khoản của bạn chưa được xếp vào học kỳ nào</strong>
            <p style={{ color: '#A16207', fontSize: 13, margin: '2px 0 0' }}>
              Vui lòng liên hệ Quản trị viên (Admin) để được nạp vào danh sách sinh viên đủ điều kiện làm Dự án Khởi nghiệp kỳ này.
            </p>
          </div>
        </div>
      )}

      {/* ── 4 Macro Metrics (Admin Only) ── */}
      {isAdmin && (
        <div className="dashboard-metrics-grid">
          <div className="metric-card-clean">
            <div className="metric-icon-box">
              <Users size={20} />
            </div>
            <div className="metric-info">
              <span className="metric-label">Tổng sinh viên</span>
              <span className="metric-number">{metrics.totalStudents}</span>
              <span className="metric-subtext">
                {metrics.matchedStudents} đã có nhóm · {metrics.unmatchedStudents} chờ ghép
              </span>
            </div>
          </div>

          <div className="metric-card-clean">
            <div className="metric-icon-box">
              <Layers size={20} />
            </div>
            <div className="metric-info">
              <span className="metric-label">Nhóm đã lập</span>
              <span className="metric-number">{metrics.totalGroups}</span>
              <span className="metric-subtext">
                {metrics.fullGroups} nhóm đã khóa hoặc đủ 5 người
              </span>
            </div>
          </div>

          <div className="metric-card-clean">
            <div className="metric-icon-box">
              <FileText size={20} />
            </div>
            <div className="metric-info">
              <span className="metric-label">Đề tài đã đăng ký</span>
              <span className="metric-number">{metrics.topicCount}</span>
              <span className="metric-subtext">Đề tài khởi nghiệp đã chốt</span>
            </div>
          </div>

          <div className="metric-card-clean">
            <div className="metric-icon-box">
              <Calendar size={20} />
            </div>
            <div className="metric-info">
              <span className="metric-label">Hạn ghép tự do</span>
              <span className="metric-number">{regCountdown.text}</span>
              <span className="metric-subtext">
                {regCountdown.subtext}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── 3 Key Milestone Countdowns & Timeline Progress ── */}
      {currentSemester && (
        <div className="card" style={{ marginBottom: 'var(--space-6)', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge badge-teal" style={{ fontWeight: 700 }}>{currentSemester.code}</span>
                <h2 style={{ fontSize: 16.5, fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  3 Mốc Thời Hạn & Đếm Ngược Học Kỳ Khởi Nghiệp
                </h2>
              </div>
            </div>
            {currentSemester.isActive ? (
              <span className="badge badge-green">Học kỳ đang kích hoạt</span>
            ) : (
              <span className="badge badge-neutral">Học kỳ đã đóng</span>
            )}
          </div>

          {/* 3 Milestone Countdown Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 18 }}>
            {/* Milestone 1: Ghép nhóm */}
            <div style={{
              padding: '12px 14px',
              borderRadius: '10px',
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
              display: 'flex',
              flexDirection: 'column',
              gap: 4
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#065F46' }}>
                  1. Hạn ghép nhóm tự do
                </span>
                <span className={`badge ${regCountdown.badgeClass}`} style={{ fontSize: 9.5 }}>
                  {regCountdown.badge}
                </span>
              </div>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#047857' }}>
                {regCountdown.text}
              </span>
              <span style={{ fontSize: 11.5, color: '#059669' }}>
                {regCountdown.subtext}
              </span>
            </div>

            {/* Milestone 2: Đăng ký đề tài */}
            <div style={{
              padding: '12px 14px',
              borderRadius: '10px',
              backgroundColor: '#FFFBEB',
              border: '1px solid #FDE68A',
              display: 'flex',
              flexDirection: 'column',
              gap: 4
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#92400E' }}>
                  2. Hạn chốt nộp đề tài
                </span>
                <span className={`badge ${topicCountdown.badgeClass}`} style={{ fontSize: 9.5 }}>
                  {topicCountdown.badge}
                </span>
              </div>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#B45309' }}>
                {topicCountdown.text}
              </span>
              <span style={{ fontSize: 11.5, color: '#D97706' }}>
                {topicCountdown.subtext}
              </span>
            </div>

            {/* Milestone 3: Khớp Mentor */}
            <div style={{
              padding: '12px 14px',
              borderRadius: '10px',
              backgroundColor: '#EFF6FF',
              border: '1px solid #BFDBFE',
              display: 'flex',
              flexDirection: 'column',
              gap: 4
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#1E40AF' }}>
                  3. Hạn chốt khớp Mentor
                </span>
                <span className={`badge ${mentorCountdown.badgeClass}`} style={{ fontSize: 9.5 }}>
                  {mentorCountdown.badge}
                </span>
              </div>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#1D4ED8' }}>
                {mentorCountdown.text}
              </span>
              <span style={{ fontSize: 11.5, color: '#2563EB' }}>
                {mentorCountdown.subtext}
              </span>
            </div>
          </div>

          {/* Visual Progress Bar with Today Marker */}
          <SemesterTimelineProgress
            startDate={currentSemester.startDate}
            endDate={currentSemester.endDate}
            registrationDeadline={currentSemester.registrationDeadline}
            topicDeadline={currentSemester.topicDeadline}
            mentorDeadline={currentSemester.mentorDeadline}
            showTodayMarker={currentSemester.isActive}
          />
        </div>
      )}

      {/* ── Main Content Grid ── */}
      <div className="dashboard-main-grid">
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Milestone Journey */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>
                  Lộ trình học kỳ Khởi nghiệp {activeCode ? `(${activeCode})` : ''}
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                  4 giai đoạn chính từ lúc mở cổng đến bảo vệ cuối kỳ
                </p>
              </div>
              <Link to="/semesters" className="btn btn-ghost btn-sm" style={{ gap: 4 }}>
                Lịch chi tiết <ChevronRight size={14} />
              </Link>
            </div>

            <div className="timeline-list">
              <div className="timeline-step-item">
                <div className="timeline-step-badge completed">
                  <CheckCircle2 size={16} />
                </div>
                <div className="timeline-step-content">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="timeline-step-title">Khởi tạo học kỳ & Cấp Google Access</span>
                    <span className="badge badge-teal">Đã hoàn thành</span>
                  </div>
                  <p className="timeline-step-meta">Import Roster sinh viên và đồng bộ whitelist đăng nhập Google FPT.</p>
                </div>
              </div>

              <div className="timeline-step-item">
                <div className={`timeline-step-badge ${regCountdown.days !== null && regCountdown.days >= 0 ? 'active' : 'completed'}`}>
                  <Users size={16} />
                </div>
                <div className="timeline-step-content">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="timeline-step-title">Ghép nhóm tự do & Bầu trưởng nhóm</span>
                    <span className={`badge ${regCountdown.badgeClass}`}>{regCountdown.badge}</span>
                  </div>
                  <p className="timeline-step-meta">
                    Sinh viên tìm nhóm bù trừ kỹ năng, chốt tối đa 5 thành viên. ({regCountdown.text} · {regCountdown.subtext})
                  </p>
                </div>
              </div>

              <div className="timeline-step-item">
                <div className={`timeline-step-badge ${topicCountdown.days !== null && topicCountdown.days >= 0 ? 'active' : 'pending'}`}>
                  <FileText size={16} />
                </div>
                <div className="timeline-step-content">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="timeline-step-title">Đăng ký đề tài & Khớp Mentor hướng dẫn</span>
                    <span className={`badge ${topicCountdown.badgeClass}`}>{topicCountdown.badge}</span>
                  </div>
                  <p className="timeline-step-meta">
                    Đăng ký bài toán thị trường và ghép Giảng viên Mentor. (Đề tài: {topicCountdown.text} | Mentor: {mentorCountdown.text})
                  </p>
                </div>
              </div>

              <div className="timeline-step-item">
                <div className="timeline-step-badge pending">
                  <Calendar size={16} />
                </div>
                <div className="timeline-step-content">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="timeline-step-title">Thẩm định Hội đồng & Bảo vệ cuối kỳ</span>
                    <span className="badge badge-neutral">
                      {currentSemester?.endDate ? `Hạn: ${new Date(currentSemester.endDate).toLocaleDateString('vi-VN')}` : 'Chưa xếp ngày'}
                    </span>
                  </div>
                  <p className="timeline-step-meta">
                    Bảo vệ sản phẩm MVP và chiến lược gọi vốn hạt giống trước Hội đồng Khởi nghiệp FPT.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Quick Shortcuts & Student Core */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {isStudent && account?.student && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={16} color="var(--primary)" /> Hồ sơ & Core của bạn
                  </h2>
                  <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4, marginBottom: 0 }}>
                    {account.student.fullName} · <strong>{account.student.studentCode}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setShowCoreModal(true)}
                >
                  <Edit3 size={13} /> Chọn Core
                </button>
              </div>

              <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '10px 12px', borderRadius: 8, marginBottom: 10 }}>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 2 }}>Ngành đào tạo</div>
                <strong style={{ fontSize: 13.5, color: 'var(--text-main)' }}>{account.student.major || 'Chưa phân ngành'}</strong>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Thế mạnh / Core chuyên môn:
                </div>
                {account.student.strengthRoles?.length ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {account.student.strengthRoles.map((role) => (
                      <span className="badge badge-teal" key={role}>{getTeamRoleLabel(role)}</span>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 12.5, color: '#B45309', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', padding: '8px 10px', borderRadius: 6, margin: 0 }}>
                    Bạn chưa chọn Core chuyên môn. Hãy bấm "Chọn Core" để các nhóm dễ tìm đồng đội phù hợp!
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="card">
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', marginBottom: 4 }}>
              Truy cập nhanh
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Thao tác nghiệp vụ theo vai trò của bạn
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link to="/groups" className="btn btn-primary" style={{ justifyContent: 'space-between' }}>
                <span>Khám phá & Quản lý Nhóm</span>
                <ArrowRight size={16} />
              </Link>

              {isAdmin && (
                <>
                  <Link to="/students" className="btn btn-outline" style={{ justifyContent: 'space-between' }}>
                    <span>Quản lý Roster Sinh viên</span>
                    <ArrowRight size={16} />
                  </Link>

                  <Link to="/semesters" className="btn btn-outline" style={{ justifyContent: 'space-between' }}>
                    <span>Thiết lập Lịch trình & Deadline</span>
                    <ArrowRight size={16} />
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      {showCoreModal && <StudentCoreModal onClose={() => setShowCoreModal(false)} />}
    </div>
  )
}
