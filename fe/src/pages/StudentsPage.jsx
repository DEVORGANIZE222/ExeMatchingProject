import { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Upload, ChevronRight } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import './ServicePages.css'

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } }
}

export default function StudentsPage() {
  const { request, isAdmin } = useAuth()
  const [semesters, setSemesters] = useState([])
  const [students, setStudents] = useState([])
  const [studentTotal, setStudentTotal] = useState(0)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [importForm, setImportForm] = useState({
    semesterCode: '', initialPassword: '', file: null
  })

  const load = useCallback(async () => {
    setBusy(true); setStatus('')
    try {
      const semData = await request('/api/semesters?page=1&pageSize=50&sortBy=startDate&descending=true')
      setSemesters(semData.items || [])
      if (isAdmin) {
        const roster = await request('/api/students?page=1&pageSize=2000&sortBy=code')
        setStudents(roster.items || [])
        setStudentTotal(roster.totalCount || 0)
      }
    } catch (e) { setStatus(e.message) }
    finally { setBusy(false) }
  }, [isAdmin, request])

  useEffect(() => {
    const id = setTimeout(load, 0)
    return () => clearTimeout(id)
  }, [load])

  const importRoster = async (event) => {
    event.preventDefault()
    if (!importForm.file) { setStatus('Chọn tệp Excel trước khi import.'); return }
    setStatus('')
    try {
      const data = new FormData()
      data.append('file', importForm.file)
      data.append('semesterCode', importForm.semesterCode)
      data.append('initialPassword', importForm.initialPassword)
      const result = await request('/api/students/import/excel', { method: 'POST', body: data })
      toast.success(`Đã import ${result.importedCount} sinh viên và đồng bộ Google Access.`)
      setImportForm({ semesterCode: '', initialPassword: '', file: null })
      await load()
    } catch (e) { setStatus(e.message) }
  }

  return (
    <motion.div initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}>
      <motion.div className="section-heading" variants={fadeUp}>
        <div>
          <p className="eyebrow eyebrow-accent">ROSTER & GOOGLE ACCESS</p>
          <h1>Sinh viên</h1>
          <p>Email từ roster sẽ được tự động thêm vào Google whitelist.</p>
        </div>
        <span className="count-chip">{studentTotal}</span>
      </motion.div>

      <motion.div className="service-grid" variants={fadeUp}>
        {/* Import Form */}
        <form className="glass-card product-form" onSubmit={importRoster}>
          <p className="eyebrow">IMPORT EXCEL</p>
          <h2>Thêm roster một lần</h2>
          <select
            className="select"
            required
            value={importForm.semesterCode}
            onChange={(e) => setImportForm({ ...importForm, semesterCode: e.target.value })}
          >
            <option value="">Chọn học kỳ</option>
            {semesters.filter(s => s.isActive).map(s => (
              <option key={s.id} value={s.code}>{s.code} · {s.name}</option>
            ))}
          </select>
          <input
            className="input"
            required
            type="password"
            minLength={12}
            placeholder="Mật khẩu khởi tạo (từ 12 ký tự)"
            value={importForm.initialPassword}
            onChange={(e) => setImportForm({ ...importForm, initialPassword: e.target.value })}
          />
          <label className="drop-zone">
            <input
              required
              type="file"
              accept=".xlsx"
              onChange={(e) => setImportForm({ ...importForm, file: e.target.files?.[0] || null })}
            />
            <Upload size={24} />
            <strong>{importForm.file?.name || 'Chọn file roster .xlsx'}</strong>
            <span>Nhận các cột MSSV, Họ tên, Email/Gmail, Ngành · tối đa 2.000 sinh viên</span>
          </label>
          <button className="btn btn-primary" disabled={busy} style={{ width: '100%' }}>
            Import & cấp Google Access <ChevronRight size={15} />
          </button>
        </form>

        {/* Roster List */}
        <article className="glass-card roster-panel">
          <p className="eyebrow">DANH SÁCH ROSTER</p>
          <h2>{studentTotal || '—'} sinh viên</h2>
          <div className="roster-list">
            {students.map(s => (
              <div key={s.id}>
                <span className="student-initial">{s.fullName.slice(0, 1)}</span>
                <span>
                  <strong>{s.fullName}</strong>
                  <small>{s.studentCode} · {s.email}</small>
                </span>
              </div>
            ))}
            {!students.length && (
              <p className="empty-state">Chưa có roster cho học kỳ này.</p>
            )}
          </div>
        </article>
      </motion.div>

      {status && <p className="form-status" role="status">{status}</p>}
    </motion.div>
  )
}
