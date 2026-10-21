// A memória pertence à sessão do app. Cada entrada do histórico conserva
// seus próprios filtros, mesmo quando duas visitas usam a mesma rota.
export function createNavigationMemory() {
  const pages = new Map();
  const history = new Map();
  const listeners = new Set();

  function page(key) {
    if (!pages.has(key)) pages.set(key, { values: new Map(), scroll: { x: 0, y: 0 }, hasScroll: false });
    return pages.get(key);
  }

  return {
    visit(index, key, pathname) {
      history.set(index, { key, pathname });
    },
    canGoBack(index) {
      const previous = history.get(index - 1);
      return !!previous && previous.pathname !== '/login';
    },
    getValue(key, field, initialValue) {
      const values = page(key).values;
      if (!values.has(field)) values.set(field, initialValue);
      return values.get(field);
    },
    peekValue(key, field) {
      return pages.get(key)?.values.get(field);
    },
    setValue(key, field, value) {
      const values = page(key).values;
      const next = typeof value === 'function' ? value(values.get(field)) : value;
      values.set(field, next);
      listeners.forEach((listener) => listener());
    },
    getScroll(key) {
      return page(key).scroll;
    },
    hasScroll(key) {
      return page(key).hasScroll;
    },
    setScroll(key, position) {
      page(key).scroll = position;
      page(key).hasScroll = true;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
