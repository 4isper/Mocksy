// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { PwaRegister } from "@/components/editor/PwaRegister";

afterEach(() => {
  cleanup();
});

describe("PwaRegister", () => {
  it("renders null (no visible UI)", () => {
    const { container } = render(<PwaRegister />);
    expect(container.innerHTML).toBe("");
  });

  it("registers the service worker when available", async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { serviceWorker: { register } },
    });

    render(<PwaRegister />);
    await new Promise((r) => setTimeout(r, 0));
    expect(register).toHaveBeenCalledWith("/sw.js");
  });

  it("does not throw when service worker is unavailable", () => {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {},
    });
    expect(() => render(<PwaRegister />)).not.toThrow();
  });
});