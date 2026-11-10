import { useEffect, useState } from 'react'
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, Calendar,
  Layers, ShieldCheck, LogOut, Menu, X,
  GraduationCap, Inbox
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import logoImg from '../assets/logo.png'
import './layout.css'

export default function AppLayout() {
  const { account, logout, isAdmin, isMentor, request } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0)
  const location = useLocation()
  const [failedAvatarUrl, setFailedAvatarUrl] = useState(null)

  useEffect(() => {
    if (!isMentor) return
    let active = true
    request('/api/mentor-requests/mine')
      .then((items) => {
        if (active) setPendingRequestsCount(items.filter((item) => item.status === 0).length)
      })
      .catch((error) => toast.error(error.message || 'Không thể cập nhật số yêu cầu mentor.'))
    return () => { active = false }
  }, [isMentor, location.pathname, request])

  const adminNav = [
    { to: '/',          icon: LayoutDashboard, label: 'Tổng quan', end: true },
    { to: '/students',  icon: Users,           label: 'Sinh viên' },
    { to: '/semesters', icon: Calendar,        label: 'Học kỳ' },
    { to: '/groups',    icon: Layers,          label: 'Nhóm & Đề tài' },
    { to: '/mentors',   icon: GraduationCap,   label: 'Giảng viên Mentor' },
    { to: '/access',    icon: ShieldCheck,     label: 'Google Access' },
  ]

  const mentorNav = [
    { to: '/mentor/dashboard', icon: LayoutDashboard, label: 'Tổng quan Cố vấn', end: true },
    {
      to: '/mentor/requests',
      icon: Inbox,
      label: 'Duyệt nhóm & Đề tài',
      badge: pendingRequestsCount > 0 ? pendingRequestsCount : null
    },
    { to: '/semesters',        icon: Calendar,        label: 'Lịch trình Học kỳ' },
  ]

  const studentNav = [
    { to: '/semesters', icon: Calendar, label: 'Học kỳ' },
    { to: '/groups',    icon: Layers,   label: 'Nhóm & Đề tài' },
  ]

  let navItems = studentNav
  let roleName = 'Sinh viên Khởi nghiệp'
  let roleBadgeClass = 'badge-green'

  if (isAdmin) {
    navItems = adminNav
    roleName = 'Quản trị viên'
    roleBadgeClass = 'badge-neutral'
  } else if (isMentor) {
    navItems = mentorNav
    roleName = 'Giảng viên Mentor'
    roleBadgeClass = 'badge-teal'
  }

  const userInitial = account?.username ? account.username.charAt(0).toUpperCase() : 'U'
  const avatarSrc = account?.avatarUrl || account?.googlePictureUrl || ''

  return (
    <div className="app-shell">
      {/* Topbar Navigation */}
      <header className="topbar">
        <div className="topbar-container">
          {/* Left: Brand */}
          <Link to="/" className="brand-link">
            <img src={logoImg} alt="ExeMatching Logo" className="brand-logo-img" style={{ width: 28, height: 28 }} />
            <span className="brand-title" style={{ fontSize: 18 }}>
              <span className="text-exe">Exe</span>
              <span className="text-matching">Matching</span>
            </span>
          </Link>

          {/* Center: Desktop Navigation */}
          <nav className="topbar-nav" aria-label="Điều hướng chính">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                <item.icon size={15} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="nav-pill-badge" title={`${item.badge} yêu cầu chờ duyệt`}>
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Right: User Profile & Actions */}
          <div className="topbar-actions">
            <div className="user-profile-badge">
              <div className="avatar avatar-sm avatar-primary" style={{ overflow: 'hidden' }}>
                {avatarSrc && avatarSrc !== failedAvatarUrl ? (
                  <img
                    key={avatarSrc}
                    src={avatarSrc}
                    alt={account?.username || 'Avatar'}
                    referrerPolicy="no-referrer"
                    onError={() => setFailedAvatarUrl(avatarSrc)}
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : userInitial}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div className="user-name">{account?.username || 'Người dùng'}</div>
                <div className="user-role" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className={`badge ${roleBadgeClass}`} style={{ fontSize: 10.5, padding: '1px 7px', borderRadius: 10 }}>
                    {roleName}
                  </span>
                </div>
              </div>
            </div>

            <button
              className="btn-signout"
              onClick={logout}
              title="Đăng xuất khỏi hệ thống"
            >
              <LogOut size={14} />
              <span>Đăng xuất</span>
            </button>

            {/* Mobile menu toggle */}
            <button
              className="mobile-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Đóng menu' : 'Mở menu'}
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="mobile-drawer">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <item.icon size={16} />
              <span>{item.label}</span>
              {item.badge && (
                <span className="nav-pill-badge" style={{ marginLeft: 'auto' }}>
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      )}

      {/* Main Content Area */}
      <main className="app-content">
        <div className="app-container">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
