import { useState, useCallback, useEffect } from 'react'
import {
  Upload, Search, Users, FileSpreadsheet, Plus,
  Trash2, Edit3, X, CheckCircle2, UserCheck
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'
import '../../components/ServicePages.css'

const TEAM_ROLES = ['Frontend', 'Backend', 'Mobile', 'UIUX', 'BusinessAnalysis', 'QualityAssurance', 'DataAI']

export default function StudentsPage() {
  const { request, isAdmin } = useAuth()
  const [semesters, setSemesters] = useState([])
  const [selectedSemester, setSelectedSemester] = useState('')
  const [hasGroupFilter, setHasGroupFilter] = useState('all') // 'all' | 'true' | 'false'
  const [students, setStudents] = useState([])
  const [studentTotal, setStudentTotal] = useState(0)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [bulkDeleteSemester, setBulkDeleteSemester] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // Tab switch between Excel Import & Single Student Add
  const [addMode, setAddMode] = useState('excel') // 'excel' | 'manual'

  // Excel Form
  const [importForm, setImportForm] = useState({
    semesterCode: '',
    file: null
  })

  // Single Add Form
  const [singleForm, setSingleForm] = useState({
    semesterCode: '',
    studentCode: '',
    fullName: '',
    email: '',
    major: 'Software Engineering',
    initialPassword: 'Student@12345678'
  })

  // Edit Modal
  const [editModal, setEditModal] = useState(false)
  const [editingStudent, setEditingStudent] = useState(null)
  const [editForm, setEditForm] = useState({
    fullName: '',
    major: ''
  })

  // Strength roles modal
  const [roleStudent, setRoleStudent] = useState(null)
  const [selectedRoles, setSelectedRoles] = useState([])

  // Load Semesters
  useEffect(() => {
    const fetchSemesters = async () => {
      try {
        const semData = await request('/api/semesters?page=1&pageSize=50&sortBy=startDate&descending=true')
        const items = semData.items || []
        setSemesters(items)
        if (items.length > 0 && !selectedSemester) {
          const active = items.find((s) => s.isActive) || items[0]
          setSelectedSemester(active.code)
          setImportForm((prev) => ({ ...prev, semesterCode: active.code }))
          setSingleForm((prev) => ({ ...prev, semesterCode: active.code }))
        }
      } catch {
        // ignore
      }
    }
    fetchSemesters()
  }, [request, selectedSemester])

  // Load Students
  const load = useCallback(async () => {
    if (!isAdmin) return
    setBusy(true)
    try {
      let url = `/api/students?page=1&pageSize=2000&sortBy=code`
      if (selectedSemester) url += `&semesterCode=${encodeURIComponent(selectedSemester)}`
      if (hasGroupFilter === 'true') url += '&hasGroup=true'
      if (hasGroupFilter === 'false') url += '&hasGroup=false'

      const roster = await request(url)
      setStudents(roster.items || [])
      setStudentTotal(roster.totalCount || 0)
    } catch {
      toast.error('Không thể tải dữ liệu danh sách sinh viên.')
    } finally {
      setBusy(false)
    }
  }, [hasGroupFilter, isAdmin, request, selectedSemester])

  useEffect(() => {
    const id = setTimeout(load, 0)
    return () => clearTimeout(id)
  }, [load])

  // 1. Import Excel
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
      if (importForm.semesterCode) {
        data.append('semesterCode', importForm.semesterCode)
      }

      const result = await request('/api/students/import/excel', { method: 'POST', body: data })
      toast.success(`Đã thêm ${result?.importedCount || 0} sinh viên và cấp quyền Google Access.`)
      setImportForm((prev) => ({ ...prev, file: null }))
      await load()
    } catch (error) {
      toast.error(error.message || 'Import danh sách sinh viên không thành công.')
    } finally {
      setBusy(false)
    }
  }

  // 2. Add Single Student (POST /api/students)
  const handleAddSingle = async (e) => {
    e.preventDefault()
    if (!singleForm.semesterCode || !singleForm.studentCode || !singleForm.email) return

    try {
      setBusy(true)
      await request('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          semesterCode: singleForm.semesterCode,
          initialPassword: singleForm.initialPassword,
          student: {
            studentCode: singleForm.studentCode.trim().toUpperCase(),
            fullName: singleForm.fullName.trim(),
            email: singleForm.email.trim().toLowerCase(),
            major: singleForm.major.trim()
          }
        })
      })
      toast.success(`Đã thêm sinh viên ${singleForm.studentCode} thành công!`)
      setSingleForm((prev) => ({
        ...prev,
        studentCode: '',
        fullName: '',
        email: ''
      }))
      await load()
    } catch (error) {
      toast.error(error.message || 'Không thể tạo sinh viên mới.')
    } finally {
      setBusy(false)
    }
  }

  // 3. Open Edit Modal
  const handleOpenEdit = (student) => {
    setEditingStudent(student)
    setEditForm({
      fullName: student.fullName || '',
      major: student.major || 'Software Engineering'
    })
    setEditModal(true)
  }

  // 4. Update Student (PUT /api/students/{id})
  const handleUpdateStudent = async (e) => {
    e.preventDefault()
    if (!editingStudent) return
    try {
      setBusy(true)
      await request(`/api/students/${editingStudent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: editForm.fullName.trim(),
          major: editForm.major.trim()
        })
      })
      toast.success(`Đã cập nhật sinh viên ${editingStudent.studentCode}`)
      setEditModal(false)
      setEditingStudent(null)
      await load()
    } catch (error) {
      toast.error(error.message || 'Lỗi khi cập nhật sinh viên.')
    } finally {
      setBusy(false)
    }
  }

  // 5. Delete Student (DELETE /api/students/{id})
  const handleDeleteStudent = async (student) => {
    if (!window.confirm(`Xác nhận xóa sinh viên ${student.fullName} (${student.studentCode}) khỏi hệ thống?`)) return
    try {
      setBusy(true)
      await request(`/api/students/${student.id}`, { method: 'DELETE' })
      toast.success(`Đã xóa sinh viên ${student.studentCode}`)
      await load()
    } catch (error) {
      toast.error(error.message || 'Không thể xóa sinh viên này (sinh viên có thể đang nằm trong nhóm).')
    } finally {
      setBusy(false)
    }
  }

  // 6. Delete all students by semester
  const handleBulkDeleteBySemester = async () => {
    if (!bulkDeleteSemester) return
    try {
      setBusy(true)
      const res = await request(`/api/students/semester/${encodeURIComponent(bulkDeleteSemester)}`, {
        method: 'DELETE'
      })
      toast.success(res || `Đã xóa toàn bộ sinh viên trong học kỳ ${bulkDeleteSemester}!`)
      setShowDeleteModal(false)
      setBulkDeleteSemester('')
      await load()
    } catch (err) {
      toast.error(err.message || 'Lỗi khi xóa sinh viên học kỳ.')
    } finally {
      setBusy(false)
    }
  }

  // 6. Strength Roles
  const openStrengthRoles = (student) => {
    setRoleStudent(student)
    setSelectedRoles(student.strengthRoles || [])
  }

  const saveStrengthRoles = async () => {
    if (!roleStudent || selectedRoles.length < 1) {
      toast.error('Chọn ít nhất một role thế mạnh.')
      return
    }
    try {
      setBusy(true)
      await request(`/api/students/${roleStudent.id}/strength-roles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleCodes: selectedRoles })
      })
      toast.success(`Đã cập nhật role thế mạnh cho ${roleStudent.fullName}`)
      setRoleStudent(null)
      await load()
    } catch (error) {
      toast.error(error.message || 'Không thể cập nhật role thế mạnh.')
    } finally {
      setBusy(false)
    }
  }

  const filteredStudents = students.filter((s) => {
    const q = search.toLowerCase()
    return (
      s.fullName?.toLowerCase().includes(q) ||
      s.studentCode?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.major?.toLowerCase().includes(q)
    )
  })

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Quản lý Sinh viên & Roster</h1>
          <p className="page-subtitle">
            Nhập danh sách sinh viên đủ điều kiện làm Dự án Khởi nghiệp từ file Excel hoặc tạo thủ công.
          </p>
        </div>
        <span className="badge badge-green" style={{ fontSize: 13, padding: '4px 12px' }}>
          {studentTotal} sinh viên đã nạp
        </span>
      </div>

      {/* ── 2-Column Layout ── */}
      <div className="service-layout-grid">
        {/* Left Column: Forms */}
        <div className="card">
          {/* Mode Switcher */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border-default)', paddingBottom: 10 }}>
            <button
              className={`tab-btn ${addMode === 'excel' ? 'active' : ''}`}
              style={{ fontSize: 13 }}
              onClick={() => setAddMode('excel')}
            >
              <FileSpreadsheet size={14} style={{ display: 'inline', marginRight: 4 }} /> Import Excel
            </button>
            <button
              className={`tab-btn ${addMode === 'manual' ? 'active' : ''}`}
              style={{ fontSize: 13 }}
              onClick={() => setAddMode('manual')}
            >
              <Plus size={14} style={{ display: 'inline', marginRight: 4 }} /> Thêm thủ công 1 sinh viên
            </button>
          </div>

          {/* Form 1: Excel Import */}
          {addMode === 'excel' && (
            <div>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 14 }}>
                File Excel cần có các cột: <strong>MSSV</strong>, <strong>Họ tên</strong>, <strong>Email/Gmail</strong> và <strong>Ngành đào tạo</strong>.
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
          )}

          {/* Form 2: Single Student Manual Add (POST /api/students) */}
          {addMode === 'manual' && (
            <form onSubmit={handleAddSingle} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="input-label">Học kỳ *</label>
                <select
                  className="select"
                  required
                  value={singleForm.semesterCode}
                  onChange={(e) => setSingleForm({ ...singleForm, semesterCode: e.target.value })}
                >
                  <option value="">-- Chọn học kỳ --</option>
                  {semesters.map((s) => (
                    <option key={s.id} value={s.code}>
                      {s.code} · {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="input-label">Mã số sinh viên (MSSV) *</label>
                  <input
                    required
                    className="input"
                    placeholder="VD: SE170123"
                    value={singleForm.studentCode}
                    onChange={(e) => setSingleForm({ ...singleForm, studentCode: e.target.value.toUpperCase() })}
                  />
                </div>
                <div>
                  <label className="input-label">Họ và tên *</label>
                  <input
                    required
                    className="input"
                    placeholder="VD: Nguyễn Văn An"
                    value={singleForm.fullName}
                    onChange={(e) => setSingleForm({ ...singleForm, fullName: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="input-label">Email trường (@fpt.edu.vn) *</label>
                <input
                  required
                  type="email"
                  className="input"
                  placeholder="VD: annvse170123@fpt.edu.vn"
                  value={singleForm.email}
                  onChange={(e) => setSingleForm({ ...singleForm, email: e.target.value.toLowerCase() })}
                />
              </div>

              <div>
                <label className="input-label">Chuyên ngành *</label>
                <select
                  className="select"
                  value={singleForm.major}
                  onChange={(e) => setSingleForm({ ...singleForm, major: e.target.value })}
                >
                  <option value="Software Engineering">Kỹ thuật phần mềm (SE)</option>
                  <option value="Artificial Intelligence">Trí tuệ nhân tạo (AI)</option>
                  <option value="Information Assurance">An toàn thông tin (IA)</option>
                  <option value="Digital Marketing">Digital Marketing (MKT)</option>
                  <option value="International Business">Kinh doanh quốc tế (IB)</option>
                </select>
              </div>

              <div>
                <label className="input-label">Mật khẩu khởi tạo ban đầu *</label>
                <input
                  required
                  type="password"
                  minLength={12}
                  className="input"
                  placeholder="Tối thiểu 12 ký tự"
                  value={singleForm.initialPassword}
                  onChange={(e) => setSingleForm({ ...singleForm, initialPassword: e.target.value })}
                />
              </div>

              <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%', marginTop: 6 }}>
                {busy ? 'Đang thêm...' : 'Tạo tài khoản sinh viên'}
              </button>
            </form>
          )}
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

          {/* Filters Bar */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <select
              className="select input-sm"
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              style={{ flex: 1, minWidth: 130 }}
            >
              <option value="">-- Tất cả học kỳ --</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.code}>{s.code}</option>
              ))}
            </select>

            <select
              className="select input-sm"
              value={hasGroupFilter}
              onChange={(e) => setHasGroupFilter(e.target.value)}
              style={{ flex: 1, minWidth: 140 }}
            >
              <option value="all">Tất cả tình trạng</option>
              <option value="false">Chưa có nhóm</option>
              <option value="true">Đã có nhóm</option>
            </select>
          </div>

          {/* Bulk Delete Bar */}
          {isAdmin && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fee2e2',
              borderRadius: 8,
              marginBottom: 10,
              flexWrap: 'wrap'
            }}>
              <Trash2 size={15} color="#dc2626" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#991b1b', whiteSpace: 'nowrap' }}>
                Xóa SV theo kỳ:
              </span>
              <select
                className="select input-sm"
                value={bulkDeleteSemester}
                onChange={(e) => setBulkDeleteSemester(e.target.value)}
                style={{ flex: 1, minWidth: 140, fontSize: 12, height: 32, borderColor: '#fca5a5' }}
              >
                <option value="">-- Chọn mã học kỳ cần xóa --</option>
                {semesters.map((s) => (
                  <option key={s.id} value={s.code}>
                    {s.code} · {s.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-sm"
                disabled={busy || !bulkDeleteSemester}
                onClick={() => setShowDeleteModal(true)}
                style={{
                  backgroundColor: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  fontSize: 12,
                  padding: '5px 12px',
                  whiteSpace: 'nowrap',
                  cursor: !bulkDeleteSemester ? 'not-allowed' : 'pointer',
                  opacity: !bulkDeleteSemester ? 0.6 : 1
                }}
              >
                Xóa toàn bộ SV {bulkDeleteSemester ? `kỳ ${bulkDeleteSemester}` : ''}
              </button>
            </div>
          )}

          {/* Search Box */}
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              className="input input-sm"
              placeholder="Tìm theo MSSV, họ tên, email hoặc ngành..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 34 }}
            />
          </div>

          {/* Student List */}
          <div className="roster-list-box" style={{ maxHeight: 440 }}>
            {filteredStudents.map((item) => (
              <div className="roster-row" key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px' }}>
                <div className="student-info-col" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="avatar avatar-md avatar-primary">
                    {item.fullName ? item.fullName.charAt(0) : 'S'}
                  </div>
                  <div className="student-meta-block">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 13.5 }}>{item.fullName}</strong>
                      {item.hasGroup ? (
                        <span className="badge badge-teal" style={{ fontSize: 10 }}>Đã có nhóm</span>
                      ) : (
                        <span className="badge badge-warning" style={{ fontSize: 10 }}>Chưa có nhóm</span>
                      )}
                      {item.strengthRoles?.map((r) => (
                        <span key={r} className="badge badge-neutral" style={{ fontSize: 9.5 }}>{r}</span>
                      ))}
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {item.studentCode} · {item.email}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge badge-neutral" style={{ fontSize: 11 }}>
                    {item.major || 'Kỹ thuật PM'}
                  </span>

                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '4px 8px', fontSize: 11.5, color: 'var(--primary)' }}
                    onClick={() => openStrengthRoles(item)}
                    title="Cập nhật Role thế mạnh"
                  >
                    Roles
                  </button>

                  {isAdmin && (
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: 4, color: 'var(--text-secondary)' }}
                        onClick={() => handleOpenEdit(item)}
                        title="Chỉnh sửa thông tin sinh viên"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: 4, color: 'var(--text-muted)' }}
                        onClick={() => handleDeleteStudent(item)}
                        title="Xóa sinh viên khỏi hệ thống"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
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

      {/* ── Edit Student Modal (PUT /api/students/{id}) ── */}
      {editModal && editingStudent && (
        <div className="modal-backdrop" onClick={() => setEditModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <span className="badge badge-neutral" style={{ marginBottom: 4 }}>Chỉnh sửa sinh viên</span>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  {editingStudent.studentCode} · {editingStudent.email}
                </h2>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setEditModal(false)}
                style={{ padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateStudent} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="input-label">Họ và tên *</label>
                <input
                  required
                  className="input"
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                />
              </div>

              <div>
                <label className="input-label">Chuyên ngành đào tạo *</label>
                <input
                  required
                  className="input"
                  value={editForm.major}
                  onChange={(e) => setEditForm({ ...editForm, major: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditModal(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── Strength Roles Modal (PUT /api/students/{id}/strength-roles) ── */}
      {roleStudent && (
        <div className="modal-backdrop" onClick={() => setRoleStudent(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <h2 style={{ fontSize: 18, margin: 0, fontWeight: 700, color: 'var(--text-main)' }}>
                  Role thế mạnh của sinh viên
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                  {roleStudent.fullName} ({roleStudent.studentCode})
                </p>
              </div>
              <button className="btn btn-ghost btn-sm" aria-label="Đóng" onClick={() => setRoleStudent(null)}>
                <X size={18} />
              </button>
            </div>

            <div role="group" aria-label="Chọn tối đa sáu role thế mạnh" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '16px 0' }}>
              {TEAM_ROLES.map((role) => {
                const selected = selectedRoles.includes(role)
                return (
                  <button
                    key={role}
                    type="button"
                    aria-pressed={selected}
                    className={`btn btn-sm ${selected ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() =>
                      setSelectedRoles((items) =>
                        selected ? items.filter((item) => item !== role) : items.length < 6 ? [...items, role] : items
                      )
                    }
                  >
                    {role}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setRoleStudent(null)}>
                Hủy
              </button>
              <button className="btn btn-primary" onClick={saveStrengthRoles} disabled={busy}>
                Lưu role
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Delete Confirmation Modal ── */}
      {showDeleteModal && (
        <div className="modal-backdrop" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  backgroundColor: '#fee2e2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Trash2 size={20} color="#dc2626" />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#991b1b', margin: 0 }}>
                    Xác nhận xóa toàn bộ sinh viên
                  </h3>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Học kỳ: <strong style={{ color: '#dc2626' }}>{bulkDeleteSemester}</strong>
                  </span>
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowDeleteModal(false)} style={{ padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: 13.5, color: 'var(--text-main)', lineHeight: 1.6, marginBottom: 18 }}>
              <p style={{ margin: '0 0 10px 0' }}>
                Bạn có chắc chắn muốn xóa <strong>toàn bộ sinh viên</strong> thuộc học kỳ <span className="badge badge-neutral" style={{ fontWeight: 700, color: '#dc2626' }}>{bulkDeleteSemester}</span>?
              </p>
              <div style={{
                padding: '10px 12px',
                backgroundColor: '#fff1f2',
                borderRadius: 6,
                border: '1px solid #ffe4e6',
                color: '#be123c',
                fontSize: 12
              }}>
                ⚠️ <strong>Cảnh báo:</strong> Thao tác này sẽ xóa vĩnh viễn hồ sơ sinh viên <strong>không thể hoàn tác</strong>!
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowDeleteModal(false)}
                disabled={busy}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleBulkDeleteBySemester}
                disabled={busy}
                style={{
                  backgroundColor: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  fontWeight: 600,
                  borderRadius: 6
                }}
              >
                {busy ? 'Đang xóa...' : `Xác nhận xóa hết SV kỳ ${bulkDeleteSemester}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
