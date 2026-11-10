import { useState } from 'react'
import { X, Sparkles, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { TEAM_ROLE_OPTIONS } from '../config/teamRoles'

export default function StudentCoreModal({ onClose }) {
  const { account, request, updateStudentProfile } = useAuth()
  const student = account?.student
  const [selectedRoles, setSelectedRoles] = useState(() => student?.strengthRoles || [])
  const [saving, setSaving] = useState(false)

  if (!student) return null

  const toggleRole = (code) => {
    setSelectedRoles((prev) => {
      if (prev.includes(code)) return prev.filter((item) => item !== code)
      if (prev.length >= 6) {
        toast.error('Bạn chỉ được chọn tối đa 6 Core chuyên môn.')
        return prev
      }
      return [...prev, code]
    })
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (selectedRoles.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 Core thế mạnh của bản thân.')
      return
    }
    try {
      setSaving(true)
      const updated = await request(`/api/students/${student.id}/strength-roles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleCodes: selectedRoles })
      })
      updateStudentProfile(updated)
      toast.success('Đã cập nhật Core chuyên môn của bạn!')
      onClose()
    } catch (error) {
      toast.error(error.message || 'Không thể cập nhật Core chuyên môn.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Sparkles size={16} color="var(--primary)" />
              <span className="badge badge-teal" style={{ fontSize: 11 }}>{student.major || 'Chưa phân ngành'}</span>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Chọn Core & Thế mạnh của bạn
            </h2>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              {student.fullName} ({student.studentCode}) · Chọn từ 1 đến 6 vai trò để các nhóm liên ngành tìm kiếm bạn.
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8, marginBottom: 18 }}>
            {TEAM_ROLE_OPTIONS.map((item) => {
              const active = selectedRoles.includes(item.code)
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => toggleRole(item.code)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: active ? '1.5px solid var(--primary)' : '1px solid var(--border-default)',
                    backgroundColor: active ? '#ECFDF5' : 'var(--bg-card)',
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: active ? '#047857' : 'var(--text-main)' }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {item.desc}
                    </div>
                  </div>
                  <div style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    border: active ? 'none' : '1.5px solid var(--border-default)',
                    backgroundColor: active ? 'var(--primary)' : 'transparent',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 2
                  }}>
                    {active && <Check size={12} />}
                  </div>
                </button>
              )
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--border-default)' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Đã chọn: <strong>{selectedRoles.length}/6</strong> Core
            </span>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
                Hủy
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving || selectedRoles.length === 0}>
                {saving ? 'Đang lưu...' : 'Lưu Core của tôi'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
