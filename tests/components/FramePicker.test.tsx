// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FramePicker } from "@/components/editor/FramePicker";
import { FRAME_ORDER, FRAME_SPECS } from "@/lib/render/frames";

afterEach(() => cleanup());

describe("FramePicker", () => {
  it("renders all frame options plus the custom upload cell as radio buttons", () => {
    render(<FramePicker value="none" onChange={() => {}} />);
    const radios = screen.getAllByRole("radio");
    expect(radios.length).toBe(FRAME_ORDER.length + 1);
    expect(screen.getByText("frame.iphone")).toBeInTheDocument();
    expect(screen.getByText("frame.macbook")).toBeInTheDocument();
    expect(screen.getByText("frame.watch")).toBeInTheDocument();
    expect(screen.getByText("frame.custom")).toBeInTheDocument();
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
    const cssOnlyCount = FRAME_ORDER.length - overlayCount;
    expect(container.querySelectorAll(".frame-picker-img").length).toBe(overlayCount);
    // CSS-only frames + the empty custom upload cell.
    expect(container.querySelectorAll(".frame-picker-device").length).toBe(cssOnlyCount + 1);
  });

  it("shows the uploaded skin and selects it when clicked", async () => {
    const onChange = vi.fn();
    const onRemoveCustom = vi.fn();
    render(
      <FramePicker
        value="iphone"
        onChange={onChange}
        customFrame={{ id: "custom-1", asset: "data:image/svg+xml;base64,c3Zn", name: "phone.svg", viewBox: { w: 400, h: 600 }, cutout: { x: 0, y: 0, w: 400, h: 600, rx: 0 } }}
        onRemoveCustom={onRemoveCustom}
      />
    );
    const custom = screen.getByRole("radio", { name: "phone.svg" });
    expect(custom).toBeInTheDocument();
    await userEvent.click(custom);
    expect(onChange).toHaveBeenCalledWith("custom");
  });

  it("triggers the file input when the empty custom cell is clicked", async () => {
    const { container } = render(<FramePicker value="none" onChange={() => {}} />);
    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    const click = vi.spyOn(input, "click");
    await userEvent.click(screen.getByRole("radio", { name: "frame.custom" }));
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("uploads a file through onUploadCustom", async () => {
    const onUploadCustom = vi.fn();
    const { container } = render(<FramePicker value="none" onChange={() => {}} onUploadCustom={onUploadCustom} />);
    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    const file = new File(["<svg/>"], "skin.svg", { type: "image/svg+xml" });
    await userEvent.upload(input, file);
    expect(onUploadCustom).toHaveBeenCalledWith(file);
  });

  it("shows a remove button only while the custom frame is active", () => {
    const { container } = render(
      <FramePicker
        value="iphone"
        onChange={() => {}}
        customFrame={{ id: "custom-1", asset: "data:image/svg+xml;base64,c3Zn", name: "phone.svg", viewBox: { w: 400, h: 600 }, cutout: { x: 0, y: 0, w: 400, h: 600, rx: 0 } }}
        onRemoveCustom={() => {}}
      />
    );
    expect(screen.queryByText("editor.customFrameRemove")).not.toBeInTheDocument();
    const { container: activeContainer } = render(
      <FramePicker
        value="custom"
        onChange={() => {}}
        customFrame={{ id: "custom-1", asset: "data:image/svg+xml;base64,c3Zn", name: "phone.svg", viewBox: { w: 400, h: 600 }, cutout: { x: 0, y: 0, w: 400, h: 600, rx: 0 } }}
        onRemoveCustom={() => {}}
      />
    );
    expect(activeContainer.querySelectorAll("button").length).toBeGreaterThan(0);
    expect(activeContainer.textContent).toContain("editor.customFrameRemove");
  });
});
