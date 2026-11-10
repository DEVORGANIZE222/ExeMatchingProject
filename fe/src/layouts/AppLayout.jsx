import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom'
import {
  Bell, Check, LayoutDashboard, Users, Calendar,
  Layers, ShieldCheck, LogOut, Menu, X,
  GraduationCap, Inbox, ChevronDown
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import logoImg from '../assets/logo.png'
import './layout.css'

function formatNotificationDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

export default function AppLayout() {
  const { account, logout, isAdmin, isMentor, request } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const userMenuRef = useRef(null)
  const notificationsRef = useRef(null)
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0)
  const location = useLocation()
  const [failedAvatarUrl, setFailedAvatarUrl] = useState(null)

  useEffect(() => {
    if (!userMenuOpen && !notificationsOpen) return
    const handleOutsideClick = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false)
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setNotificationsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [userMenuOpen, notificationsOpen])

  useEffect(() => {
    if (!isMentor) return
    let active = true
    Promise.all([
      request('/api/mentor-requests/mine'),
      request('/api/mentors/me/notifications').catch(() => [])
    ])
      .then(([items, alerts]) => {
        if (!active) return
        setPendingRequestsCount(items.filter((item) => item.status === 0).length)
        setNotifications(Array.isArray(alerts) ? alerts : [])
      })
      .catch((error) => toast.error(error.message || 'Không thể cập nhật số yêu cầu mentor.'))
    return () => { active = false }
  }, [isMentor, location.pathname, request])

  const unreadNotificationsCount = notifications.filter((item) => !item.isRead).length

  const toggleNotifications = async () => {
    const nextOpen = !notificationsOpen
    setUserMenuOpen(false)
    setNotificationsOpen(nextOpen)
    if (!nextOpen || !isMentor) return

    setNotificationsLoading(true)
    try {
      const alerts = await request('/api/mentors/me/notifications')
      setNotifications(Array.isArray(alerts) ? alerts : [])
    } catch {
      // Keep cached list if background refresh fails
    } finally {
      setNotificationsLoading(false)
    }
  }

  const markNotificationRead = async (id) => {
    try {
      await request(`/api/mentors/me/notifications/${id}/read`, { method: 'PUT' })
      setNotifications((current) => current.map((item) => (
        item.id === id ? { ...item, isRead: true } : item
      )))
    } catch (error) {
      toast.error(error.message || 'Không thể cập nhật thông báo.')
    }
  }

  const markAllNotificationsRead = async () => {
    try {
      await request('/api/mentors/me/notifications/read-all', { method: 'PUT' })
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })))
    } catch (error) {
      toast.error(error.message || 'Không thể đánh dấu thông báo đã đọc.')
    }
  }

  const adminNav = [
    { to: '/',          icon: LayoutDashboard, label: 'Tổng quan', end: true },
    { to: '/students',  icon: Users,           label: 'Sinh viên' },
    { to: '/semesters', icon: Calendar,        label: 'Học kỳ' },
    { to: '/groups',    icon: Layers,          label: 'Nhóm & Đề tài' },
    { to: '/mentors',   icon: GraduationCap,   label: 'Giảng viên hướng dẫn' },
    { to: '/access',    icon: ShieldCheck,     label: 'Google Access' },
  ]

  const mentorNav = [
    { to: '/', icon: LayoutDashboard, label: 'Tổng quan hướng dẫn', end: true, matchPaths: ['/', '/mentor/dashboard'] },
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
    roleName = 'Giảng viên hướng dẫn'
    roleBadgeClass = 'badge-teal'
  }

  const displayName = account?.mentor?.fullName || account?.student?.fullName || account?.username || 'Người dùng'
  const userInitial = displayName.trim().charAt(0).toUpperCase()
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
            {navItems.map((item) => {
              const forceActive = item.matchPaths ? item.matchPaths.includes(location.pathname) : false
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `nav-link ${isActive || forceActive ? 'active' : ''}`}
                >
                  <item.icon size={15} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="nav-pill-badge" title={`${item.badge} yêu cầu chờ duyệt`}>
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              )
            })}
          </nav>

          {/* Right: Notification Bell + User Profile Dropdown & Mobile Toggle */}
          <div className="topbar-actions">
            {isMentor && (
              <div className="notifications-menu-wrap" ref={notificationsRef}>
                <button
                  type="button"
                  className="topbar-bell-btn"
                  onClick={toggleNotifications}
                  aria-expanded={notificationsOpen}
                  aria-haspopup="dialog"
                  aria-label={unreadNotificationsCount > 0 ? `Thông báo (${unreadNotificationsCount} chưa đọc)` : 'Thông báo'}
                  title={unreadNotificationsCount > 0 ? `${unreadNotificationsCount} thông báo chưa đọc` : 'Thông báo'}
                >
                  <Bell size={18} />
                  {unreadNotificationsCount > 0 && (
                    <span className="topbar-bell-badge">
                      {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <div className="notifications-dropdown" role="dialog" aria-label="Danh sách thông báo">
                    <div className="notifications-dropdown-header">
                      <div className="notifications-dropdown-title-wrap">
                        <strong>Thông báo</strong>
                        {unreadNotificationsCount > 0 ? (
                          <span className="badge badge-warning" style={{ fontSize: 11, padding: '1px 7px' }}>
                            {unreadNotificationsCount} chưa đọc
                          </span>
                        ) : (
                          <span className="notifications-all-read">Đã đọc hết</span>
                        )}
                      </div>
                      {unreadNotificationsCount > 0 && (
                        <button
                          type="button"
                          className="notifications-mark-all-btn"
                          onClick={markAllNotificationsRead}
                        >
                          <Check size={13} />
                          <span>Đánh dấu đã đọc</span>
                        </button>
                      )}
                    </div>

                    <div className="notifications-dropdown-list">
                      {notificationsLoading && notifications.length === 0 ? (
                        <div className="notifications-dropdown-empty">
                          <span>Đang tải thông báo...</span>
                        </div>
                      ) : notifications.length === 0 ? (
                        <div className="notifications-dropdown-empty">
                          <div className="notifications-empty-icon">
                            <Bell size={18} />
                          </div>
                          <strong>Chưa có thông báo mới</strong>
                          <span>Thông báo khi có nhóm gửi lời mời hoặc cập nhật mới sẽ hiển thị tại đây.</span>
                        </div>
                      ) : (
                        notifications.slice(0, 12).map((notification) => (
                          <button
                            type="button"
                            key={notification.id}
                            className={`notification-popover-item ${notification.isRead ? '' : 'unread'}`}
                            onClick={() => !notification.isRead && markNotificationRead(notification.id)}
                          >
                            <div className="notification-popover-top">
                              <strong>{notification.title}</strong>
                              {!notification.isRead && <span className="notification-unread-dot" aria-hidden="true" />}
                            </div>
                            <p>{notification.message}</p>
                            <small>{formatNotificationDate(notification.createdAt)}</small>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="user-profile-menu-wrap" ref={userMenuRef}>
              <button
                type="button"
                className="user-profile-badge"
                onClick={() => {
                  setNotificationsOpen(false)
                  setUserMenuOpen((prev) => !prev)
                }}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                aria-label="Mở menu tài khoản"
              >
                <div className="avatar avatar-sm avatar-primary" style={{ overflow: 'hidden' }}>
                  {avatarSrc && avatarSrc !== failedAvatarUrl ? (
                    <img
                      key={avatarSrc}
                      src={avatarSrc}
                      alt={displayName}
                      referrerPolicy="no-referrer"
                      onError={() => setFailedAvatarUrl(avatarSrc)}
                      style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : userInitial}
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div className="user-name">{displayName}</div>
                  <div className="user-role" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className={`badge ${roleBadgeClass}`} style={{ fontSize: 10.5, padding: '1px 7px', borderRadius: 10 }}>
                      {roleName}
                    </span>
                  </div>
                </div>
                <ChevronDown size={14} color="var(--text-secondary)" style={{ marginLeft: 2, flexShrink: 0 }} />
              </button>

              {userMenuOpen && (
                <div className="user-profile-dropdown" role="menu">
                  <div className="user-profile-dropdown-header">
                    <strong>{displayName}</strong>
                    {account?.email && <span>{account.email}</span>}
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    className="user-dropdown-signout"
                    onClick={() => {
                      setUserMenuOpen(false)
                      logout()
                    }}
                  >
                    <LogOut size={15} />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              )}
            </div>

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
          {navItems.map((item) => {
            const forceActive = item.matchPaths ? item.matchPaths.includes(location.pathname) : false
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav-link ${isActive || forceActive ? 'active' : ''}`}
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
            )
          })}
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
