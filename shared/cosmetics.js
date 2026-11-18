// ============================================================================
// shared/cosmetics.js — Catálogo de personalización del huevo (cliente + servidor)
// Todos los diseños son propios, hechos con primitivas simples.
// ============================================================================
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Cosmetics = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CATALOG = {
    finish: [
      { id: 'matte', name: 'Mate', icon: '🥚' },
      { id: 'satin', name: 'Satinado', icon: '✨' },
      { id: 'gloss', name: 'Brillante', icon: '💎' },
      { id: 'metal', name: 'Metálico', icon: '🔩' },
      { id: 'neon', name: 'Neón', icon: '💡' },
      { id: 'toon', name: 'Cómic', icon: '🖍️' },
      { id: 'chrome', name: 'Cromado', icon: '🪞', rarity: 'epica', locked: true },
      { id: 'gold', name: 'Oro', icon: '🏆', rarity: 'legendaria', locked: true },
    ],
    pattern: [
      { id: 'none', name: 'Liso', icon: '⚪' },
      { id: 'stripes', name: 'Rayas', icon: '〰️' },
      { id: 'dots', name: 'Lunares', icon: '🔴' },
      { id: 'zigzag', name: 'Zigzag', icon: '⚡' },
      { id: 'spots', name: 'Manchas', icon: '🐄' },
      { id: 'half', name: 'Mitad', icon: '◐' },
      { id: 'gradient', name: 'Degradado', icon: '🌅' },
      { id: 'crack', name: 'Grietas', icon: '🥚' },
      { id: 'stars', name: 'Estrellas', icon: '⭐' },
      { id: 'camo', name: 'Camuflaje', icon: '🌿' },
      { id: 'checker', name: 'Cuadros', icon: '🏁' },
      { id: 'hearts', name: 'Corazones', icon: '💗' },
      { id: 'tiger', name: 'Tigre', icon: '🐯' },
      { id: 'galaxy', name: 'Galaxia', icon: '🌌' },
      { id: 'lava', name: 'Lava', icon: '🌋', rarity: 'rara', locked: true },
      { id: 'pixel', name: 'Píxeles', icon: '👾', rarity: 'rara', locked: true },
      { id: 'marble', name: 'Mármol', icon: '🏛️', rarity: 'rara', locked: true },
      { id: 'rainbow', name: 'Arcoíris', icon: '🌈', rarity: 'epica', locked: true },
    ],
    eyes: [
      { id: 'normal', name: 'Normales', icon: '👀' },
      { id: 'happy', name: 'Felices', icon: '😊' },
      { id: 'angry', name: 'Enfadados', icon: '😠' },
      { id: 'sleepy', name: 'Dormilones', icon: '😪' },
      { id: 'wink', name: 'Guiño', icon: '😉' },
      { id: 'big', name: 'Grandes', icon: '😳' },
      { id: 'cyclops', name: 'Cíclope', icon: '👁️' },
    ],
    mouth: [
      { id: 'none', name: 'Sin boca', icon: '➖' },
      { id: 'smile', name: 'Sonrisa', icon: '🙂' },
      { id: 'grin', name: 'Dientes', icon: '😁' },
      { id: 'open', name: 'Sorpresa', icon: '😮' },
      { id: 'mustache', name: 'Bigote', icon: '🥸' },
      { id: 'tongue', name: 'Lengua', icon: '😛' },
    ],
    hat: [
      { id: 'none', name: 'Ninguno', icon: '➖' },
      { id: 'tophat', name: 'Chistera', icon: '🎩' },
      { id: 'helmet', name: 'Casco militar', icon: '⛑️' },
      { id: 'cap', name: 'Gorra', icon: '🧢' },
      { id: 'crown', name: 'Corona', icon: '👑' },
      { id: 'cowboy', name: 'Vaquero', icon: '🤠' },
      { id: 'beanie', name: 'Gorro de lana', icon: '🧶' },
      { id: 'chef', name: 'Cocinero', icon: '👨‍🍳' },
      { id: 'party', name: 'Fiesta', icon: '🥳' },
      { id: 'viking', name: 'Vikingo', icon: '🪓' },
      { id: 'propeller', name: 'Hélice', icon: '🚁' },
      { id: 'halo', name: 'Aureola', icon: '😇' },
      { id: 'headband', name: 'Cinta', icon: '🎽' },
      { id: 'bunny', name: 'Orejas de conejo', icon: '🐰' },
      { id: 'cat', name: 'Orejas de gato', icon: '🐱' },
      { id: 'wizard', name: 'Mago', icon: '🧙' },
      { id: 'flower', name: 'Flor', icon: '🌼' },
      { id: 'antenna', name: 'Antenas', icon: '👽' },
      { id: 'sprout', name: 'Brote', icon: '🌱' },
      { id: 'graduate', name: 'Birrete', icon: '🎓', rarity: 'rara', locked: true },
      { id: 'headphones', name: 'Cascos', icon: '🎧', rarity: 'rara', locked: true },
      { id: 'pirate', name: 'Pirata', icon: '🏴‍☠️', rarity: 'epica', locked: true },
      { id: 'santa', name: 'Papá Noel', icon: '🎅', rarity: 'epica', locked: true },
      { id: 'astro', name: 'Escafandra', icon: '👩‍🚀', rarity: 'legendaria', locked: true },
    ],
    glasses: [
      { id: 'none', name: 'Ninguna', icon: '➖' },
      { id: 'sunglasses', name: 'Gafas de sol', icon: '🕶️' },
      { id: 'mask', name: 'Antifaz', icon: '🎭' },
      { id: 'goggles', name: 'Buceo', icon: '🥽' },
      { id: 'monocle', name: 'Monóculo', icon: '🧐' },
      { id: 'nerd', name: 'Pasta', icon: '🤓' },
      { id: 'eyepatch', name: 'Parche', icon: '🏴‍☠️' },
      { id: 'visor', name: 'Visor', icon: '🥽' },
      { id: 'hearts', name: 'Corazones', icon: '😍' },
      { id: 'round', name: 'Redondas', icon: '👓' },
      { id: 'cyber', name: 'Visor cíber', icon: '🤖', rarity: 'epica', locked: true },
    ],
    extra: [
      { id: 'none', name: 'Nada', icon: '➖' },
      { id: 'scarf', name: 'Bufanda', icon: '🧣' },
      { id: 'bowtie', name: 'Pajarita', icon: '🎀' },
      { id: 'cape', name: 'Capa', icon: '🦸' },
      { id: 'backpack', name: 'Mochila', icon: '🎒' },
      { id: 'medal', name: 'Medalla', icon: '🏅' },
      { id: 'wings', name: 'Alitas', icon: '🪽' },
      { id: 'balloon', name: 'Globo', icon: '🎈' },
      { id: 'necklace', name: 'Collar', icon: '📿' },
      { id: 'jetpack', name: 'Mochila cohete', icon: '🚀' },
      { id: 'shield', name: 'Escudo', icon: '🛡️', rarity: 'rara', locked: true },
      { id: 'halo2', name: 'Anillo orbital', icon: '🪐', rarity: 'legendaria', locked: true },
    ],
  };

  // ---------------------------------------------------------------------------
  // Skins de armas. kind: color liso (solid), metal brillante (metal), neón
  // (neon) o textura dibujada (tex). a = piezas oscuras, b = piezas de color.
  // ---------------------------------------------------------------------------
  const WEAPON_SKINS = [
    { id: 'default', name: 'Estándar', rarity: 'comun', kind: 'none' },
    { id: 'arctic', name: 'Ártico', rarity: 'comun', kind: 'solid', a: '#dfe6ec', b: '#9fb3c4', locked: true },
    { id: 'desert', name: 'Desierto', rarity: 'comun', kind: 'solid', a: '#c8a96a', b: '#8a6a3c', locked: true },
    { id: 'forest', name: 'Bosque', rarity: 'comun', kind: 'solid', a: '#4b5d3a', b: '#7d8c4f', locked: true },
    { id: 'night', name: 'Noche', rarity: 'comun', kind: 'solid', a: '#1c1d22', b: '#3a3d47', locked: true },
    { id: 'camo', name: 'Camuflaje', rarity: 'rara', kind: 'tex', tex: 'camo', a: '#5b6b3a', b: '#3d4a28', c: '#8a7d55', locked: true },
    { id: 'tiger', name: 'Tigre', rarity: 'rara', kind: 'tex', tex: 'tiger', a: '#ff8c2a', b: '#1d1d1d', locked: true },
    { id: 'carbon', name: 'Fibra de carbono', rarity: 'rara', kind: 'tex', tex: 'carbon', a: '#26282d', b: '#3c3f46', locked: true },
    { id: 'candy', name: 'Caramelo', rarity: 'rara', kind: 'tex', tex: 'stripes', a: '#ff7fb5', b: '#ffffff', locked: true },
    { id: 'lava', name: 'Lava', rarity: 'epica', kind: 'tex', tex: 'lava', a: '#2a0d06', b: '#ff5a1f', glow: true, locked: true },
    { id: 'neon', name: 'Neón', rarity: 'epica', kind: 'neon', a: '#101820', b: '#25f4ee', locked: true },
    { id: 'galaxy', name: 'Galaxia', rarity: 'epica', kind: 'tex', tex: 'galaxy', a: '#140b2e', b: '#6c4dff', locked: true },
    { id: 'abastos', name: 'Abastos', rarity: 'epica', kind: 'tex', tex: 'stripes', a: '#1f3d7a', b: '#ff8c2a', locked: true },
    { id: 'gold', name: 'Oro', rarity: 'legendaria', kind: 'metal', a: '#c9971c', b: '#ffd75e', locked: true },
    { id: 'chrome', name: 'Cromo', rarity: 'legendaria', kind: 'metal', a: '#9aa5b1', b: '#e9eef3', locked: true },
    { id: 'diamond', name: 'Diamante', rarity: 'legendaria', kind: 'metal', a: '#7fd4f5', b: '#d8f6ff', locked: true },
    { id: 'rainbow', name: 'Arcoíris', rarity: 'legendaria', kind: 'tex', tex: 'rainbow', a: '#ff5f6d', b: '#5f9dff', locked: true },
  ];

  const RARITY = {
    comun: { name: 'Común', color: '#9aa4ad', weight: 0 },
    rara: { name: 'Rara', color: '#3d8bff', weight: 1 },
    epica: { name: 'Épica', color: '#a45cff', weight: 2 },
    legendaria: { name: 'Legendaria', color: '#ffb020', weight: 3 },
  };

  // Hueveras: se abren con los huevos que dan los retos. Sale un objeto bloqueado al azar.
  const CRATES = [
    { id: 'basic', name: 'Huevera', cost: 400, odds: { comun: 0.55, rara: 0.32, epica: 0.11, legendaria: 0.02 } },
    { id: 'golden', name: 'Huevera dorada', cost: 1200, odds: { comun: 0, rara: 0.52, epica: 0.36, legendaria: 0.12 } },
  ];
  const DUPLICATE_REFUND = 0.3;   // si sale algo repetido se devuelve parte del precio

  const PALETTE = ['#fff1dc', '#ffffff', '#f6d7a7', '#e9b97a', '#ff9a4d', '#ff6b5f', '#ff7fb5', '#c77dff', '#6c8cff', '#4fc3f7',
    '#4dd0a7', '#7bd35a', '#ffd84d', '#9c6b43', '#5b5b66', '#2b2b33'];

  const EYE_COLORS = ['#151515', '#3b2a1a', '#2e6da4', '#2e8b57', '#7d4bb0', '#c0392b', '#d4ac0d', '#ffffff'];

  const DEFAULT = { color: '#fff1dc', color2: '#ff9a4d', eyeColor: '#151515', finish: 'satin', pattern: 'none', eyes: 'normal', mouth: 'smile', hat: 'none', glasses: 'none', extra: 'none', paint: null, wskins: {} };
  const SLOTS = ['finish', 'pattern', 'eyes', 'mouth', 'hat', 'glasses', 'extra'];

  // Clave única de cada objeto desbloqueable: "hat:santa", "w:gold"…
  const itemKey = (cat, id) => (cat === 'weapon' ? 'w:' : cat + ':') + id;
  // Todo lo que se puede conseguir en una huevera
  const LOOT = [];
  SLOTS.forEach(cat => CATALOG[cat].forEach(o => { if (o.locked) LOOT.push({ key: itemKey(cat, o.id), cat, id: o.id, name: o.name, icon: o.icon, rarity: o.rarity }); }));
  WEAPON_SKINS.forEach(o => { if (o.locked) LOOT.push({ key: itemKey('weapon', o.id), cat: 'weapon', id: o.id, name: o.name, icon: '🔫', rarity: o.rarity }); });
  const LOOT_KEYS = new Set(LOOT.map(l => l.key));

  function sanitizeUnlocks(list) {
    if (!Array.isArray(list)) return [];
    const out = [];
    for (const k of list) if (typeof k === 'string' && LOOT_KEYS.has(k) && !out.includes(k)) out.push(k);
    return out;
  }
  function isUnlocked(cat, id, unlocks) {
    const list = cat === 'weapon' ? WEAPON_SKINS : CATALOG[cat];
    const o = list && list.find(x => x.id === id);
    if (!o) return false;
    if (!o.locked) return true;
    return !!unlocks && unlocks.includes(itemKey(cat, id));
  }
  // Abre una huevera: elige rareza según las probabilidades y luego un objeto de esa rareza
  function rollCrate(crateId, rng) {
    rng = rng || Math.random;
    const crate = CRATES.find(c => c.id === crateId) || CRATES[0];
    let r = rng(), rar = 'comun';
    for (const k of ['legendaria', 'epica', 'rara', 'comun']) { if (r < crate.odds[k]) { rar = k; break; } r -= crate.odds[k]; }
    let pool = LOOT.filter(l => l.rarity === rar);
    if (!pool.length) pool = LOOT;
    return pool[Math.floor(rng() * pool.length)];
  }

  const HEX = /^#[0-9a-fA-F]{6}$/;
  // Valida y limpia una personalización recibida (servidor y cliente)
  function sanitize(c, unlocks) {
    c = c || {};
    const out = Object.assign({}, DEFAULT, { wskins: {} });
    if (HEX.test(c.color || '')) out.color = c.color;
    if (HEX.test(c.color2 || '')) out.color2 = c.color2;
    if (HEX.test(c.eyeColor || '')) out.eyeColor = c.eyeColor;
    for (const k of SLOTS) {
      const o = CATALOG[k].find(x => x.id === c[k]);
      // Si se pasa la lista de desbloqueos, lo que no se tiene vuelve al valor por defecto
      if (o && (!o.locked || !unlocks || unlocks.includes(itemKey(k, o.id)))) out[k] = c[k];
    }
    out.wskins = {};
    if (c.wskins && typeof c.wskins === 'object') {
      let n = 0;
      for (const w of Object.keys(c.wskins)) {
        if (n >= 12 || !/^[a-z]{3,10}$/.test(w)) continue;
        const sk = WEAPON_SKINS.find(x => x.id === c.wskins[w]);
        if (!sk || sk.id === 'default') continue;
        if (sk.locked && unlocks && !unlocks.includes(itemKey('weapon', sk.id))) continue;
        out.wskins[w] = sk.id; n++;
      }
    }
    const paint = c.paint || c.textureData;
    if (typeof paint === 'string' && paint.startsWith('data:image/png;base64,') && paint.length < 70000) out.paint = paint;
    return out;
  }

  return { CATALOG, PALETTE, EYE_COLORS, DEFAULT, SLOTS, WEAPON_SKINS, RARITY, CRATES, DUPLICATE_REFUND, LOOT, itemKey, sanitize, sanitizeUnlocks, isUnlocked, rollCrate };
});
