import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Users, Layers, FileText, Calendar,
  ChevronRight, ArrowRight, CheckCircle2
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import './DashboardPage.css'

export default function DashboardPage() {
  const { account, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [selectedSemester, setSelectedSemester] = useState('FA26 - Fall 2026')

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
          <select
            className="select input-sm"
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
            style={{ width: 'auto', fontWeight: 600, minWidth: 170 }}
          >
            <option value="FA26 - Fall 2026">Học kỳ Fall 2026</option>
            <option value="SP27 - Spring 2027">Học kỳ Spring 2027</option>
          </select>
        </div>
      </div>

      {/* ── 4 Clean Metrics ── */}
      <div className="dashboard-metrics-grid">
        <div className="metric-card-clean">
          <div className="metric-icon-box">
            <Users size={20} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Tổng sinh viên</span>
            <span className="metric-number">200</span>
            <span className="metric-subtext">176 đã có nhóm · 24 chờ ghép</span>
          </div>
        </div>

        <div className="metric-card-clean">
          <div className="metric-icon-box">
            <Layers size={20} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Nhóm đã lập</span>
            <span className="metric-number">72</span>
            <span className="metric-subtext">54 nhóm đã đủ 5 thành viên</span>
          </div>
        </div>

        <div className="metric-card-clean">
          <div className="metric-icon-box">
            <FileText size={20} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Đề tài khởi nghiệp</span>
            <span className="metric-number">58</span>
            <span className="metric-subtext">42 đề tài đã được duyệt</span>
          </div>
        </div>

        <div className="metric-card-clean">
          <div className="metric-icon-box">
            <Calendar size={20} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Hạn ghép tự do</span>
            <span className="metric-number">Còn 4 ngày</span>
            <span className="metric-subtext">Hạn chót: 20/09/2026</span>
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
                  Lộ trình học kỳ Khởi nghiệp
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
                <div className="timeline-step-badge current">
                  2
                </div>
                <div className="timeline-step-content">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="timeline-step-title">Tự do ghép đội & Đăng ký đề tài</span>
                    <span className="badge badge-green">Đang diễn ra</span>
                  </div>
                  <p className="timeline-step-meta">Sinh viên chủ động kết nối theo năng lực và nộp ý tưởng dự án.</p>
                </div>
              </div>

              <div className="timeline-step-item">
                <div className="timeline-step-badge upcoming">
                  3
                </div>
                <div className="timeline-step-content">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="timeline-step-title">Hệ thống gợi ý ghép nhóm ngẫu nhiên (Random Matching)</span>
                    <span className="badge badge-neutral">Bắt đầu từ 21/09</span>
                  </div>
                  <p className="timeline-step-meta">Tự động ghép các sinh viên còn lẻ theo tiêu chí cân bằng chuyên ngành.</p>
                </div>
              </div>

              <div className="timeline-step-item">
                <div className="timeline-step-badge upcoming">
                  4
                </div>
                <div className="timeline-step-content">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="timeline-step-title">Phân công Mentor & Triển khai dự án</span>
                    <span className="badge badge-neutral">Sắp tới</span>
                  </div>
                  <p className="timeline-step-meta">Chốt giảng viên đồng hành hướng dẫn từng nhóm đến ngày bảo vệ.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Actionable items */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>
                Công việc cần theo dõi
              </h2>
              <span className="badge badge-warning">3 cần xử lý</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Danh sách các hạng mục cần đôn đốc trước khi hết hạn giai đoạn 2
            </p>

            <div className="task-list-clean">
              <div className="task-item-clean">
                <div>
                  <div className="task-item-title">24 sinh viên chưa tham gia nhóm nào</div>
                  <div className="task-item-desc">Cần gửi email nhắc nhở trước hạn đóng cổng ghép nhóm tự do</div>
                </div>
                <span className="badge badge-warning">Cận hạn</span>
              </div>

              <div className="task-item-clean">
                <div>
                  <div className="task-item-title">18 nhóm đang chờ bầu nhóm trưởng (Leader)</div>
                  <div className="task-item-desc">Yêu cầu hoàn tất bình chọn trong hệ thống để khóa danh sách thành viên</div>
                </div>
                <span className="badge badge-error">Thiếu Leader</span>
              </div>

              <div className="task-item-clean">
                <div>
                  <div className="task-item-title">6 nhóm chưa nộp mô tả đề tài khởi nghiệp</div>
                  <div className="task-item-desc">Hạn chót nộp tóm tắt đề tài vào ngày 05/10/2026</div>
                </div>
                <span className="badge badge-neutral">Chờ nộp</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Progress Card */}
          <div className="card">
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>
              Tỷ lệ ghép nhóm học kỳ
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              Tiến độ hoàn thiện đội ngũ sinh viên
            </p>

            <div className="progress-container">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
                <span>Đã vào nhóm: 176 / 200</span>
                <span style={{ color: 'var(--primary)' }}>88%</span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: '88%' }} />
              </div>
            </div>

            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Còn 24 sinh viên chưa có nhóm. Thuật toán gợi ý sẽ tự động phân bổ vào các nhóm còn thiếu vị trí chuyên ngành sau hạn chót.
            </p>

            <div style={{ marginTop: 'var(--space-5)' }}>
              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={() => navigate('/groups')}
              >
                Xem danh sách nhóm <ArrowRight size={15} />
              </button>
            </div>
          </div>

          {/* Quick Access Links */}
          <div className="card">
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', marginBottom: 12 }}>
              Lối tắt điều phối
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {isAdmin && (
                <>
                  <Link to="/students" className="quick-action-link">
                    <span>Import Roster sinh viên (.xlsx)</span>
                    <ChevronRight size={15} color="var(--text-muted)" />
                  </Link>

                  <Link to="/access" className="quick-action-link">
                    <span>Quản lý Google Whitelist</span>
                    <ChevronRight size={15} color="var(--text-muted)" />
                  </Link>
                </>
              )}

              <Link to="/semesters" className="quick-action-link">
                <span>Cấu hình mốc thời gian học kỳ</span>
                <ChevronRight size={15} color="var(--text-muted)" />
              </Link>

              <Link to="/groups" className="quick-action-link">
                <span>Khám phá nhóm & đề tài khởi nghiệp</span>
                <ChevronRight size={15} color="var(--text-muted)" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
