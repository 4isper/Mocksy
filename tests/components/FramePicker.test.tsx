// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FramePicker } from "@/components/editor/FramePicker";
import { FRAME_ORDER, FRAME_SPECS } from "@/lib/render/frames";

afterEach(() => cleanup());

describe("FramePicker", () => {
  it("renders all frame options as radio buttons", () => {
    render(<FramePicker value="none" onChange={() => {}} />);
    const radios = screen.getAllByRole("radio");
    expect(radios.length).toBe(FRAME_ORDER.length);
    expect(screen.getByText("frame.iphone")).toBeInTheDocument();
    expect(screen.getByText("frame.macbook")).toBeInTheDocument();
    expect(screen.getByText("frame.watch")).toBeInTheDocument();
  });

  it("marks the selected frame as checked", () => {
    render(<FramePicker value="iphone" onChange={() => {}} />);
    expect(screen.getByRole("radio", { name: "frame.iphone" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "frame.none" })).toHaveAttribute("aria-checked", "false");
  });

  it("calls onChange with the clicked frame", async () => {
    const onChange = vi.fn();
    render(<FramePicker value="none" onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio", { name: "frame.desktop" }));
    expect(onChange).toHaveBeenCalledWith("desktop");
  });

  it("renders SVG thumbnails for overlay frames and silhouettes for CSS-only frames", () => {
    const { container } = render(<FramePicker value="none" onChange={() => {}} />);
    const overlayCount = FRAME_ORDER.filter((f) => FRAME_SPECS[f]?.asset != null).length;
    expect(container.querySelectorAll(".frame-picker-img").length).toBe(overlayCount);
    expect(container.querySelectorAll(".frame-picker-device").length).toBe(FRAME_ORDER.length - overlayCount);
  });
});
