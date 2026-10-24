import { useState, useCallback, useEffect } from 'react'
import { Upload, Search, Users, FileSpreadsheet } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import './ServicePages.css'

export default function StudentsPage() {
  const { request, isAdmin } = useAuth()
  const [semesters, setSemesters] = useState([])
  const [students, setStudents] = useState([])
  const [studentTotal, setStudentTotal] = useState(0)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [importForm, setImportForm] = useState({
    semesterCode: '',
    initialPassword: '',
    file: null
  })

  const load = useCallback(async () => {
    setBusy(true)
    try {
      const semData = await request('/api/semesters?page=1&pageSize=50&sortBy=startDate&descending=true')
      setSemesters(semData.items || [])

      if (isAdmin) {
        const roster = await request('/api/students?page=1&pageSize=2000&sortBy=code')
        setStudents(roster.items || [])
        setStudentTotal(roster.totalCount || 0)
      }
    } catch {
      toast.error('Không thể tải dữ liệu danh sách sinh viên.')
    } finally {
      setBusy(false)
    }
  }, [isAdmin, request])

  useEffect(() => {
    const id = setTimeout(load, 0)
    return () => clearTimeout(id)
  }, [load])

  const importRoster = async (e) => {
    e.preventDefault()
    if (!importForm.file) {
      toast.error('Vui lòng chọn tệp Excel (.xlsx) trước khi import.')
      return
    }

    try {
      setBusy(true)
      const data = new FormData()
      data.append('file', importForm.file)
      data.append('semesterCode', importForm.semesterCode)
      data.append('initialPassword', importForm.initialPassword)

      const result = await request('/api/students/import/excel', { method: 'POST', body: data })
      toast.success(`Đã thêm ${result?.importedCount || 0} sinh viên và cấp quyền Google Access.`)
      setImportForm({ semesterCode: '', initialPassword: '', file: null })
      await load()
    } catch {
      toast.error('Import danh sách sinh viên không thành công.')
    } finally {
      setBusy(false)
    }
  }

  const filteredStudents = students.filter((s) => {
    const q = search.toLowerCase()
    return (
      s.fullName?.toLowerCase().includes(q) ||
      s.studentCode?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q)
    )
  })

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Quản lý Sinh viên & Roster</h1>
          <p className="page-subtitle">
            Nhập danh sách sinh viên đủ điều kiện làm Dự án Khởi nghiệp từ file Excel. Hệ thống sẽ tự động đồng bộ email vào Google Access.
          </p>
        </div>
        <span className="badge badge-green" style={{ fontSize: 13, padding: '4px 12px' }}>
          {studentTotal} sinh viên đã nạp
        </span>
      </div>

      {/* ── 2-Column Layout ── */}
      <div className="service-layout-grid">
        {/* Left Column: Import Form */}
        <div className="card">
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', marginBottom: 4 }}>
            Import danh sách Roster (.xlsx)
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            File Excel cần có các cột: MSSV, Họ tên, Email/Gmail và Ngành đào tạo.
          </p>

          <form onSubmit={importRoster} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="input-label">Học kỳ áp dụng *</label>
              <select
                className="select"
                required
                value={importForm.semesterCode}
                onChange={(e) => setImportForm({ ...importForm, semesterCode: e.target.value })}
              >
                <option value="">-- Chọn học kỳ --</option>
                {semesters.filter((s) => s.isActive).map((s) => (
                  <option key={s.id} value={s.code}>
                    {s.code} · {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="input-label">Mật khẩu khởi tạo ban đầu *</label>
              <input
                className="input"
                required
                type="password"
                minLength={12}
                placeholder="Tối thiểu 12 ký tự"
                value={importForm.initialPassword}
                onChange={(e) => setImportForm({ ...importForm, initialPassword: e.target.value })}
              />
            </div>

            <div>
              <label className="input-label">Tệp danh sách Excel (.xlsx) *</label>
              <label className="drop-zone">
                <input
                  required
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => setImportForm({ ...importForm, file: e.target.files?.[0] || null })}
                />
                {importForm.file ? (
                  <FileSpreadsheet size={26} color="var(--primary)" />
                ) : (
                  <Upload size={24} color="var(--text-muted)" />
                )}
                <strong>{importForm.file ? importForm.file.name : 'Nhấn để chọn tệp .xlsx'}</strong>
                <span>Hỗ trợ tệp bảng tính tối đa 2.000 sinh viên</span>
              </label>
            </div>

            <button className="btn btn-primary" type="submit" disabled={busy || !importForm.file} style={{ width: '100%', marginTop: 4 }}>
              {busy ? 'Đang xử lý...' : 'Import & Cấp quyền Google'}
            </button>
          </form>
        </div>

        {/* Right Column: Roster List */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>
              Danh sách sinh viên trong hệ thống
            </h2>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {filteredStudents.length} / {studentTotal}
            </span>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              className="input input-sm"
              placeholder="Tìm theo mã số, tên hoặc email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 34 }}
            />
          </div>

          <div className="roster-list-box">
            {filteredStudents.map((item) => (
              <div className="roster-row" key={item.id}>
                <div className="student-info-col">
                  <div className="avatar avatar-md avatar-primary">
                    {item.fullName ? item.fullName.charAt(0) : 'S'}
                  </div>
                  <div className="student-meta-block">
                    <strong>{item.fullName}</strong>
                    <span>{item.studentCode} · {item.email}</span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span className="badge badge-neutral" style={{ fontSize: 11 }}>
                    {item.major || 'Kỹ thuật PM'}
                  </span>
                </div>
              </div>
            ))}

            {!filteredStudents.length && !busy && (
              <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-secondary)' }}>
                <Users size={28} color="var(--text-muted)" style={{ margin: '0 auto 8px' }} />
                <p style={{ fontSize: 13 }}>Không tìm thấy sinh viên nào phù hợp.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
