import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, User, Bot, FileText, Plus, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

const Sidebar = () => {
  const navigate = useNavigate();
  const [showDesktopMenu, setShowDesktopMenu] = useState(false);

  const toggleMenu = (e) => {
    e.preventDefault();
    setShowDesktopMenu(!showDesktopMenu);
  };

  const handleAdd = (type) => {
    setShowDesktopMenu(false);
    navigate(`/expense/new?type=${type}`);
  };

  return (
    <>
      <aside className="sidebar glass" style={{
        width: '260px',
        height: '100vh',
        position: 'sticky',
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: '32px 24px',
        borderRight: '1px solid var(--glass-border)',
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '48px' }}>
          <img src="/app_icon.png" alt="Logo" style={{ width: '40px', height: '40px' }} />
          <h1 className="app-title" style={{ fontSize: '1.8rem', margin: 0 }}>NaMão</h1>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
          <NavLink to="/" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <Home size={24} />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/report" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <FileText size={24} />
            <span>Relatórios</span>
          </NavLink>
          <NavLink to="/chat" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <Bot size={24} />
            <span>Agente IA</span>
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <User size={24} />
            <span>Perfil</span>
          </NavLink>
        </nav>

        <div style={{ marginTop: 'auto', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
          Versão Desktop Beta
        </div>
      </aside>

      {/* Floating Action Button - Top Right */}
      <div style={{ position: 'fixed', top: '24px', right: '32px', zIndex: 100 }}>
        {showDesktopMenu && (
          <div className="action-menu glass" style={{ 
            position: 'absolute', 
            top: '70px', 
            right: '0', 
            left: 'auto', 
            transform: 'none',
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px',
            padding: '12px',
            borderRadius: '16px',
            width: '200px'
          }}>
            <button onClick={() => handleAdd('income')} className="btn-primary" style={{ width: '100%', padding: '12px', boxShadow: 'none' }}>
              <ArrowUpCircle size={20} /> <span>Nova Renda</span>
            </button>
            <button onClick={() => handleAdd('expense')} className="btn-danger" style={{ width: '100%', padding: '12px', boxShadow: 'none' }}>
              <ArrowDownCircle size={20} /> <span>Nova Despesa</span>
            </button>
          </div>
        )}
        <button 
          onClick={toggleMenu} 
          className="btn-primary"
          style={{ 
            borderRadius: '24px', 
            padding: '12px 24px', 
            boxShadow: '0 8px 16px rgba(16, 185, 129, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Plus size={24} style={{ transform: showDesktopMenu ? 'rotate(45deg)' : 'none', transition: 'transform 0.3s ease' }} />
          <span>Lançar</span>
        </button>
      </div>
      
      {/* Overlay para fechar o menu superior */}
      {showDesktopMenu && (
        <div onClick={() => setShowDesktopMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
      )}
    </>
  );
};

export default Sidebar;
