import { deflateRaw, inflateRaw } from 'pako';

/**
 * PlantUML's custom 64-character alphabet table.
 * Standard Base64 uses: A-Z, a-z, 0-9, +, /
 * PlantUML uses: 0-9, A-Z, a-z, -, _
 */
function encode6bit(b) {
  if (b < 10) return String.fromCharCode(48 + b);
  b -= 10;
  if (b < 26) return String.fromCharCode(65 + b);
  b -= 26;
  if (b < 26) return String.fromCharCode(97 + b);
  b -= 26;
  if (b === 0) return '-';
  if (b === 1) return '_';
  return '?';
}

function append3bytes(b1, b2, b3) {
  const c1 = b1 >> 2;
  const c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
  const c3 = ((b2 & 0xf) << 2) | (b3 >> 6);
  const c4 = b3 & 0x3f;
  return (
    encode6bit(c1 & 0x3f) +
    encode6bit(c2 & 0x3f) +
    encode6bit(c3 & 0x3f) +
    encode6bit(c4 & 0x3f)
  );
}

/**
 * Encodes PlantUML text using deflateRaw + PlantUML 64-character table.
 * @param {string} text - PlantUML source code
 * @returns {string} Encoded PlantUML string
 */
export function encodePlantUML(text) {
  if (!text) return '';
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  const deflated = deflateRaw(bytes, { level: 9 });
  let res = '';
  for (let i = 0; i < deflated.length; i += 3) {
    if (i + 2 === deflated.length) {
      res += append3bytes(deflated[i], deflated[i + 1], 0);
    } else if (i + 1 === deflated.length) {
      res += append3bytes(deflated[i], 0, 0);
    } else {
      res += append3bytes(deflated[i], deflated[i + 1], deflated[i + 2]);
    }
  }
  return res;
}

function decode6bit(b) {
  const code = b.charCodeAt(0);
  if (code === 45) return 62; // '-'
  if (code === 95) return 63; // '_'
  if (code >= 48 && code <= 57) return code - 48; // '0'-'9'
  if (code >= 65 && code <= 90) return code - 65 + 10; // 'A'-'Z'
  if (code >= 97 && code <= 122) return code - 97 + 36; // 'a'-'z'
  return 0;
}

/**
 * Decodes PlantUML encoded string back to plaintext.
 * @param {string} encoded - Encoded PlantUML string
 * @returns {string} PlantUML source code
 */
export function decodePlantUML(encoded) {
  if (!encoded) return '';
  // Strip optional '~1' prefix used in some plantuml URLs
  const clean = encoded.startsWith('~1') ? encoded.slice(2) : encoded;
  const data = [];
  for (let i = 0; i < clean.length; i += 4) {
    const c1 = decode6bit(clean.charAt(i) || '0');
    const c2 = decode6bit(clean.charAt(i + 1) || '0');
    const c3 = decode6bit(clean.charAt(i + 2) || '0');
    const c4 = decode6bit(clean.charAt(i + 3) || '0');

    const b1 = (c1 << 2) | (c2 >> 4);
    const b2 = ((c2 & 0xf) << 4) | (c3 >> 2);
    const b3 = ((c3 & 0x3) << 6) | c4;
    data.push(b1, b2, b3);
  }
  try {
    const uint8 = new Uint8Array(data);
    const inflated = inflateRaw(uint8);
    return new TextDecoder().decode(inflated);
  } catch (err) {
    console.warn('Failed to decode PlantUML string:', err);
    return '';
  }
}

/**
 * Returns the official PlantUML server SVG URL for a diagram.
 * @param {string} text
 * @param {'svg' | 'png'} format
 */
export function getPlantUMLServerUrl(text, format = 'svg') {
  const encoded = encodePlantUML(text);
  return `https://www.plantuml.com/plantuml/${format}/~1${encoded}`;
}
