// Seed data: communities contain properties, properties contain units. Loaded only into an empty database.
export const COMMUNITIES = [
  { id: 'c1', name: 'Palm Crescent', city: 'Dubai', emoji: '🌴', color: '#dcfce7', description: 'A waterfront community with a private beach, marina promenade and landscaped parks.' },
  { id: 'c2', name: 'Azure Bay', city: 'Abu Dhabi', emoji: '🌊', color: '#e0f2fe', description: 'Sea-view living next to the Corniche with cafes, a yacht club and cycling tracks.' },
  { id: 'c3', name: 'Olive Hills', city: 'Dubai', emoji: '🫒', color: '#fef9c3', description: 'Quiet, family-focused hillside community with schools, clinics and green trails.' },
  { id: 'c4', name: 'Skyline District', city: 'Dubai', emoji: '🏙️', color: '#ede9fe', description: 'Urban high-rise district with metro access, offices, retail and nightlife.' },
  { id: 'c5', name: 'Desert Bloom', city: 'Sharjah', emoji: '🌵', color: '#ffedd5', description: 'Affordable villas and townhouses around a central lake and community farm.' },
];

export const PROPERTIES = [
  { id: 'p1', communityId: 'c1', name: 'Coral Residences', type: 'Apartment', handover: 'Q4 2027', emoji: '🏢', color: '#dcfce7', description: 'Beachfront tower with infinity pool, gym and concierge.' },
  { id: 'p2', communityId: 'c1', name: 'Marina Villas', type: 'Villa', handover: 'Q2 2028', emoji: '🏡', color: '#d1fae5', description: 'Four- and five-bedroom villas with private docks and gardens.' },
  { id: 'p3', communityId: 'c2', name: 'Bayview Towers', type: 'Apartment', handover: 'Q1 2028', emoji: '🏬', color: '#e0f2fe', description: 'Twin towers with panoramic bay views and a rooftop lounge.' },
  { id: 'p4', communityId: 'c2', name: 'The Pearl Townhouses', type: 'Townhouse', handover: 'Q3 2027', emoji: '🏘️', color: '#dbeafe', description: 'Three-bedroom townhouses steps from the waterfront.' },
  { id: 'p5', communityId: 'c3', name: 'Cedar Grove', type: 'Villa', handover: 'Ready', emoji: '🏠', color: '#fef9c3', description: 'Ready-to-move-in family villas with large gardens.' },
  { id: 'p6', communityId: 'c3', name: 'Hillside Apartments', type: 'Apartment', handover: 'Q4 2026', emoji: '🏢', color: '#fef3c7', description: 'Low-rise apartments with terraces overlooking the hills.' },
  { id: 'p7', communityId: 'c4', name: 'Metro Heights', type: 'Apartment', handover: 'Q2 2027', emoji: '🌆', color: '#ede9fe', description: 'Studios and one-bedrooms above the metro station.' },
  { id: 'p8', communityId: 'c4', name: 'Skyline Penthouses', type: 'Penthouse', handover: 'Q1 2029', emoji: '🌇', color: '#f3e8ff', description: 'Full-floor penthouses with private pools and skyline views.' },
  { id: 'p9', communityId: 'c5', name: 'Lakeside Townhomes', type: 'Townhouse', handover: 'Q3 2027', emoji: '🏘️', color: '#ffedd5', description: 'Two- and three-bedroom townhomes around the central lake.' },
  { id: 'p10', communityId: 'c5', name: 'Bloom Villas', type: 'Villa', handover: 'Ready', emoji: '🏡', color: '#fed7aa', description: 'Affordable three-bedroom villas with private courtyards.' },
];

// Unit mix per property: [bedrooms, bathrooms, areaSqft, basePrice, count]
const MIX = {
  p1: [[1, 2, 780, 1450000, 3], [2, 3, 1180, 2250000, 3], [3, 4, 1720, 3400000, 2]],
  p2: [[4, 5, 3900, 6900000, 3], [5, 6, 5200, 9800000, 2]],
  p3: [[1, 2, 720, 1100000, 3], [2, 3, 1100, 1750000, 3], [3, 4, 1600, 2600000, 2]],
  p4: [[3, 4, 2100, 3100000, 4]],
  p5: [[4, 5, 3400, 4300000, 3], [5, 6, 4300, 5600000, 2]],
  p6: [[1, 1, 650, 780000, 3], [2, 2, 1020, 1190000, 4]],
  p7: [[0, 1, 430, 520000, 4], [1, 1, 640, 790000, 4]],
  p8: [[4, 5, 4800, 12500000, 2], [5, 6, 6100, 17800000, 1]],
  p9: [[2, 3, 1450, 1350000, 3], [3, 4, 1900, 1780000, 3]],
  p10: [[3, 3, 2000, 1450000, 4]],
};
const VIEWS = ['Sea', 'Garden', 'City', 'Pool', 'Park'];

// Deterministic, so every fresh database gets the same units.
export const UNITS = Object.entries(MIX).flatMap(([propertyId, rows]) => {
  let n = 0;
  return rows.flatMap(([bedrooms, bathrooms, areaSqft, base, count]) =>
    Array.from({ length: count }, (_, i) => {
      n += 1;
      const floor = 1 + ((n * 3 + i) % 18);
      return {
        id: `u-${propertyId}-${n}`,
        propertyId,
        unitNo: `${propertyId.slice(1).padStart(2, '0')}${String(floor).padStart(2, '0')}${n}`,
        bedrooms,
        bathrooms,
        areaSqft: areaSqft + i * 25,
        floor,
        price: base + floor * 12000 + i * 25000,
        view: VIEWS[(n + i) % VIEWS.length],
        status: n % 7 === 0 ? 'Sold' : n % 5 === 0 ? 'Reserved' : 'Available',
      };
    })
  );
});
