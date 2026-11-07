import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Users, Layers, FileText, Calendar,
  ChevronRight, ArrowRight, CheckCircle2, AlertCircle
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import './DashboardPage.css'

export default function DashboardPage() {
  const { account, request, isAdmin } = useAuth()
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

  // Determine fixed student semester or selectable admin semester
  const studentSemesterCode = account?.student?.semesterCode

  // 1. Load Semesters
  useEffect(() => {
    const fetchSemesters = async () => {
      try {
        const semData = await request('/api/semesters?page=1&pageSize=50&sortBy=startDate&descending=true')
        const items = semData.items || []
        setSemesters(items)

        if (isAdmin) {
          if (items.length > 0 && !selectedSemesterCode) {
            const defaultSem = items.find((s) => s.isActive) || items[0]
            setSelectedSemesterCode(defaultSem.code)
          }
        } else {
          // Student is strictly tied to their own semester set by Admin
          setSelectedSemesterCode(studentSemesterCode || '')
        }
      } catch {
        // ignore
      }
    }
    fetchSemesters()
  }, [account, isAdmin, request, studentSemesterCode])

  // 2. Load Realtime Metrics when Semester Changes
  const loadMetrics = useCallback(async () => {
    const targetCode = isAdmin ? selectedSemesterCode : studentSemesterCode
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

      // Fetch Student Metrics
      let totalStudents = 0
      let unmatchedStudents = 0
      try {
        const allStudentsRes = await request(`/api/students?semesterCode=${encodeURIComponent(targetCode)}&page=1&pageSize=1`)
        totalStudents = allStudentsRes?.totalCount || 0

        const unmatchedRes = await request(`/api/students?semesterCode=${encodeURIComponent(targetCode)}&hasGroup=false&page=1&pageSize=1`)
        unmatchedStudents = unmatchedRes?.totalCount || 0
      } catch {
        // user might not be admin to query all students
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

  const activeCode = isAdmin ? selectedSemesterCode : studentSemesterCode

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
          {isAdmin ? (
            // Admin can choose semester
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
      {!isAdmin && !studentSemesterCode && (
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

      {/* ── 4 Clean Metrics (Realtime API Data) ── */}
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
            <span className="metric-number">{metrics.registrationDeadlineText}</span>
            <span className="metric-subtext">
              {currentSemester?.registrationDeadline
                ? `Hạn chót: ${new Date(currentSemester.registrationDeadline).toLocaleDateString('vi-VN')}`
                : 'Chưa cài đặt thời hạn'}
            </span>
          </div>
        </div>
      </div>

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
                <div className="timeline-step-badge active">
                  <Users size={16} />
                </div>
                <div className="timeline-step-content">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="timeline-step-title">Ghép nhóm tự do & Bầu trưởng nhóm</span>
                    <span className="badge badge-green">Đang diễn ra</span>
                  </div>
                  <p className="timeline-step-meta">
                    Sinh viên tìm nhóm bù trừ kỹ năng, chốt danh sách tối đa 5 thành viên.
                  </p>
                </div>
              </div>

              <div className="timeline-step-item">
                <div className="timeline-step-badge pending">
                  <FileText size={16} />
                </div>
                <div className="timeline-step-content">
                  <span className="timeline-step-title">Đăng ký đề tài & Khớp Mentor hướng dẫn</span>
                  <p className="timeline-step-meta">
                    Nhóm trưởng đăng ký bài toán thị trường và gửi yêu cầu ghép Giảng viên Mentor.
                  </p>
                </div>
              </div>

              <div className="timeline-step-item">
                <div className="timeline-step-badge pending">
                  <Calendar size={16} />
                </div>
                <div className="timeline-step-content">
                  <span className="timeline-step-title">Thẩm định Hội đồng & Bảo vệ cuối kỳ</span>
                  <p className="timeline-step-meta">
                    Bảo vệ sản phẩm MVP và chiến lược gọi vốn hạt giống trước Hội đồng Khởi nghiệp FPT.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Quick Shortcuts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
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
    </div>
  )
}
