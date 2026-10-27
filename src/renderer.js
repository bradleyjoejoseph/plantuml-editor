import { encodePlantUML, getPlantUMLServerUrl } from './encoder.js';

const renderCache = new Map();

/**
 * Extracts width and height from SVG string.
 * @param {string} svgString
 * @returns {{ width: number, height: number }}
 */
export function getSvgDimensions(svgString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) return { width: 800, height: 600 };

  let width = parseFloat(svg.getAttribute('width'));
  let height = parseFloat(svg.getAttribute('height'));

  if (!width || !height || isNaN(width) || isNaN(height)) {
    const viewBox = svg.getAttribute('viewBox');
    if (viewBox) {
      const parts = viewBox.trim().split(/\s+|,/);
      if (parts.length >= 4) {
        width = parseFloat(parts[2]);
        height = parseFloat(parts[3]);
      }
    }
  }

  return {
    width: width || 800,
    height: height || 600,
  };
}

/**
 * Normalizes SVG background based on user preference ('transparent' or 'white').
 * @param {string} svgString
 * @param {'transparent' | 'white'} backgroundMode
 * @returns {string} Processed SVG string
 */
export function processSvgBackground(svgString, backgroundMode = 'transparent') {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) return svgString;

  if (backgroundMode === 'transparent') {
    // Remove or neutralize background from inline style
    const style = svg.getAttribute('style') || '';
    const cleanStyle = style
      .replace(/background\s*:\s*#[a-fA-F0-9]{3,8}\s*;?/gi, '')
      .replace(/background\s*:\s*white\s*;?/gi, '')
      .replace(/background-color\s*:\s*#[a-fA-F0-9]{3,8}\s*;?/gi, '')
      .replace(/background-color\s*:\s*white\s*;?/gi, '');
    svg.setAttribute('style', cleanStyle);

    // If there is a root background rect covering full canvas with white/light fill, make it none
    const firstRect = svg.querySelector('rect');
    if (firstRect) {
      const fill = (firstRect.getAttribute('fill') || '').toLowerCase();
      const x = firstRect.getAttribute('x');
      const y = firstRect.getAttribute('y');
      const w = firstRect.getAttribute('width');
      const h = firstRect.getAttribute('height');
      // If rect starts at origin or is 100% width/height and filled white
      if ((fill === '#ffffff' || fill === '#fff' || fill === 'white') && 
          ((x === '0' && y === '0') || w === '100%' || (parseFloat(x) <= 1 && parseFloat(y) <= 1))) {
        firstRect.setAttribute('fill', 'none');
      }
    }
  } else {
    // White background requested: ensure background:#FFFFFF is explicitly defined
    let style = svg.getAttribute('style') || '';
    if (!/background/i.test(style)) {
      style += (style.trim().endsWith(';') || !style.trim() ? '' : ';') + 'background:#FFFFFF;';
      svg.setAttribute('style', style);
    } else {
      style = style.replace(/background(-color)?\s*:\s*[^;]+/gi, 'background:#FFFFFF');
      svg.setAttribute('style', style);
    }
  }

  // Ensure width and height attributes exist and are explicitly set to prevent Safari canvas bugs
  const dims = getSvgDimensions(svgString);
  if (!svg.getAttribute('width') || svg.getAttribute('width').includes('%')) {
    svg.setAttribute('width', `${dims.width}px`);
  }
  if (!svg.getAttribute('height') || svg.getAttribute('height').includes('%')) {
    svg.setAttribute('height', `${dims.height}px`);
  }

  const serializer = new XMLSerializer();
  return serializer.serializeToString(svg);
}

/**
 * Prepares the PlantUML source code for rendering with optional transparency skinparam.
 * @param {string} code
 * @param {'transparent' | 'white'} backgroundMode
 * @returns {string}
 */
export function preparePlantUMLCode(code, backgroundMode = 'transparent') {
  let trimmed = code.trim();
  if (!trimmed) return '';

  // If missing @startuml/@enduml and not another start format (like @startjson, @startmindmap, etc.)
  if (!trimmed.startsWith('@start')) {
    trimmed = `@startuml\n${trimmed}\n@enduml`;
  }

  // If transparent requested and no backgroundColor already specified in code
  if (backgroundMode === 'transparent' && !/skinparam\s+backgroundColor/i.test(trimmed)) {
    // Inject right after the first @start... line
    trimmed = trimmed.replace(/^(@start[a-z0-9_-]+)/im, '$1\nskinparam backgroundColor transparent');
  }

  return trimmed;
}

/**
 * Renders PlantUML code to SVG string with fallbacks and caching.
 * @param {string} rawCode - PlantUML source
 * @param {'transparent' | 'white'} backgroundMode
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ svg: string, renderTime: number, dimensions: { width: number, height: number } }>}
 */
export async function renderPlantUML(rawCode, backgroundMode = 'transparent', signal) {
  const preparedCode = preparePlantUMLCode(rawCode, backgroundMode);
  if (!preparedCode) {
    throw new Error('Diagram source is empty');
  }

  const cacheKey = `${backgroundMode}::${preparedCode}`;
  if (renderCache.has(cacheKey)) {
    return renderCache.get(cacheKey);
  }

  const startTime = performance.now();
  let svgString = null;
  let lastError = null;

  // 1. Primary engine: Kroki API via POST (supports large diagrams, fast response)
  try {
    const res = await fetch('https://kroki.io/plantuml/svg', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Accept': 'image/svg+xml'
      },
      body: preparedCode,
      signal
    });

    if (res.ok) {
      svgString = await res.text();
    } else {
      const errText = await res.text().catch(() => '');
      lastError = new Error(errText || `Kroki HTTP ${res.status}`);
    }
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    lastError = err;
  }

  // 2. Secondary fallback: Official PlantUML Server
  if (!svgString) {
    try {
      const officialUrl = getPlantUMLServerUrl(preparedCode, 'svg');
      const res = await fetch(officialUrl, { signal });
      if (res.ok) {
        svgString = await res.text();
      } else {
        throw new Error(`PlantUML Server HTTP ${res.status}`);
      }
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      throw new Error(`Rendering failed: ${lastError?.message || err.message || 'Unable to connect to diagram server'}`);
    }
  }

  // Process background styling
  const finalSvg = processSvgBackground(svgString, backgroundMode);
  const dimensions = getSvgDimensions(finalSvg);
  const renderTime = Math.round(performance.now() - startTime);

  const result = {
    svg: finalSvg,
    renderTime,
    dimensions
  };

  // Keep cache size bounded
  if (renderCache.size > 100) {
    const firstKey = renderCache.keys().next().value;
    renderCache.delete(firstKey);
  }
  renderCache.set(cacheKey, result);

  return result;
}
