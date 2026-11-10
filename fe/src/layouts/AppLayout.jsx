import { useCallback, useEffect, useRef, useState } from 'react'
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

const notificationTypeMeta = {
  'decision-approved': { label: 'Đã chấp thuận', className: 'badge-green' },
  'decision-rejected': { label: 'Từ chối', className: 'badge-error' },
  'progress-feedback': { label: 'Cập nhật tiến độ', className: 'badge-teal' },
}

function formatNotificationDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

export default function AppLayout() {
  const { account, logout, isAdmin, isMentor, isStudent, request } = useAuth()
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

  const studentSemesterCode = account?.student?.semesterCode || ''
  const hasNotificationBell = isMentor || isStudent

  const notificationsEndpoint = isMentor
    ? '/api/mentors/me/notifications'
    : isStudent && studentSemesterCode
      ? `/api/mentor-requests/student/notifications?semesterCode=${encodeURIComponent(studentSemesterCode)}`
      : null

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

  const loadNotifications = useCallback(() => {
    if (!notificationsEndpoint) return Promise.resolve([])
    return request(notificationsEndpoint)
      .then((alerts) => (Array.isArray(alerts) ? alerts : []))
      .catch(() => [])
  }, [notificationsEndpoint, request])

  useEffect(() => {
    if (!isMentor && !isStudent) return
    let active = true

    const refresh = () => {
      if (isMentor) {
        Promise.all([
          request('/api/mentor-requests/mine'),
          loadNotifications()
        ])
          .then(([items, alerts]) => {
            if (!active) return
            setPendingRequestsCount(items.filter((item) => item.status === 0).length)
            setNotifications(alerts)
          })
          .catch((error) => toast.error(error.message || 'Không thể cập nhật số yêu cầu mentor.'))
        return
      }

      loadNotifications().then((alerts) => {
        if (active) setNotifications(alerts)
      })
    }

    refresh()
    window.addEventListener('focus', refresh)
    return () => {
      active = false
      window.removeEventListener('focus', refresh)
    }
  }, [isMentor, isStudent, loadNotifications, location.pathname, request])

  const unreadNotificationsCount = notifications.filter((item) => !item.isRead).length

  const toggleNotifications = async () => {
    const nextOpen = !notificationsOpen
    setUserMenuOpen(false)
    setNotificationsOpen(nextOpen)
    if (!nextOpen || !notificationsEndpoint) return

    setNotificationsLoading(true)
    try {
      const alerts = await request(notificationsEndpoint)
      setNotifications(Array.isArray(alerts) ? alerts : [])
    } catch {
      // Keep cached list if background refresh fails
    } finally {
      setNotificationsLoading(false)
    }
  }

  const markNotificationRead = async (id) => {
    const url = isMentor
      ? `/api/mentors/me/notifications/${id}/read`
      : isStudent && studentSemesterCode
        ? `/api/mentor-requests/student/notifications/${id}/read?semesterCode=${encodeURIComponent(studentSemesterCode)}`
        : null
    if (!url) return

    try {
      await request(url, { method: 'PUT' })
      setNotifications((current) => current.map((item) => (
        item.id === id ? { ...item, isRead: true } : item
      )))
    } catch (error) {
      toast.error(error.message || 'Không thể cập nhật thông báo.')
    }
  }

  const markAllNotificationsRead = async () => {
    const url = isMentor
      ? '/api/mentors/me/notifications/read-all'
      : isStudent && studentSemesterCode
        ? `/api/mentor-requests/student/notifications/read-all?semesterCode=${encodeURIComponent(studentSemesterCode)}`
        : null
    if (!url) return

    try {
      await request(url, { method: 'PUT' })
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
            {hasNotificationBell && (
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
                        <strong>{isStudent ? 'Phản hồi từ Giảng viên' : 'Thông báo'}</strong>
                        {unreadNotificationsCount > 0 ? (
                          <span className="badge badge-warning" style={{ fontSize: 11, padding: '1px 7px' }}>
                            {unreadNotificationsCount} chưa đọc
                          </span>
                        ) : notifications.length > 0 ? (
                          <span className="notifications-all-read">Đã đọc hết</span>
                        ) : null}
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
                          <strong>{isStudent ? 'Chưa có phản hồi từ giảng viên' : 'Chưa có thông báo mới'}</strong>
                          <span>
                            {isStudent
                              ? 'Phản hồi duyệt lời mời hoặc nhận xét tiến độ từ Giảng viên hướng dẫn sẽ hiển thị tại đây.'
                              : 'Thông báo khi có nhóm gửi lời mời hoặc cập nhật mới sẽ hiển thị tại đây.'}
                          </span>
                        </div>
                      ) : (
                        notifications.slice(0, 12).map((notification) => {
                          const typeMeta = notificationTypeMeta[notification.type]
                          return (
                            <button
                              type="button"
                              key={notification.id}
                              className={`notification-popover-item ${notification.isRead ? '' : 'unread'} ${notification.type === 'decision-rejected' ? 'rejected' : ''}`}
                              onClick={() => !notification.isRead && markNotificationRead(notification.id)}
                            >
                              <div className="notification-popover-top">
                                <div className="notification-popover-heading">
                                  {typeMeta && (
                                    <span className={`badge ${typeMeta.className}`} style={{ fontSize: 10.5, padding: '1px 7px' }}>
                                      {typeMeta.label}
                                    </span>
                                  )}
                                  <strong>{notification.title}</strong>
                                </div>
                                {!notification.isRead && <span className="notification-unread-dot" aria-hidden="true" />}
                              </div>
                              <p>{notification.message}</p>
                              <small>{formatNotificationDate(notification.createdAt)}</small>
                            </button>
                          )
                        })
                      )}
                    </div>

                    {isStudent && location.pathname !== '/groups' && (
                      <div className="notifications-dropdown-footer">
                        <Link to="/groups" className="notifications-footer-link" onClick={() => setNotificationsOpen(false)}>
                          Đến trang Nhóm & Đề tài
                        </Link>
                      </div>
                    )}
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
