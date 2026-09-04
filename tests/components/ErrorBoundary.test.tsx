// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ErrorBoundary, LocalizedErrorBoundary } from "@/components/editor/ErrorBoundary";

afterEach(cleanup);

describe("ErrorBoundary", () => {
  it("renders children when no error", () => {
    render(<ErrorBoundary><span>hello</span></ErrorBoundary>);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("renders default fallback on error", () => {
    const Bomb = () => { throw new Error("💥"); };
    render(<ErrorBoundary><Bomb /></ErrorBoundary>);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders custom fallback when provided", () => {
    const Bomb = () => { throw new Error("💥"); };
    render(<ErrorBoundary fallback={<div>custom error</div>}><Bomb /></ErrorBoundary>);
    expect(screen.getByText("custom error")).toBeInTheDocument();
  });

  it("renders retry button in default fallback", () => {
    const Bomb = () => { throw new Error("💥"); };
    render(<ErrorBoundary><Bomb /></ErrorBoundary>);
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("recovers and re-renders children after clicking retry", () => {
    let shouldThrow = true;
    const Bomb = () => {
      if (shouldThrow) throw new Error("boom");
      return <span>recovered</span>;
    };
    render(<ErrorBoundary><Bomb /></ErrorBoundary>);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByText("recovered")).toBeInTheDocument();
  });

  it("renders a custom message and retry label", () => {
    const Bomb = () => { throw new Error("x"); };
    render(<ErrorBoundary message="Custom msg" retryLabel="Try again"><Bomb /></ErrorBoundary>);
    expect(screen.getByText("Custom msg")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("logs the caught error with its component stack", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const Bomb = () => { throw new Error("logged"); };
    render(<ErrorBoundary><Bomb /></ErrorBoundary>);
    expect(spy).toHaveBeenCalledWith("[ErrorBoundary]", expect.any(Error), expect.any(String));
    spy.mockRestore();
  });

  it("passes translated strings down via LocalizedErrorBoundary", () => {
    const Bomb = () => { throw new Error("x"); };
    render(<LocalizedErrorBoundary><Bomb /></LocalizedErrorBoundary>);
    expect(screen.getByText("message")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "tryAgain" })).toBeInTheDocument();
  });
});
