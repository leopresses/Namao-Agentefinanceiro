export function parseBrazilianCurrency(value) {
  const input = String(value ?? '').trim().replace(/\s/g, '');
  if (!input) return null;

  let normalized = input;
  if (input.includes(',')) {
    normalized = input.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(input)) {
    normalized = input.replace(/\./g, '');
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : null;
}
