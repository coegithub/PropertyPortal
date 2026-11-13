export const money = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AED', maximumFractionDigits: 0 }).format(n);
export const sqft = (n) => `${new Intl.NumberFormat('en-US').format(n)} sq ft`;
export const bedLabel = (n) => (n === 0 ? 'Studio' : `${n} bed`);
