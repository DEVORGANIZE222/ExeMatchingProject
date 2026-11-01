import { useEffect, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import logoImg from '../assets/logo.png'
import './LoginPage.css'

function GoogleAuthButton({ onCredential }) {
  const mount = useRef(null)
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  useEffect(() => {
    if (!clientId) return
    const render = () => {
      try {
        if (window.google?.accounts?.id && mount.current) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: onCredential
          })
          window.google.accounts.id.renderButton(mount.current, {
            theme: 'outline',
            size: 'large',
            width: 344,
            text: 'continue_with',
            shape: 'rectangular',
            logo_alignment: 'left'
          })
        }
      } catch {
        // Fallback without throwing
      }
    }

    if (window.google?.accounts?.id) {
      render()
    } else {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.onload = render
      document.head.appendChild(script)
      return () => script.remove()
    }
  }, [clientId, onCredential])

  return (
    <div className="google-btn-wrapper">
      <div ref={mount} />
    </div>
  )
}

export default function LoginPage() {
  const { googleLogin, loginAsDemo, loginError, token, account } = useAuth()

  if (token && account) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="login-viewport">
      {/* ── Fixed Top Navigation Bar (24px - 32px from top edge) ── */}
      <header className="login-top-bar">
        <div className="login-top-bar-inner">
          <div className="login-brand-header">
            <img src={logoImg} alt="ExeMatching Logo" className="brand-logo-img" />
            <span className="brand-title">
              <span className="text-exe">Exe</span>
              <span className="text-matching">Matching</span>
            </span>
          </div>

          <div className="top-bar-meta">
            <span className="campus-badge">FPT University · Cổng Khởi nghiệp EXE</span>
          </div>
        </div>
      </header>

      {/* ── Main Center Grid Container (12-column, 7:5 ratio, vertically centered) ── */}
      <main className="login-center-container">
        {/* Left Column (col-span-7) */}
        <div className="login-col-left">
          <div className="login-announcement-pill">
            <span className="pill-pulse-dot" />
            <span>Học kỳ Fall 2026 · Cổng ghép nhóm Dự án Khởi nghiệp</span>
          </div>

          <h1 className="login-headline">
            Khởi đầu dự án khởi nghiệp với đội ngũ ăn ý
          </h1>

          <p className="login-subheadline">
            Không gian điều phối sinh viên, dự án khởi nghiệp và phân công giảng viên mentor theo tiêu chuẩn Đại học FPT.
          </p>

          {/* Stepper 3-Step Flow Card with Vertical Connectors */}
          <div className="workflow-stepper-card">
            <div className="stepper-item">
              <div className="stepper-track">
                <span className="stepper-circle">1</span>
                <span className="stepper-line" />
              </div>
              <div className="stepper-content">
                <h3 className="stepper-title">Khởi tạo hồ sơ & chuyên ngành</h3>
                <p className="stepper-desc">
                  Đồng bộ dữ liệu Roster theo các khối ngành SE, AI, IA, MKT, IB.
                </p>
              </div>
            </div>

            <div className="stepper-item">
              <div className="stepper-track">
                <span className="stepper-circle">2</span>
                <span className="stepper-line" />
              </div>
              <div className="stepper-content">
                <h3 className="stepper-title">Khớp đề tài & tìm đồng đội</h3>
                <p className="stepper-desc">
                  Tự do tìm nhóm theo kỹ năng bù trừ hoặc sử dụng thuật toán gợi ý ghép đội.
                </p>
              </div>
            </div>

            <div className="stepper-item">
              <div className="stepper-track">
                <span className="stepper-circle">3</span>
              </div>
              <div className="stepper-content">
                <h3 className="stepper-title">Chốt nhóm & Ghép Mentor hướng dẫn</h3>
                <p className="stepper-desc">
                  Khóa danh sách nhóm tối đa 5 thành viên và gửi đề xuất ghép mentor phụ trách.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (col-span-5) */}
        <div className="login-col-right">
          <div className="login-auth-card">
            <div className="auth-card-header">
              <h2 className="auth-card-title">Đăng nhập tài khoản</h2>
              <p className="auth-card-subtitle">
                Sử dụng email FPT University (@fpt.edu.vn) để truy cập không gian học kỳ của bạn.
              </p>
            </div>

            {/* Error Message if any */}
            {loginError && (
              <div className="alert alert-error" style={{ marginBottom: 14 }}>
                <span>{loginError}</span>
              </div>
            )}

            {/* Google Sign-in CTA (Full width, h-11) */}
            <div className="google-auth-slot">
              <GoogleAuthButton onCredential={googleLogin} />
            </div>

            {/* Whitelist Note Compact under Google button */}
            <div className="whitelist-note-compact">
              <ShieldCheck size={15} className="whitelist-icon" />
              <span>Chỉ email sinh viên và giảng viên có trong whitelist mới có quyền truy cập.</span>
            </div>

            {/* Demo Mode: 3 pills horizontal */}
            <div className="demo-mode-footer">
              <span className="demo-mode-label">Trải nghiệm nhanh:</span>
              <div className="demo-pills-row">
                <button
                  type="button"
                  className="demo-pill-btn"
                  onClick={() => loginAsDemo('Admin')}
                >
                  Quản trị viên
                </button>
                <button
                  type="button"
                  className="demo-pill-btn"
                  onClick={() => loginAsDemo('Mentor')}
                >
                  Giảng viên Mentor
                </button>
                <button
                  type="button"
                  className="demo-pill-btn"
                  onClick={() => loginAsDemo('Student')}
                >
                  Sinh viên
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Fixed Bottom Footer ── */}
      <footer className="login-bottom-footer">
        <span>© 2026 ExeMatching · FPT University · Dự án Khởi nghiệp EXE</span>
        <span>Hệ thống ghép nhóm & điều phối đề tài chính thức</span>
      </footer>
    </div>
  )
}
