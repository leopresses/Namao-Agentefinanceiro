import { createContext, useCallback, useContext, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createNavigationMemory } from '../utils/navigationMemory';
import { getEntryDate } from '../utils/expenseList';

const NavigationContext = createContext(null);

export function NavigationProvider({ children }) {
  const [memory] = useState(createNavigationMemory);
  const location = useLocation();

  useLayoutEffect(() => {
    const previousMode = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => { window.history.scrollRestoration = previousMode; };
  }, []);

  useLayoutEffect(() => {
    const key = location.key;
    memory.visit(window.history.state?.idx ?? 0, key, location.pathname);
    const target = memory.getScroll(key);
    const hasSavedScroll = memory.hasScroll(key);
    const root = document.getElementById('root');
    let restoring = true;
    let frame;

    const saveScroll = () => {
      if (restoring) return;
      const containers = {};
      root.querySelectorAll('[data-navigation-scroll]').forEach((element) => {
        containers[element.getAttribute('data-navigation-scroll')] = { x: element.scrollLeft, y: element.scrollTop };
      });
      memory.setScroll(key, { x: window.scrollX, y: window.scrollY, containers });
    };
    const stopRestoring = () => {
      restoring = false;
      observer.disconnect();
      resizeObserver.disconnect();
      window.cancelAnimationFrame(frame);
    };
    const restore = () => {
      if (!restoring) return;
      // Auth, carregamento lazy e IndexedDB precisam concluir antes da volta
      // à posição antiga; rolar durante o placeholder perde essa posição.
      if (root.querySelector('[data-navigation-loading="true"]')) return;
      const initialAnchor = !hasSavedScroll && root.querySelector('[data-navigation-scroll-end]');
      if (initialAnchor) initialAnchor.scrollIntoView({ behavior: 'instant', block: 'end' });
      else {
        window.scrollTo({ left: target.x, top: target.y, behavior: 'instant' });
        root.querySelectorAll('[data-navigation-scroll]').forEach((element) => {
          const position = target.containers?.[element.getAttribute('data-navigation-scroll')];
          if (position) element.scrollTo({ left: position.x, top: position.y, behavior: 'instant' });
        });
      }
      stopRestoring();
      saveScroll();
    };
    const scheduleRestore = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(restore);
    };
    const observer = new MutationObserver(scheduleRestore);
    const resizeObserver = new ResizeObserver(scheduleRestore);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-navigation-loading'] });
    resizeObserver.observe(root);
    window.addEventListener('scroll', saveScroll, { passive: true, capture: true });
    // Uma interação do usuário tem prioridade sobre a restauração pendente.
    window.addEventListener('wheel', stopRestoring, { passive: true });
    window.addEventListener('touchstart', stopRestoring, { passive: true });
    scheduleRestore();

    return () => {
      stopRestoring();
      window.removeEventListener('scroll', saveScroll, true);
      window.removeEventListener('wheel', stopRestoring);
      window.removeEventListener('touchstart', stopRestoring);
    };
  }, [location.key, location.pathname, memory]);

  return <NavigationContext.Provider value={memory}>{children}</NavigationContext.Provider>;
}

export function usePageState(field, initialValue) {
  const memory = useContext(NavigationContext);
  const { key } = useLocation();
  const [initial] = useState(initialValue);
  const getSnapshot = useCallback(() => memory.getValue(key, field, initial), [memory, key, field, initial]);
  const value = useSyncExternalStore(memory.subscribe, getSnapshot);
  const setValue = useCallback((next) => memory.setValue(key, field, next), [memory, key, field]);
  return [value, setValue];
}

export function useGoBack(fallback = '/') {
  const memory = useContext(NavigationContext);
  const navigate = useNavigate();
  return useCallback(() => {
    if (memory.canGoBack(window.history.state?.idx ?? 0)) navigate(-1);
    else navigate(fallback, { replace: true });
  }, [fallback, memory, navigate]);
}

// Consulta o mês na hora do clique: os menus globais estão fora do dashboard.
export function useNewExpensePath() {
  const memory = useContext(NavigationContext);
  const { key, pathname } = useLocation();
  return useCallback((type) => {
    const month = ['/', '/report'].includes(pathname) ? memory.peekValue(key, 'month') : null;
    const params = new URLSearchParams({ type, date: getEntryDate(month) });
    return `/expense/new?${params}`;
  }, [key, memory, pathname]);
}
