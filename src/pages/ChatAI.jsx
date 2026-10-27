import { useState, useEffect, useRef, useCallback } from 'react';
import { getExpenses, getBudgets, getGoals } from '../services/db';
import { getChatList, getChatById, getActiveChatId, setActiveChatId, createChat, addMessageToChat, deleteChat } from '../services/chatDb';
import { getCachedProStatus, getIdToken, getUserProStatus, onAuthChange } from '../services/firebase';
import ChatView from '../components/ChatView';
import { useDialog } from '../contexts/DialogContext';
import { buildFinancialContext } from '../utils/financialContext';
import { IS_LOCAL_TEST_MODE } from '../config/environment';

const CHAT_TIMEOUT_MS = 65000;
const MAX_HISTORY_MESSAGES = 10;
const MAX_HISTORY_MESSAGE_LENGTH = 700;
const MAX_CONVERSATION_HISTORY_LENGTH = 8000;

function buildConversationHistory(messages) {
  const history = messages
    .filter((message) => !message.isError)
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => {
      const speaker = message.sender === 'user' ? 'Usuário' : 'NaMão IA';
      const text = String(message.text || '').replace(/\s+/g, ' ').trim();
      const compactText = text.length > MAX_HISTORY_MESSAGE_LENGTH
        ? `${text.slice(0, MAX_HISTORY_MESSAGE_LENGTH - 1)}…`
        : text;
      return `${speaker}: ${compactText}`;
    })
    .join('\n');

  return history.slice(-MAX_CONVERSATION_HISTORY_LENGTH);
}

function getChatErrorMessage(error) {
  if (error?.name === 'AbortError') return '';
  const message = String(error?.message || '').trim();
  if (/limite de mensagens gratuitas/i.test(message)) return message;
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return 'Não foi possível conectar à IA. Verifique sua internet e tente novamente.';
  }
  return message || 'Não foi possível gerar uma resposta agora. Tente novamente.';
}

export default function ChatAI() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedMessages = useRef(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeChatId, setActiveChatIdState] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [chatList, setChatList] = useState([]);
  const [proStatus, setProStatus] = useState({ isPro: getCachedProStatus(), aiMessageCount: 0 });
  const messagesEndRef = useRef(null);
  const activeChatIdRef = useRef(null);
  const sendLockRef = useRef(false);
  const requestControllerRef = useRef(null);
  const requestSequenceRef = useRef(0);
  const { showConfirm, showProModal } = useDialog();

  // Carregar o status Pro.
  useEffect(() => {
    const unsubscribe = onAuthChange(async (user) => {
      if (user) {
        const pro = await getUserProStatus();
        setProStatus(pro);
      }
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const refreshChatList = useCallback(() => {
    setChatList(getChatList());
  }, []);

  const startNewChat = useCallback(() => {
    const chat = createChat();
    activeChatIdRef.current = chat.id;
    setActiveChatIdState(chat.id);
    setMessages(chat.messages);
    setInput('');
    setActiveChatId(chat.id);
    refreshChatList();
    setShowHistory(false);
  }, [refreshChatList]);

  // Carregar ou criar chat ativo ao montar
  useEffect(() => {
    const savedId = getActiveChatId();
    if (savedId) {
      const chat = getChatById(savedId);
      if (chat) {
        activeChatIdRef.current = chat.id;
        setActiveChatIdState(chat.id);
        setMessages(chat.messages);
      } else {
        startNewChat();
      }
    } else {
      startNewChat();
    }
    refreshChatList();
    setIsLoading(false);
  }, [startNewChat, refreshChatList]);

  const switchToChat = (chatId) => {
    const chat = getChatById(chatId);
    if (chat) {
      activeChatIdRef.current = chat.id;
      setActiveChatIdState(chat.id);
      setMessages(chat.messages);
      setInput('');
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
    if (isLoading) return;
    // A navegação restaura a posição na abertura. Só mensagens novas devem
    // levar a conversa ao fim enquanto esta tela já está aberta.
    if (hasLoadedMessages.current) scrollToBottom();
    hasLoadedMessages.current = true;
  }, [messages, isTyping, isLoading]);

  useEffect(() => () => {
    requestSequenceRef.current += 1;
    requestControllerRef.current?.abort();
  }, []);

  const cancelChatResponse = useCallback(() => {
    const controller = requestControllerRef.current;
    if (!controller) return;
    requestSequenceRef.current += 1;
    requestControllerRef.current = null;
    sendLockRef.current = false;
    controller.abort();
    setIsTyping(false);
  }, []);

  const handleSend = async (suggestedText) => {
    const userText = (typeof suggestedText === 'string' ? suggestedText : input).trim();
    if (!userText || sendLockRef.current) return;

    if (!proStatus.isPro && proStatus.aiMessageCount >= 5) {
      showProModal();
      return;
    }

    const userMsg = { id: Date.now(), text: userText, sender: 'user' };
    const chatIdAtSend = activeChatIdRef.current;
    if (!chatIdAtSend) return;
    const conversationHistory = buildConversationHistory(messages);
    const requestId = requestSequenceRef.current + 1;
    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = window.setTimeout(() => { timedOut = true; controller.abort(); }, CHAT_TIMEOUT_MS);

    requestSequenceRef.current = requestId;
    requestControllerRef.current = controller;
    sendLockRef.current = true;
    
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);

    // Persistir mensagem do usuário
    if (chatIdAtSend) {
      addMessageToChat(chatIdAtSend, userMsg);
      refreshChatList();
    }

    try {
      // A leitura acontece no envio para incluir até os lançamentos criados
      // pouco antes da pergunta, mesmo que a tela do chat já estivesse aberta.
      const [expensesData, budgetsData, goalsData] = await Promise.all([
        getExpenses(),
        getBudgets(),
        getGoals(),
      ]);
      const contextData = buildFinancialContext({
        expenses: expensesData,
        budgets: budgetsData,
        goals: goalsData,
      });
      const apiUrl = import.meta.env.VITE_API_URL || '/api/chat';
      const isLocalTest = import.meta.env.DEV && IS_LOCAL_TEST_MODE
        && localStorage.getItem('namao_local_test_user') === 'true';
      let authHeader;
      if (isLocalTest) {
        authHeader = { 'X-Namao-Local-Test': 'true' };
      } else {
        const token = await getIdToken();
        authHeader = { 'Authorization': `Bearer ${token}` };
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader
        },
        body: JSON.stringify({ userText, contextData, conversationHistory }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || 'Falha ao conectar com o servidor.');
      }

      const data = await response.json().catch(() => null);
      if (requestId !== requestSequenceRef.current) return;
      if (controller.signal.aborted) throw new Error('Tempo limite da IA.');
      if (typeof data?.text !== 'string' || !data.text.trim()) {
        throw new Error('A IA não retornou uma resposta válida. Tente novamente.');
      }
      const aiMsg = { id: Date.now() + 2, text: data.text.trim(), sender: 'ai' };

      if (activeChatIdRef.current === chatIdAtSend) {
        setMessages(prev => [...prev, aiMsg]);
      }
      
      // Persistir resposta da IA
      if (chatIdAtSend) {
        addMessageToChat(chatIdAtSend, aiMsg);
        refreshChatList();
      }

      // Update local count assuming success
      if (!proStatus.isPro) {
        setProStatus(prev => ({ ...prev, aiMessageCount: prev.aiMessageCount + 1 }));
      }
    } catch (error) {
      console.error(error);
      if (requestId !== requestSequenceRef.current || (controller.signal.aborted && !timedOut)) return;
      const errorText = timedOut
        ? 'A IA demorou para responder. Tente novamente em instantes.'
        : getChatErrorMessage(error);
      if (/limite de mensagens gratuitas/i.test(errorText)) {
        showProModal();
        return;
      }
      const errorMsg = { id: Date.now() + 2, text: errorText, sender: 'ai', isError: true };
      if (activeChatIdRef.current === chatIdAtSend) {
        setMessages(prev => [...prev, errorMsg]);
      }
      
      if (chatIdAtSend) {
        addMessageToChat(chatIdAtSend, errorMsg);
        refreshChatList();
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
        sendLockRef.current = false;
        setIsTyping(false);
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
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

  return <ChatView
    messages={messages} isLoading={isLoading} input={input} setInput={setInput}
    isTyping={isTyping} proStatus={proStatus} messagesEndRef={messagesEndRef}
    showHistory={showHistory} setShowHistory={setShowHistory} chatList={chatList}
    activeChatId={activeChatId} startNewChat={startNewChat} switchToChat={switchToChat}
    handleDeleteChat={handleDeleteChat} handleSend={handleSend} handleKeyPress={handleKeyPress}
    cancelChatResponse={cancelChatResponse} formatDate={formatDate} showProModal={showProModal}
  />;
}
