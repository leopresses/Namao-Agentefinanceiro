import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import ExpenseForm from './pages/ExpenseForm';
import ExpenseDetails from './pages/ExpenseDetails';
import Profile from './pages/Profile';
import ChatAI from './pages/ChatAI';
import Report from './pages/Report';
import Budgets from './pages/Budgets';
import Goals from './pages/Goals';
import GoalForm from './pages/GoalForm';
import BottomNav from './components/BottomNav';
import HelpModal from './components/HelpModal';
import PwaPrompt from './components/PwaPrompt';
import Sidebar from './components/Sidebar';
import BiometricLock from './components/BiometricLock';
import { DialogProvider } from './contexts/DialogContext';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useAutoSync } from './hooks/useAutoSync';
import { onAuthChange } from './services/firebase';
import { WifiOff, RefreshCw } from 'lucide-react';

function SyncStatusBadge() {
  const { isOnline, syncStatus } = useAutoSync();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  
  // Esconde completamente o badge se estiver apenas online e ocioso (deixa o layout mais limpo)
  if (isOnline && (syncStatus === 'idle' || syncStatus === 'success')) {
    return null;
  }

  return (
    <div className="animate-fade-up" style={{
      position: 'fixed',
      top: '20px',
      right: isDesktop ? '180px' : '65px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      background: 'var(--glass-bg)',
      backdropFilter: 'blur(8px)',
      padding: '8px 12px',
      borderRadius: '20px',
      border: '1px solid var(--glass-border)',
      boxShadow: 'var(--glass-shadow)',
      zIndex: 1000,
      fontSize: '0.75rem',
      fontWeight: '600',
      color: 'var(--text-secondary)'
    }}>
      {!isOnline && <><WifiOff size={14} color="var(--color-crimson-primary)" /> Offline</>}
      {isOnline && syncStatus === 'syncing' && <><RefreshCw size={14} className="spin" color="var(--color-emerald-primary)" /> Salvando...</>}
      {isOnline && syncStatus === 'error' && <><WifiOff size={14} color="var(--color-crimson-primary)" /> Erro de Sincronização</>}
    </div>
  );
}

function RequireAuth({ children }) {
  const location = useLocation();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => onAuthChange((currentUser) => {
    setUser(currentUser);
    setIsCheckingAuth(false);
  }), []);

  if (isCheckingAuth) {
    return <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>Verificando acesso...</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

function App() {
  const location = useLocation();
  const hideNav = location.pathname === '/login';
  const isDesktop = useMediaQuery('(min-width: 768px)');

  useEffect(() => {
    const savedTheme = localStorage.getItem('namao_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const content = (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      {/* Protected Routes */}
      <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/expense/new" element={<RequireAuth><ExpenseForm /></RequireAuth>} />
      <Route path="/expense/:id" element={<RequireAuth><ExpenseDetails /></RequireAuth>} />
      <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
      <Route path="/chat" element={<RequireAuth><ChatAI /></RequireAuth>} />
      <Route path="/report" element={<RequireAuth><Report /></RequireAuth>} />
      <Route path="/budgets" element={<RequireAuth><Budgets /></RequireAuth>} />
      <Route path="/goals" element={<RequireAuth><Goals /></RequireAuth>} />
      <Route path="/goal/new" element={<RequireAuth><GoalForm /></RequireAuth>} />
      <Route path="/goal/:id" element={<RequireAuth><GoalForm /></RequireAuth>} />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );

  return (
    <DialogProvider>
      <BiometricLock requireLock={!hideNav && localStorage.getItem('namao_biometric') === 'true'}>
      {isDesktop && !hideNav ? (
        <div className="desktop-layout">
          <Sidebar />
          <div className="desktop-content">
            {content}
          </div>
        </div>
      ) : (
        <div className="mobile-layout">
          {content}
          {!hideNav && <BottomNav />}
        </div>
      )}
      </BiometricLock>
      
      {!hideNav && <HelpModal />}
      {!hideNav && <PwaPrompt />}
      {!hideNav && <SyncStatusBadge />}
    </DialogProvider>
  );
}

const AppWrapper = () => (
  <Router>
    <App />
  </Router>
);

export default AppWrapper;
