import { useState } from 'react'
import { NavLink, Outlet, Link } from 'react-router-dom'
import {
  LayoutDashboard, Users, Calendar,
  Layers, ShieldCheck, LogOut, Menu, X
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import logoImg from '../assets/logo.png'
import './layout.css'

const adminNav = [
  { to: '/',          icon: LayoutDashboard, label: 'Tổng quan', end: true },
  { to: '/students',  icon: Users,           label: 'Sinh viên' },
  { to: '/semesters', icon: Calendar,        label: 'Học kỳ' },
  { to: '/groups',    icon: Layers,          label: 'Nhóm & Đề tài' },
  { to: '/access',    icon: ShieldCheck,     label: 'Google Access' },
]

const studentNav = [
  { to: '/semesters', icon: Calendar,        label: 'Học kỳ' },
  { to: '/groups',    icon: Layers,          label: 'Nhóm & Đề tài' },
]

export default function AppLayout() {
  const { account, logout, isAdmin } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navItems = isAdmin ? adminNav : studentNav

  const userInitial = account?.username ? account.username.charAt(0).toUpperCase() : 'U'
  const roleName = isAdmin ? 'Quản trị viên' : 'Sinh viên'

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
              </NavLink>
            ))}
          </nav>

          {/* Right: User Profile & Actions */}
          <div className="topbar-actions">
            <div className="user-profile-badge">
              <div className="avatar avatar-sm avatar-primary">
                {userInitial}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div className="user-name">{account?.username || 'Người dùng'}</div>
                <div className="user-role">{roleName}</div>
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
