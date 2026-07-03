// ── Unicode Font Styles ─────────────────────────────────────────────────────────
// Modular conversion utility — maps normal ASCII text to various Unicode
// character sets that render as "fonts" in Discord channel / category names.
//
// Usage:
//   const { formatText, FONT_STYLES } = require('../utils/fonts');
//   formatText('welcome', 'bold');       // → '𝘄𝗲𝗹𝗰𝗼𝗺𝗲'
//   formatText('📋 INFO', 'fraktur');    // → '📋 𝔍𝔑𝔉𝔒'
// ────────────────────────────────────────────────────────────────────────────────

// ── Style definitions ───────────────────────────────────────────────────────────
// Each style has offsets for uppercase (A-Z), lowercase (a-z), and optionally
// digits (0-9) in the Mathematical Alphanumeric Symbols Unicode block.
// Lookup-table styles (smallcaps, circled, squared, fullwidth) use explicit maps.

const OFFSET_STYLES = {
  // Mathematical Sans-Serif
  sans:       { upper: 0x1D5A0, lower: 0x1D5BA, digit: 0x1D7E2 },
  // Mathematical Sans-Serif Bold
  bold:       { upper: 0x1D5D4, lower: 0x1D5EE, digit: 0x1D7EC },
  // Mathematical Sans-Serif Italic
  italic:     { upper: 0x1D608, lower: 0x1D622, digit: null },
  // Mathematical Sans-Serif Bold Italic
  bolditalic: { upper: 0x1D63C, lower: 0x1D656, digit: null },
  // Mathematical Script (cursive)
  script:     { upper: 0x1D49C, lower: 0x1D4B6, digit: null },
  // Mathematical Bold Script
  boldscript: { upper: 0x1D4D0, lower: 0x1D4EA, digit: null },
  // Mathematical Fraktur (gothic)
  fraktur:    { upper: 0x1D504, lower: 0x1D51E, digit: null },
  // Mathematical Bold Fraktur
  boldfraktur:{ upper: 0x1D56C, lower: 0x1D586, digit: null },
  // Mathematical Double-Struck
  doublestruck:{ upper: 0x1D538, lower: 0x1D552, digit: 0x1D7D8 },
  // Mathematical Monospace
  monospace:  { upper: 0x1D670, lower: 0x1D68A, digit: 0x1D7F6 },
};

// Script style has several "holes" where Unicode reuses existing codepoints.
// These are the standard exceptions in the Mathematical Alphanumeric block.
const SCRIPT_EXCEPTIONS = {
  // Script uppercase exceptions
  B: '\u212C', // ℬ
  E: '\u2130', // ℰ
  F: '\u2131', // ℱ
  H: '\u210B', // ℋ
  I: '\u2110', // ℐ
  L: '\u2112', // ℒ
  M: '\u2133', // ℳ
  R: '\u211B', // ℛ
  // Script lowercase exceptions
  e: '\u212F', // ℯ
  g: '\u210A', // ℊ
  o: '\u2134', // ℴ
};

const FRAKTUR_EXCEPTIONS = {
  C: '\u212D', // ℭ
  H: '\u210C', // ℌ
  I: '\u2111', // ℑ
  R: '\u211C', // ℜ
  Z: '\u2128', // ℨ
};

const DOUBLESTRUCK_EXCEPTIONS = {
  C: '\u2102', // ℂ
  H: '\u210D', // ℍ
  N: '\u2115', // ℕ
  P: '\u2119', // ℙ
  Q: '\u211A', // ℚ
  R: '\u211D', // ℝ
  Z: '\u2124', // ℤ
};

// Lookup-table styles
const SMALL_CAPS = {
  a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ',
  j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ',
  s: 'ꜱ', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ',
};

const CIRCLED_UPPER = {};
const CIRCLED_LOWER = {};
const CIRCLED_DIGITS = {};
// Ⓐ-Ⓩ = U+24B6 to U+24CF, ⓐ-ⓩ = U+24D0 to U+24E9
for (let i = 0; i < 26; i++) {
  CIRCLED_UPPER[String.fromCharCode(65 + i)] = String.fromCodePoint(0x24B6 + i);
  CIRCLED_LOWER[String.fromCharCode(97 + i)] = String.fromCodePoint(0x24D0 + i);
}
// ⓪ = U+24EA, ①-⑨ = U+2460-U+2468
CIRCLED_DIGITS['0'] = '\u24EA';
for (let i = 1; i <= 9; i++) {
  CIRCLED_DIGITS[String(i)] = String.fromCodePoint(0x245F + i);
}

const SQUARED_UPPER = {};
// 🄰-🅉 = U+1F170 to U+1F189 (Negative Squared Latin Capital Letters)
for (let i = 0; i < 26; i++) {
  SQUARED_UPPER[String.fromCharCode(65 + i)] = String.fromCodePoint(0x1F170 + i);
}

const FULLWIDTH = {};
// Fullwidth ASCII: ! = U+FF01, ... A = U+FF21, a = U+FF41, 0 = U+FF10
for (let i = 33; i <= 126; i++) { // printable ASCII range (! to ~)
  FULLWIDTH[String.fromCharCode(i)] = String.fromCodePoint(0xFF01 + (i - 33));
}

// ── Conversion function ─────────────────────────────────────────────────────────

/**
 * Convert a single character using an offset-based style.
 * Returns null if no conversion is available (fallback to original char).
 */
function convertOffsetChar(char, offsets, exceptions) {
  // Check exceptions first
  if (exceptions && exceptions[char]) return exceptions[char];

  const code = char.charCodeAt(0);

  if (code >= 65 && code <= 90 && offsets.upper) { // A-Z
    return String.fromCodePoint(offsets.upper + (code - 65));
  }
  if (code >= 97 && code <= 122 && offsets.lower) { // a-z
    return String.fromCodePoint(offsets.lower + (code - 97));
  }
  if (code >= 48 && code <= 57 && offsets.digit) { // 0-9
    return String.fromCodePoint(offsets.digit + (code - 48));
  }

  return null; // no mapping, caller should use original char
}

/**
 * Detect and strip a leading emoji prefix from the text.
 * Returns { prefix, rest } where prefix includes trailing space.
 */
function splitEmoji(text) {
  // Match common emoji (supplementary plane emoji, dingbats, symbols, etc.)
  const emojiMatch = text.match(/^((?:[\u2000-\u32FF\u2600-\u27FF]|[\uD83C-\uD83E][\uDC00-\uDFFF]|\uFE0F)+\s*)/);
  if (emojiMatch) {
    return { prefix: emojiMatch[0], rest: text.slice(emojiMatch[0].length) };
  }
  return { prefix: '', rest: text };
}

/**
 * Format a string using a named Unicode font style.
 *
 * @param {string} text  - The text to convert (may start with emoji).
 * @param {string} style - One of the keys from FONT_STYLES.
 * @returns {string} The converted text with emoji prefix preserved.
 */
function formatText(text, style) {
  if (style === 'default') return text;

  const { prefix, rest } = splitEmoji(text);
  let formatted = '';

  // ── Offset-based styles ────────────────────────────────────────────────
  if (OFFSET_STYLES[style]) {
    const offsets = OFFSET_STYLES[style];

    // Pick the right exception map
    let exceptions = null;
    if (style === 'script')       exceptions = SCRIPT_EXCEPTIONS;
    if (style === 'fraktur')      exceptions = FRAKTUR_EXCEPTIONS;
    if (style === 'doublestruck') exceptions = DOUBLESTRUCK_EXCEPTIONS;

    for (const char of rest) {
      const converted = convertOffsetChar(char, offsets, exceptions);
      formatted += converted !== null ? converted : char;
    }

  // ── Small caps ─────────────────────────────────────────────────────────
  } else if (style === 'smallcaps') {
    for (const char of rest) {
      const lower = char.toLowerCase();
      formatted += SMALL_CAPS[lower] || char;
    }

  // ── Circled ────────────────────────────────────────────────────────────
  } else if (style === 'circled') {
    for (const char of rest) {
      formatted +=
        CIRCLED_UPPER[char] || CIRCLED_LOWER[char] || CIRCLED_DIGITS[char] || char;
    }

  // ── Squared (negative) ────────────────────────────────────────────────
  } else if (style === 'squared') {
    for (const char of rest) {
      // Squared only has uppercase; convert lowercase to uppercase equivalent
      const upper = char.toUpperCase();
      formatted += SQUARED_UPPER[upper] || char;
    }

  // ── Fullwidth ──────────────────────────────────────────────────────────
  } else if (style === 'fullwidth') {
    for (const char of rest) {
      formatted += FULLWIDTH[char] || char;
    }

  // ── Spaced (aesthetic wide) ────────────────────────────────────────────
  } else if (style === 'spaced') {
    formatted = [...rest].join(' ');

  // ── Unknown style → pass through ──────────────────────────────────────
  } else {
    formatted = rest;
  }

  return prefix + formatted;
}

// ── Style registry (for building select menus) ──────────────────────────────────
// Each entry has: label, description (with sample text), and the value key.
const FONT_STYLES = [
  { value: 'default',      label: 'Default / Classic',        emoji: '📝' },
  { value: 'bold',         label: 'Bold Sans',                emoji: '🔠' },
  { value: 'italic',       label: 'Italic Sans',              emoji: '🔤' },
  { value: 'bolditalic',   label: 'Bold Italic',              emoji: '💫' },
  { value: 'sans',         label: 'Sans-Serif',               emoji: '🔡' },
  { value: 'script',       label: 'Script / Cursive',         emoji: '✒️' },
  { value: 'boldscript',   label: 'Bold Script',              emoji: '🖊️' },
  { value: 'fraktur',      label: 'Fraktur / Gothic',         emoji: '🏰' },
  { value: 'boldfraktur',  label: 'Bold Fraktur',             emoji: '⚔️' },
  { value: 'doublestruck', label: 'Double-Struck',            emoji: '🔲' },
  { value: 'monospace',    label: 'Monospace',                 emoji: '💻' },
  { value: 'smallcaps',    label: 'Small Caps',               emoji: '🔠' },
  { value: 'circled',      label: 'Circled Letters',           emoji: '⭕' },
  { value: 'squared',      label: 'Squared Letters',           emoji: '🟥' },
  { value: 'fullwidth',    label: 'Fullwidth',                 emoji: '🅰️' },
  { value: 'spaced',       label: 'Spaced / Aesthetic Wide',   emoji: '↔️' },
];

module.exports = { formatText, FONT_STYLES };
