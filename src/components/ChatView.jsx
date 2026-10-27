import { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowUp, ArrowUpRight, CalendarDays, ChartNoAxesCombined, History, MessageSquarePlus, Sparkles, Trash2, Wallet } from 'lucide-react';
import '../pages/AccountScreens.css';

const suggestions = [
  { text: 'Como está meu mês?', Icon: Wallet },
  { text: 'Onde estou gastando mais?', Icon: ChartNoAxesCombined },
  { text: 'O que vence esta semana?', Icon: CalendarDays },
];

export default function ChatView({
  messages, isLoading, input, setInput, isTyping, proStatus, messagesEndRef,
  showHistory, setShowHistory, chatList, activeChatId, startNewChat, switchToChat,
  handleDeleteChat, handleSend, handleKeyPress, cancelChatResponse, formatDate, showProModal,
}) {
  const historyRef = useRef(null);
  const isNewConversation = messages.length === 0 || (messages.length === 1 && messages[0].id === 1 && messages[0].sender === 'ai' && !messages[0].isError);
  const atLimit = !proStatus.isPro && proStatus.aiMessageCount >= 5;

  useEffect(() => {
    const dialog = historyRef.current;
    if (showHistory && !dialog.open) dialog.showModal();
    else if (!showHistory && dialog.open) dialog.close();
  }, [showHistory]);

  return (
    <div className="chat-container chat-page" data-navigation-loading={isLoading}>
      <header className="account-brand-header"><div className="app-title"><img src="/logo.png?v=20260901" alt="" className="logo-icon" />NaMão</div><span className="account-plan-badge">{proStatus.isPro ? 'PRO' : 'Gratuito'}</span></header>
      <div className="chat-title-row"><div><h1>NaMão IA</h1><p>Vamos cuidar das suas finanças?</p></div><div className="chat-actions">
        <button type="button" className="account-icon-button" aria-label="Histórico de conversas" onClick={() => setShowHistory(true)} disabled={isTyping}><History size={21} aria-hidden="true" /></button>
        <button type="button" className="account-icon-button chat-new" aria-label="Nova conversa" onClick={startNewChat} disabled={isTyping}><MessageSquarePlus size={21} aria-hidden="true" /></button>
      </div></div>

      <div className="chat-messages" data-navigation-scroll="chat-messages" aria-label="Conversa">
        {isNewConversation ? <section className="chat-welcome">
          <div className="chat-welcome-icon"><Sparkles size={23} aria-hidden="true" /></div>
          <h2>Seu dinheiro,<br />mais fácil de entender.</h2>
          <p>Consulte seus gastos, entenda o saldo e organize os próximos passos.</p>
          <div className="chat-suggestions">{suggestions.map(({ text, Icon }) => <button type="button" key={text} onClick={() => handleSend(text)} disabled={isTyping || isLoading}><Icon size={18} aria-hidden="true" /><span>{text}</span><ArrowUpRight size={16} aria-hidden="true" /></button>)}</div>
        </section> : messages.map(msg => <article key={msg.id} className={`chat-message ${msg.sender === 'user' ? 'chat-message-user' : 'chat-message-ai'}${msg.isError ? ' chat-message-error' : ''}`}>
          {msg.sender !== 'user' && <span className="chat-message-label"><Sparkles size={14} aria-hidden="true" />NaMão IA</span>}
          <p>{msg.text}</p>
        </article>)}
        {isTyping && <div className="chat-typing" role="status"><span>O Agente está digitando...</span><button type="button" onClick={cancelChatResponse}>Cancelar</button></div>}
        <div ref={messagesEndRef} data-navigation-scroll-end />
      </div>

      <div className="chat-composer-zone">
        <div className="chat-usage"><span>{proStatus.isPro ? 'Plano PRO · Sem cota mensal' : atLimit ? 'Limite gratuito de 5 mensagens atingido' : `${proStatus.aiMessageCount} de 5 mensagens grátis usadas`}</span>{!proStatus.isPro && <button type="button" onClick={showProModal}>Conhecer PRO</button>}</div>
        <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); handleSend(); }}>
          <textarea aria-label="Mensagem para NaMão IA" rows={1} placeholder={atLimit ? 'Limite grátis atingido' : 'Pergunte sobre suas finanças...'} value={input} onChange={event => setInput(event.target.value)} onKeyDown={handleKeyPress} />
          <button type="submit" className="chat-send" aria-label="Enviar mensagem" disabled={isTyping || !input.trim() || isLoading}><ArrowUp size={23} aria-hidden="true" /></button>
        </form>
        <p className="chat-composer-note">Confira os valores antes de tomar decisões.</p>
      </div>

      <dialog ref={historyRef} className="chat-history-dialog" aria-labelledby="chat-history-title" onCancel={() => setShowHistory(false)} onClose={() => setShowHistory(false)}>
        <header className="account-subpage-header"><button type="button" className="account-icon-button" aria-label="Fechar histórico" onClick={() => setShowHistory(false)}><ArrowLeft size={23} aria-hidden="true" /></button><h2 id="chat-history-title">Conversas</h2></header>
        <div className="chat-history-list" data-navigation-scroll="chat-history">
          {chatList.length === 0 ? <p className="account-helper">Nenhuma conversa encontrada.</p> : chatList.map(chat => <div className={`chat-history-row${chat.id === activeChatId ? ' is-active' : ''}`} key={chat.id}>
            <button type="button" className="chat-history-select" onClick={() => switchToChat(chat.id)} aria-current={chat.id === activeChatId ? 'true' : undefined}><strong>{chat.title}</strong><small>{chat.messageCount} mensagens · {formatDate(chat.updatedAt)}</small></button>
            <button type="button" className="account-icon-button" aria-label={`Excluir conversa ${chat.title}`} onClick={async event => {
              // A confirmação global precisa ficar fora da camada modal nativa.
              setShowHistory(false);
              await handleDeleteChat(chat.id, event);
              setShowHistory(true);
            }}><Trash2 size={18} aria-hidden="true" /></button>
          </div>)}
        </div>
        <button type="button" onClick={startNewChat} className="account-primary"><MessageSquarePlus size={18} aria-hidden="true" />Nova conversa</button>
      </dialog>
    </div>
  );
}
