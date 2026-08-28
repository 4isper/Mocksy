// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ShareQrDialog } from "@/components/editor/ShareQrDialog";

describe("ShareQrDialog", () => {
  it("renders nothing without a URL", () => {
    const { container } = render(<ShareQrDialog url={null} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a QR SVG for the URL and closes via the button", () => {
    const onClose = vi.fn();
    render(<ShareQrDialog url="https://mocksy.test/?scene=z.abc" onClose={onClose} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("dialog").querySelector("svg")).not.toBeNull();

    fireEvent.click(screen.getByRole("dialog").querySelector("button")!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<ShareQrDialog url="https://mocksy.test/" onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
