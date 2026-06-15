import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, Plus, User, Bot, FileText, ArrowDownCircle, ArrowUpCircle, Mic } from 'lucide-react';

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

  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleVoice = () => {
    setShowMenu(false);
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Seu navegador não suporta reconhecimento de voz.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = async (event) => {
      setIsListening(false);
      const text = event.results[0][0].transcript;
      
      setIsProcessing(true);
      try {
        const response = await fetch('/api/extract-expense', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        
        if (!response.ok) throw new Error('Falha na API');
        const data = await response.json();
        
        setIsProcessing(false);
        const params = new URLSearchParams();
        if (data.amount) params.set('amount', data.amount);
        if (data.description) params.set('description', data.description);
        if (data.category) params.set('category', data.category);
        params.set('type', data.type === 'income' ? 'income' : 'expense');
        params.set('voice', 'true');
        
        navigate(`/expense/new?${params.toString()}`);
      } catch (err) {
        setIsProcessing(false);
        alert('Erro ao processar a voz. Tente novamente.');
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      alert('Erro ao acessar o microfone.');
    };

    recognition.start();
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
            onClick={handleVoice} 
            className="btn-primary" 
            style={{ width: '100%', padding: '12px', boxShadow: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', border: 'none' }}
          >
            <Mic size={20} /> <span>Lançar por Voz (IA)</span>
          </button>
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

      {(isListening || isProcessing) && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          <div className={`glass-card ${isListening ? 'pulse' : ''}`} style={{ textAlign: 'center', background: 'var(--bg-primary)', padding: '32px', borderRadius: '32px' }}>
            <Mic size={48} color={isListening ? 'var(--color-emerald-primary)' : 'var(--text-tertiary)'} style={{ marginBottom: '16px' }} />
            <h3 style={{ color: 'var(--text-primary)' }}>{isListening ? 'Fale agora...' : 'A IA está analisando...'}</h3>
            <p style={{ color: 'var(--text-secondary)' }}>
              {isListening ? 'ex: Gastei 150 reais de gasolina hoje' : 'Aguarde um instante.'}
            </p>
          </div>
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
