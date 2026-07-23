# Mocksy

Free alternative to Shots-style mockup editor with no subscriptions.

Reference inspiration: [shots.so](https://shots.so/), [PostSpark device mockup](https://postspark.app/device-mockup).

## Features

- Multi-panel editor layout (controls, canvas preview, templates, layers, annotations, projects)
- Undo / redo of every edit (`⌘Z` / `⇧⌘Z`), with keyboard shortcuts and history coalescing (rapid slider drags collapse into one step)
- Background presets (transparent, solid swatches, gradient palettes, background image with blur)
- "Auto from media" — generates a gradient from the loaded media's dominant colors
- Watermark toggle with text, position (4 corners), and size controls
- Mockup frames: `none`, `iphone`, `iphone15`, `iphone16pro`, `desktop`, `tablet`, `watch` (circular)
- Overlay phone skins (iphone15/16pro) adopt their native portrait aspect ratio so the SVG is never stretched
- Mockup styles: default, glass (light/dark), outline — with shadows and corner radius
- Scene style presets: Dark Studio, Soft Glass, Bold Gradient, Minimal, Warm
- Animation presets: zoom in, zoom out, parallax
- Aspect ratio presets: 16:9, 4:3, 3:2, 1:1, 9:16
- Zoom slider (0.8–1.5×), media position X/Y sliders, shadow opacity, and corner radius controls
- Per-layer media Fill/Fit toggle (contain vs cover) for image/video layers
- Layer management: add, duplicate, hide/show, reorder, remove; disabled when only 1 layer remains
- Text, arrow, and rectangle annotations with color and stroke-width controls; draggable and resizable on canvas
- The preview canvas keeps the chosen scene aspect ratio (contain), so portrait ratios like 9/16 fit the viewport without stretching or page scroll
- Drag-to-pan the canvas; pinch-to-zoom on touch devices
- Drag-and-drop or file picker to load image/video media; Clear media button
- Unsupported file types are rejected with an inline error instead of a blank canvas
- Video options (muted/loop/autoplay, poster, timeline, trim, quality) collapse into a togglable accordion
- Video trim shown as a single dual-range control with a visible selected window
- Export quality selector for MP4/GIF: Low, Medium, High
- Unified export dialog for PNG/MP4/GIF with size selector (1×, 2×, 4×)
- PNG export (matches the on-screen preview pixel-for-pixel) with explicit scale selector
- PNG copy to clipboard (`⇧⌘C`)
- MP4 export via in-browser recording (MediaRecorder) + FFmpeg (WebM → MP4)
- GIF export for animated stills (with palette generation for accurate colors)
- Animated still-image exports run for a visible 3s (zoom/parallax) instead of a 0.2s blink
- MP4 export attaches the canvas to the DOM while recording so headless/background tabs capture frames reliably
- Project management: create, switch, rename, duplicate, import, export, and delete projects (persisted in localStorage)
- Reset confirmation modal (clears the current mockup and returns to the default scene)
- Opens with an offline demo image so the canvas is never empty
- Autosave to localStorage (with a Saved indicator) plus explicit Save and Reset
- Share URL that encodes the full scene as base64 JSON (demo media stripped to keep URLs short); invalid/old payloads are normalized, not trusted blindly
- Error boundary with "Try again" recovery (your last saved scene is still safe in this browser)
- No auth, no paywall, no subscription gates

## Stack

- Next.js 15 + TypeScript
- React 19
- Zustand for editor state
- Tailwind CSS v4
- @ffmpeg/ffmpeg for client-side MP4 conversion
- Vitest (unit) + Playwright (e2e) test setup

## Run

```bash
npm install
npm run dev
```

## Tests

```bash
npm run test        # unit tests (Vitest)
npm run test:e2e    # end-to-end tests (Playwright; needs a browser installed)
```

## Project layout

- `app/` — Next.js app router entry (`layout.tsx`, `page.tsx`, `error.tsx`)
- `components/editor/` — `EditorShell`, `ControlPanel`, `PreviewCanvas`, `TemplatesPanel`, `LayersPanel`, `AnnotationsPanel`, `ExportDialog`, `ShortcutsDialog`, `ProjectsPanel`, `VideoOptions`, `VideoTrimControl`
- `lib/state/` — Zustand stores (`editorStore`, `projectsStore`), scene normalization (`normalizeScene`), share-URL (de)serialization (`shareState`), project file I/O (`projectFile`)
- `lib/render/` — frame specs (`frames`), media type detection (`mediaKind`), CSS/canvas geometry (`mockupRenderer`), video timeline (`videoComposer`)
- `lib/export/` — PNG (`exportImage`), MP4/GIF (`exportVideo`), canvas mockup rendering (`renderMockup`)
- `lib/media/` — file loading (`loadFile`), built-in demo image (`demoMedia`), dominant-color palette extraction (`palette`)
- `lib/presets/` — background swatches and scene style presets (`presets`)
- `lib/types/` — TypeScript type definitions (`editor`)
- `public/devices/` — SVG device skins for overlay frames
- `tests/unit/`, `tests/e2e/` — Vitest and Playwright suites

## Responsive layout

The editor locks to the viewport height (`100dvh`) and never scrolls the page:
the preview stays fully visible at any aspect ratio (including portrait 9/16),
and the side panels scroll internally when they overflow. Below 980px wide the
multi-panel editor (controls / preview / templates / layers / annotations /
projects) collapses to a single stacked column so it stays usable on tablets
and phones.

The preview canvas uses container-query units (`cqw`/`cqh`) for aspect-ratio-based
sizing, `touch-action: none` to prevent browser zoom on pinch, and supports
pinch-to-zoom and drag-to-pan via pointer events.

The UI uses a dark theme with glass panels (`backdrop-filter: blur(14px)`)
throughout. An error boundary with a "Try again" button recovers from crashes
without losing your last saved scene.

## Keyboard shortcuts

Press `?` (or the **Shortcuts** button) for an in-app cheat sheet. `⌘`
is Cmd on macOS and Ctrl on Windows/Linux.

| Shortcut          | Action                                              |
| ----------------- | --------------------------------------------------- |
| `?`               | Open keyboard shortcuts cheat sheet                 |
| `⌘Z` / `Ctrl+Z`   | Undo                                                |
| `⇧⌘Z` / `Ctrl+Y`  | Redo                                                |
| `⌘S` / `Ctrl+S`   | Save to localStorage                                |
| `⌘E` / `Ctrl+E`   | Export PNG                                          |
| `⇧⌘C` / `Ctrl+⇧C` | Copy PNG to clipboard                               |
| `⇧⌘E` / `Ctrl+⇧E` | Export MP4                                          |
| `⇧⌘G` / `Ctrl+⇧G` | Export GIF                                          |
| `⌘D` / `Ctrl+D`   | Duplicate active layer (ignored while typing)       |
| `⌘↑` / `⌘↓`       | Move active layer up / down (ignored while typing)  |
| `⌘[` / `⌘]`       | Select previous / next layer (ignored while typing) |
| `R`               | Reset to defaults (ignored while typing in a field) |
