export const PRODUCT_PRICES = {
  lanyard: 8000,
  cocard: 10000,
  booklet: 25000,
  "paket-lc": 15000,
  "paket-lb": 30000,
  "paket-cb": 32000,
  "paket-lengkap": 38000,
};

export function computeTotal(productIds) {
  if (!Array.isArray(productIds) || productIds.length === 0) return 0;
  return productIds.reduce((sum, id) => sum + (PRODUCT_PRICES[id] || 0), 0);
}
