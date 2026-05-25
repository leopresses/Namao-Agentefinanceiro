import React, { useState, useEffect, useRef } from 'react';
import { getExpenses } from '../services/db';
import { getCategory } from '../utils/categories';

export default function ChatAI() {
  const [messages, setMessages] = useState([
    { id: 1, text: 'Olá! Sou seu Agente Financeiro. Como posso te ajudar com suas finanças hoje?', sender: 'ai' }
  ]);
  const [input, setInput] = useState('');
  const [expenses, setExpenses] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    async function load() {
      const data = await getExpenses();
      setExpenses(data);
    }
    load();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userText = input.trim();
    const userMsg = { id: Date.now(), text: userText, sender: 'user' };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      // Contexto das finanças filtrado para o mês atual
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
          // Quando pago, subtrai do saldo (dependendo de como você calcula, mas vamos mandar o Saldo Líquido atual do mês)
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

      // Requisição segura para o servidor backend local ou em produção
      const apiUrl = import.meta.env.VITE_API_URL || 'https://namao-agentefinanceiro.onrender.com/api/chat';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-secret': import.meta.env.VITE_LOCAL_API_SECRET || ''
        },
        body: JSON.stringify({ userText, contextData }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || 'Falha ao conectar com o servidor.');
      }

      const data = await response.json();

      setMessages(prev => [...prev, { id: Date.now() + 2, text: data.text, sender: 'ai' }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { id: Date.now() + 2, text: error.message || "Erro desconhecido.", sender: 'ai' }]);
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

  return (
    <div className="animate-fade-up" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: 'calc(100vh - 80px)', // Remove os 80px do BottomNav
      overflow: 'hidden'
    }}>
      <header className="app-header glass" style={{ marginBottom: '16px' }}>
        <h1 className="app-title" style={{ fontSize: '1.2rem' }}>Agente IA</h1>
      </header>

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
              background: msg.sender === 'user' ? 'var(--color-emerald-primary)' : 'rgba(255, 255, 255, 0.85)',
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

      <div style={{ padding: '0 0 16px 0' }}>
        <div className="glass-card" style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', padding: '12px 16px', borderRadius: '24px', background: 'rgba(255, 255, 255, 0.95)' }}>
          <textarea 
            placeholder="Pergunte qualquer coisa..." 
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
