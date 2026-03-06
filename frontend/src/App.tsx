import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PointsProvider } from './contexts/PointsContext';
import { Layout } from './components/layout/Layout';
import TasksView from './pages/Tasks/Tasks';
import FinanceView from './pages/Finance/Finance';
import BooksView from './pages/Books/Books';
import ExerciseView from './pages/Exercise/Exercise';
import ListsView from './pages/Lists/Lists';
import HistoryView from './pages/History/History';
import SettingsView from './pages/Settings/Settings';
import DashboardView from './pages/Dashboard/Dashboard';
import LoginView from './pages/Auth/Login';
import UpdatePasswordView from './pages/Auth/UpdatePassword';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useAutoReset } from './hooks/useAutoReset';

// Placeholder Pages - To be implemented
// (None left, we imported them all!)

function AppRoutes() {
  const { user } = useAuth();
  const { isResetting } = useAutoReset();

  if (user && isResetting) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', background: 'var(--bg-color)' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid var(--surface-hover)', borderTopColor: 'var(--primary-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p className="text-secondary font-medium">Syncing your goals...</p>
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Check if we are physically on the update-password route
  // We need to render the router so it can match the path.

  return (
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
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PointsProvider>
          <AppRoutes />
        </PointsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
