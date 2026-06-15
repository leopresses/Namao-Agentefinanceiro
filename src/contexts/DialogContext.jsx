import React, { createContext, useContext, useState, useCallback } from 'react';
import ProModal from '../components/ProModal';

const DialogContext = createContext();

export function useDialog() {
  return useContext(DialogContext);
}

export function DialogProvider({ children }) {
  const [dialogs, setDialogs] = useState([]);
  const [isProModalOpen, setIsProModalOpen] = useState(false);

  const showDialog = useCallback(({ title, message, type = 'alert', onConfirm = () => {}, onCancel = () => {} }) => {
    const id = Date.now().toString();
    setDialogs(prev => [...prev, { id, title, message, type, onConfirm, onCancel }]);
  }, []);

  const closeDialog = useCallback((id) => {
    setDialogs(prev => prev.filter(d => d.id !== id));
  }, []);

  const showAlert = (title, message) => showDialog({ title, message, type: 'alert' });
  
  const showConfirm = (title, message) => {
    return new Promise((resolve) => {
      showDialog({
        title,
        message,
        type: 'confirm',
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false)
      });
    });
  };

  const showPrompt = (title, message, defaultValue = '') => {
    return new Promise((resolve) => {
      showDialog({
        title,
        message,
        type: 'prompt',
        defaultValue,
        onConfirm: (val) => resolve(val),
        onCancel: () => resolve(null)
      });
    });
  };

  const showProModal = () => setIsProModalOpen(true);
  const closeProModal = () => setIsProModalOpen(false);

  return (
    <DialogContext.Provider value={{ showAlert, showConfirm, showPrompt, showProModal }}>
      {children}
      {dialogs.map(dialog => (
        <DialogItem key={dialog.id} dialog={dialog} closeDialog={closeDialog} />
      ))}
      <ProModal isOpen={isProModalOpen} onClose={closeProModal} />
    </DialogContext.Provider>
  );
}

function DialogItem({ dialog, closeDialog }) {
  const [inputValue, setInputValue] = useState(dialog.defaultValue || '');

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.4)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 99999,
      padding: '24px'
    }}>
      <div className="glass-card animate-fade-up" style={{ width: '100%', maxWidth: '400px', background: 'var(--bg-primary)', border: '1px solid var(--color-emerald-primary)' }}>
        <h3 style={{ margin: '0 0 12px 0', color: 'var(--text-primary)', fontSize: '1.2rem' }}>{dialog.title}</h3>
        <p style={{ margin: '0 0 24px 0', color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5' }}>{dialog.message}</p>
        
        {dialog.type === 'prompt' && (
          <input 
            type="number"
            step="0.01"
            className="input-field" 
            style={{ marginBottom: '24px' }}
            placeholder="R$ 0,00"
            value={inputValue} 
            onChange={e => setInputValue(e.target.value)} 
            autoFocus
          />
        )}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          {(dialog.type === 'confirm' || dialog.type === 'prompt') && (
            <button 
              onClick={() => {
                dialog.onCancel();
                closeDialog(dialog.id);
              }}
              style={{ padding: '10px 16px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontWeight: '600', cursor: 'pointer' }}
            >
              Cancelar
            </button>
          )}
          <button 
            className="btn-primary"
            onClick={() => {
              dialog.onConfirm(dialog.type === 'prompt' ? inputValue : true);
              closeDialog(dialog.id);
            }}
            style={{ padding: '10px 24px', flex: dialog.type === 'alert' ? 1 : 'unset' }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
