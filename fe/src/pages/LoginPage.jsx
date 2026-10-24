import { useEffect, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Users, KeyRound, ShieldCheck } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import './LoginPage.css'

function GoogleSignInButton({ onCredential }) {
  const mount = useRef(null)
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  useEffect(() => {
    if (!clientId) return
    const render = () => {
      window.google.accounts.id.initialize({ client_id: clientId, callback: onCredential })
      window.google.accounts.id.renderButton(mount.current, {
        theme: 'filled_black',
        size: 'large',
        width: 320,
        text: 'continue_with',
        shape: 'pill'
      })
    }
    if (window.google?.accounts?.id) render()
    else {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.onload = render
      document.head.appendChild(script)
      return () => script.remove()
    }
  }, [clientId, onCredential])

  if (!clientId) {
    return <p className="form-status" role="alert">Thiếu VITE_GOOGLE_CLIENT_ID trong fe/.env.local.</p>
  }
  return <div ref={mount} className="google-button-slot" />
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } }
}
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }
}

export default function LoginPage() {
  const { googleLogin, loginAsDemo, loginError, token, account } = useAuth()

  if (token && account) {
    return <Navigate to="/" replace />
  }

  return (
    <main className="login-page">
      {/* Left — Pitch */}
      <section className="login-pitch">
        <motion.div
          className="login-brand"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="brand-mark">EXE</span>
          <strong>Team Matching</strong>
        </motion.div>

        <motion.div
          className="pitch-content"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.p className="eyebrow" variants={itemVariants}>
            CAPSTONE WORKSPACE
          </motion.p>
          <motion.h1 variants={itemVariants}>
            Nhóm tốt bắt đầu từ{' '}
            <span className="gradient-text">một kết nối đúng.</span>
          </motion.h1>
          <motion.p variants={itemVariants}>
            Không gian phối hợp cho sinh viên, đề tài và mentor
            trong toàn bộ học kỳ — từ ghép nhóm đến bảo vệ cuối kỳ.
          </motion.p>
        </motion.div>

        <div className="pitch-stats">
          <motion.div
            className="stat-card stat-card-1"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <strong>200+</strong>
            <span>sinh viên</span>
          </motion.div>
          <motion.div
            className="stat-card stat-card-2"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <strong>72</strong>
            <span>nhóm đã tạo</span>
          </motion.div>
          <motion.div
            className="pitch-orb"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <Users size={34} />
          </motion.div>
        </div>

        <p className="login-footer">EXE Team Matching · FPT University</p>
      </section>

      {/* Right — Form */}
      <section className="login-form-section">
        <motion.div
          className="login-card"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="google-logo">G</div>
          <p className="eyebrow eyebrow-accent">CHÀO MỪNG TRỞ LẠI</p>
          <h2>Đăng nhập để tiếp tục</h2>
          <p className="login-help">
            Sử dụng tài khoản Google FPT đã được Admin phê duyệt.
          </p>

          {loginError && (
            <motion.div
              className="login-error"
              role="alert"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
            >
              {loginError}
            </motion.div>
          )}

          <GoogleSignInButton onCredential={googleLogin} />

          <div className="login-note">
            <KeyRound size={16} />
            <span>Chỉ email trong whitelist mới truy cập được hệ thống.</span>
          </div>

          <div className="demo-access-box">
            <span className="demo-badge">TRẢI NGHIỆM NHANH (DEMO MODE)</span>
            <p className="demo-text">Xem trước không gian quản trị hoặc sinh viên:</p>
            <div className="demo-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => loginAsDemo('Admin')}
              >
                <ShieldCheck size={14} /> Quản trị viên
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => loginAsDemo('Student')}
              >
                <Users size={14} /> Sinh viên
              </button>
            </div>
          </div>
        </motion.div>
      </section>
    </main>
  )
}
