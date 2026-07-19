# Mocksy

Free alternative to Shots-style mockup editor with no subscriptions.

Reference inspiration: [shots.so](https://shots.so/), [PostSpark device mockup](https://postspark.app/device-mockup).

## Features

- 3-panel editor layout (controls, canvas preview, templates)
- Undo / redo of every edit (`⌘Z` / `⇧⌘Z`), with keyboard shortcuts
- Background presets (transparent, solid swatches, gradient palettes)
- Mockup frames: `none`, `iphone`, `iphone15`, `iphone16pro`, `desktop`, `tablet`, `watch` (circular)
- Mockup styles: default, glass (light/dark), outline — with shadows and corner radius
- Preset templates and animation presets (zoom in/out, parallax)
- Drag-and-drop or file picker to load image/video media; Clear media button
- Video trim shown as a single dual-range control with a visible selected window
- PNG export (matches the on-screen preview pixel-for-pixel)
- MP4 export via in-browser recording (MediaRecorder) + FFmpeg (WebM → MP4)
- Animated still-image exports run for a visible 3s (zoom/parallax) instead of a 0.2s blink
- Opens with an offline demo image so the canvas is never empty
- Autosave to localStorage (with a Saved indicator) plus explicit Save and Reset
- Share URL that encodes the full scene; invalid/old payloads are normalized, not trusted blindly
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

- `app/` — Next.js app router entry (`layout.tsx`, `page.tsx`)
- `components/editor/` — `EditorShell`, `ControlPanel`, `PreviewCanvas`, `TemplatesPanel`
- `lib/state/` — Zustand store (`editorStore`), scene normalization, share-URL (de)serialization
- `lib/render/` — frame specs, CSS/canvas geometry (`mockupRenderer`, `renderMockup`), video timeline
- `lib/export/` — PNG (`exportImage`) and MP4 (`exportVideo`) pipelines
- `lib/media/` — file loading and the built-in demo image
- `public/devices/` — SVG device skins for overlay frames
- `tests/unit/`, `tests/e2e/` — Vitest and Playwright suites

## Responsive layout

The three-panel editor (controls / preview / templates) collapses to a single
stacked column below 900px wide, so the editor stays usable on tablets and phones.

## Keyboard shortcuts

| Shortcut         | Action                                              |
| ---------------- | --------------------------------------------------- |
| `⌘Z` / `Ctrl+Z`  | Undo                                                |
| `⇧⌘Z` / `Ctrl+Y` | Redo                                                |
| `⌘S` / `Ctrl+S`  | Save to localStorage                                |
| `⌘E` / `Ctrl+E`  | Export PNG                                          |
| `R`              | Reset to defaults (ignored while typing in a field) |
