import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, Plus, User, Bot, FileText, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);

  if (location.pathname === '/login') return null;

  const toggleMenu = (e) => {
    e.preventDefault();
    setShowMenu(!showMenu);
  };

  const handleAdd = (type) => {
    setShowMenu(false);
    navigate(`/expense/new?type=${type}`);
  };

  return (
    <>
      {/* Overlay click fora */}
      {showMenu && (
        <div 
          onClick={() => setShowMenu(false)} 
          style={{ position: 'fixed', inset: 0, zIndex: 90 }}
        />
      )}

      {showMenu && (
        <div className="action-menu" style={{ zIndex: 100 }}>
          <button 
            onClick={() => handleAdd('income')} 
            className="btn-primary" 
            style={{ width: '100%', padding: '12px', boxShadow: 'none' }}
          >
            <ArrowUpCircle size={20} /> <span>Nova Renda</span>
          </button>
          <button 
            onClick={() => handleAdd('expense')} 
            className="btn-danger" 
            style={{ width: '100%', padding: '12px', boxShadow: 'none' }}
          >
            <ArrowDownCircle size={20} /> <span>Nova Despesa</span>
          </button>
        </div>
      )}

      <nav className="glass" style={{
        position: 'fixed',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 32px)',
        maxWidth: '568px',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: '12px 0',
        zIndex: 100,
      }}>
        <NavLink to="/" style={navStyle}>
          <Home size={24} />
        </NavLink>
        <NavLink to="/report" style={navStyle}>
          <FileText size={24} />
        </NavLink>
        
        <div onClick={toggleMenu} style={{ ...navStyle, ...mainActionStyle(showMenu) }}>
          <Plus size={32} color="#FFF" style={{ transform: showMenu ? 'rotate(45deg)' : 'none', transition: 'transform 0.3s ease' }} />
        </div>

        <NavLink to="/chat" style={navStyle}>
          <Bot size={24} />
        </NavLink>
        <NavLink to="/profile" style={navStyle}>
          <User size={24} />
        </NavLink>
      </nav>
    </>
  );
};

const navStyle = ({ isActive }) => ({
  color: isActive ? 'var(--color-emerald-light)' : 'var(--text-secondary)',
  textDecoration: 'none',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  transition: 'color 0.2s',
  padding: '8px',
  cursor: 'pointer'
});

const mainActionStyle = (isOpen) => ({
  background: isOpen ? 'var(--color-crimson-primary)' : 'var(--color-emerald-primary)',
  borderRadius: '50%',
  padding: '12px',
  marginTop: '-24px', 
  boxShadow: isOpen ? '0 8px 16px rgba(244, 63, 94, 0.4)' : '0 8px 16px rgba(16, 185, 129, 0.4)',
  transition: 'all 0.3s ease'
});

export default BottomNav;
