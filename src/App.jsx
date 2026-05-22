import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import ExpenseForm from './pages/ExpenseForm';
import ExpenseDetails from './pages/ExpenseDetails';
import Profile from './pages/Profile';
import ChatAI from './pages/ChatAI';
import Report from './pages/Report';
import BottomNav from './components/BottomNav';
import HelpModal from './components/HelpModal';
import PwaPrompt from './components/PwaPrompt';
import Sidebar from './components/Sidebar';
import { DialogProvider } from './contexts/DialogContext';
import { useMediaQuery } from './hooks/useMediaQuery';

// Componente para proteger rotas
function RequireAuth({ children }) {
  const token = localStorage.getItem('namao_auth_token');
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

function App() {
  const location = useLocation();
  const hideNav = location.pathname === '/login';
  const isDesktop = useMediaQuery('(min-width: 768px)');

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
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );

  return (
    <DialogProvider>
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
      
      {!hideNav && <HelpModal />}
      {!hideNav && <PwaPrompt />}
    </DialogProvider>
  );
}

const AppWrapper = () => (
  <Router>
    <App />
  </Router>
);

export default AppWrapper;
