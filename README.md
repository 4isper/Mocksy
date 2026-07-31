# Mocksy

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Free browser-based mockup editor. No auth, no paywall, no subscriptions.

Inspired by [shots.so](https://shots.so/) · [PostSpark device mockup](https://postspark.app/device-mockup)

---

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start editing.

---

## Features

### Editor

- Multi-panel layout: controls, canvas preview, layers, annotations, templates, projects
- Undo/redo (`⌘Z` / `⇧⌘Z`) with keyboard shortcuts; rapid slider drags coalesce into one step
- Command palette (`⌘K`) for keyboard-driven access to every action
- Light/dark/system theme toggle in the toolbar
- Error boundary with recovery (your saved scene stays safe)
- Save / unsaved status indicator with 500ms autosave debounce
- Multi-frame grid layout (2–4 frames, horizontal or vertical)
- Per-frame device select, position (X/Y/scale), and layer assignment

### Mockup frames

| Frame | Type | Notes |
|-------|------|-------|
| `none` | CSS | Raw rounded rectangle |
| `iphone` | CSS | Classic phone shape |
| `iphone15` | Overlay | SVG skin, native portrait ratio |
| `iphone16pro` | Overlay | SVG skin, native portrait ratio |
| `pixel8pro` | Overlay | SVG skin, native portrait ratio |
| `galaxy24` | Overlay | SVG skin, native portrait ratio |
| `ipad` | Overlay | iPad Pro skin, native portrait ratio |
| `desktop` | CSS | Wide landscape monitor |
| `tablet` | CSS | Tablet proportions |
| `macbook` | Overlay | MacBook Pro skin, landscape |
| `imac` | Overlay | iMac skin with stand |
| `watch` | CSS | Circular face |

- Style presets: default, glass (light/dark), outline — with configurable shadow opacity and corner radius
- Scene style presets: Dark Studio, Soft Glass, Bold Gradient, Minimal, Warm
- Aspect ratios: 16:9, 4:3, 3:2, 1:1, 9:16

### Media & layers

- Image and video support (drag-drop or file picker)
- Zoom (0.8–1.5x), position X/Y, and fill/fit toggle
- Layer management: add, duplicate, hide/show, reorder, remove
- Unsupported file types rejected with inline error
- Opens with an offline demo image

### Annotations

- Text, arrow, and rectangle annotations
- Color picker, stroke-width, and font family selection
- Draggable and resizable on canvas

### Video

- Mute / loop / autoplay toggles
- Poster frame selector
- Timeline scrubber
- Trim with dual-range control
- Export quality: Low, Medium, High

### Background

- Solid colors, gradient presets, transparent mode
- Background image upload with blur control
- Auto from media — generates a gradient from the loaded media's dominant colors

### Watermark

- Toggle on/off
- Custom text
- 4-corner positioning
- Size control (8–64px)

### Export

| Format | Scale | Notes |
|--------|-------|-------|
| PNG | 1x, 2x, 4x | Pixel-for-pixel match with preview; copy to clipboard |
| WebP | 1x, 2x, 4x | Static WebP at ~half the PNG size |
| SVG | — | Vector export: media, skins, annotations and watermark embedded as data URLs |
| HTML | — | Self-contained snippet: live CSS mockup (animation preserved) or embedded raster for multi-frame scenes |
| MP4 | 1x, 2x, 4x | In-browser MediaRecorder + FFmpeg WebM→MP4 |
| WebM | 1x, 2x, 4x | Direct MediaRecorder capture, no encode — fastest, best quality |
| GIF | 1x, 2x, 4x | Palette generation for accurate colors |
| Animated WebP | 1x, 2x, 4x | FFmpeg libwebp_anim at 15fps — fraction of the MP4/GIF size |

- Animated exports run for a visible 3s (zoom/parallax) instead of a blink
- MP4 attaches the canvas to the DOM during recording for reliable frame capture in background tabs

### Projects

- Create, switch, rename, duplicate, import, export, delete
- All projects persisted to localStorage
- Share URL encodes the full scene as base64 JSON (demo media stripped); invalid payloads are normalized
- Reset confirmation modal before clearing

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 |
| UI | React 19 |
| State | Zustand |
| Styling | Tailwind CSS v4 |
| Video | @ffmpeg/ffmpeg (client-side WebM→MP4 / GIF / WebP) |
| Unit tests | Vitest (550 tests, 36 files) |
| E2E tests | Playwright |
| Language | TypeScript (strict) |

---

## Project layout

```
app/                    Next.js router (layout, page, error boundary)
components/editor/      16 React components
  EditorShell            Main orchestrator with keyboard shortcuts
  ControlPanel           Frame, style, media, background, watermark controls
  PreviewCanvas          Canvas renderer with drag/pan/pinch/annotations
  CommandPalette         ⌘K action search palette
  LayersPanel            Layer list with hide/reorder/remove
  AnnotationsPanel       Annotation CRUD and editor
  TemplatesPanel         Scene style preset gallery
  ProjectsPanel          Project CRUD
  ExportDialog           PNG/WebP/SVG/HTML/MP4/WebM/GIF/WebP export modal
  ShortcutsDialog        Keyboard shortcuts cheat sheet
  VideoOptions           Video playback + trim + quality
  VideoTrimControl       Dual-range trim slider
  RightPanel             Tabbed panel (templates / layers / annotations / projects)
  ErrorBoundary          Crash recovery with retry
  ThemeProvider          Light/dark/system theme
  LocaleSwitcher         EN / RU toggle
lib/
  state/                 Zustand stores + normalization + share URL
  render/                Frame specs, CSS geometry, video timeline
  export/                PNG/WebP, SVG/HTML, MP4/WebM/GIF/WebP, canvas rendering
  media/                 File loading, demo image, palette extraction
  presets/               Background swatches, scene style presets
  types/                 TypeScript interfaces
public/devices/          SVG device skins for overlay frames
tests/
  unit/                  Pure function and store tests
  components/            Component tests (16 components)
  e2e/                   Playwright end-to-end tests
```

---

## Scripts

```bash
npm run typecheck       # TypeScript strict check
npm run test            # Vitest (501 tests, 34 files)
npm run test:coverage   # Unit tests with coverage report
npm run test:e2e        # Playwright (requires browser install)
npm run lint            # ESLint (Next.js core-web-vitals)
```

---

## Keyboard shortcuts

Press `?` in the editor (or click the Shortcuts button) for the in-app cheat sheet. `⌘` is Cmd on macOS, Ctrl on Windows/Linux.

| Shortcut | Action |
|----------|--------|
| `?` | Open shortcuts cheat sheet |
| `⌘K` / `Ctrl+K` | Open command palette |
| `⌘Z` / `Ctrl+Z` | Undo |
| `⇧⌘Z` / `Ctrl+Y` | Redo |
| `⌘S` / `Ctrl+S` | Save to localStorage |
| `⌘E` / `Ctrl+E` | Export PNG |
| `⇧⌘C` / `Ctrl+⇧C` | Copy PNG to clipboard |
| `⇧⌘E` / `Ctrl+⇧E` | Export MP4 |
| `⇧⌘G` / `Ctrl+⇧G` | Export GIF |
| `⌘D` / `Ctrl+D` | Duplicate active layer |
| `⌘↑` / `⌘↓` | Move active layer up/down |
| `⌘[` / `⌘]` | Select previous / next layer |
| `R` | Reset to defaults |

All layer shortcuts are ignored while typing in a text field.

---

## Responsive design

The editor locks to the viewport height (`100dvh`) and never scrolls as a page. The preview stays fully visible at any aspect ratio (including portrait 9/16). Side panels scroll internally when content overflows.

Below 980px wide the layout collapses to a single stacked column for tablets and phones.

The preview canvas uses:
- Container-query units (`cqw`/`cqh`) for aspect-ratio sizing
- `touch-action: none` to prevent browser zoom on pinch
- Pointer events for drag-to-pan and pinch-to-zoom
