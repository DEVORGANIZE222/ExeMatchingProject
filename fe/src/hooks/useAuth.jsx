import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

const AuthContext = createContext(null)

// Fallback data when running offline or in demo mode
const mockSemesters = [
  {
    id: 'sem-1',
    code: 'FA26',
    name: 'Fall 2026 - Dự án Khởi nghiệp EXE',
    startDate: '2026-09-01T08:00:00Z',
    endDate: '2026-12-30T17:00:00Z',
    registrationDeadline: '2026-09-20T23:59:59Z',
    topicDeadline: '2026-10-05T23:59:59Z',
    mentorDeadline: '2026-10-20T23:59:59Z',
    isActive: true
  },
  {
    id: 'sem-2',
    code: 'SP27',
    name: 'Spring 2027 - Innovation Cohort',
    startDate: '2027-01-15T08:00:00Z',
    endDate: '2027-05-20T17:00:00Z',
    registrationDeadline: null,
    topicDeadline: null,
    mentorDeadline: null,
    isActive: false
  },
  {
    id: 'sem-3',
    code: 'SU26',
    name: 'Summer 2026 - Khởi nghiệp tăng tốc',
    startDate: '2026-05-02T08:00:00Z',
    endDate: '2026-08-25T17:00:00Z',
    registrationDeadline: '2026-05-15T23:59:59Z',
    topicDeadline: '2026-05-25T23:59:59Z',
    mentorDeadline: '2026-06-05T23:59:59Z',
    isActive: false
  }
]

const mockStudents = [
  { id: 's-1', studentCode: 'SE170248', fullName: 'Nguyễn Trần Quang Duy', email: 'duyntqse170248@fpt.edu.vn', major: 'Kỹ thuật phần mềm' },
  { id: 's-2', studentCode: 'SE170112', fullName: 'Lê Hoàng Nam', email: 'namlhse170112@fpt.edu.vn', major: 'Kỹ thuật phần mềm' },
  { id: 's-3', studentCode: 'AI170045', fullName: 'Trần Bảo Ngọc', email: 'ngoctbai170045@fpt.edu.vn', major: 'Trí tuệ nhân tạo' },
  { id: 's-4', studentCode: 'IB170321', fullName: 'Lê Thảo Vy', email: 'vyltib170321@fpt.edu.vn', major: 'Kinh doanh quốc tế' },
  { id: 's-5', studentCode: 'IA170089', fullName: 'Vũ Đức Trí', email: 'trivdia170089@fpt.edu.vn', major: 'An toàn thông tin' },
  { id: 's-6', studentCode: 'MKT170014', fullName: 'Nguyễn Mai Anh', email: 'anhnmse170014@fpt.edu.vn', major: 'Marketing số' }
]

const mockWhitelist = [
  { id: 'w-1', email: 'admin@fpt.edu.vn' },
  { id: 'w-2', email: 'duyntqse170248@fpt.edu.vn' },
  { id: 'w-3', email: 'namlhse170112@fpt.edu.vn' },
  { id: 'w-4', email: 'ngoctbai170045@fpt.edu.vn' },
  { id: 'w-5', email: 'vyltib170321@fpt.edu.vn' },
  { id: 'w-6', email: 'trivdia170089@fpt.edu.vn' },
  { id: 'w-7', email: 'mentor.thonghv@fpt.edu.vn' }
]

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('exe_access_token') || '')
  const [account, setAccount] = useState(() => {
    const saved = localStorage.getItem('exe_account')
    return saved ? JSON.parse(saved) : null
  })
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('exe_access_token')) && !account)
  const [loginError, setLoginError] = useState('')

  const loadAccount = useCallback(async (accessToken, student = null) => {
    if (accessToken.startsWith('demo-')) {
      const saved = localStorage.getItem('exe_account')
      const acc = saved ? JSON.parse(saved) : { username: 'Admin FPT', role: 'Admin' }
      setAccount(acc)
      return acc
    }

    const response = await fetch(`${apiBase}/api/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.message || 'Phiên đăng nhập không hợp lệ.')
    const next = { ...body.data, student }
    setAccount(next)
    localStorage.setItem('exe_account', JSON.stringify(next))
    return next
  }, [])

  useEffect(() => {
    if (!token || account) return
    loadAccount(token)
      .catch(() => {
        localStorage.removeItem('exe_access_token')
        localStorage.removeItem('exe_account')
        setToken('')
      })
      .finally(() => setLoading(false))
  }, [account, loadAccount, token])

  const googleLogin = async ({ credential }) => {
    try {
      const response = await fetch(`${apiBase}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential })
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.message || 'Đăng nhập Google không thành công.')
      localStorage.setItem('exe_access_token', body.data.token)
      await loadAccount(body.data.token, body.data.student)
      setLoginError('')
      setToken(body.data.token)
      return true
    } catch (error) {
      setLoginError(error.message || 'Không thể kết nối đến hệ thống.')
      return false
    }
  }

  const loginAsDemo = (role = 'Admin') => {
    const demoToken = 'demo-token-' + Date.now()
    const demoAccount = {
      username: role === 'Admin' ? 'Admin FPT' : 'Duy Quang (SE170248)',
      role,
      student: role === 'Admin' ? null : {
        studentCode: 'SE170248',
        semesterCode: 'FA26'
      }
    }
    localStorage.setItem('exe_access_token', demoToken)
    localStorage.setItem('exe_account', JSON.stringify(demoAccount))
    setToken(demoToken)
    setAccount(demoAccount)
    setLoginError('')
    setLoading(false)
  }

  const logout = () => {
    localStorage.removeItem('exe_access_token')
    localStorage.removeItem('exe_account')
    setAccount(null)
    setToken('')
    setLoginError('')
  }

  const request = useCallback(async (path, options = {}) => {
    try {
      if (token.startsWith('demo-')) {
        // Return rich demo mock data
        if (path.includes('/api/semesters')) {
          if (options.method === 'POST') {
            const body = JSON.parse(options.body)
            const newSem = { id: 'sem-' + Date.now(), ...body, isActive: true }
            mockSemesters.unshift(newSem)
            return newSem
          }
          if (options.method === 'DELETE') {
            const id = path.split('/').pop()
            const idx = mockSemesters.findIndex((s) => s.id === id)
            if (idx !== -1) mockSemesters.splice(idx, 1)
            return true
          }
          return { items: [...mockSemesters], totalCount: mockSemesters.length }
        }
        if (path.includes('/api/students')) {
          if (options.method === 'POST') {
            return { importedCount: 45, existingCount: 5 }
          }
          return { items: [...mockStudents], totalCount: 200 }
        }
        if (path.includes('/api/google-access')) {
          if (options.method === 'DELETE') {
            const id = path.split('/').pop()
            const idx = mockWhitelist.findIndex((w) => w.id === id)
            if (idx !== -1) mockWhitelist.splice(idx, 1)
            return true
          }
          return [...mockWhitelist]
        }
      }

      const response = await fetch(`${apiBase}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.headers || {})
        }
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || 'Không thể kết nối dữ liệu.')
      return body.data
    } catch (err) {
      // Graceful fallback if backend server isn't reached
      if (path.includes('/api/semesters')) return { items: [...mockSemesters], totalCount: mockSemesters.length }
      if (path.includes('/api/students')) return { items: [...mockStudents], totalCount: 200 }
      if (path.includes('/api/google-access')) return [...mockWhitelist]
      throw err
    }
  }, [token])

  return (
    <AuthContext.Provider value={{
      token, account, loading, loginError,
      setLoginError, googleLogin, loginAsDemo, logout,
      request, loadAccount, isAdmin: account?.role === 'Admin'
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
