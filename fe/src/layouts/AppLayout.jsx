import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  LayoutGrid, Users, CalendarDays, Layers, KeyRound,
  Bell, ChevronRight, Menu, X, LogOut
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import './layout.css'

const adminNav = [
  { to: '/',           icon: LayoutGrid,  label: 'Tổng quan' },
  { to: '/students',   icon: Users,       label: 'Sinh viên' },
  { to: '/semesters',  icon: CalendarDays, label: 'Học kỳ' },
  { to: '/groups',     icon: Layers,      label: 'Nhóm & Matching' },
  { to: '/access',     icon: KeyRound,    label: 'Google Access' },
]

const studentNav = [
  { to: '/semesters', icon: CalendarDays, label: 'Học kỳ' },
  { to: '/groups',    icon: Layers,      label: 'Nhóm & Matching' },
]

export default function AppLayout() {
  const { account, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const isAdmin = account?.role === 'Admin'
  const nav = isAdmin ? adminNav : studentNav

  const currentLabel = nav.find(n =>
    n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to)
  )?.label || 'Tổng quan'

  return (
    <div className="app-shell">
      {/* Mobile overlay */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="sidebar-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`sidebar ${menuOpen ? 'is-open' : ''}`} aria-label="Điều hướng chính">
        <div className="sidebar-brand">
          <span className="brand-mark">EXE</span>
          <span className="brand-text">Team Matching</span>
        </div>

        <nav>
          <p className="nav-section-label">Không gian làm việc</p>
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button
            className="nav-item"
            onClick={() => {/* TODO: notifications */}}
          >
            <Bell size={19} />
            <span>Thông báo</span>
            <span className="nav-badge">3</span>
          </button>

          <div className="sidebar-profile">
            <div className="avatar avatar-sm avatar-gradient">
              {account?.username?.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <strong>{account?.username}</strong>
              <span>{isAdmin ? 'Quản trị viên' : 'Sinh viên'}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        <header className="topbar">
          <button
            className="menu-toggle"
            aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className="breadcrumb">
            <span>{isAdmin ? 'Quản trị' : 'Không gian cá nhân'}</span>
            <ChevronRight size={14} />
            <strong>{currentLabel}</strong>
          </div>

          <div className="topbar-actions">
            <button className="signout-btn" onClick={logout}>
              <LogOut size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
              Đăng xuất
            </button>
            <button className="topbar-icon-btn" aria-label="Thông báo">
              <Bell size={18} />
              <i className="notification-dot" />
            </button>
            <div className="topbar-avatar">
              {account?.username?.slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>

        <div className="content-area">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
