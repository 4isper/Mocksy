// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WatermarkControls } from "@/components/editor/WatermarkControls";
import { loadMediaFromFile, UnsupportedMediaError } from "@/lib/media/loadFile";

vi.mock("@/lib/media/loadFile", () => ({
  loadMediaFromFile: vi.fn(),
  UnsupportedMediaError: class extends Error { name = "UnsupportedMediaError" },
}));

const mockLoad = vi.mocked(loadMediaFromFile);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const props = {
  watermarkEnabled: false,
  watermarkText: "Mocksy",
  watermarkPosition: "bottom-right" as const,
  watermarkSize: 16,
  watermarkImageUrl: null,
  toggleWatermark: vi.fn(),
  setWatermarkText: vi.fn(),
  setWatermarkPosition: vi.fn(),
  setWatermarkSize: vi.fn(),
  setWatermarkImage: vi.fn(),
};

describe("WatermarkControls", () => {

  it("renders watermark toggle", () => {
    render(<WatermarkControls {...props} />);
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("renders watermark text input", () => {
    render(<WatermarkControls {...props} />);
    const input = screen.getByDisplayValue("Mocksy");
    expect(input).toBeInTheDocument();
  });

  it("renders position select with all options", () => {
    render(<WatermarkControls {...props} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByText("editor.posBottomRight")).toBeInTheDocument();
    expect(screen.getByText("editor.posBottomLeft")).toBeInTheDocument();
    expect(screen.getByText("editor.posTopRight")).toBeInTheDocument();
    expect(screen.getByText("editor.posTopLeft")).toBeInTheDocument();
  });

  it("renders size slider", () => {
    render(<WatermarkControls {...props} />);
    const slider = screen.getByRole("slider");
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveValue("16");
  });

  it("calls toggleWatermark when checkbox is toggled", async () => {
    const toggleWatermark = vi.fn();
    render(<WatermarkControls {...props} toggleWatermark={toggleWatermark} />);
    await userEvent.click(screen.getByRole("checkbox"));
    expect(toggleWatermark).toHaveBeenCalledWith(true);
  });

  it("calls setWatermarkText when text input changes", () => {
    const setWatermarkText = vi.fn();
    render(<WatermarkControls {...props} setWatermarkText={setWatermarkText} />);
    const input = screen.getByDisplayValue("Mocksy") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "New Text" } });
    expect(setWatermarkText).toHaveBeenCalledWith("New Text");
  });

  it("shows an upload trigger when no logo is set", () => {
    render(<WatermarkControls {...props} />);
    expect(screen.getByText("editor.watermarkLogoUpload")).toBeInTheDocument();
    expect(screen.queryByText("editor.watermarkLogoRemove")).not.toBeInTheDocument();
  });

  it("shows the logo preview and remove button when a logo is set", () => {
    render(<WatermarkControls {...props} watermarkImageUrl="data:image/png;base64,LOGO" />);
    expect(screen.getByAltText("editor.watermarkLogoPreview")).toBeInTheDocument();
    expect(screen.getByText("editor.watermarkLogoReplace")).toBeInTheDocument();
    fireEvent.click(screen.getByText("editor.watermarkLogoRemove"));
    expect(props.setWatermarkImage).toHaveBeenCalledWith(null);
  });
});

describe("WatermarkControls logo upload", () => {
  function logoInput(): HTMLInputElement {
    return document.querySelector('input[type="file"]') as HTMLInputElement;
  }

  it("does nothing when no file is selected", async () => {
    const setWatermarkImage = vi.fn();
    render(<WatermarkControls {...props} setWatermarkImage={setWatermarkImage} />);
    await userEvent.upload(logoInput(), []);
    expect(mockLoad).not.toHaveBeenCalled();
    expect(setWatermarkImage).not.toHaveBeenCalled();
  });

  it("sets the watermark image on a successful upload and resets the input", async () => {
    mockLoad.mockResolvedValue({ url: "blob:logo", mediaType: "image", mediaName: "logo.png" });
    const setWatermarkImage = vi.fn();
    render(<WatermarkControls {...props} setWatermarkImage={setWatermarkImage} />);
    await userEvent.upload(logoInput(), new File(["x"], "logo.png", { type: "image/png" }));
    expect(mockLoad).toHaveBeenCalledTimes(1);
    expect(setWatermarkImage).toHaveBeenCalledWith("blob:logo");
    expect(logoInput().value).toBe("");
  });

  it("shows the unsupported-media message", async () => {
    mockLoad.mockRejectedValue(new UnsupportedMediaError("bad format"));
    render(<WatermarkControls {...props} />);
    await userEvent.upload(logoInput(), new File(["x"], "x.png", { type: "image/png" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("bad format");
  });

  it("shows a generic error for unexpected failures", async () => {
    mockLoad.mockRejectedValue(new Error("boom"));
    render(<WatermarkControls {...props} />);
    await userEvent.upload(logoInput(), new File(["x"], "x.png", { type: "image/png" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("editor.watermarkLogoError");
  });

  it("clears a previous error on the next successful upload", async () => {
    mockLoad.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({ url: "blob:ok", mediaType: "image", mediaName: "ok.png" });
    render(<WatermarkControls {...props} />);
    await userEvent.upload(logoInput(), new File(["x"], "x.png", { type: "image/png" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("editor.watermarkLogoError");
    await userEvent.upload(logoInput(), new File(["x"], "ok.png", { type: "image/png" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });
});