# PlantUML Studio 🎨

> A fast, clean, **100% adware-free** PlantUML web editor. Paste your UML code, see the diagram rendered underneath, and download crisp PNG or JPEG images with transparent or white backgrounds.

[![Deploy to GitHub Pages](https://github.com/bradleyjoejoseph/plantuml-editor/actions/workflows/deploy.yml/badge.svg)](https://github.com/bradleyjoejoseph/plantuml-editor/actions/workflows/deploy.yml)
[![Adware Free](https://img.shields.io/badge/Adware-None-brightgreen)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 🌟 Highlights & Features

- **🚫 100% Ad-Free & Distraction-Free**: No ads, no popups, no trackers, no sponsored bloat. Just a clean, lightning-fast workspace.
- **👇 Generous Preview Underneath**: Default stacked layout puts your code editor on top and the high-fidelity diagram right underneath. Also supports side-by-side split layout for ultrawide displays.
- **🎨 Transparent or White Background**:
  - **Transparent Mode**: Generates transparent diagrams with an interactive checkerboard preview. PNG exports have full alpha transparency.
  - **White Mode**: Generates diagrams on a solid white canvas with crisp borders.
- **💾 PNG & JPEG Export**:
  - **PNG Download**: Choice of Transparent or White background.
  - **JPEG Download**: Crisp solid white background for documents and slides.
  - **SVG Download**: Scalable vector output for Figma, Illustrator, or print.
  - **Multi-Resolution Scale**: 1x standard, 2x Retina (recommended), or 3x High-Res Print.
- **📋 1-Click Clipboard Copy**:
  - **Copy PNG**: Copies raster image directly to clipboard for instant pasting into Slack, Notion, Google Docs, Word, or Figma (`⌘C`/`Ctrl+C` workflow).
  - **Copy SVG**: Copies raw SVG markup with one click.
- **⚡ Dual-Engine Rendering**:
  - Primary: High-speed Kroki POST API (no 2KB URL length limit, supports complex architectures).
  - Secondary Fallback: Official PlantUML server with custom 64-bit deflate encoder.
  - Instant caching: Repeated edits render in 0ms.
- **📂 10+ Built-In Templates**:
  - Sequence Diagram (Auth Flow)
  - Class Diagram (Domain Model & Inheritance)
  - Activity Diagram / Flowchart
  - State Machine
  - Component Architecture (Cloud & Microservices)
  - Use Case Diagram
  - Mind Map
  - C4 Architecture Context
  - JSON / Data Tree Visualizer
  - Gantt Chart (Project Schedule)
- **🔍 Pan & Zoom Controls**: Mouse drag to pan, mouse wheel or buttons to zoom, 100% reset, and auto-fit to screen.
- **🔗 Shareable Bookmarks**: Share diagrams with full state encoded in URL hash (`#uml=...`).
- **🐙 GitHub Light Color Scheme**: Clean, distraction-free aesthetic based on GitHub's Primer design system.

---

## 🚀 Live Demo

- **GitHub Pages**: [https://bradleyjoejoseph.github.io/plantuml-editor/](https://bradleyjoejoseph.github.io/plantuml-editor/)

---

## 🛠️ Local Development

### Prerequisites
- Node.js (v18+)
- npm

### Setup
```bash
# Clone the repository
git clone https://github.com/bradleyjoejoseph/plantuml-editor.git
cd plantuml-editor

# Install dependencies
npm install

# Start local development server
npm run dev
```

### Production Build
```bash
npm run build
npm run preview
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + Enter` / `⌘ + Enter` | Render diagram immediately |
| `Tab` | Indent 2 spaces (preserves focus) |
| `Shift + Tab` | Unindent 2 spaces |
| `Enter` | Preserves indentation level on new line |
| `Esc` | Close cheat sheet / dialog |

---

## 📄 License

MIT License © 2026 [Bradley Joseph](https://github.com/bradleyjoejoseph)
