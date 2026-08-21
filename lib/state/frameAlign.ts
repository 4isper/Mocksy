import type { CustomFrame, FrameInstance } from "@/lib/types/editor";
import { frameInstanceSize } from "@/lib/render/frames";

/** Ways to align frame instances: to the left/right/top/bottom edge of the
 *  group's bounding box, or on a shared horizontal/vertical center. */
export type FrameAlignMode = "left" | "centerX" | "right" | "top" | "centerY" | "bottom";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function instanceBoxes(
  instances: FrameInstance[],
  aspectRatio: string,
  customFrame: CustomFrame | null
): Box[] {
  return instances.map((inst) => {
    const size = frameInstanceSize(inst, customFrame, aspectRatio);
    return { x: inst.x - size.w / 2, y: inst.y - size.h / 2, w: size.w, h: size.h };
  });
}

/** Aligns every instance to one shared edge/center. Positions are centers
 *  (0..1 fractions), so each instance is shifted by half its own size after
 *  the target line is computed from the group's bounding box. Needs ≥2
 *  instances; otherwise the input is returned untouched. */
export function alignFrameInstances(
  instances: FrameInstance[],
  mode: FrameAlignMode,
  aspectRatio = "16 / 9",
  customFrame: CustomFrame | null = null
): FrameInstance[] {
  if (instances.length < 2) return instances;
  const boxes = instanceBoxes(instances, aspectRatio, customFrame);
  const minX = Math.min(...boxes.map((b) => b.x));
  const maxX = Math.max(...boxes.map((b) => b.x + b.w));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxY = Math.max(...boxes.map((b) => b.y + b.h));

  return instances.map((inst, i) => {
    const box = boxes[i]!;
    switch (mode) {
      case "left":
        return { ...inst, x: minX + box.w / 2 };
      case "right":
        return { ...inst, x: maxX - box.w / 2 };
      case "centerX":
        return { ...inst, x: (minX + maxX) / 2 };
      case "top":
        return { ...inst, y: minY + box.h / 2 };
      case "bottom":
        return { ...inst, y: maxY - box.h / 2 };
      case "centerY":
        return { ...inst, y: (minY + maxY) / 2 };
      default:
        return inst;
    }
  });
}

/** Distributes instances so the gaps between neighbouring boxes along `axis`
 *  are equal (first and last keep their position). Needs ≥3 instances;
 *  otherwise the input is returned untouched. */
export function distributeFrameInstances(
  instances: FrameInstance[],
  axis: "horizontal" | "vertical",
  aspectRatio = "16 / 9",
  customFrame: CustomFrame | null = null
): FrameInstance[] {
  if (instances.length < 3) return instances;
  const boxes = instanceBoxes(instances, aspectRatio, customFrame);
  const order = boxes
    .map((box, i) => ({ i, start: axis === "horizontal" ? box.x : box.y }))
    .sort((a, b) => a.start - b.start)
    .map((entry) => entry.i);

  const spanStart = axis === "horizontal"
    ? Math.min(...boxes.map((b) => b.x))
    : Math.min(...boxes.map((b) => b.y));
  const spanEnd = axis === "horizontal"
    ? Math.max(...boxes.map((b) => b.x + b.w))
    : Math.max(...boxes.map((b) => b.y + b.h));
  const totalSize = order.reduce((sum, i) => sum + (axis === "horizontal" ? boxes[i]!.w : boxes[i]!.h), 0);
  const gap = (spanEnd - spanStart - totalSize) / (order.length - 1);

  const next = [...instances];
  let cursor = spanStart;
  for (const i of order) {
    const box = boxes[i]!;
    const size = axis === "horizontal" ? box.w : box.h;
    if (axis === "horizontal") next[i] = { ...next[i]!, x: cursor + size / 2 };
    else next[i] = { ...next[i]!, y: cursor + size / 2 };
    cursor += size + gap;
  }
  return next;
}
