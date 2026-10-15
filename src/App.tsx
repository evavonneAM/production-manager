import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { AppLayout } from './components/AppLayout'
import { FullScreenLoader } from './components/FullScreenLoader'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AdminOnly } from './components/AdminOnly'
import Login from './screens/Login'
import MyWork from './screens/MyWork'
import Projects from './screens/Projects'
import ProjectDetail from './screens/ProjectDetail'
import JobDetail from './screens/JobDetail'
import TaskDetail from './screens/TaskDetail'
import Inspection from './screens/Inspection'
import Ordering from './screens/Ordering'
import Calendar from './screens/Calendar'
import Priority from './screens/Priority'
import Inbox from './screens/Inbox'
import Reports from './screens/Reports'
import Tools from './screens/Tools'
import Profile from './screens/Profile'
import QrResolve from './screens/QrResolve'

// Scanner pulls in the camera library — load it only when opened.
const Scan = lazy(() => import('./screens/Scan'))
// Calculators (and their PDF code) load only when opened.
const CushionCut = lazy(() => import('./screens/calculators/CushionCut'))
const LeafBag = lazy(() => import('./screens/calculators/LeafBag'))
const CushionPricing = lazy(() => import('./screens/calculators/CushionPricing'))
const Upholstery = lazy(() => import('./screens/calculators/Upholstery'))
const DraperyPleat = lazy(() => import('./screens/calculators/DraperyPleat'))
const FloorplanMeasure = lazy(() => import('./screens/calculators/floorplan/FloorplanMeasure'))
// Estimates show prices: Admins only, and loaded only when opened.
const Estimates = lazy(() => import('./screens/Estimates'))
const EstimateDetail = lazy(() => import('./screens/EstimateDetail'))
const page = (el: React.ReactNode) => <Suspense fallback={<FullScreenLoader />}>{el}</Suspense>

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
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/priority" element={<Priority />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/tools/cushion-cut" element={page(<CushionCut />)} />
        <Route path="/tools/leaf-bag" element={page(<LeafBag />)} />
        <Route path="/tools/drapery-pleat" element={page(<DraperyPleat />)} />
        <Route path="/tools/floorplan-measure" element={page(<FloorplanMeasure />)} />
        <Route path="/tools/cushion-pricing" element={<AdminOnly>{page(<CushionPricing />)}</AdminOnly>} />
        <Route path="/tools/upholstery" element={<AdminOnly>{page(<Upholstery />)}</AdminOnly>} />
        <Route path="/estimates" element={<AdminOnly>{page(<Estimates />)}</AdminOnly>} />
        <Route path="/estimates/:estimateId" element={<AdminOnly>{page(<EstimateDetail />)}</AdminOnly>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
