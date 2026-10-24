import { useEffect, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import { GraduationCap, ShieldCheck, Sparkles } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
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
            width: 320,
            text: 'continue_with',
            shape: 'rectangular',
            logo_alignment: 'left'
          })
        }
      } catch {
        // Fallback gracefully without breaking UI
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
      <div ref={mount} style={{ display: 'flex', justifyContent: 'center' }} />
    </div>
  )
}

export default function LoginPage() {
  const { googleLogin, loginAsDemo, loginError, token, account } = useAuth()

  if (token && account) {
    return <Navigate to="/" replace />
  }

  return (
    <main className="login-page-wrapper">
      {/* ── Left Pane (55%): Value proposition & 3-step process ── */}
      <section className="login-left-pane">
        <div className="login-left-brand">
          <div className="brand-icon">
            <GraduationCap size={20} />
          </div>
          <span>CapstoneMatch</span>
        </div>

        <div className="login-hero-content">
          <div className="login-badge-eyebrow">
            <Sparkles size={13} />
            <span>Học kỳ Fall 2026</span>
          </div>

          <h1 className="login-hero-title">
            Nền tảng kết nối & điều phối đề tài Capstone
          </h1>

          <p className="login-hero-desc">
            Không gian làm việc chính thức cho sinh viên, đề tài và giảng viên hướng dẫn trong toàn bộ học kỳ khởi nghiệp tại Đại học FPT.
          </p>

          <div className="process-steps">
            <div className="step-card">
              <span className="step-number">1</span>
              <div>
                <h3 className="step-title">Khởi tạo hồ sơ & chuyên ngành</h3>
                <p className="step-desc">
                  Đồng bộ thông tin sinh viên từ danh sách Roster chính thức theo chuyên ngành SE, AI, IA, MKT, IB.
                </p>
              </div>
            </div>

            <div className="step-card">
              <span className="step-number">2</span>
              <div>
                <h3 className="step-title">Khớp đề tài & tìm đồng đội</h3>
                <p className="step-desc">
                  Tự do tìm nhóm phù hợp theo kỹ năng hoặc sử dụng hệ thống gợi ý ghép đội cân bằng chuyên môn.
                </p>
              </div>
            </div>

            <div className="step-card">
              <span className="step-number">3</span>
              <div>
                <h3 className="step-title">Chốt nhóm & Ghép Mentor hướng dẫn</h3>
                <p className="step-desc">
                  Khóa danh sách nhóm tối đa 5 thành viên, gửi đăng ký đề tài và kết nối với giảng viên phụ trách.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="login-left-footer">
          © 2026 CapstoneMatch · FPT University EXE Capstone Project
        </div>
      </section>

      {/* ── Right Pane (45%): Centered Auth Card ── */}
      <section className="login-right-pane">
        <div className="auth-card">
          <div className="auth-header">
            <h2 className="auth-title">Đăng nhập hệ thống</h2>
            <p className="auth-subtitle">
              Sử dụng tài khoản Google FPT (@fpt.edu.vn) để truy cập không gian học kỳ của bạn.
            </p>
          </div>

          {/* Whitelist Alert */}
          <div className="alert alert-success auth-alert">
            <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>Chỉ email sinh viên và giảng viên có trong danh sách phê duyệt mới có thể đăng nhập.</span>
          </div>

          {/* Error Message if any */}
          {loginError && (
            <div className="alert alert-error" style={{ marginBottom: 16 }}>
              <span>{loginError}</span>
            </div>
          )}

          {/* Google Sign-in CTA */}
          <GoogleAuthButton onCredential={googleLogin} />

          {/* Subtle Demo Mode Links at Footer */}
          <div className="auth-footer-notes">
            <div className="demo-access-links">
              <span>Trải nghiệm nhanh:</span>
              <button
                type="button"
                className="demo-link-btn"
                onClick={() => loginAsDemo('Admin')}
              >
                Vào vai Quản trị viên
              </button>
              <span>·</span>
              <button
                type="button"
                className="demo-link-btn"
                onClick={() => loginAsDemo('Student')}
              >
                Vào vai Sinh viên
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
