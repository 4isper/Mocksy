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
| `npm run test:vrt`   | Visual regression tests via Playwright      |
| `npm run i18n:sync`  | Sync translations across 57 locales         |
| `npm run i18n:report`| Report untranslated keys per locale          |

## Project structure

```
app/                        Next.js app router ([locale]/layout, page, error boundary)
components/editor/          57 React components (EditorShell, ControlPanel, PreviewCanvas, ...)
  sections/                 6 control-panel sub-sections (Media, Text, Frame, Animation, Position, Filters)
i18n/                       Locale request config + canonical locale list
lib/
  state/                    Zustand stores (editorStore, projectsStore, themeStore), normalization, share URL
  render/                   Frame specs, CSS/canvas geometry, video timeline, canvas drawing
  export/                   PNG/SVG/HTML/MP4-GIF export, canvas rendering, filename helpers
  commands/                 Command-palette command factories (per feature area)
  media/                    File loading, demo image, palette extraction, IndexedDB media store
  presets/                  Background swatches, scene style presets
  hooks/                    Client hooks (commands, focus trap, frame transform, scene palette)
  search/                   Frame search utilities
  shortcuts/                Keyboard shortcut definitions, config, remapping store
  types/                    TypeScript interfaces
  utils/                    Utility functions
messages/                   57 locale JSON files (en.json is the source of truth)
public/devices/             SVG device skins for overlay frames
tests/unit/                 Vitest unit tests (mirrors lib/ structure)
tests/components/           Vitest + Testing Library component tests
tests/e2e/                  Playwright e2e tests (editor, UX, visual regression, a11y)
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
  `lib/export/exportSvg.ts` handles SVG export and clipboard copy.
  `lib/export/exportHtml.ts` handles HTML export and clipboard copy.
  `lib/export/exportVideo.ts` handles MP4/GIF via MediaRecorder + FFmpeg.
- **Media**: `lib/media/loadFile.ts` loads files as data URLs (survives localStorage
  round-trip and embeds in share URLs). `palette.ts` extracts dominant colors.
  `idbMediaStore.ts` offloads large media to IndexedDB.

## i18n (next-intl)

- `next-intl` v4 is used for internationalization.
- 57 locales live in `messages/*.json`. Add new keys to `messages/en.json` (and
  translate in `messages/ru.json`), then run `npm run i18n:sync` to backfill the
  English fallback into every other locale.
- All user-facing strings must be in message files, never hardcoded in JSX.
- Use `useTranslations(namespace)` in client components.

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
4. Handle the new value in `renderMockupToCanvas` in `lib/render/renderMockup.ts` (canvas export).
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

### New layout preset

1. Add value to `LayoutPreset` in `lib/types/editor.ts`.
2. Add key to `LAYOUT_PRESETS` in `lib/state/editorHelpers.ts`.
3. Add layout handler in `buildAutoLayout` (`lib/state/editorHelpers.ts`).
4. Add translation keys in `messages/en.json` and `messages/ru.json`.
5. Add button to the layout section in `ControlPanel.tsx`.
6. Add tests to `tests/unit/autoLayout.test.ts`.

## Testing

### Unit tests (Vitest)

Unit tests live in `tests/unit/`. Each test file mirrors the module it tests.
Run them with:

```bash
npm run test
```

### Component tests (Vitest + Testing Library)

Component tests live in `tests/components/`. They test React components in isolation:

```bash
npm run test -- --dir tests/components
```

### E2e tests (Playwright)

E2e tests live in `tests/e2e/`. They require a browser to be installed:

```bash
npx playwright install
npm run test:e2e
```

### Visual regression tests

```bash
npm run test:vrt              # Run visual regression tests
npm run test:vrt:update       # Update baselines
```

### Writing tests

- Use Vitest's `describe` / `it` / `expect` pattern (see existing tests for style).
- Import modules via the `@/` alias.
- For functions that touch `localStorage` or browser APIs, mock them with
  `vi.stubGlobal` or `vi.stubEnv` as needed.
- Pure functions (normalization, frame specs, video timeline, palette) should
  have straightforward unit tests with no mocks.
- All new features must include corresponding tests.

## Code style

- **Lint**: `npm run lint` (ESLint with Next.js core-web-vitals config).
- **Types**: `npm run typecheck` — fix all type errors before submitting.
- **Formatting**: 2-space indent, double quotes, semicolons.
- **Commits**: Use [Conventional Commits](https://www.conventionalcommits.org/):
  `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.

## Pull requests

1. Fork the repo and create a branch from `dev`.
2. Make your changes with tests.
3. Ensure `npm run lint` and `npm run typecheck` pass.
4. Ensure `npm run test` passes.
5. Open a PR against `dev` with a clear description of the change.
