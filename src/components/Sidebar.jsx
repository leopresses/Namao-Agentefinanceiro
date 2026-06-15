import React, { useState, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, User, Bot, FileText, Plus, ArrowUpCircle, ArrowDownCircle, Mic, X } from 'lucide-react';

const Sidebar = () => {
  const navigate = useNavigate();
  const [showDesktopMenu, setShowDesktopMenu] = useState(false);
  const recognitionRef = useRef(null);

  const toggleMenu = (e) => {
    e.preventDefault();
    setShowDesktopMenu(!showDesktopMenu);
  };

  const handleAdd = (type) => {
    setShowDesktopMenu(false);
    navigate(`/expense/new?type=${type}`);
  };

  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleVoice = () => {
    setShowDesktopMenu(false);
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Seu navegador não suporta reconhecimento de voz.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
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
    };

    recognition.start();
  };

  const cancelVoice = () => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }
    setIsListening(false);
    setIsProcessing(false);
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
            <span>NaMão IA</span>
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <User size={24} />
            <span>Perfil</span>
          </NavLink>
        </nav>

        <div style={{ marginTop: 'auto', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
          Criado por Leonardo Presses
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
            <button 
              onClick={handleVoice} 
              className="btn-primary" 
              style={{ width: '100%', padding: '12px', boxShadow: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', border: 'none' }}
            >
              <Mic size={20} /> <span>Lançar por Voz (IA)</span>
            </button>
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

      {/* Modal de Lançamento por Voz */}
      {(isListening || isProcessing) && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          <div className="glass-card" style={{ textAlign: 'center', background: 'var(--bg-primary)', padding: '32px', borderRadius: '32px', maxWidth: '300px' }}>
            <div className={isListening ? 'animate-pulse-glow' : ''} style={{ display: 'inline-block', marginBottom: '16px', padding: '16px', borderRadius: '50%', background: isListening ? 'rgba(16, 185, 129, 0.1)' : 'transparent' }}>
              <Mic size={48} color={isListening ? 'var(--color-emerald-primary)' : 'var(--text-tertiary)'} />
            </div>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>{isListening ? 'Fale agora...' : 'A IA está analisando...'}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {isListening ? 'ex: "Gastei 150 reais de gasolina hoje"' : 'Aguarde um instante enquanto processamos sua fala.'}
            </p>
          </div>
          
          <button 
            onClick={cancelVoice} 
            style={{ marginTop: '32px', background: 'var(--color-crimson-primary)', border: 'none', borderRadius: '50%', padding: '16px', color: 'white', cursor: 'pointer', boxShadow: '0 8px 16px rgba(244, 63, 94, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={28} />
          </button>
        </div>
      )}
    </>
  );
};

export default Sidebar;
