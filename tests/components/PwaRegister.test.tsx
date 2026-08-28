// @vitest-environment happy-dom
import { act } from "@testing-library/react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PwaRegister } from "@/components/editor/PwaRegister";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

type Listener = () => void;

/** ServiceWorkerContainer stub capturing controllerchange listeners. */
function stubServiceWorker({ controller }: { controller?: unknown } = {}) {
  const listeners: Record<string, Listener[]> = {};
  const update = vi.fn().mockResolvedValue(undefined);
  const register = vi.fn().mockResolvedValue({ update });
  const sw = {
    controller: controller ?? null,
    register,
    addEventListener: vi.fn((type: string, cb: Listener) => {
      (listeners[type] ??= []).push(cb);
    }),
    removeEventListener: vi.fn((type: string, cb: Listener) => {
      listeners[type] = (listeners[type] ?? []).filter((l) => l !== cb);
    })
  };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { serviceWorker: sw }
  });
  return {
    sw,
    register,
    update,
    fireControllerChange: () => (listeners.controllerchange ?? []).forEach((cb) => cb())
  };
}

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
}

async function renderAndSettle() {
  render(<PwaRegister />);
  // Flush the register() promise chain inside act so state settles.
  await act(async () => {});
}

describe("PwaRegister", () => {
  it("renders nothing by default", async () => {
    stubServiceWorker();
    const { container } = render(<PwaRegister />);
    await act(async () => {});
    expect(container.innerHTML).toBe("");
  });

  it("registers the service worker with bypassed caching", async () => {
    const { register } = stubServiceWorker();
    await renderAndSettle();
    expect(register).toHaveBeenCalledWith("/sw.js", { updateViaCache: "none" });
  });

  it("does not throw when service workers are unavailable", async () => {
    Object.defineProperty(globalThis.navigator, "serviceWorker", {
      configurable: true,
      get: () => undefined
    });
    expect(() => render(<PwaRegister />)).not.toThrow();
  });

  it("shows the reload banner when a newer worker takes control mid-session", async () => {
    // Page loaded while an old worker was controlling it: any later handover
    // is a deploy, and the page keeps running stale assets until reloaded.
    const { fireControllerChange } = stubServiceWorker({ controller: {} });
    await renderAndSettle();

    act(() => fireControllerChange());

    expect(screen.getByRole("status")).toHaveTextContent("updateReady");
    expect(screen.getByRole("button", { name: "reload" })).toBeInTheDocument();
  });

  it("suppresses the banner for the very first claim (no prior controller)", async () => {
    // First visit / hard refresh: claim() hands control to the initial worker
    // — nothing was updated, so no banner may appear.
    const { fireControllerChange } = stubServiceWorker({ controller: null });
    await renderAndSettle();

    act(() => fireControllerChange());
    act(() => fireControllerChange()); // a later handover IS an update

    expect(screen.getByRole("status")).toHaveTextContent("updateReady");
  });

  it("reloads the page when the banner button is pressed", async () => {
    const user = userEvent.setup();
    const reload = vi.fn();
    Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, reload } });
    const { fireControllerChange } = stubServiceWorker({ controller: {} });
    await renderAndSettle();
    act(() => fireControllerChange());

    await user.click(screen.getByRole("button", { name: "reload" }));

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("polls for a newer worker when the tab becomes visible, throttled", async () => {
    setVisibility("hidden");
    const { update } = stubServiceWorker();
    await renderAndSettle();
    // Hidden tab: the post-registration check is skipped entirely.
    expect(update).not.toHaveBeenCalled();

    setVisibility("visible");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(update).toHaveBeenCalledTimes(1);

    // An immediate repeat stays within the throttle window.
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(update).toHaveBeenCalledTimes(1);
  });
});
