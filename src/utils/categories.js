export const CATEGORIES = [
  { id: 'mercado', label: 'Mercado', icon: '🛒' },
  { id: 'alimentacao', label: 'Alimentação', icon: '🍔' },
  { id: 'transporte', label: 'Transporte', icon: '🚗' },
  { id: 'casa', label: 'Casa', icon: '🏠' },
  { id: 'saude', label: 'Saúde', icon: '💊' },
  { id: 'lazer', label: 'Lazer', icon: '🎉' },
  { id: 'dividas', label: 'Dívidas', icon: '💳' },
  { id: 'outros', label: 'Outros', icon: '💸' }
];

export function getCategory(id) {
  return CATEGORIES.find(c => c.id === id) || CATEGORIES.find(c => c.id === 'outros');
}
