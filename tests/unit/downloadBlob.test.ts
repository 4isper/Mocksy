import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadBlob } from "@/lib/export/downloadBlob";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("downloadBlob", () => {
  it("creates an anchor, clicks it, and revokes the URL", () => {
    const link = { href: "", download: "", click: vi.fn() };
    vi.stubGlobal("document", {
      createElement: (tag: string) => (tag === "a" ? link : undefined)
    });
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.useFakeTimers();

    const blob = new Blob(["hi"], { type: "text/plain" });
    downloadBlob(blob, "result.txt");

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(link.href).toBe("blob:mock");
    expect(link.download).toBe("result.txt");
    expect(link.click).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5000);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });
});
