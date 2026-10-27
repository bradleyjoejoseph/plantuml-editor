import { renderPlantUML, processSvgBackground, getSvgDimensions } from './renderer.js';
import { exportToBlob, downloadBlob, downloadSvgFile, copyImageToClipboard, copyTextToClipboard } from './exporter.js';
import { encodePlantUML, decodePlantUML } from './encoder.js';
import { TEMPLATES } from './templates.js';
import {
  replaceTextInUml,
  setElementColorInUml,
  setArrowColorInUml,
  setArrowStyleInUml,
  addNoteToElementInUml,
  toggleSkinparamInUml,
  hasSkinparam
} from './umlModifier.js';

// DOM Elements - Editor
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

// DOM Elements - Workspace & Preview
const appContainer = document.getElementById('appContainer');
const previewViewport = document.getElementById('previewViewport');
const diagramStage = document.getElementById('diagramStage');
const emptyState = document.getElementById('emptyState');
const loadingOverlay = document.getElementById('loadingOverlay');
const errorBanner = document.getElementById('errorBanner');
const errorMessage = document.getElementById('errorMessage');
const loadSampleEmptyBtn = document.getElementById('loadSampleEmptyBtn');

// DOM Elements - Visual Edit & Styles Controls
const editModeToggleBtn = document.getElementById('editModeToggleBtn');
const editModeLabel = document.getElementById('editModeLabel');
const stylesMenuBtn = document.getElementById('stylesMenuBtn');
const stylesDropdownMenu = document.getElementById('stylesDropdownMenu');
const inlineTextEditor = document.getElementById('inlineTextEditor');
const elementActionPopover = document.getElementById('elementActionPopover');
const interactiveTooltip = document.getElementById('interactiveTooltip');

// DOM Elements - Viewport & Background Controls
const bgTransparentBtn = document.getElementById('bgTransparentBtn');
const bgWhiteBtn = document.getElementById('bgWhiteBtn');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const zoomResetBtn = document.getElementById('zoomResetBtn');
const zoomFitBtn = document.getElementById('zoomFitBtn');
const exportScaleSelect = document.getElementById('exportScaleSelect');

// DOM Elements - Exports
const downloadPngBtn = document.getElementById('downloadPngBtn');
const downloadJpegBtn = document.getElementById('downloadJpegBtn');
const downloadSvgBtn = document.getElementById('downloadSvgBtn');
const copyPngBtn = document.getElementById('copyPngBtn');
const copySvgBtn = document.getElementById('copySvgBtn');

// DOM Elements - Top Header
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
let mouseDownPos = { x: 0, y: 0, time: 0 };
let debounceTimer = null;
let abortController = null;

// Visual Interactive Edit State
let isVisualEditMode = true;
let activeEditingOldText = '';
let selectedElementInfo = null;

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
    closePopovers();
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
  closePopovers();

  if (!code) {
    diagramStage.innerHTML = '';
    currentSvg = '';
    emptyState.style.display = 'flex';
    errorBanner.style.display = 'none';
    statusText.textContent = 'Ready';
    statusDot.className = 'status-dot';
    return;
  }

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

    diagramStage.innerHTML = currentSvg;
    emptyState.style.display = 'none';
    loadingOverlay.style.display = 'none';
    errorBanner.style.display = 'none';

    statusDot.className = 'status-dot';
    statusText.textContent = `Rendered (${result.renderTime}ms)`;

    applyTransform();
    updateStylesMenuChecks();
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
// Visual Edit Mode Toggle & Styles Presets
// ============================================================================
function setVisualEditMode(enable) {
  isVisualEditMode = enable;
  if (isVisualEditMode) {
    previewViewport.classList.add('is-edit-mode');
    editModeToggleBtn.classList.add('btn-primary');
    editModeLabel.textContent = 'Visual Edit: ON';
    showToast('Visual Edit Mode ON: Click elements to customize, double-click to edit text.');
  } else {
    previewViewport.classList.remove('is-edit-mode');
    editModeToggleBtn.classList.remove('btn-primary');
    editModeLabel.textContent = 'Visual Edit: OFF';
    closePopovers();
  }
}

editModeToggleBtn.addEventListener('click', () => {
  setVisualEditMode(!isVisualEditMode);
});

// Styles presets menu
stylesMenuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = stylesDropdownMenu.style.display === 'block';
  if (isOpen) {
    stylesDropdownMenu.style.display = 'none';
  } else {
    updateStylesMenuChecks();
    stylesDropdownMenu.style.display = 'block';
  }
});

function updateStylesMenuChecks() {
  const code = codeEditor.value;
  const options = stylesDropdownMenu.querySelectorAll('.style-option-btn');
  options.forEach((btn) => {
    const param = btn.getAttribute('data-param');
    const val = btn.getAttribute('data-val');
    const active = hasSkinparam(code, param, val);
    if (active) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

stylesDropdownMenu.addEventListener('click', (e) => {
  const btn = e.target.closest('.style-option-btn');
  if (!btn) return;
  const param = btn.getAttribute('data-param');
  const val = btn.getAttribute('data-val');
  const currentlyActive = btn.classList.contains('active');

  const updatedCode = toggleSkinparamInUml(codeEditor.value, param, val, !currentlyActive);
  codeEditor.value = updatedCode;
  updateLineNumbers();
  localStorage.setItem('plantuml_saved_code', updatedCode);
  renderCurrentDiagram();
  updateStylesMenuChecks();
  showToast(`${!currentlyActive ? 'Enabled' : 'Disabled'} ${btn.textContent.trim()}`);
});

// ============================================================================
// Inline Text Editing (WYSIWYG on SVG)
// ============================================================================
function openInlineTextEditor(textElement) {
  if (!textElement) return;
  closePopovers();

  activeEditingOldText = textElement.textContent.trim();
  inlineTextEditor.value = activeEditingOldText;

  const textRect = textElement.getBoundingClientRect();
  const viewportRect = previewViewport.getBoundingClientRect();

  const left = textRect.left - viewportRect.left;
  const top = textRect.top - viewportRect.top;

  inlineTextEditor.style.left = `${Math.max(10, left - 4)}px`;
  inlineTextEditor.style.top = `${Math.max(10, top - 4)}px`;
  inlineTextEditor.style.width = `${Math.max(textRect.width + 24, 130)}px`;
  inlineTextEditor.style.height = `${Math.max(textRect.height + 8, 28)}px`;
  inlineTextEditor.style.display = 'block';

  inlineTextEditor.focus();
  inlineTextEditor.select();
}

function commitInlineEdit() {
  if (inlineTextEditor.style.display === 'none') return;
  const newText = inlineTextEditor.value.trim();
  inlineTextEditor.style.display = 'none';

  if (newText && newText !== activeEditingOldText) {
    const updatedCode = replaceTextInUml(codeEditor.value, activeEditingOldText, newText);
    if (updatedCode !== codeEditor.value) {
      codeEditor.value = updatedCode;
      updateLineNumbers();
      localStorage.setItem('plantuml_saved_code', updatedCode);
      renderCurrentDiagram();
      showToast(`Updated "${activeEditingOldText}" → "${newText}" in UML!`);
    }
  }
  activeEditingOldText = '';
}

function cancelInlineEdit() {
  inlineTextEditor.style.display = 'none';
  activeEditingOldText = '';
}

// IME-Safe Enter-to-Submit (modern-web-guidance: ime-safe-enter-submit)
inlineTextEditor.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    // Block submission if user is actively composing with an IME or keyCode is 229
    if (e.isComposing || e.keyCode === 229) {
      return;
    }
    commitInlineEdit();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    cancelInlineEdit();
  }
});

inlineTextEditor.addEventListener('blur', () => {
  commitInlineEdit();
});

// ============================================================================
// Interactive Element Inspector Popover
// ============================================================================
const GITHUB_PALETTE = [
  { name: 'Blue', hex: '#DDF4FF' },
  { name: 'Green', hex: '#DAFBE1' },
  { name: 'Yellow', hex: '#FFF8C5' },
  { name: 'Red', hex: '#FFEBE9' },
  { name: 'Purple', hex: '#FBEFFF' },
  { name: 'Orange', hex: '#FFDFB6' },
  { name: 'Gray', hex: '#F6F8FA' },
  { name: 'White', hex: '#FFFFFF' }
];

function openElementActionPopover(element, clientX, clientY) {
  closePopovers();
  selectedElementInfo = analyzeClickedElement(element);
  if (!selectedElementInfo) return;

  const viewportRect = previewViewport.getBoundingClientRect();
  const posX = Math.min(Math.max(10, clientX - viewportRect.left + 10), viewportRect.width - 230);
  const posY = Math.min(Math.max(10, clientY - viewportRect.top + 10), viewportRect.height - 200);

  const isArrow = selectedElementInfo.type === 'arrow';
  const name = selectedElementInfo.name;

  elementActionPopover.innerHTML = `
    <div class="popover-header">
      <span class="popover-title" title="${escapeHtml(name)}">${isArrow ? 'Arrow' : 'Box'}: <strong>${escapeHtml(name)}</strong></span>
      <button class="popover-close-btn" id="popoverCloseBtn" title="Close">×</button>
    </div>

    <div>
      <div class="popover-section-label">Color Fill</div>
      <div class="color-chips-row">
        ${GITHUB_PALETTE.map(c => `
          <button class="color-chip" data-color="${c.hex}" title="${c.name} (${c.hex})" style="background:${c.hex};"></button>
        `).join('')}
        <button class="color-chip" data-color="default" title="Clear / Default" style="background:transparent; display:flex; align-items:center; justify-content:center; font-size:10px; color:#656d76;">✕</button>
      </div>
    </div>

    <div class="popover-actions-row">
      <button class="popover-action-btn" id="popoverEditTextBtn" title="Edit text label">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        Edit Text
      </button>

      ${!isArrow ? `
        <button class="popover-action-btn" id="popoverAddNoteBtn" title="Add note to this element">
          + Note
        </button>
      ` : `
        <button class="popover-action-btn" data-arrow-style="solid" title="Solid Arrow (->)">→</button>
        <button class="popover-action-btn" data-arrow-style="dashed" title="Dashed Arrow (-->)">⇢</button>
        <button class="popover-action-btn" data-arrow-style="bidi" title="Bidirectional (<->)">↔</button>
      `}

      <button class="popover-action-btn danger" id="popoverDeleteBtn" title="Remove element from UML">
        Delete
      </button>
    </div>
  `;

  elementActionPopover.style.left = `${posX}px`;
  elementActionPopover.style.top = `${posY}px`;
  elementActionPopover.style.display = 'flex';

  // Wire up popover events
  document.getElementById('popoverCloseBtn').addEventListener('click', closePopovers);

  document.getElementById('popoverEditTextBtn').addEventListener('click', () => {
    const textEl = selectedElementInfo.textElement;
    closePopovers();
    if (textEl) {
      openInlineTextEditor(textEl);
    } else {
      const promptNew = prompt(`Edit text for "${name}":`, name);
      if (promptNew && promptNew.trim() && promptNew !== name) {
        const updated = replaceTextInUml(codeEditor.value, name, promptNew.trim());
        applyUmlCodeChange(updated, `Renamed "${name}" → "${promptNew.trim()}"`);
      }
    }
  });

  elementActionPopover.querySelectorAll('.color-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const color = chip.getAttribute('data-color');
      const isClear = color === 'default';
      let updated = '';

      if (isArrow) {
        updated = setArrowColorInUml(codeEditor.value, name, isClear ? 'default' : color);
      } else {
        updated = setElementColorInUml(codeEditor.value, name, isClear ? 'default' : color);
      }

      applyUmlCodeChange(updated, `Updated color for "${name}"`);
      closePopovers();
    });
  });

  const noteBtn = document.getElementById('popoverAddNoteBtn');
  if (noteBtn) {
    noteBtn.addEventListener('click', () => {
      const note = prompt(`Enter note for ${name}:`);
      if (note && note.trim()) {
        const updated = addNoteToElementInUml(codeEditor.value, name, note.trim());
        applyUmlCodeChange(updated, `Added note to "${name}"`);
        closePopovers();
      }
    });
  }

  elementActionPopover.querySelectorAll('[data-arrow-style]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const style = btn.getAttribute('data-arrow-style');
      const updated = setArrowStyleInUml(codeEditor.value, name, style);
      applyUmlCodeChange(updated, `Updated arrow style to ${style}`);
      closePopovers();
    });
  });

  document.getElementById('popoverDeleteBtn').addEventListener('click', () => {
    if (confirm(`Remove "${name}" from diagram?`)) {
      const lines = codeEditor.value.split('\n');
      const filtered = lines.filter(l => !l.includes(name));
      applyUmlCodeChange(filtered.join('\n'), `Removed "${name}"`);
      closePopovers();
    }
  });
}

function applyUmlCodeChange(newCode, toastMsg) {
  if (newCode !== codeEditor.value) {
    codeEditor.value = newCode;
    updateLineNumbers();
    localStorage.setItem('plantuml_saved_code', newCode);
    renderCurrentDiagram();
    if (toastMsg) showToast(toastMsg);
  }
}

function closePopovers() {
  elementActionPopover.style.display = 'none';
  stylesDropdownMenu.style.display = 'none';
  interactiveTooltip.style.display = 'none';
  selectedElementInfo = null;
}

// Analyze SVG element clicked to extract entity/arrow name and text
function analyzeClickedElement(el) {
  if (!el || el === diagramStage || el === previewViewport) return null;

  // 1. Clicked directly on a text node
  if (el.tagName && el.tagName.toLowerCase() === 'text') {
    const text = el.textContent.trim();
    if (!text || /^\d+$/.test(text)) {
      // If just autonumber digit, check sibling text
      const nextText = el.nextElementSibling;
      if (nextText && nextText.tagName.toLowerCase() === 'text') {
        return { type: 'arrow', name: nextText.textContent.trim(), textElement: nextText };
      }
    }
    // Check if line or polygon is near (arrow label)
    const parentG = el.closest('g');
    const hasLine = parentG && parentG.querySelector('line, polygon');
    return {
      type: hasLine ? 'arrow' : 'box',
      name: text,
      textElement: el
    };
  }

  // 2. Clicked on an arrow line or polygon
  if (el.tagName && (el.tagName.toLowerCase() === 'line' || el.tagName.toLowerCase() === 'polygon')) {
    const parent = el.closest('g') || diagramStage;
    const textEl = parent.querySelector('text');
    const name = textEl ? textEl.textContent.trim() : 'Arrow';
    return { type: 'arrow', name, textElement: textEl };
  }

  // 3. Clicked on a box, rect, ellipse, or path
  const entityG = el.closest('g[data-qualified-name], g.entity, g');
  if (entityG) {
    const qName = entityG.getAttribute('data-qualified-name');
    const title = entityG.querySelector('title');
    const textEl = entityG.querySelector('text');
    const name = qName || (title ? title.textContent.trim() : (textEl ? textEl.textContent.trim() : ''));
    if (name) {
      return { type: 'box', name, textElement: textEl };
    }
  }

  // 4. Sibling text detection for bare rects
  const prevOrNextText = el.previousElementSibling?.tagName === 'text'
    ? el.previousElementSibling
    : (el.nextElementSibling?.tagName === 'text' ? el.nextElementSibling : null);

  if (prevOrNextText) {
    return { type: 'box', name: prevOrNextText.textContent.trim(), textElement: prevOrNextText };
  }

  return null;
}

// ============================================================================
// Interactive SVG Viewport Handlers (Pan, Zoom, Click, Double-Click)
// ============================================================================
// Mouse hover tooltip
previewViewport.addEventListener('mousemove', (e) => {
  if (!isVisualEditMode || isDragging || inlineTextEditor.style.display === 'block') {
    interactiveTooltip.style.display = 'none';
    return;
  }

  const target = document.elementFromPoint(e.clientX, e.clientY);
  const info = analyzeClickedElement(target);

  if (info && info.name) {
    const viewportRect = previewViewport.getBoundingClientRect();
    interactiveTooltip.textContent = info.textElement
      ? `Double-click to edit "${info.name}" • Click for colors`
      : `Click to customize "${info.name}"`;
    interactiveTooltip.style.left = `${e.clientX - viewportRect.left}px`;
    interactiveTooltip.style.top = `${e.clientY - viewportRect.top}px`;
    interactiveTooltip.style.display = 'block';
  } else {
    interactiveTooltip.style.display = 'none';
  }
});

previewViewport.addEventListener('mouseleave', () => {
  interactiveTooltip.style.display = 'none';
});

// Distinguish pan-drag vs element click
previewViewport.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  // If clicking inside active popovers, don't drag
  if (e.target.closest('#elementActionPopover, #inlineTextEditor, #stylesDropdownMenu')) {
    return;
  }

  mouseDownPos = { x: e.clientX, y: e.clientY, time: Date.now() };
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

window.addEventListener('mouseup', (e) => {
  if (!isDragging) return;
  isDragging = false;
  previewViewport.classList.remove('is-dragging');

  // Check if this was a quick click rather than a pan drag
  const dist = Math.hypot(e.clientX - mouseDownPos.x, e.clientY - mouseDownPos.y);
  if (dist < 6 && isVisualEditMode) {
    // If clicking outside active popover, close it
    if (!e.target.closest('#elementActionPopover, #stylesDropdownMenu, #stylesMenuBtn')) {
      closePopovers();
    }

    const clickedEl = document.elementFromPoint(e.clientX, e.clientY);
    if (clickedEl && clickedEl.closest('#diagramStage')) {
      const info = analyzeClickedElement(clickedEl);
      if (info && info.name) {
        openElementActionPopover(clickedEl, e.clientX, e.clientY);
      }
    }
  }
});

// Double click directly launches inline text editor
previewViewport.addEventListener('dblclick', (e) => {
  if (!isVisualEditMode) return;
  const clickedEl = document.elementFromPoint(e.clientX, e.clientY);
  if (!clickedEl || !clickedEl.closest('#diagramStage')) return;

  const info = analyzeClickedElement(clickedEl);
  if (info && info.textElement) {
    e.preventDefault();
    openInlineTextEditor(info.textElement);
  }
});

// Close floating menus when clicking document
document.addEventListener('click', (e) => {
  if (!e.target.closest('#stylesMenuBtn, #stylesDropdownMenu')) {
    stylesDropdownMenu.style.display = 'none';
  }
});

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
  closePopovers();
}

function resetZoom() {
  zoom = 1.0;
  pan = { x: 0, y: 0 };
  applyTransform();
  closePopovers();
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
    closePopovers();
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
    codeEditor.value = TEMPLATES.sequence.code;
    updateLineNumbers();
    renderCurrentDiagram();
  }
}

// Kick off initialization
initEditorContent();
