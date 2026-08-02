import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router';
import { PointsProvider } from './contexts/PointsContext';
import { Layout } from './components/layout/Layout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { UpdatePrompt } from './components/UpdatePrompt';
import { InstallPrompt } from './components/InstallPrompt';
import { FullscreenLoader } from './components/ui/FullscreenLoader';
import { useAutoReset } from './hooks/useAutoReset';

// PWA-5 — one chunk per route instead of one bundle for the whole app.
//
// Statically importing all ten pages meant opening the Dashboard also
// downloaded and parsed Finance, Books, Exercise, Lists, Settings and the rest.
// On a phone that is the slowest part of a cold start, and it is all work for
// screens the user may never visit this session. React.lazy defers each page to
// the moment it is routed to; Vite emits a separate chunk per dynamic import.
//
// Login is lazy too, but it is the first thing an unauthenticated visitor sees,
// so it stays small and the shell renders around it immediately either way.
const DashboardView = lazy(() => import('./pages/Dashboard/Dashboard'));
const TasksView = lazy(() => import('./pages/Tasks/Tasks'));
const FinanceView = lazy(() => import('./pages/Finance/Finance'));
const BooksView = lazy(() => import('./pages/Books/Books'));
const ExerciseView = lazy(() => import('./pages/Exercise/Exercise'));
const ListsView = lazy(() => import('./pages/Lists/Lists'));
const HistoryView = lazy(() => import('./pages/History/History'));
const SettingsView = lazy(() => import('./pages/Settings/Settings'));
const LoginView = lazy(() => import('./pages/Auth/Login'));
const UpdatePasswordView = lazy(() => import('./pages/Auth/UpdatePassword'));

function AppRoutes() {
  const { user } = useAuth();
  const { isResetting } = useAutoReset();

  if (user && isResetting) {
    return <FullscreenLoader message="Syncing your goals…" />;
  }

  // Check if we are physically on the update-password route
  // We need to render the router so it can match the path.

  return (
    // This boundary only catches the routes that render *outside* the app
    // shell — Login and the password-reset landing. Pages inside the shell have
    // their own boundary around <Outlet /> in Layout.tsx, which keeps the
    // sidebar and header on screen while a page chunk downloads instead of
    // blanking the whole window.
    <Suspense fallback={<FullscreenLoader />}>
      <Routes>
        <Route path="/update-password" element={<UpdatePasswordView />} />
        <Route path="/" element={user ? <Layout /> : <LoginView />}>
          {user && (
            <>
              <Route index element={<DashboardView />} />
              <Route path="tasks" element={<TasksView />} />
              <Route path="finance" element={<FinanceView />} />
              <Route path="books" element={<BooksView />} />
              <Route path="exercise" element={<ExerciseView />} />
              <Route path="lists" element={<ListsView />} />
              <Route path="history" element={<HistoryView />} />
              <Route path="settings" element={<SettingsView />} />
            </>
          )}
        </Route>
        {/* Catch-all for non-logged-in users trying to access other routes */}
        {!user && <Route path="*" element={<LoginView />} />}
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <BrowserRouter>
      {/* ErrorBoundary sits outermost so a crash anywhere still renders a
          recoverable screen; ToastProvider sits above the data contexts so they
          can report failures instead of swallowing them into the console. */}
      <ErrorBoundary>
        <ToastProvider>
          {/* Both prompts live outside the auth gate. A pending app update is
              worth offering whether or not anyone is signed in, and the install
              banner is most useful to a first-time visitor looking at Login. */}
          <UpdatePrompt />
          <InstallPrompt />
          <AuthProvider>
            <PointsProvider>
              <AppRoutes />
            </PointsProvider>
          </AuthProvider>
        </ToastProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
