// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach } from "vitest";
import { PreviewOverlays } from "@/components/editor/PreviewOverlays";
import { initialScene } from "@/lib/state/editorStore";
import { makeAnnotation } from "@/lib/state/editorHelpers";

afterEach(() => {
  cleanup();
});

describe("PreviewOverlays", () => {
  it("paints above the single-frame device so blur samples the screen, not the background", () => {
    const canvas = document.createElement("div");
    const canvasRef = { current: canvas } as React.RefObject<HTMLDivElement | null>;
    const scene = {
      ...initialScene,
      annotations: [{ ...makeAnnotation("blur"), id: "b1" }]
    };
    const { container } = render(
      <PreviewOverlays
        scene={scene}
        canvasRef={canvasRef}
        selectedAnnotationId={null}
        selectedAnnotationIds={[]}
        showGrid={false}
        gridDivisions={12}
        guides={[]}
        onSelectAnnotation={() => {}}
        onUpdateAnnotation={() => {}}
        onRemoveAnnotation={() => {}}
        onSelectMany={() => {}}
        onGuides={() => {}}
      />
    );
    // The translate centering creates a stacking context at level 0, which the
    // single-frame device (zIndex 1) would otherwise paint above. An explicit
    // level keeps annotations on top in both single and multi modes, matching
    // the canvas/SVG/HTML exporters.
    const overlay = container.firstChild as HTMLElement;
    expect(overlay.style.zIndex).toBe("2");
  });
});
