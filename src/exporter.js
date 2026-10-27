import { getSvgDimensions, processSvgBackground } from './renderer.js';

/**
 * Converts an SVG string into a Canvas element at a specified scale and background.
 * @param {string} svgString - Valid SVG markup
 * @param {object} options
 * @param {'transparent' | 'white'} options.background
 * @param {'png' | 'jpeg'} options.format
 * @param {number} [options.scale=2] - Scale factor (1, 2, 3) for retina / high-resolution export
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function svgToCanvas(svgString, { background = 'transparent', format = 'png', scale = 2 }) {
  const processedSvg = processSvgBackground(svgString, background);
  const dims = getSvgDimensions(processedSvg);

  const width = Math.max(1, Math.round(dims.width * scale));
  const height = Math.max(1, Math.round(dims.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context');

  // Background painting:
  // - JPEG format has no alpha channel, so it must ALWAYS have an opaque white background.
  // - PNG format with 'white' background fills with white.
  // - PNG format with 'transparent' background clears rect to transparent alpha.
  if (format === 'jpeg' || background === 'white') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.clearRect(0, 0, width, height);
  }

  // Load SVG into Image object
  const svgBlob = new Blob([processedSvg], { type: 'image/svg+xml;charset=utf-8' });
  const blobUrl = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(blobUrl);
        resolve(canvas);
      } catch (err) {
        URL.revokeObjectURL(blobUrl);
        reject(err);
      }
    };

    img.onerror = (e) => {
      URL.revokeObjectURL(blobUrl);
      reject(new Error('Failed to render SVG image to canvas'));
    };

    img.src = blobUrl;
  });
}

/**
 * Exports diagram as a Blob (PNG or JPEG).
 * @param {string} svgString
 * @param {object} options
 * @param {'png' | 'jpeg'} options.format
 * @param {'transparent' | 'white'} options.background
 * @param {number} [options.scale=2]
 * @param {number} [options.quality=0.95]
 * @returns {Promise<Blob>}
 */
export async function exportToBlob(svgString, { format = 'png', background = 'transparent', scale = 2, quality = 0.95 }) {
  const canvas = await svgToCanvas(svgString, { format, background, scale });
  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error(`Failed to convert canvas to ${format} blob`));
      }
    }, mimeType, quality);
  });
}

/**
 * Triggers a browser file download for a given Blob.
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Downloads the diagram SVG as a .svg text file.
 * @param {string} svgString
 * @param {string} filename
 */
export function downloadSvgFile(svgString, filename = 'diagram.svg') {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, filename);
}

/**
 * Copies a PNG Blob directly to the system clipboard.
 * @param {Blob} pngBlob
 * @returns {Promise<void>}
 */
export async function copyImageToClipboard(pngBlob) {
  if (!navigator.clipboard || !window.ClipboardItem) {
    throw new Error('Clipboard API is not supported in this browser');
  }
  const item = new ClipboardItem({ 'image/png': pngBlob });
  await navigator.clipboard.write([item]);
}

/**
 * Copies plain text to clipboard.
 * @param {string} text
 * @returns {Promise<void>}
 */
export async function copyTextToClipboard(text) {
  if (!navigator.clipboard) {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return;
  }
  await navigator.clipboard.writeText(text);
}
