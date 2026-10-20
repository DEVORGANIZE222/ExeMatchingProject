import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'

const icons = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  users: <><path d="M16 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-5A4.5 4.5 0 0 0 2 18.5V20"/><circle cx="9" cy="7" r="4"/><path d="M17 4.5a4 4 0 0 1 0 7.7M22 20v-1.5a4.5 4.5 0 0 0-2.8-4.15"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></>,
  bell: <><path d="M18 9a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 22h4"/></>,
  help: <><circle cx="12" cy="12" r="9"/><path d="M9.4 9a2.7 2.7 0 1 1 4.9 1.6c-.8 1.1-2.3 1.4-2.3 3.2M12 17h.01"/></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
  dots: <><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/></>,
  close: <><path d="m6 6 12 12M18 6 6 18"/></>,
  upload: <><path d="M12 16V3M7 8l5-5 5 5"/><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></>,
  key: <><circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M15 6l3 3M12 9l3 3"/></>,
}
function Icon({ name, size = 20 }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg> }
const nav = [['grid', 'Tổng quan'], ['users', 'Sinh viên'], ['calendar', 'Học kỳ'], ['layers', 'Nhóm & Matching'], ['key', 'Google Access']]
const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

function GoogleAccessPanel({ token, onLogin, toast }) {
  const [items, setItems] = useState([]); const [file, setFile] = useState(null); const [status, setStatus] = useState(''); const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    if (!token) return
    try {
      const response = await fetch(`${apiBase}/api/google-access`, { headers: { Authorization: `Bearer ${token}` } })
      const body = await response.json()
      if (!response.ok) throw new Error(body.message || 'Không thể tải danh sách.')
      setItems(body.data || [])
    } catch (error) { setStatus(error.message) }
  }, [token])
  useEffect(() => { const timer = window.setTimeout(load, 0); return () => window.clearTimeout(timer) }, [load])
  const upload = async () => {
    if (!file) { setStatus('Chọn tệp .xlsx có cột A tên Email trước khi tải lên.'); return }
    setBusy(true); setStatus('')
    try {
      const form = new FormData(); form.append('file', file)
      const response = await fetch(`${apiBase}/api/google-access/import/excel`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form })
      const body = await response.json()
      if (!response.ok) throw new Error(body.message || 'Import không thành công.')
      setFile(null); setStatus(`Đã thêm ${body.data.importedCount} email; ${body.data.existingCount} email đã có sẵn.`); toast('Danh sách email Google đã được cập nhật.'); await load()
    } catch (error) { setStatus(error.message) } finally { setBusy(false) }
  }
  const remove = async (id, email) => {
    if (!window.confirm(`Gỡ quyền đăng nhập Google cho ${email}?`)) return
    const response = await fetch(`${apiBase}/api/google-access/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    if (response.ok) { toast('Đã gỡ email khỏi whitelist.'); await load() } else setStatus('Không thể gỡ email. Vui lòng thử lại.')
  }
  if (!token) return <section className="access-page"><div className="access-intro"><div className="access-icon"><Icon name="key" size={30}/></div><div><p className="eyebrow">BẢO MẬT ĐĂNG NHẬP</p><h1>Google Access</h1><p>Chỉ email trong danh sách được phép mới có thể đăng nhập bằng Google.</p></div></div><div className="login-required"><Icon name="key" size={34}/><h2>Cần đăng nhập quản trị</h2><p>Đăng nhập Google bằng tài khoản Admin để import và quản lý whitelist.</p><button className="primary-button solid" onClick={onLogin}>Đăng nhập Google</button></div></section>
  return <section className="access-page"><div className="access-intro"><div className="access-icon"><Icon name="key" size={30}/></div><div><p className="eyebrow">BẢO MẬT ĐĂNG NHẬP</p><h1>Google Access</h1><p>Quản lý email được phép sử dụng Google Sign-In.</p></div></div><div className="access-grid"><article className="upload-panel"><p className="eyebrow">BƯỚC 1 · IMPORT WHITELIST</p><h2>Thêm email từ Excel</h2><p>Tải roster hoặc danh sách email. Hệ thống tự tìm cột <code>Email</code> hoặc <code>Gmail</code>, tối đa 2.000 email.</p><label className="drop-zone"><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => { setFile(e.target.files?.[0] || null); setStatus('') }}/><Icon name="upload" size={25}/><strong>{file ? file.name : 'Chọn tệp Excel'}</strong><span>{file ? 'Sẵn sàng import' : 'Kéo thả hoặc chọn tệp .xlsx'}</span></label><button className="primary-button solid import-button" disabled={busy || !file} onClick={upload}>{busy ? 'Đang import…' : 'Import danh sách'} <Icon name="arrow"/></button>{status && <p className="form-status" role="status">{status}</p>}</article><article className="allowed-panel"><div className="panel-heading"><div><p className="eyebrow">BƯỚC 2 · KIỂM TRA</p><h2>Email đang được phép</h2></div><span className="count-chip">{items.length}</span></div><div className="allowed-list">{items.length ? items.map((item) => <div className="allowed-row" key={item.id}><span className="email-dot"/><span>{item.email}</span><button aria-label={`Gỡ ${item.email}`} onClick={() => remove(item.id, item.email)}><Icon name="close" size={16}/></button></div>) : <p className="empty-list">Chưa có email được import.</p>}</div></article></div></section>
}

function GoogleLoginModal({ onClose, onCredential }) {
  const mount = useRef(null); const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID; const message = clientId ? '' : 'Thiếu VITE_GOOGLE_CLIENT_ID trong file fe/.env.local.'
  useEffect(() => {
    if (!clientId) return
    const render = () => {
      window.google.accounts.id.initialize({ client_id: clientId, callback: onCredential })
      window.google.accounts.id.renderButton(mount.current, { theme: 'outline', size: 'large', width: 310, text: 'continue_with', shape: 'rectangular' })
    }
    if (window.google?.accounts?.id) render()
    else { const script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client'; script.async = true; script.onload = render; document.head.appendChild(script); return () => script.remove() }
  }, [clientId, onCredential])
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="google-modal" role="dialog" aria-modal="true" aria-labelledby="google-login-title" onMouseDown={(e) => e.stopPropagation()}><button className="modal-close" aria-label="Đóng" onClick={onClose}><Icon name="close"/></button><div className="google-logo">G</div><p className="eyebrow">EXE TEAM MATCHING</p><h2 id="google-login-title">Đăng nhập bằng Google</h2><p>Chỉ tài khoản đã xác minh và có trong whitelist mới được truy cập.</p><div ref={mount} className="google-button-slot"/>{message && <p className="form-status" role="alert">{message}</p>}</section></div>
}

function GoogleSignInButton({ onCredential }) {
  const mount = useRef(null); const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  useEffect(() => {
    if (!clientId) return
    const render = () => {
      window.google.accounts.id.initialize({ client_id: clientId, callback: onCredential })
      window.google.accounts.id.renderButton(mount.current, { theme: 'outline', size: 'large', width: 320, text: 'continue_with', shape: 'rectangular' })
    }
    if (window.google?.accounts?.id) render()
    else { const script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client'; script.async = true; script.onload = render; document.head.appendChild(script); return () => script.remove() }
  }, [clientId, onCredential])
  return <>{clientId ? <div ref={mount} className="google-button-slot"/> : <p className="form-status" role="alert">Thiếu VITE_GOOGLE_CLIENT_ID trong fe/.env.local.</p>}</>
}

function LoginPage({ onCredential, error }) {
  return <main className="login-page"><section className="login-pitch"><div className="login-brand"><span className="brand-mark">EXE</span><strong>Team Matching</strong></div><div className="pitch-copy"><p className="eyebrow">CAPSTONE WORKSPACE</p><h1>Nhóm tốt bắt đầu từ một kết nối đúng.</h1><p>Không gian phối hợp cho sinh viên, đề tài và mentor trong toàn bộ học kỳ.</p></div><div className="pitch-orbit"><div className="login-stat one"><strong>200</strong><span>sinh viên</span></div><div className="login-stat two"><strong>72</strong><span>nhóm đã tạo</span></div><div className="login-core"><Icon name="users" size={38}/></div></div><p className="login-footer">EXE Team Matching · FPT University</p></section><section className="login-form-section"><div className="login-card"><div className="google-logo">G</div><p className="eyebrow">CHÀO MỪNG TRỞ LẠI</p><h2>Đăng nhập để tiếp tục</h2><p className="login-help">Sử dụng tài khoản Google FPT đã được Admin phê duyệt.</p>{error && <div className="login-error" role="alert">{error}</div>}<GoogleSignInButton onCredential={onCredential}/><div className="login-note"><Icon name="key" size={16}/><span>Chỉ email trong whitelist mới truy cập được.</span></div></div></section></main>
}

function ServiceOnePanel({ active, token, account, toast }) {
  const [semesters, setSemesters] = useState([]); const [students, setStudents] = useState([]); const [studentTotal, setStudentTotal] = useState(0); const [status, setStatus] = useState(''); const [busy, setBusy] = useState(false)
  const [semesterForm, setSemesterForm] = useState({ code: '', name: '', startDate: '', endDate: '', registrationDeadline: '', topicDeadline: '', mentorDeadline: '' })
  const [importForm, setImportForm] = useState({ semesterCode: '', initialPassword: '', file: null })
  const isAdmin = account.role === 'Admin'
  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${apiBase}${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) } })
    const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.message || 'Không thể kết nối dữ liệu.')
    return body.data
  }, [token])
  const load = useCallback(async () => {
    setBusy(true); setStatus('')
    try {
      const semesterData = await request('/api/semesters?page=1&pageSize=50&sortBy=startDate&descending=true'); setSemesters(semesterData.items || [])
      if (isAdmin && active === 'Sinh viên') { const roster = await request('/api/students?page=1&pageSize=2000&sortBy=code'); setStudents(roster.items || []); setStudentTotal(roster.totalCount || 0) }
    } catch (error) { setStatus(error.message) } finally { setBusy(false) }
  }, [active, isAdmin, request])
  useEffect(() => { const id = window.setTimeout(load, 0); return () => window.clearTimeout(id) }, [load])
  const toUtc = (value) => value ? new Date(value).toISOString() : null
  const createSemester = async (event) => {
    event.preventDefault(); setStatus('')
    const milestones = [semesterForm.registrationDeadline, semesterForm.topicDeadline, semesterForm.mentorDeadline]
    if (milestones.some(Boolean) && milestones.some((item) => !item)) { setStatus('Điền đủ ba mốc hoặc để trống cả ba.'); return }
    try {
      await request('/api/semesters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...semesterForm, startDate: toUtc(semesterForm.startDate), endDate: toUtc(semesterForm.endDate), registrationDeadline: toUtc(semesterForm.registrationDeadline), topicDeadline: toUtc(semesterForm.topicDeadline), mentorDeadline: toUtc(semesterForm.mentorDeadline) }) })
      setSemesterForm({ code: '', name: '', startDate: '', endDate: '', registrationDeadline: '', topicDeadline: '', mentorDeadline: '' }); toast('Đã tạo học kỳ.'); await load()
    } catch (error) { setStatus(error.message) }
  }
  const importRoster = async (event) => {
    event.preventDefault(); if (!importForm.file) { setStatus('Chọn tệp Excel trước khi import.'); return }; setStatus('')
    try { const data = new FormData(); data.append('file', importForm.file); data.append('semesterCode', importForm.semesterCode); data.append('initialPassword', importForm.initialPassword); const result = await request('/api/students/import/excel', { method: 'POST', body: data }); toast(`Đã import ${result.importedCount} sinh viên và đồng bộ Google Access.`); setImportForm({ semesterCode: '', initialPassword: '', file: null }); await load() } catch (error) { setStatus(error.message) }
  }
  const schedule = account.student ? semesters.filter((item) => item.code === account.student.semesterCode) : semesters
  if (active === 'Sinh viên') return <section className="service-page"><div className="service-heading"><div><p className="eyebrow">ROSTER & GOOGLE ACCESS</p><h1>Sinh viên</h1><p>Email từ roster sẽ được tự động thêm vào Google whitelist.</p></div><span className="count-chip">{studentTotal}</span></div><div className="service-grid"><form className="panel product-form" onSubmit={importRoster}><p className="eyebrow">IMPORT EXCEL</p><h2>Thêm roster một lần</h2><select required value={importForm.semesterCode} onChange={(e) => setImportForm({ ...importForm, semesterCode: e.target.value })}><option value="">Chọn học kỳ</option>{semesters.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.code}>{item.code} · {item.name}</option>)}</select><input required type="password" minLength="12" placeholder="Mật khẩu khởi tạo (từ 12 ký tự)" value={importForm.initialPassword} onChange={(e) => setImportForm({ ...importForm, initialPassword: e.target.value })}/><label className="drop-zone"><input required type="file" accept=".xlsx" onChange={(e) => setImportForm({ ...importForm, file: e.target.files?.[0] || null })}/><Icon name="upload" size={25}/><strong>{importForm.file?.name || 'Chọn file roster .xlsx'}</strong><span>Nhận các cột MSSV, Họ tên, Email/Gmail, Ngành · tối đa 2.000 sinh viên</span></label><button className="primary-button solid" disabled={busy}>Import & cấp Google Access <Icon name="arrow"/></button></form><article className="panel roster-panel"><p className="eyebrow">DANH SÁCH ROSTER</p><h2>{studentTotal || '—'} sinh viên</h2><div className="roster-list">{students.map((item) => <div key={item.id}><span className="student-initial">{item.fullName.slice(0, 1)}</span><span><strong>{item.fullName}</strong><small>{item.studentCode} · {item.email}</small></span></div>)}{!students.length && <p className="empty-list">Chưa có roster cho học kỳ này.</p>}</div></article></div>{status && <p className="form-status" role="status">{status}</p>}</section>
  if (active === 'Học kỳ') return <section className="service-page"><div className="service-heading"><div><p className="eyebrow">SEMESTER TIMELINE</p><h1>{isAdmin ? 'Học kỳ' : 'Lịch học kỳ'}</h1><p>{isAdmin ? 'Tạo lịch trước, sau đó mở import roster.' : 'Các mốc đã được Admin công bố.'}</p></div><span className="count-chip">{schedule.length}</span></div>{isAdmin && <form className="panel product-form semester-form" onSubmit={createSemester}><p className="eyebrow">HỌC KỲ MỚI</p><div className="form-two"><input required placeholder="Mã · FA26" value={semesterForm.code} onChange={(e) => setSemesterForm({ ...semesterForm, code: e.target.value })}/><input required placeholder="Tên học kỳ" value={semesterForm.name} onChange={(e) => setSemesterForm({ ...semesterForm, name: e.target.value })}/><label>Bắt đầu<input required type="datetime-local" value={semesterForm.startDate} onChange={(e) => setSemesterForm({ ...semesterForm, startDate: e.target.value })}/></label><label>Kết thúc<input required type="datetime-local" value={semesterForm.endDate} onChange={(e) => setSemesterForm({ ...semesterForm, endDate: e.target.value })}/></label><label>Đóng ghép nhóm<input type="datetime-local" value={semesterForm.registrationDeadline} onChange={(e) => setSemesterForm({ ...semesterForm, registrationDeadline: e.target.value })}/></label><label>Đóng đề tài<input type="datetime-local" value={semesterForm.topicDeadline} onChange={(e) => setSemesterForm({ ...semesterForm, topicDeadline: e.target.value })}/></label><label>Đóng mentor<input type="datetime-local" value={semesterForm.mentorDeadline} onChange={(e) => setSemesterForm({ ...semesterForm, mentorDeadline: e.target.value })}/></label></div><button className="primary-button solid" disabled={busy}>Tạo học kỳ <Icon name="arrow"/></button></form>}<div className="semester-cards">{schedule.map((item) => <article className="panel semester-card" key={item.id}><span className={item.isActive ? 'active-dot' : 'inactive-dot'}/><p className="eyebrow">{item.code}</p><h2>{item.name}</h2><p>{new Date(item.startDate).toLocaleDateString('vi-VN')} — {new Date(item.endDate).toLocaleDateString('vi-VN')}</p><div className="mini-milestones"><span>Nhóm {item.registrationDeadline ? new Date(item.registrationDeadline).toLocaleDateString('vi-VN') : 'Chưa cấu hình'}</span><span>Đề tài {item.topicDeadline ? new Date(item.topicDeadline).toLocaleDateString('vi-VN') : '—'}</span></div></article>)}</div>{status && <p className="form-status" role="status">{status}</p>}</section>
  return null
}
function App() {
  const [active, setActive] = useState('Tổng quan'); const [notice, setNotice] = useState(''); const [menuOpen, setMenuOpen] = useState(false); const [selectedPeriod, setSelectedPeriod] = useState('Học kỳ Fall 2026'); const [modal, setModal] = useState(false); const [loginOpen, setLoginOpen] = useState(false); const [token, setToken] = useState(() => localStorage.getItem('exe_access_token') || ''); const [loginError, setLoginError] = useState(''); const [account, setAccount] = useState(null)
  const toast = (message) => { setNotice(message); window.setTimeout(() => setNotice(''), 2600) }
  const loadAccount = useCallback(async (accessToken, student = null) => {
    const response = await fetch(`${apiBase}/api/auth/me`, { headers: { Authorization: `Bearer ${accessToken}` } }); const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.message || 'Phiên đăng nhập không hợp lệ.'); const next = { ...body.data, student }; setAccount(next); setActive(next.role === 'Admin' ? 'Tổng quan' : 'Học kỳ')
  }, [])
  useEffect(() => { if (!token || account) return; loadAccount(token).catch((error) => { localStorage.removeItem('exe_access_token'); setToken(''); setLoginError(error.message) }) }, [account, loadAccount, token])
  const googleCredential = async ({ credential }) => {
    try {
      const response = await fetch(`${apiBase}/api/auth/google`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.message || 'Đăng nhập Google không thành công.')
      localStorage.setItem('exe_access_token', body.data.token); await loadAccount(body.data.token, body.data.student); setLoginError(''); setToken(body.data.token); setLoginOpen(false); toast('Đăng nhập Google thành công.')
    } catch (error) { setLoginError(error.message || 'Không thể kết nối đến hệ thống.') }
  }
  if (!token) return <LoginPage onCredential={googleCredential} error={loginError}/>
  if (!account) return <main className="login-page"><section className="login-form-section"><div className="login-card"><div className="google-logo">EXE</div><h2>Đang mở không gian học kỳ…</h2></div></section></main>
  const visibleNav = account.role === 'Admin' ? nav.filter(([, label]) => label !== 'Nhóm & Matching') : nav.filter(([, label]) => label === 'Học kỳ')
  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'is-open' : ''}`} aria-label="Điều hướng chính"><div className="brand"><span className="brand-mark">EXE</span><span>Team Matching</span></div><nav><p className="nav-label">Không gian làm việc</p>{visibleNav.map(([icon,label]) => <button key={label} className={`nav-item ${active === label ? 'active' : ''}`} onClick={() => {setActive(label);setMenuOpen(false)}} aria-current={active === label ? 'page' : undefined}><Icon name={icon}/><span>{label}</span></button>)}</nav><div className="sidebar-bottom"><button className="nav-item" onClick={() => toast('Thông báo đang được cập nhật.')}><Icon name="bell"/><span>Thông báo</span><b>3</b></button><div className="profile"><div className="avatar">{account.username.slice(0, 1).toUpperCase()}</div><div><strong>{account.username}</strong><span>{account.role === 'Admin' ? 'Quản trị viên' : 'Sinh viên'}</span></div></div></div></aside>
    <main><header className="topbar"><button className="menu-button" aria-label={menuOpen?'Đóng menu':'Mở menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen?'close':'layers'}/></button><div className="crumb"><span>{account.role === 'Admin' ? 'Quản trị' : 'Không gian cá nhân'}</span><Icon name="arrow" size={16}/><strong>{active}</strong></div><div className="top-actions">{token ? <button className="signed-in" onClick={() => { localStorage.removeItem('exe_access_token'); setAccount(null); setToken(''); toast('Đã đăng xuất.')}}>Đăng xuất</button> : <button className="signin-button" onClick={() => setLoginOpen(true)}>Đăng nhập Google</button>}<button className="icon-button" aria-label="Thông báo" onClick={() => toast('Bạn có 3 thông báo mới.')}><Icon name="bell"/><i/></button><div className="top-avatar">{account.username.slice(0, 1).toUpperCase()}</div></div></header>
    <div className="content">{active === 'Google Access' ? <GoogleAccessPanel token={token} onLogin={() => setLoginOpen(true)} toast={toast}/> : active === 'Sinh viên' || active === 'Học kỳ' ? <ServiceOnePanel active={active} token={token} account={account} toast={toast}/> : <><section className="welcome-row"><div><p className="eyebrow">BẢNG ĐIỀU KHIỂN</p><h1>Chào buổi sáng, {account.username} <span>✦</span></h1><p className="subtle">Quản lý roster, Google Access và các mốc học kỳ tại một nơi.</p></div><button className="period-select" onClick={() => setSelectedPeriod(selectedPeriod === 'Học kỳ Fall 2026' ? 'Học kỳ Spring 2027' : 'Học kỳ Fall 2026')}><Icon name="calendar"/><span>{selectedPeriod}</span><small>⌄</small></button></section>
    <section className="hero-card"><div className="hero-copy"><p className="hero-tag">SERVICE 1 · IDENTITY & SEMESTER</p><h2>Roster sạch, truy cập đúng.</h2><p>Tạo học kỳ, nhập danh sách sinh viên và cấp Google Access trong một quy trình có kiểm soát.</p><button className="primary-button" onClick={() => setActive('Học kỳ')}>Mở học kỳ <Icon name="arrow"/></button></div><div className="hero-visual" aria-label="Minh họa quản lý học kỳ"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="visual-card purple"><span>01</span><small>tạo học kỳ</small></div><div className="visual-card gold"><span>02</span><small>import roster</small></div><div className="visual-card white"><span>03</span><small>Google Access</small></div><div className="center-orb"><Icon name="users" size={34}/></div></div></section>
    <section className="metrics" aria-label="Các bước quản trị Service 1">{[['01','Cấu hình học kỳ','calendar','neutral'],['02','Import roster','users','purple'],['03','Google whitelist','key','gold'],['JWT','Đăng nhập an toàn','layers','mint']].map(([value,label,icon,tone]) => <article key={label} className="metric-card"><div className={`metric-icon ${tone}`}><Icon name={icon}/></div><div><strong>{value}</strong><span>{label}</span></div><button aria-label={`Mở ${label}`} onClick={() => setActive(label === 'Cấu hình học kỳ' ? 'Học kỳ' : label === 'Import roster' ? 'Sinh viên' : label === 'Google whitelist' ? 'Google Access' : 'Tổng quan')}><Icon name="dots"/></button></article>)}</section>
    <section className="dashboard-grid"><article className="panel progress-panel"><div className="panel-heading"><div><p className="eyebrow">TIẾN ĐỘ CHUNG</p><h2>Hành trình học kỳ</h2></div><button className="text-button" onClick={() => toast('Đang mở lịch học kỳ.')}>Chi tiết <Icon name="arrow" size={17}/></button></div><div className="timeline">{[['01','Khởi tạo học kỳ','Đã hoàn thành','done'],['02','Tự do ghép nhóm','Đang diễn ra','current'],['03','Random matching','Sắp diễn ra','next'],['04','Đăng ký đề tài','Sắp diễn ra','next']].map(([num,title,status,type]) => <div className={`timeline-item ${type}`} key={num}><span className="step">{num}</span><div><strong>{title}</strong><small>{status}</small></div></div>)}</div></article><article className="panel action-panel"><div className="panel-heading"><div><p className="eyebrow">CẦN LƯU Ý</p><h2>Việc hôm nay</h2></div><span className="count-chip">3</span></div><div className="task-list">{[['gold','24 sinh viên chưa có nhóm','Cần theo dõi trước hạn đăng ký'],['purple','18 nhóm đang chờ bầu leader','Gửi nhắc nhở để hoàn tất'],['mint','4 yêu cầu hỗ trợ mới','Từ sinh viên trong học kỳ']].map(([tone,title,description]) => <button key={title} onClick={() => toast(`Đã mở: ${title}.`)}><span className={`task-dot ${tone}`}/><div><strong>{title}</strong><small>{description}</small></div><Icon name="arrow" size={18}/></button>)}</div><button className="secondary-button" onClick={() => toast('Đã đánh dấu toàn bộ là đã xem.')}>Đánh dấu đã xem</button></article></section></>}</div></main>
    {modal && <div className="modal-backdrop" role="presentation" onMouseDown={() => setModal(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(e) => e.stopPropagation()}><button className="modal-close" aria-label="Đóng" onClick={() => setModal(false)}><Icon name="close"/></button><p className="eyebrow">TỔNG QUAN NHÓM</p><h2 id="modal-title">176 / 200 sinh viên đã vào nhóm</h2><div className="big-progress"><span/></div><p>Còn 24 sinh viên cần được theo dõi trước khi kích hoạt random matching.</p><button className="primary-button" onClick={() => {setModal(false);toast('Danh sách sinh viên đã được mở.')}}>Xem sinh viên chưa ghép</button></section></div>}{loginOpen && <GoogleLoginModal onClose={() => setLoginOpen(false)} onCredential={googleCredential}/>} {notice && <div className="toast" role="status">{notice}</div>}</div>
}
export default App
