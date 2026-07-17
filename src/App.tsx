import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { AppLayout } from './components/AppLayout'
import { FullScreenLoader } from './components/FullScreenLoader'
import { ErrorBoundary } from './components/ErrorBoundary'
import Login from './screens/Login'
import MyWork from './screens/MyWork'
import Projects from './screens/Projects'
import ProjectDetail from './screens/ProjectDetail'
import JobDetail from './screens/JobDetail'
import TaskDetail from './screens/TaskDetail'
import Inspection from './screens/Inspection'
import Ordering from './screens/Ordering'
import Profile from './screens/Profile'
import QrResolve from './screens/QrResolve'
import Placeholder from './screens/Placeholder'

// Scanner pulls in the camera library — load it only when opened.
const Scan = lazy(() => import('./screens/Scan'))

function ProtectedLayout() {
  const { session, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (!session) return <Navigate to="/login" replace />
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  )
}

export default function App() {
  const { session, loading } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={
          loading ? (
            <FullScreenLoader />
          ) : session ? (
            <Navigate to="/" replace />
          ) : (
            <Login />
          )
        }
      />

      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<Navigate to="/my-work" replace />} />
        <Route path="/my-work" element={<MyWork />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:projectId" element={<ProjectDetail />} />
        <Route path="/jobs/:jobId" element={<JobDetail />} />
        <Route path="/tasks/:taskId" element={<TaskDetail />} />
        <Route path="/profile" element={<Profile />} />
        <Route
          path="/scan"
          element={
            <ErrorBoundary>
              <Suspense fallback={<FullScreenLoader />}>
                <Scan />
              </Suspense>
            </ErrorBoundary>
          }
        />
        {/* QR deep links (resolve qr_code_uuid -> entity) */}
        <Route path="/p/:qr" element={<QrResolve kind="project" />} />
        <Route path="/j/:qr" element={<QrResolve kind="job" />} />
        <Route path="/j/:qr/m/:mqr" element={<QrResolve kind="material" />} />
        <Route path="/inspection" element={<Inspection />} />
        <Route path="/ordering" element={<Ordering />} />
        <Route path="/calendar" element={<Placeholder titleKey="nav.calendar" />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
