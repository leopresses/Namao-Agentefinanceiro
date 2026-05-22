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
import { DialogProvider } from './contexts/DialogContext';

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

  return (
    <DialogProvider>
      <div className="container">
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
        
        {!hideNav && <BottomNav />}
        {!hideNav && <HelpModal />}
        {!hideNav && <PwaPrompt />}
      </div>
    </DialogProvider>
  );
}

const AppWrapper = () => (
  <Router>
    <App />
  </Router>
);

export default AppWrapper;
