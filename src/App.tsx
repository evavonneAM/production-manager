import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { AppLayout } from './components/AppLayout'
import { FullScreenLoader } from './components/FullScreenLoader'
import Login from './screens/Login'
import Projects from './screens/Projects'
import ProjectDetail from './screens/ProjectDetail'
import JobDetail from './screens/JobDetail'
import Profile from './screens/Profile'
import Placeholder from './screens/Placeholder'

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
        <Route path="/" element={<Navigate to="/projects" replace />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:projectId" element={<ProjectDetail />} />
        <Route path="/jobs/:jobId" element={<JobDetail />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/my-work" element={<Placeholder titleKey="nav.myWork" />} />
        <Route path="/calendar" element={<Placeholder titleKey="nav.calendar" />} />
        <Route path="/inspection" element={<Placeholder titleKey="nav.inspection" />} />
        <Route path="/scan" element={<Placeholder titleKey="nav.scan" />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
