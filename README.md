# Mocksy

Free alternative to Shots-style mockup editor with no subscriptions.

Reference inspiration: [shots.so](https://shots.so/).

## Features

- 3-panel editor layout (controls, canvas preview, templates)
- Mockup styles (frame, glass styles, outline, shadows, radius)
- Preset templates and animation presets
- PNG export
- Video timeline export pipeline (animation keyframes)
- Local save + share URL
- No auth, no paywall, no subscription gates

## Stack

- Next.js 15 + TypeScript
- Zustand for editor state
- Tailwind-ready styling baseline
- Vitest + Playwright test setup

## Run

```bash
npm install
npm run dev
```

## Tests

```bash
npm run test
npm run test:e2e
```
