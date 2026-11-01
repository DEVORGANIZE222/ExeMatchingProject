import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './hooks/useAuth'
import AppLayout from './layouts/AppLayout'

// ── Feature-based Modules (Vertical Slices) ────────────────
import { LoginPage } from './features/auth'
import { DashboardPage } from './features/dashboard'
import { StudentsPage } from './features/students'
import { SemestersPage } from './features/semesters'
import { GroupsPage } from './features/groups'
import { GoogleAccessPage } from './features/google-access'
import {
  MentorDashboardPage,
  MentorRequestsPage,
  AdminMentorsPage
} from './features/mentors'

import './components/shared.css'

function ProtectedRoute({ children, adminOnly = false, mentorOnly = false }) {
  const { token, loading, isAdmin, isMentor } = useAuth()

  if (loading) {
    return (
      <div className="app-loading-screen">
        <div className="spinner" />
        <p style={{ marginTop: 12, color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500 }}>
          Đang tải không gian học kỳ...
        </p>
      </div>
    )
  }

  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />
  }

  if (mentorOnly && !isMentor) {
    return <Navigate to="/" replace />
  }

  return children
}

function RoleAdaptiveHome() {
  const { isMentor } = useAuth()
  if (isMentor) {
    return <MentorDashboardPage />
  }
  return <DashboardPage />
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
        <Route index element={<RoleAdaptiveHome />} />
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

        {/* ── Mentor Routes ── */}
        <Route
          path="mentor/dashboard"
          element={
            <ProtectedRoute mentorOnly>
              <MentorDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="mentor/requests"
          element={
            <ProtectedRoute mentorOnly>
              <MentorRequestsPage />
            </ProtectedRoute>
          }
        />

        {/* ── Admin Mentors & Quota Management Route ── */}
        <Route
          path="mentors"
          element={
            <ProtectedRoute adminOnly>
              <AdminMentorsPage />
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
              background: '#FFFFFF',
              color: '#0F172A',
              border: '1px solid #E2E8F0',
              borderRadius: '10px',
              padding: '10px 16px',
              fontSize: '13.5px',
              fontWeight: 500,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.04)'
            },
            success: {
              iconTheme: {
                primary: '#15803D',
                secondary: '#FFFFFF'
              }
            },
            error: {
              iconTheme: {
                primary: '#BA1A1A',
                secondary: '#FFFFFF'
              }
            }
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  )
}
