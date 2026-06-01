import React, { useState, useEffect, useRef } from 'react';
import { getExpenses } from '../services/db';
import { getCategory } from '../utils/categories';
import { getChatList, getChatById, getActiveChatId, setActiveChatId, createChat, addMessageToChat, deleteChat } from '../services/chatDb';
import { getIdToken, getUserProStatus, onAuthChange } from '../services/firebase';
import { MessageSquarePlus, History, Trash2, ChevronLeft, X, Sparkles } from 'lucide-react';
import { useDialog } from '../contexts/DialogContext';

export default function ChatAI() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [expenses, setExpenses] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [activeChatId, setActiveChatIdState] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [chatList, setChatList] = useState([]);
  const [proStatus, setProStatus] = useState({ isPro: localStorage.getItem('namao_is_pro') === 'true', aiMessageCount: 0 });
  const messagesEndRef = useRef(null);
  const { showConfirm, showProModal } = useDialog();

  // Carregar despesas e status pro
  useEffect(() => {
    async function load() {
      const data = await getExpenses();
      setExpenses(data);
    }
    load();
    
    const unsubscribe = onAuthChange(async (user) => {
      if (user) {
        const pro = await getUserProStatus();
        setProStatus(pro);
      }
    });
    return () => unsubscribe();
  }, []);

  // Carregar ou criar chat ativo ao montar
  useEffect(() => {
    const savedId = getActiveChatId();
    if (savedId) {
      const chat = getChatById(savedId);
      if (chat) {
        setActiveChatIdState(chat.id);
        setMessages(chat.messages);
      } else {
        startNewChat();
      }
    } else {
      startNewChat();
    }
    refreshChatList();
  }, []);

  const refreshChatList = () => {
    setChatList(getChatList());
  };

  const startNewChat = () => {
    const chat = createChat();
    setActiveChatIdState(chat.id);
    setMessages(chat.messages);
    setActiveChatId(chat.id);
    refreshChatList();
    setShowHistory(false);
  };

  const switchToChat = (chatId) => {
    const chat = getChatById(chatId);
    if (chat) {
      setActiveChatIdState(chat.id);
      setMessages(chat.messages);
      setActiveChatId(chat.id);
      setShowHistory(false);
    }
  };

  const handleDeleteChat = async (chatId, e) => {
    e.stopPropagation();
    const confirmed = await showConfirm('Apagar Conversa', 'Deseja realmente apagar esta conversa?');
    if (confirmed) {
      deleteChat(chatId);
      if (chatId === activeChatId) {
        const list = getChatList();
        if (list.length > 0) {
          switchToChat(list[0].id);
        } else {
          startNewChat();
        }
      }
      refreshChatList();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (input.trim() === '') return;

    if (!proStatus.isPro && proStatus.aiMessageCount >= 5) {
      showProModal();
      return;
    }

    const userText = input.trim();
    const userMsg = { id: Date.now(), text: userText, sender: 'user' };
    
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);

    // Persistir mensagem do usuário
    if (activeChatId) {
      addMessageToChat(activeChatId, userMsg);
      refreshChatList();
    }

    try {
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();
      const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

      const currentMonthExpenses = expenses.filter(item => {
        const itemDate = new Date(item.date + 'T12:00:00');
        return itemDate.getMonth() === currentMonth && itemDate.getFullYear() === currentYear;
      });

      const toPay = currentMonthExpenses.filter(e => e.type === 'expense' && e.status === 'unpaid').reduce((a, b) => a + b.amount, 0);
      
      let balance = 0;
      currentMonthExpenses.forEach(item => {
        if (item.type === 'income') {
          balance += item.amount;
        } else if (item.status === 'paid') {
          balance -= item.amount;
        }
      });

      const contextData = `
        Mês Atual: ${monthNames[currentMonth]} de ${currentYear}.
        Resumo deste mês:
        - Saldo Atual do Mês (Renda - Despesas Pagas): R$ ${balance.toFixed(2)}.
        - Faturas a Pagar neste mês: R$ ${toPay.toFixed(2)}.
        Aqui está a lista de movimentações DO MÊS ATUAL:
        ${currentMonthExpenses.map(e => `- ${e.date}: ${e.description} | Categoria: ${e.category ? getCategory(e.category).label : 'Outros'} | R$ ${e.amount} | Tipo: ${e.type} | Status: ${e.status}`).join('\n')}
      `;
      // Para Vercel, usamos caminho relativo. Em dev, o Vite Proxy lida com isso se configurado,
      // mas na Vercel o backend já roda no mesmo domínio do frontend.
      const apiUrl = import.meta.env.VITE_API_URL || '/api/chat';
      
      // SEGURANÇA: Envia Firebase ID Token (JWT) ao invés de secret estático
      let authHeader = {};
      try {
        const token = await getIdToken();
        authHeader = { 'Authorization': `Bearer ${token}` };
      } catch (e) {
        // Usuário não autenticado via Google, continuar sem token
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader
        },
        body: JSON.stringify({ userText, contextData }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || 'Falha ao conectar com o servidor.');
      }

      const data = await response.json();
      const aiMsg = { id: Date.now() + 2, text: data.text, sender: 'ai' };

      setMessages(prev => [...prev, aiMsg]);
      
      // Persistir resposta da IA
      if (activeChatId) {
        addMessageToChat(activeChatId, aiMsg);
        refreshChatList();
      }

      // Update local count assuming success
      if (!proStatus.isPro) {
        setProStatus(prev => ({ ...prev, aiMessageCount: prev.aiMessageCount + 1 }));
      }
    } catch (error) {
      console.error(error);
      const errorMsg = { id: Date.now() + 2, text: error.message || "Erro desconhecido.", sender: 'ai' };
      setMessages(prev => [...prev, errorMsg]);
      
      if (activeChatId) {
        addMessageToChat(activeChatId, errorMsg);
      }
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatDate = (isoString) => {
    const d = new Date(isoString);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div className="chat-container animate-fade-up">
      {/* Header */}
      <header className="app-header glass" style={{ marginBottom: '16px', marginTop: '32px', position: 'relative' }}>
        <h1 className="app-title" style={{ fontSize: '1.2rem' }}>Agente IA</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => setShowHistory(!showHistory)}
            style={{ 
              background: showHistory ? 'var(--color-emerald-primary)' : 'transparent', 
              border: 'none', 
              padding: '8px', 
              borderRadius: '12px',
              color: showHistory ? '#fff' : 'var(--text-secondary)',
              transition: '0.2s'
            }}
            title="Histórico de conversas"
          >
            <History size={20} />
          </button>
          <button 
            onClick={startNewChat}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              padding: '8px', 
              borderRadius: '12px',
              color: 'var(--color-emerald-primary)'
            }}
            title="Nova conversa"
          >
            <MessageSquarePlus size={20} />
          </button>
        </div>
      </header>

      {/* Painel de Histórico */}
      {showHistory && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'var(--bg-primary)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          padding: '24px',
          animation: 'fadeUp 0.3s ease forwards'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 style={{ color: 'var(--text-primary)', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <History size={22} color="var(--color-emerald-primary)" />
              Histórico de Conversas
            </h2>
            <button 
              onClick={() => setShowHistory(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '8px' }}
            >
              <X size={22} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {chatList.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '40px' }}>
                Nenhuma conversa encontrada.
              </p>
            ) : (
              chatList.map(chat => (
                <div 
                  key={chat.id}
                  onClick={() => switchToChat(chat.id)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px',
                    borderRadius: '16px',
                    marginBottom: '8px',
                    cursor: 'pointer',
                    background: chat.id === activeChatId ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-secondary)',
                    border: chat.id === activeChatId ? '1px solid var(--color-emerald-primary)' : '1px solid var(--glass-border)',
                    transition: '0.2s'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ 
                      margin: 0, 
                      color: 'var(--text-primary)', 
                      fontSize: '0.95rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {chat.title}
                    </h4>
                    <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                      {chat.messageCount} mensagens · {formatDate(chat.updatedAt)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDeleteChat(chat.id, e)}
                    style={{ 
                      background: 'transparent', 
                      border: 'none', 
                      color: 'var(--text-secondary)', 
                      padding: '8px',
                      flexShrink: 0,
                      borderRadius: '8px'
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>

          <button onClick={startNewChat} className="btn-primary" style={{ width: '100%', marginTop: '16px' }}>
            <MessageSquarePlus size={18} /> Nova Conversa
          </button>
        </div>
      )}

      {/* Área de Mensagens */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '16px' }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ 
            alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start', 
            maxWidth: '85%',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px', marginLeft: msg.sender === 'user' ? 'auto' : '8px', marginRight: msg.sender === 'user' ? '8px' : '0' }}>
              {msg.sender === 'user' ? 'Você' : 'Agente'}
            </span>
            <div className="glass-card" style={{ 
              padding: '16px', 
              borderRadius: msg.sender === 'user' ? '24px 24px 4px 24px' : '24px 24px 24px 4px',
              background: msg.sender === 'user' ? 'var(--color-emerald-primary)' : 'var(--bg-secondary)',
              color: msg.sender === 'user' ? '#fff' : 'var(--text-primary)',
              border: msg.sender === 'user' ? 'none' : '1px solid var(--glass-border)',
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.05)'
            }}>
              <p style={{ margin: 0, lineHeight: '1.5', whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>{msg.text}</p>
            </div>
          </div>
        ))}
        {isTyping && (
          <div style={{ alignSelf: 'flex-start', marginLeft: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>O Agente está digitando...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input de Mensagem */}
      <div className="chat-input-area" style={{ padding: '0 0 16px 0' }}>
        {!proStatus.isPro && (
          <div style={{ 
            fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
          }}>
            <Sparkles size={12} color="var(--color-emerald-primary)"/>
            {proStatus.aiMessageCount >= 5 ? 
              'Limite gratuito de 5/5 mensagens atingido.' : 
              `${proStatus.aiMessageCount}/5 mensagens gratuitas enviadas este mês.`
            }
          </div>
        )}
        <div className="glass-card" style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', padding: '12px 16px', borderRadius: '24px', background: 'var(--bg-secondary)' }}>
          <textarea 
            placeholder={
              !proStatus.isPro && proStatus.aiMessageCount >= 5 
                ? "Limite grátis atingido" 
                : "Pergunte qualquer coisa..."
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            style={{ 
              flex: 1, 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--text-primary)', 
              fontFamily: 'Inter', 
              fontSize: '1rem',
              resize: 'none',
              minHeight: '44px',
              maxHeight: '120px',
              outline: 'none',
              paddingTop: '12px'
            }} 
          />
          <button 
            onClick={handleSend} 
            className="btn-primary" 
            style={{ padding: '0', width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            disabled={isTyping}
          >
            ➔
          </button>
        </div>
      </div>
    </div>
  );
}
