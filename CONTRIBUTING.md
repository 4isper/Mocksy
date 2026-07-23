# Contributing to Mocksy

Thanks for your interest in contributing! This document covers the essentials:
getting started, project structure, adding new features, testing, and code style.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

## Scripts

| Command              | What it does                                |
| -------------------- | ------------------------------------------- |
| `npm run dev`        | Start the Next.js dev server                |
| `npm run build`      | Production build                            |
| `npm run lint`       | Run ESLint (Next.js core-web-vitals config) |
| `npm run typecheck`  | Run `tsc --noEmit`                          |
| `npm run test`       | Run unit tests (Vitest)                     |
| `npm run test:watch` | Run unit tests in watch mode                |
| `npm run test:e2e`   | Run Playwright e2e tests                    |

## Project structure

```
app/                      Next.js app router (layout, page, error boundary)
components/editor/        Editor UI components (11 components)
lib/
  state/                  Zustand stores, scene normalization, share URL, projects
  render/                 Frame specs, CSS/canvas geometry, video timeline
  export/                 PNG, MP4/GIF export, canvas mockup rendering
  media/                  File loading, demo image, palette extraction
  presets/                Background swatches and scene style presets
  types/                  TypeScript type definitions
public/devices/           SVG device skins for overlay frames
tests/unit/               Vitest unit tests
tests/e2e/                Playwright e2e tests
```

### Path alias

The project uses `@/` as an alias for the project root (configured in
`tsconfig.json` and `vitest.config.ts`). Import like:

```ts
import { normalizeScene } from "@/lib/state/normalizeScene";
```

## Architecture overview

- **State**: `lib/state/editorStore.ts` holds the scene, layer list, annotations,
  video options, and non-scene UI state (export scale, loading flag, palette).
  History is managed with a 100-entry limit and 400ms coalescing for slider drags.
  `projectsStore.ts` manages project CRUD (localStorage persistence).
- **Rendering**: `lib/render/mockupRenderer.ts` builds CSS for the live preview.
  `lib/render/renderMockup.ts` renders the same scene onto a 2D canvas for PNG/MP4/GIF
  export. `lib/render/frames.ts` defines frame specs; `videoComposer.ts` builds
  animation keyframes.
- **Export**: `lib/export/exportImage.ts` handles PNG (download + clipboard).
  `lib/export/exportVideo.ts` handles MP4/GIF via MediaRecorder + FFmpeg.
- **Media**: `lib/media/loadFile.ts` loads files as data URLs (survives localStorage
  round-trip and embeds in share URLs). `palette.ts` extracts dominant colors.

## Adding a new feature

### New mockup frame

1. Add a `FrameSpec` entry to `FRAME_SPECS` in `lib/render/frames.ts`.
2. Add the frame key to `FRAME_ORDER` (controls display order in the UI).
3. If it's an overlay frame, add an SVG to `public/devices/` and set `isOverlay: true`
   with the correct `asset` path and `cutout` (x, y, w, h, rx).
4. Add a test case to `tests/unit/frames.test.ts`.

### New style preset

1. Add the new value to the `StylePreset` type in `lib/types/editor.ts`.
2. Add it to the `STYLE_PRESETS` array in `lib/state/normalizeScene.ts`.
3. Handle the new value in `buildSceneCss` in `lib/render/mockupRenderer.ts` (CSS preview).
4. Handle the new value in `renderMockupToCanvas` in `lib/export/renderMockup.ts` (canvas export).
5. Add a test case to `tests/unit/normalizeScene.test.ts`.

### New animation preset

1. Add the preset to `ANIMATION_PRESETS` in `lib/render/frames.ts`.
2. Add keyframe generation in `buildVideoTimeline` in `lib/render/videoComposer.ts`.
3. Add a test case to `tests/unit/videoComposer.test.ts`.

### New scene style preset

1. Add an entry to `sceneStylePresets` in `lib/presets/presets.ts`.
2. Add a test case to `tests/unit/presets.test.ts`.

### New background preset

1. Add an entry to `backgroundPresets` in `lib/presets/presets.ts`.
2. Add a test case to `tests/unit/presets.test.ts`.

## Testing

### Unit tests (Vitest)

Unit tests live in `tests/unit/`. Each test file mirrors the module it tests:

```
tests/unit/
  editorStore.test.ts
  normalizeScene.test.ts
  frames.test.ts
  mockupRenderer.test.ts
  exportImage.test.ts
  exportVideo.test.ts
  videoComposer.test.ts
  palette.test.ts
  presets.test.ts
  shareState.test.ts
  projectsStore.test.ts
  loadFile.test.ts
  mediaKind.test.ts
  renderMockup.test.ts
  demoMedia.test.ts
```

Run them with:

```bash
npm run test
```

### E2e tests (Playwright)

E2e tests live in `tests/e2e/`. They require a browser to be installed:

```bash
npx playwright install
npm run test:e2e
```

### Writing tests

- Use Vitest's `describe` / `it` / `expect` pattern (see existing tests for style).
- Import modules via the `@/` alias.
- For functions that touch `localStorage` or browser APIs, mock them with
  `vi.stubGlobal` or `vi.stubEnv` as needed.
- Pure functions (normalization, frame specs, video timeline, palette) should
  have straightforward unit tests with no mocks.

## Code style

- **Lint**: `npm run lint` (ESLint with Next.js core-web-vitals config).
- **Types**: `npm run typecheck` — fix all type errors before submitting.
- **Formatting**: The project uses Prettier-style formatting (2-space indent,
  double quotes, semicolons). Run `npx prettier --write .` if available.
- **Commits**: Use [Conventional Commits](https://www.conventionalcommits.org/):
  `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.

## Pull requests

1. Fork the repo and create a branch from `dev`.
2. Make your changes with tests.
3. Ensure `npm run lint` and `npm run typecheck` pass.
4. Ensure `npm run test` passes.
5. Open a PR against `dev` with a clear description of the change.
