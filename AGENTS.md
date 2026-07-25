# Mocksy — Agent Guide

## Project overview

Free browser-based mockup editor (Next.js 15 + React 19 + TypeScript). All media is data URLs; state lives in `localStorage`. No auth, no backend.

## i18n (next-intl)

- `next-intl` v4 is used for internationalization.
- Locales live in `messages/en.json` and `messages/ru.json`.
- Routing is file-based: `app/[locale]/` — middleware detects locale from cookie/header, defaults to `en`.
- Use `useTranslations(namespace)` in client components; `getMessages()` in server components/layouts.
- All user-facing strings must be in message files, never hardcoded in JSX.
- Translation keys follow dot-notation namespaces: `editor.frame`, `export.png`, `shortcuts.undo`, etc.
- `LocaleSwitcher` component (`components/editor/LocaleSwitcher.tsx`) toggles EN/РУС in the toolbar.

## Key conventions

### Path alias

`@/` maps to the project root (configured in `tsconfig.json` and `vitest.config.ts`). Always use `@/lib/...` imports, never relative paths above one level.

### Adding a new mockup frame

1. Add `FrameSpec` entry to `FRAME_SPECS` in `lib/render/frames.ts`.
2. Add the key to `FRAME_ORDER` in the same file (controls UI order).
3. If overlay, add SVG to `public/devices/` and set `isOverlay: true` with `asset` path and `cutout`.
4. Add a test to `tests/unit/frames.test.ts`.

### Adding a style preset

1. Add value to `StylePreset` in `lib/types/editor.ts`.
2. Add to `STYLE_PRESETS` in `lib/state/normalizeScene.ts`.
3. Handle in `buildSceneCss` (`lib/render/mockupRenderer.ts`) and `renderMockupToCanvas` (`lib/export/renderMockup.ts`).
4. Add test to `tests/unit/normalizeScene.test.ts`.

### Adding an animation preset

1. Add to `ANIMATION_PRESETS` in `lib/render/frames.ts`.
2. Add keyframe generation in `buildVideoTimeline` (`lib/render/videoComposer.ts`).
3. Add test to `tests/unit/videoComposer.test.ts`.

### Adding a scene style or background preset

1. Add entry to `sceneStylePresets` or `backgroundPresets` in `lib/presets/presets.ts`.
2. Add test to `tests/unit/presets.test.ts`.

## State management

- **`editorStore.ts`** — scene, layers, annotations, undo/redo (`pushHistory` with 100-entry limit, 400ms slider-drag coalescing). UI-only state (`exportScale`, `isMediaLoading`, `scenePalette`, `selectedAnnotationId`) lives **outside** `scene` so it doesn't pollute undo history or share URLs.
- **`projectsStore.ts`** — project CRUD, localStorage persistence.
- **`themeStore.ts`** — light/dark/system theme with persisted preference.
- Helpers in `lib/state/editorHelpers.ts`: `activeLayer`, `patchActive`, `pushHistory`, `makeAnnotation`, `makeDemoLayer`, `nextLayerId`, `activePosterTime`.

## Rendering pipeline

- **Live preview**: `lib/render/mockupRenderer.ts` → CSS.
- **Canvas export**: `lib/export/renderMockup.ts` + `lib/render/renderMockup.ts` → 2D canvas.
- **Video export**: `lib/render/videoComposer.ts` → keyframes → `MediaRecorder` + `@ffmpeg/ffmpeg` for WebM→MP4.

## Export

- `lib/export/exportImage.ts` — PNG (download + clipboard), scale 1×/2×/4×.
- `lib/export/exportVideo.ts` — MP4/GIF via MediaRecorder + FFmpeg.
- Quality: `low`/`medium`/`high` per layer.

## Share URL

Scene serialized as base64 JSON; demo media stripped to keep URLs short. 16KB URL length guard. Invalid payloads are normalized via `normalizeScene`, never trusted blindly.

## Project structure

```
app/              Next.js router (layout, page, error boundary)
components/editor/ 13 React components (EditorShell, ControlPanel, PreviewCanvas, ...)
lib/state/        Zustand stores, normalization, share URL, projects
lib/render/       Frame specs, CSS/canvas geometry, video timeline
lib/export/       PNG, MP4/GIF export, canvas rendering
lib/media/        File loading, demo image, palette extraction
lib/presets/      Background swatches, scene style presets
lib/types/        TypeScript interfaces
public/devices/   SVG device skins for overlay frames
tests/unit/       Vitest (mirrors lib/ structure)
tests/e2e/        Playwright (42 tests in editor.spec.ts)
```

## Testing

- `npm run test` — Vitest (165 tests, 16 files)
- `npm run test:e2e` — Playwright (requires browser install, needs dev server)
- Pure functions (normalization, frames, palette, video timeline) should be tested without mocks.
- Use `vi.stubGlobal` or `vi.stubEnv` for browser APIs / localStorage.

## Code style

- Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`)
- 2-space indent, double quotes, semicolons
- ESLint: `npm run lint` (Next.js core-web-vitals config)
- TypeScript strict: run `npm run typecheck` before committing
- All new features must include corresponding tests

## Important files to modify together

- When adding a frame/styles/animation preset: update `frames.ts`, `normalizeScene.ts`, `mockupRenderer.ts`, `renderMockup.ts`, and the matching test file **in the same change**.
- State shape changes: update `lib/types/editor.ts`, `editorStore.ts`, `normalizeScene.ts`, and add tests.
