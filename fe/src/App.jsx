import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './hooks/useAuth'
import AppLayout from './layouts/AppLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import StudentsPage from './pages/StudentsPage'
import SemestersPage from './pages/SemestersPage'
import GroupsPage from './pages/GroupsPage'
import GoogleAccessPage from './pages/GoogleAccessPage'
import './components/shared.css'

function ProtectedRoute({ children, adminOnly = false }) {
  const { token, loading, isAdmin } = useAuth()

  if (loading) {
    return (
      <div className="app-loading-screen">
        <div className="app-loading-orb" />
        <div className="brand-mark" style={{ width: 52, height: 52, fontSize: 18, zIndex: 1 }}>
          EXE
        </div>
        <p style={{ marginTop: 18, color: 'var(--text-secondary)', fontSize: 13, letterSpacing: '0.06em', zIndex: 1 }}>
          ĐANG KHỞI TẠO KHÔNG GIAN HỌC KỲ...
        </p>
      </div>
    )
  }

  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/semesters" replace />
  }

  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route
          path="students"
          element={
            <ProtectedRoute adminOnly>
              <StudentsPage />
            </ProtectedRoute>
          }
        />
        <Route path="semesters" element={<SemestersPage />} />
        <Route path="groups" element={<GroupsPage />} />
        <Route
          path="access"
          element={
            <ProtectedRoute adminOnly>
              <GoogleAccessPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              background: '#13151f',
              color: '#f8fafc',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '12px 18px',
              fontSize: '13px',
              fontWeight: 500,
              boxShadow: '0 20px 40px -8px rgba(0, 0, 0, 0.6), 0 0 1px 1px rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)'
            },
            success: {
              iconTheme: {
                primary: '#34d399',
                secondary: '#13151f'
              }
            },
            error: {
              iconTheme: {
                primary: '#fb7185',
                secondary: '#13151f'
              }
            }
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  )
}
