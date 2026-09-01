import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getIdToken } from '../services/firebase';
import { useDialog } from '../contexts/DialogContext';

const VOICE_TIMEOUT_MS = 30000;

function getSpeechErrorMessage(errorCode) {
  switch (errorCode) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Permita o uso do microfone nas configurações do navegador e tente novamente.';
    case 'no-speech':
      return 'Não foi possível ouvir uma fala. Tente falar novamente.';
    case 'network':
      return 'O reconhecimento de voz precisa de conexão com a internet. Verifique sua rede e tente novamente.';
    case 'audio-capture':
      return 'Nenhum microfone foi encontrado. Conecte ou habilite um microfone e tente novamente.';
    default:
      return 'Não foi possível iniciar o reconhecimento de voz. Tente novamente.';
  }
}

async function getApiErrorMessage(response) {
  try {
    const body = await response.json();
    if (typeof body?.error === 'string' && body.error.trim()) return body.error;
  } catch {
    // A mensagem padrão abaixo é mais útil do que um erro de conversão de JSON.
  }
  return 'Não foi possível processar sua fala agora. Tente novamente.';
}

export function useVoiceExpense() {
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useDialog();
  const recognitionRef = useRef(null);
  const requestControllerRef = useRef(null);
  const requestSequenceRef = useRef(0);
  const cancelledRef = useRef(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const cancelVoice = useCallback(() => {
    cancelledRef.current = true;
    requestSequenceRef.current += 1;
    recognitionRef.current?.abort();
    requestControllerRef.current?.abort();
    recognitionRef.current = null;
    requestControllerRef.current = null;
    setIsListening(false);
    setIsProcessing(false);
  }, []);

  useEffect(() => () => {
    cancelledRef.current = true;
    recognitionRef.current?.abort();
    requestControllerRef.current?.abort();
  }, []);

  const handleVoice = useCallback(async () => {
    if (isListening || isProcessing) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      const openManualEntry = await showConfirm(
        'Lançamento por voz indisponível',
        'Seu navegador não oferece reconhecimento de voz. Deseja abrir o cadastro manual de uma despesa?'
      );
      if (openManualEntry) navigate('/expense/new?type=expense');
      return;
    }

    cancelledRef.current = false;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      if (recognitionRef.current === recognition && !cancelledRef.current) setIsListening(true);
    };

    recognition.onresult = async (event) => {
      if (recognitionRef.current !== recognition || cancelledRef.current) return;
      setIsListening(false);
      const text = event.results?.[0]?.[0]?.transcript?.trim();
      if (!text) {
        showAlert('Não entendemos a fala', 'Tente falar algo como “gastei 35 reais no mercado hoje”.');
        return;
      }

      const requestId = requestSequenceRef.current + 1;
      requestSequenceRef.current = requestId;
      const controller = new AbortController();
      requestControllerRef.current = controller;
      setIsProcessing(true);
      const timeoutId = window.setTimeout(() => controller.abort(), VOICE_TIMEOUT_MS);

      try {
        const token = await getIdToken();
        if (!token) throw new Error('Sua sessão expirou. Faça login novamente para usar o lançamento por voz.');

        const response = await fetch('/api/extract-expense', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ text }),
          signal: controller.signal,
        });

        if (!response.ok) throw new Error(await getApiErrorMessage(response));
        const data = await response.json();

        if (cancelledRef.current || controller.signal.aborted || requestId !== requestSequenceRef.current) return;
        if (!Number.isFinite(Number(data?.amount)) || Number(data.amount) <= 0 || !String(data?.description || '').trim()) {
          throw new Error('Não consegui identificar o valor e a descrição. Tente falar, por exemplo, “gastei 35 reais no mercado”.');
        }

        const params = new URLSearchParams();
        params.set('amount', String(data.amount));
        params.set('description', String(data.description).trim());
        if (data.category) params.set('category', data.category);
        if (/^\d{4}-\d{2}-\d{2}$/.test(data.date || '')) params.set('date', data.date);
        params.set('type', data.type === 'income' ? 'income' : 'expense');
        params.set('voice', 'true');
        navigate(`/expense/new?${params.toString()}`);
      } catch (error) {
        if (cancelledRef.current || error.name === 'AbortError') {
          if (!cancelledRef.current) {
            showAlert('Tempo esgotado', 'A IA demorou para responder. Verifique sua conexão e tente novamente.');
          }
          return;
        }
        console.error('Falha no lançamento por voz:', error);
        showAlert('Lançamento por voz', error.message || 'Não foi possível processar sua fala agora. Tente novamente.');
      } finally {
        window.clearTimeout(timeoutId);
        if (requestControllerRef.current === controller) {
          requestControllerRef.current = null;
          setIsProcessing(false);
        }
      }
    };

    recognition.onerror = (event) => {
      if (recognitionRef.current !== recognition) return;
      if (!cancelledRef.current && event.error !== 'aborted') {
        showAlert('Lançamento por voz', getSpeechErrorMessage(event.error));
      }
      setIsListening(false);
      if (!requestControllerRef.current) setIsProcessing(false);
    };

    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
        setIsListening(false);
      }
    };

    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      showAlert('Lançamento por voz', 'O microfone já está em uso ou não pôde ser iniciado. Tente novamente.');
    }
  }, [isListening, isProcessing, navigate, showAlert, showConfirm]);

  return { isListening, isProcessing, handleVoice, cancelVoice };
}
