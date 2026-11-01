import { useState, useCallback, useEffect } from 'react'
import {
  Upload, Search, Trash2,
  FileSpreadsheet, AlertCircle
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { API_BASE_URL as apiBase } from '../../config/api'
import toast from 'react-hot-toast'
import '../../components/ServicePages.css'

export default function GoogleAccessPage() {
  const { request, token, isAdmin } = useAuth()
  const [items, setItems] = useState([])
  const [file, setFile] = useState(null)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!token || !isAdmin) return
    setBusy(true)
    try {
      const data = await request('/api/google-access')
      setItems(data || [])
    } catch {
      toast.error('Không thể tải danh sách email Google Access.')
    } finally {
      setBusy(false)
    }
  }, [isAdmin, request, token])

  useEffect(() => {
    const id = setTimeout(load, 0)
    return () => clearTimeout(id)
  }, [load])

  const handleUpload = async (e) => {
    e?.preventDefault()
    if (!file) {
      toast.error('Chọn tệp .xlsx trước khi tải lên.')
      return
    }

    setBusy(true)
    try {
      const form = new FormData()
      form.append('file', file)

      const response = await fetch(`${apiBase}/api/google-access/import/excel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || 'Import không thành công.')

      setFile(null)
      toast.success(`Đã thêm ${body.data?.importedCount || 0} email vào whitelist.`)
      await load()
    } catch {
      toast.error('Có lỗi xảy ra khi tải lên tệp Excel.')
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async (id, email) => {
    if (!window.confirm(`Xác nhận gỡ quyền đăng nhập Google của "${email}"?`)) return
    try {
      await request(`/api/google-access/${id}`, { method: 'DELETE' })
      toast.success(`Đã xóa ${email} khỏi whitelist.`)
      await load()
    } catch {
      toast.error('Không thể gỡ email này khỏi hệ thống.')
    }
  }

  const filteredItems = items.filter((item) =>
    item.email?.toLowerCase().includes(search.toLowerCase())
  )

  if (!isAdmin) {
    return (
      <div className="card" style={{ maxWidth: 500, margin: '40px auto', textAlign: 'center' }}>
        <AlertCircle size={36} color="var(--error)" style={{ margin: '0 auto 12px' }} />
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Giới hạn quyền truy cập</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
          Chỉ tài khoản Quản trị viên (Admin) mới có quyền quản lý danh sách email Google Whitelist.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Quản lý Google Access Whitelist</h1>
          <p className="page-subtitle">
            Kiểm soát danh sách email FPT University được phép đăng nhập Google Sign-In vào hệ thống.
          </p>
        </div>
        <span className="badge badge-green" style={{ fontSize: 13, padding: '4px 12px' }}>
          {items.length} email đang được phép
        </span>
      </div>

      {/* ── 2-Step Layout ── */}
      <div className="service-layout-grid">
        {/* Step 1: Upload */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="badge badge-green">Bước 1</span>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Thêm email từ tệp Excel
            </h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Tải lên file danh sách sinh viên hoặc giảng viên. Hệ thống tự động nhận diện cột <code>Email</code> hoặc <code>Gmail</code>.
          </p>

          <label className="drop-zone">
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file ? (
              <FileSpreadsheet size={28} color="var(--primary)" />
            ) : (
              <Upload size={24} color="var(--text-muted)" />
            )}
            <strong>{file ? file.name : 'Chọn tệp Excel (.xlsx)'}</strong>
            <span>Hỗ trợ tối đa 2.000 email trong một lần import</span>
          </label>

          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            {file && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setFile(null)}
              >
                Hủy
              </button>
            )}
            <button
              className="btn btn-primary"
              disabled={busy || !file}
              onClick={handleUpload}
              style={{ flex: 1 }}
            >
              {busy ? 'Đang xử lý...' : 'Tiến hành nạp Whitelist'}
            </button>
          </div>
        </div>

        {/* Step 2: Whitelist View */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="badge badge-teal">Bước 2</span>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                Kiểm tra email được cấp quyền
              </h2>
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {filteredItems.length} kết quả
            </span>
          </div>

          <div style={{ position: 'relative', marginBottom: 10 }}>
            <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              className="input input-sm"
              placeholder="Tìm kiếm địa chỉ email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 34 }}
            />
          </div>

          <div className="roster-list-box" style={{ maxHeight: 380 }}>
            <table className="whitelist-table">
              <thead>
                <tr>
                  <th>Địa chỉ Email</th>
                  <th style={{ width: 80, textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: 'var(--primary)', flexShrink: 0 }} />
                        <span style={{ fontWeight: 500 }}>{item.email}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '4px 6px', color: 'var(--text-muted)' }}
                        onClick={() => handleRemove(item.id, item.email)}
                        title={`Gỡ ${item.email}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}

                {!filteredItems.length && (
                  <tr>
                    <td colSpan={2} style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-secondary)' }}>
                      Không có email nào khớp với tìm kiếm.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
