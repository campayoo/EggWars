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
    ],
  };

  const PALETTE = ['#fff1dc', '#ffffff', '#f6d7a7', '#e9b97a', '#ff9a4d', '#ff6b5f', '#ff7fb5', '#c77dff', '#6c8cff', '#4fc3f7',
    '#4dd0a7', '#7bd35a', '#ffd84d', '#9c6b43', '#5b5b66', '#2b2b33'];

  const EYE_COLORS = ['#151515', '#3b2a1a', '#2e6da4', '#2e8b57', '#7d4bb0', '#c0392b', '#d4ac0d', '#ffffff'];

  const DEFAULT = { color: '#fff1dc', color2: '#ff9a4d', eyeColor: '#151515', finish: 'satin', pattern: 'none', eyes: 'normal', mouth: 'smile', hat: 'none', glasses: 'none', extra: 'none', paint: null };

  const HEX = /^#[0-9a-fA-F]{6}$/;
  // Valida y limpia una personalización recibida (servidor y cliente)
  function sanitize(c) {
    c = c || {};
    const out = Object.assign({}, DEFAULT);
    if (HEX.test(c.color || '')) out.color = c.color;
    if (HEX.test(c.color2 || '')) out.color2 = c.color2;
    if (HEX.test(c.eyeColor || '')) out.eyeColor = c.eyeColor;
    for (const k of ['finish', 'pattern', 'eyes', 'mouth', 'hat', 'glasses', 'extra']) {
      if (CATALOG[k].some(o => o.id === c[k])) out[k] = c[k];
    }
    const paint = c.paint || c.textureData;
    if (typeof paint === 'string' && paint.startsWith('data:image/png;base64,') && paint.length < 70000) out.paint = paint;
    return out;
  }

  return { CATALOG, PALETTE, EYE_COLORS, DEFAULT, sanitize };
});
