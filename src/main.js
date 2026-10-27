import { renderPlantUML, processSvgBackground, getSvgDimensions } from './renderer.js';
import { exportToBlob, downloadBlob, downloadSvgFile, copyImageToClipboard, copyTextToClipboard } from './exporter.js';
import { encodePlantUML, decodePlantUML } from './encoder.js';
import { TEMPLATES } from './templates.js';

// DOM Elements
const codeEditor = document.getElementById('codeEditor');
const lineNumbers = document.getElementById('lineNumbers');
const editorStats = document.getElementById('editorStats');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const renderBtn = document.getElementById('renderBtn');
const autoRenderCheckbox = document.getElementById('autoRenderCheckbox');
const pasteBtn = document.getElementById('pasteBtn');
const wrapBtn = document.getElementById('wrapBtn');
const clearBtn = document.getElementById('clearBtn');

const appContainer = document.getElementById('appContainer');
const previewViewport = document.getElementById('previewViewport');
const diagramStage = document.getElementById('diagramStage');
const emptyState = document.getElementById('emptyState');
const loadingOverlay = document.getElementById('loadingOverlay');
const errorBanner = document.getElementById('errorBanner');
const errorMessage = document.getElementById('errorMessage');
const loadSampleEmptyBtn = document.getElementById('loadSampleEmptyBtn');

const bgTransparentBtn = document.getElementById('bgTransparentBtn');
const bgWhiteBtn = document.getElementById('bgWhiteBtn');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const zoomResetBtn = document.getElementById('zoomResetBtn');
const zoomFitBtn = document.getElementById('zoomFitBtn');
const exportScaleSelect = document.getElementById('exportScaleSelect');

const downloadPngBtn = document.getElementById('downloadPngBtn');
const downloadJpegBtn = document.getElementById('downloadJpegBtn');
const downloadSvgBtn = document.getElementById('downloadSvgBtn');
const copyPngBtn = document.getElementById('copyPngBtn');
const copySvgBtn = document.getElementById('copySvgBtn');

const templateSelect = document.getElementById('templateSelect');
const layoutStackedBtn = document.getElementById('layoutStackedBtn');
const layoutSplitBtn = document.getElementById('layoutSplitBtn');
const shareLinkBtn = document.getElementById('shareLinkBtn');
const helpModalBtn = document.getElementById('helpModalBtn');
const helpModal = document.getElementById('helpModal');
const closeHelpModalBtn = document.getElementById('closeHelpModalBtn');
const closeHelpModalFooterBtn = document.getElementById('closeHelpModalFooterBtn');
const toastContainer = document.getElementById('toastContainer');

// State
let currentSvg = '';
let currentBackgroundMode = 'transparent'; // 'transparent' | 'white'
let zoom = 1.0;
let pan = { x: 0, y: 0 };
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let debounceTimer = null;
let abortController = null;

// ============================================================================
// Toast Notification System
// ============================================================================
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span aria-hidden="true">${type === 'success' ? '✓' : '⚠'}</span>
    <span>${message}</span>
  `;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

// Clear any obsolete stored dark theme preference
localStorage.removeItem('plantuml_theme');

// ============================================================================
// Layout Switcher (Stacked vs Split)
// ============================================================================
function setLayout(mode) {
  if (mode === 'split') {
    appContainer.classList.remove('layout-stacked');
    appContainer.classList.add('layout-split');
    layoutSplitBtn.classList.add('active');
    layoutStackedBtn.classList.remove('active');
  } else {
    appContainer.classList.remove('layout-split');
    appContainer.classList.add('layout-stacked');
    layoutStackedBtn.classList.add('active');
    layoutSplitBtn.classList.remove('active');
  }
  localStorage.setItem('plantuml_layout', mode);
  fitDiagramToView();
}

layoutStackedBtn.addEventListener('click', () => setLayout('stacked'));
layoutSplitBtn.addEventListener('click', () => setLayout('split'));

const savedLayout = localStorage.getItem('plantuml_layout') || 'stacked';
setLayout(savedLayout);

// ============================================================================
// Code Editor Features: Line Numbers & Smart Indentation
// ============================================================================
function updateLineNumbers() {
  const text = codeEditor.value;
  const lines = text.split('\n').length;
  const numbersArray = [];
  for (let i = 1; i <= lines; i++) {
    numbersArray.push(i);
  }
  lineNumbers.textContent = numbersArray.join('\n');
  editorStats.textContent = `Lines: ${lines} | Chars: ${text.length}`;
}

// Smart keyboard handling in code textarea
codeEditor.addEventListener('keydown', (e) => {
  // Tab key: indent 2 spaces
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = codeEditor.selectionStart;
    const end = codeEditor.selectionEnd;
    const val = codeEditor.value;

    if (e.shiftKey) {
      // Unindent if line starts with 2 spaces
      const lineStart = val.lastIndexOf('\n', start - 1) + 1;
      if (val.slice(lineStart, lineStart + 2) === '  ') {
        codeEditor.value = val.slice(0, lineStart) + val.slice(lineStart + 2);
        codeEditor.selectionStart = Math.max(lineStart, start - 2);
        codeEditor.selectionEnd = Math.max(lineStart, end - 2);
      }
    } else {
      codeEditor.value = val.substring(0, start) + '  ' + val.substring(end);
      codeEditor.selectionStart = codeEditor.selectionEnd = start + 2;
    }
    updateLineNumbers();
    triggerAutoRender();
    return;
  }

  // Enter key: maintain auto-indentation
  if (e.key === 'Enter') {
    const start = codeEditor.selectionStart;
    const val = codeEditor.value;
    const lineStart = val.lastIndexOf('\n', start - 1) + 1;
    const currentLine = val.substring(lineStart, start);
    const match = currentLine.match(/^\s+/);
    const indent = match ? match[0] : '';

    if (indent.length > 0) {
      e.preventDefault();
      const insert = '\n' + indent;
      codeEditor.value = val.substring(0, start) + insert + val.substring(start);
      codeEditor.selectionStart = codeEditor.selectionEnd = start + insert.length;
      updateLineNumbers();
      triggerAutoRender();
      return;
    }
  }

  // Bracket auto-closing
  const pairs = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'" };
  if (pairs[e.key]) {
    const start = codeEditor.selectionStart;
    const end = codeEditor.selectionEnd;
    if (start === end) {
      // If closing bracket matches next character, skip typing
      const nextChar = codeEditor.value.charAt(start);
      if (nextChar === e.key && (e.key === '"' || e.key === "'")) {
        e.preventDefault();
        codeEditor.selectionStart = codeEditor.selectionEnd = start + 1;
        return;
      }
    }
  }

  // Cmd+Enter or Ctrl+Enter to render immediately
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    renderCurrentDiagram();
  }
});

// Synchronize line numbers on scroll
codeEditor.addEventListener('scroll', () => {
  lineNumbers.scrollTop = codeEditor.scrollTop;
});

codeEditor.addEventListener('input', () => {
  updateLineNumbers();
  localStorage.setItem('plantuml_saved_code', codeEditor.value);
  triggerAutoRender();
});

// "Paste UML" button
pasteBtn.addEventListener('click', async () => {
  try {
    if (navigator.clipboard && navigator.clipboard.readText) {
      const text = await navigator.clipboard.readText();
      if (text) {
        codeEditor.value = text;
        updateLineNumbers();
        localStorage.setItem('plantuml_saved_code', text);
        renderCurrentDiagram();
        showToast('Pasted UML from clipboard!');
        return;
      }
    }
  } catch (err) {
    console.warn('Clipboard read error:', err);
  }
  // Fallback: focus editor
  codeEditor.focus();
  codeEditor.select();
  showToast('Press Cmd+V / Ctrl+V to paste', 'info');
});

// "Wrap @startuml" button
wrapBtn.addEventListener('click', () => {
  let val = codeEditor.value.trim();
  if (!val) return;
  if (!val.startsWith('@start')) {
    val = `@startuml\n${val}\n@enduml`;
    codeEditor.value = val;
    updateLineNumbers();
    renderCurrentDiagram();
    showToast('Wrapped with @startuml and @enduml');
  } else {
    showToast('Code already has @start tag');
  }
});

// "Clear" button
clearBtn.addEventListener('click', () => {
  if (!codeEditor.value.trim()) return;
  if (confirm('Are you sure you want to clear the editor?')) {
    codeEditor.value = '';
    updateLineNumbers();
    localStorage.removeItem('plantuml_saved_code');
    diagramStage.innerHTML = '';
    currentSvg = '';
    emptyState.style.display = 'flex';
    errorBanner.style.display = 'none';
    statusText.textContent = 'Ready';
    statusDot.className = 'status-dot';
  }
});

renderBtn.addEventListener('click', () => {
  renderCurrentDiagram();
});

function triggerAutoRender() {
  if (!autoRenderCheckbox.checked) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    renderCurrentDiagram();
  }, 400);
}

// ============================================================================
// Diagram Rendering Engine
// ============================================================================
async function renderCurrentDiagram() {
  const code = codeEditor.value.trim();
  if (!code) {
    diagramStage.innerHTML = '';
    currentSvg = '';
    emptyState.style.display = 'flex';
    errorBanner.style.display = 'none';
    statusText.textContent = 'Ready';
    statusDot.className = 'status-dot';
    return;
  }

  // Cancel any in-flight request
  if (abortController) {
    abortController.abort();
  }
  abortController = new AbortController();

  statusDot.className = 'status-dot rendering';
  statusText.textContent = 'Rendering...';
  loadingOverlay.style.display = 'flex';
  errorBanner.style.display = 'none';

  try {
    const result = await renderPlantUML(code, currentBackgroundMode, abortController.signal);
    currentSvg = result.svg;

    // Display SVG in diagram stage
    diagramStage.innerHTML = currentSvg;
    emptyState.style.display = 'none';
    loadingOverlay.style.display = 'none';
    errorBanner.style.display = 'none';

    statusDot.className = 'status-dot';
    statusText.textContent = `Rendered (${result.renderTime}ms)`;

    // Update viewport transform
    applyTransform();
  } catch (err) {
    if (err.name === 'AbortError') return;

    console.error('Render error:', err);
    loadingOverlay.style.display = 'none';
    statusDot.className = 'status-dot error';
    statusText.textContent = 'Syntax Error';

    errorBanner.style.display = 'flex';
    errorMessage.innerHTML = `<pre>${escapeHtml(err.message)}</pre>`;
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ============================================================================
// Background Toggle: Transparent vs White
// ============================================================================
function setBackgroundMode(mode) {
  currentBackgroundMode = mode;
  localStorage.setItem('plantuml_bg_mode', mode);

  if (mode === 'transparent') {
    bgTransparentBtn.classList.add('active');
    bgWhiteBtn.classList.remove('active');
    previewViewport.classList.remove('bg-white');
    previewViewport.classList.add('bg-transparent');
  } else {
    bgWhiteBtn.classList.add('active');
    bgTransparentBtn.classList.remove('active');
    previewViewport.classList.remove('bg-transparent');
    previewViewport.classList.add('bg-white');
  }

  // If diagram is already rendered, update its background immediately!
  if (currentSvg) {
    currentSvg = processSvgBackground(currentSvg, currentBackgroundMode);
    diagramStage.innerHTML = currentSvg;
  } else {
    renderCurrentDiagram();
  }
}

bgTransparentBtn.addEventListener('click', () => setBackgroundMode('transparent'));
bgWhiteBtn.addEventListener('click', () => setBackgroundMode('white'));

const savedBg = localStorage.getItem('plantuml_bg_mode') || 'transparent';
setBackgroundMode(savedBg);

// ============================================================================
// Pan and Zoom Controls
// ============================================================================
function applyTransform() {
  diagramStage.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
}

function zoomBy(delta) {
  zoom = Math.min(Math.max(0.2, zoom + delta), 4.0);
  applyTransform();
}

function resetZoom() {
  zoom = 1.0;
  pan = { x: 0, y: 0 };
  applyTransform();
}

function fitDiagramToView() {
  if (!currentSvg) return;
  const dims = getSvgDimensions(currentSvg);
  const vWidth = previewViewport.clientWidth - 40;
  const vHeight = previewViewport.clientHeight - 40;

  if (vWidth > 0 && vHeight > 0 && dims.width > 0 && dims.height > 0) {
    const scaleX = vWidth / dims.width;
    const scaleY = vHeight / dims.height;
    zoom = Math.min(Math.min(scaleX, scaleY), 1.2);
    pan = { x: 0, y: 0 };
    applyTransform();
  }
}

zoomInBtn.addEventListener('click', () => zoomBy(0.2));
zoomOutBtn.addEventListener('click', () => zoomBy(-0.2));
zoomResetBtn.addEventListener('click', resetZoom);
zoomFitBtn.addEventListener('click', fitDiagramToView);

// Mouse wheel zoom
previewViewport.addEventListener('wheel', (e) => {
  e.preventDefault();
  const delta = e.deltaY < 0 ? 0.1 : -0.1;
  zoomBy(delta);
}, { passive: false });

// Mouse drag to pan
previewViewport.addEventListener('mousedown', (e) => {
  // Only pan on left click
  if (e.button !== 0) return;
  isDragging = true;
  dragStart = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  previewViewport.classList.add('is-dragging');
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  pan = {
    x: e.clientX - dragStart.x,
    y: e.clientY - dragStart.y
  };
  applyTransform();
});

window.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
    previewViewport.classList.remove('is-dragging');
  }
});

// ============================================================================
// Export Engine: PNG, JPEG, SVG, Clipboard
// ============================================================================
function getExportScale() {
  return parseFloat(exportScaleSelect.value) || 2;
}

// Download PNG (supports transparent or white background)
downloadPngBtn.addEventListener('click', async () => {
  if (!currentSvg) {
    showToast('No diagram to export', 'error');
    return;
  }
  const scale = getExportScale();
  try {
    statusText.textContent = 'Exporting PNG...';
    const blob = await exportToBlob(currentSvg, {
      format: 'png',
      background: currentBackgroundMode,
      scale
    });
    const filename = `plantuml-diagram-${currentBackgroundMode}-${scale}x.png`;
    downloadBlob(blob, filename);
    showToast(`Downloaded ${filename}!`);
    statusText.textContent = 'Export complete';
  } catch (err) {
    console.error('PNG export error:', err);
    showToast('Failed to export PNG', 'error');
  }
});

// Download JPEG (solid white background)
downloadJpegBtn.addEventListener('click', async () => {
  if (!currentSvg) {
    showToast('No diagram to export', 'error');
    return;
  }
  const scale = getExportScale();
  try {
    statusText.textContent = 'Exporting JPEG...';
    // JPEG has no transparency, so we always bake with white background
    const blob = await exportToBlob(currentSvg, {
      format: 'jpeg',
      background: 'white',
      scale,
      quality: 0.95
    });
    const filename = `plantuml-diagram-white-${scale}x.jpeg`;
    downloadBlob(blob, filename);
    showToast(`Downloaded ${filename} (White BG)!`);
    statusText.textContent = 'Export complete';
  } catch (err) {
    console.error('JPEG export error:', err);
    showToast('Failed to export JPEG', 'error');
  }
});

// Download SVG (vector)
downloadSvgBtn.addEventListener('click', () => {
  if (!currentSvg) {
    showToast('No diagram to export', 'error');
    return;
  }
  const processed = processSvgBackground(currentSvg, currentBackgroundMode);
  downloadSvgFile(processed, `plantuml-diagram-${currentBackgroundMode}.svg`);
  showToast('Downloaded SVG vector!');
});

// Copy PNG Image directly to system clipboard
copyPngBtn.addEventListener('click', async () => {
  if (!currentSvg) {
    showToast('No diagram to copy', 'error');
    return;
  }
  try {
    statusText.textContent = 'Copying PNG...';
    const blob = await exportToBlob(currentSvg, {
      format: 'png',
      background: currentBackgroundMode,
      scale: 2 // Crisp 2x for clipboard paste
    });
    await copyImageToClipboard(blob);
    showToast('PNG copied to clipboard! Ready to paste into Slack/Docs.');
    statusText.textContent = 'Copied to clipboard';
  } catch (err) {
    console.error('Clipboard copy error:', err);
    showToast('Clipboard copy failed. Try Download PNG instead.', 'error');
  }
});

// Copy raw SVG markup to clipboard
copySvgBtn.addEventListener('click', async () => {
  if (!currentSvg) {
    showToast('No diagram to copy', 'error');
    return;
  }
  try {
    const processed = processSvgBackground(currentSvg, currentBackgroundMode);
    await copyTextToClipboard(processed);
    showToast('SVG markup copied to clipboard!');
  } catch (err) {
    showToast('Failed to copy SVG', 'error');
  }
});

// ============================================================================
// Share Link Generation
// ============================================================================
shareLinkBtn.addEventListener('click', async () => {
  const code = codeEditor.value.trim();
  if (!code) {
    showToast('Type a diagram first to share', 'error');
    return;
  }
  const encoded = encodePlantUML(code);
  const shareUrl = `${window.location.origin}${window.location.pathname}#uml=${encoded}`;
  try {
    await copyTextToClipboard(shareUrl);
    window.location.hash = `uml=${encoded}`;
    showToast('Shareable URL copied to clipboard!');
  } catch (err) {
    showToast('Unable to copy share URL', 'error');
  }
});

// ============================================================================
// Templates Dropdown & Empty State Button
// ============================================================================
templateSelect.addEventListener('change', () => {
  const selectedKey = templateSelect.value;
  if (TEMPLATES[selectedKey]) {
    codeEditor.value = TEMPLATES[selectedKey].code;
    updateLineNumbers();
    localStorage.setItem('plantuml_saved_code', codeEditor.value);
    resetZoom();
    renderCurrentDiagram();
    showToast(`Loaded ${TEMPLATES[selectedKey].name}!`);
    templateSelect.value = '';
  }
});

loadSampleEmptyBtn.addEventListener('click', () => {
  codeEditor.value = TEMPLATES.sequence.code;
  updateLineNumbers();
  localStorage.setItem('plantuml_saved_code', codeEditor.value);
  renderCurrentDiagram();
  showToast('Loaded Sample Sequence Diagram!');
});

// ============================================================================
// Cheat Sheet Dialog Management
// ============================================================================
helpModalBtn.addEventListener('click', () => {
  if (typeof helpModal.showModal === 'function') {
    helpModal.showModal();
  }
});

closeHelpModalBtn.addEventListener('click', () => helpModal.close());
closeHelpModalFooterBtn.addEventListener('click', () => helpModal.close());

// Close modal when clicking on backdrop
helpModal.addEventListener('click', (e) => {
  const rect = helpModal.getBoundingClientRect();
  const isInDialog = (
    rect.top <= e.clientY &&
    e.clientY <= rect.top + rect.height &&
    rect.left <= e.clientX &&
    e.clientX <= rect.left + rect.width
  );
  if (!isInDialog) {
    helpModal.close();
  }
});

// ============================================================================
// Initialization from URL Hash or LocalStorage
// ============================================================================
function initEditorContent() {
  const hash = window.location.hash;
  if (hash && hash.includes('uml=')) {
    const encoded = hash.split('uml=')[1];
    if (encoded) {
      const decoded = decodePlantUML(encoded);
      if (decoded) {
        codeEditor.value = decoded;
        updateLineNumbers();
        renderCurrentDiagram();
        showToast('Diagram loaded from share URL!');
        return;
      }
    }
  }

  const saved = localStorage.getItem('plantuml_saved_code');
  if (saved && saved.trim()) {
    codeEditor.value = saved;
    updateLineNumbers();
    renderCurrentDiagram();
  } else {
    // Default initial template
    codeEditor.value = TEMPLATES.sequence.code;
    updateLineNumbers();
    renderCurrentDiagram();
  }
}

// Kick off initialization
initEditorContent();
