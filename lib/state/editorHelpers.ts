// Barrel for state helpers, split into focused modules:
//   - history.ts        undo/redo history bookkeeping (pushHistory)
//   - layerHelpers.ts   annotation/layer factories and active-layer queries
//   - autoLayout.ts     multi-frame grid/fan/cascade/masonry/stack layout
// Re-exports keep every existing importer (slices, editorScene, tests) stable.
export * from "@/lib/state/history";
export * from "@/lib/state/layerHelpers";
export * from "@/lib/state/autoLayout";
