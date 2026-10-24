import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  CalendarDays, Users, KeyRound, Layers,
  ChevronRight, MoreHorizontal
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import './DashboardPage.css'

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } }
}

export default function DashboardPage() {
  const { account } = useAuth()
  const navigate = useNavigate()
  const [selectedPeriod, setSelectedPeriod] = useState('Học kỳ Fall 2026')

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible">
      {/* Welcome */}
      <motion.section className="welcome-row" variants={fadeUp}>
        <div>
          <p className="eyebrow">BẢNG ĐIỀU KHIỂN</p>
          <h1>
            Chào buổi sáng, {account?.username}{' '}
            <span className="wave">✦</span>
          </h1>
          <p className="welcome-subtitle">
            Quản lý roster, Google Access và các mốc học kỳ tại một nơi.
          </p>
        </div>
        <button
          className="period-select"
          onClick={() => setSelectedPeriod(
            selectedPeriod === 'Học kỳ Fall 2026' ? 'Học kỳ Spring 2027' : 'Học kỳ Fall 2026'
          )}
        >
          <CalendarDays size={16} />
          <span>{selectedPeriod}</span>
          <small style={{ fontSize: 16, marginLeft: 4 }}>⌄</small>
        </button>
      </motion.section>

      {/* Hero Card */}
      <motion.section className="hero-card" variants={fadeUp}>
        <div className="hero-copy">
          <p className="hero-tag">SERVICE 1 · IDENTITY & SEMESTER</p>
          <h2>Roster sạch, truy cập đúng.</h2>
          <p>
            Tạo học kỳ, nhập danh sách sinh viên và cấp Google Access
            trong một quy trình có kiểm soát.
          </p>
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/semesters')}>
            Mở học kỳ <ChevronRight size={16} />
          </button>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="hero-orbit hero-orbit-1" />
          <div className="hero-orbit hero-orbit-2" />
          <div className="visual-step step-purple">
            <strong>01</strong><small>tạo học kỳ</small>
          </div>
          <div className="visual-step step-gold">
            <strong>02</strong><small>import roster</small>
          </div>
          <div className="visual-step step-glass">
            <strong>03</strong><small>Google Access</small>
          </div>
          <div className="hero-center-orb">
            <Users size={30} color="white" />
          </div>
        </div>
      </motion.section>

      {/* Metrics */}
      <motion.section className="metrics-grid" variants={fadeUp} aria-label="Bước quản trị">
        {[
          { value: '01', label: 'Cấu hình học kỳ', icon: CalendarDays, tone: 'purple', to: '/semesters' },
          { value: '02', label: 'Import roster',    icon: Users,        tone: 'cyan',   to: '/students' },
          { value: '03', label: 'Google whitelist',  icon: KeyRound,     tone: 'amber',  to: '/access' },
          { value: 'JWT', label: 'Đăng nhập an toàn', icon: Layers,     tone: 'green',  to: '/' },
        ].map(({ value, label, icon: Icon, tone, to }) => (
          <motion.article
            key={label}
            className="metric-card"
            variants={fadeUp}
            onClick={() => navigate(to)}
            whileHover={{ y: -3 }}
          >
            <div className={`metric-icon ${tone}`}><Icon size={18} /></div>
            <div>
              <span className="metric-value">{value}</span>
              <span className="metric-label">{label}</span>
            </div>
            <button className="metric-more" aria-label={`Mở ${label}`}>
              <MoreHorizontal size={16} />
            </button>
          </motion.article>
        ))}
      </motion.section>

      {/* Dashboard Grid */}
      <motion.section className="dashboard-grid" variants={fadeUp}>
        {/* Timeline */}
        <article className="glass-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">TIẾN ĐỘ CHUNG</p>
              <h2>Hành trình học kỳ</h2>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => toast('Đang mở lịch học kỳ.')}>
              Chi tiết <ChevronRight size={15} />
            </button>
          </div>
          <div className="timeline-grid">
            {[
              { num: '01', title: 'Khởi tạo học kỳ', status: 'Đã hoàn thành', type: 'done' },
              { num: '02', title: 'Tự do ghép nhóm', status: 'Đang diễn ra',   type: 'current' },
              { num: '03', title: 'Random matching',  status: 'Sắp diễn ra',    type: 'next' },
              { num: '04', title: 'Đăng ký đề tài',  status: 'Sắp diễn ra',    type: 'next' },
            ].map(({ num, title, status, type }) => (
              <div className={`timeline-item ${type}`} key={num}>
                <span className="timeline-step">{num}</span>
                <div>
                  <strong>{title}</strong>
                  <small>{status}</small>
                </div>
              </div>
            ))}
          </div>
        </article>

        {/* Tasks */}
        <article className="glass-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">CẦN LƯU Ý</p>
              <h2>Việc hôm nay</h2>
            </div>
            <span className="count-chip">3</span>
          </div>
          <div className="task-list">
            {[
              { tone: 'amber',  title: '24 sinh viên chưa có nhóm', desc: 'Cần theo dõi trước hạn đăng ký' },
              { tone: 'purple', title: '18 nhóm đang chờ bầu leader', desc: 'Gửi nhắc nhở để hoàn tất' },
              { tone: 'green',  title: '4 yêu cầu hỗ trợ mới', desc: 'Từ sinh viên trong học kỳ' },
            ].map(({ tone, title, desc }) => (
              <button
                key={title}
                className="task-item"
                onClick={() => toast(`Đã mở: ${title}.`)}
              >
                <span className={`task-dot ${tone}`} />
                <div>
                  <strong>{title}</strong>
                  <small>{desc}</small>
                </div>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
          <button
            className="btn btn-secondary"
            style={{ width: '100%', marginTop: 12 }}
            onClick={() => toast('Đã đánh dấu toàn bộ là đã xem.')}
          >
            Đánh dấu đã xem
          </button>
        </article>
      </motion.section>
    </motion.div>
  )
}
