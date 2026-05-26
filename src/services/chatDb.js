// Serviço de persistência de conversas com a IA
const CHATS_KEY = 'namao_chats';
const ACTIVE_CHAT_KEY = 'namao_active_chat';

function getAll() {
  const data = localStorage.getItem(CHATS_KEY);
  return data ? JSON.parse(data) : [];
}

function saveAll(chats) {
  localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
}

export function getAllChats() {
  return getAll();
}

export function setAllChats(chats) {
  saveAll(chats);
}

export function getChatList() {
  return getAll().map(c => ({
    id: c.id,
    title: c.title,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    messageCount: c.messages.length
  })).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export function getChatById(id) {
  return getAll().find(c => c.id === id) || null;
}

export function getActiveChatId() {
  return localStorage.getItem(ACTIVE_CHAT_KEY);
}

export function setActiveChatId(id) {
  localStorage.setItem(ACTIVE_CHAT_KEY, id);
}

export function createChat() {
  const chat = {
    id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
    title: 'Nova Conversa',
    messages: [
      { id: 1, text: 'Olá! Sou seu Agente Financeiro. Como posso te ajudar com suas finanças hoje?', sender: 'ai' }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const chats = getAll();
  chats.push(chat);
  saveAll(chats);
  setActiveChatId(chat.id);
  return chat;
}

export function addMessageToChat(chatId, message) {
  const chats = getAll();
  const chat = chats.find(c => c.id === chatId);
  if (!chat) return;

  chat.messages.push(message);
  chat.updatedAt = new Date().toISOString();

  // Atualiza o título com a primeira mensagem do usuário
  if (message.sender === 'user' && chat.title === 'Nova Conversa') {
    chat.title = message.text.substring(0, 40) + (message.text.length > 40 ? '...' : '');
  }

  saveAll(chats);
}

export function deleteChat(chatId) {
  const chats = getAll().filter(c => c.id !== chatId);
  saveAll(chats);

  // Se o chat ativo for deletado, limpar
  if (getActiveChatId() === chatId) {
    localStorage.removeItem(ACTIVE_CHAT_KEY);
  }
}

export function clearAllChats() {
  localStorage.removeItem(CHATS_KEY);
  localStorage.removeItem(ACTIVE_CHAT_KEY);
}
