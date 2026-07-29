// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ErrorBoundary } from "@/components/editor/ErrorBoundary";

afterEach(cleanup);

describe("ErrorBoundary", () => {
  it("renders children when no error", () => {
    render(<ErrorBoundary><span>hello</span></ErrorBoundary>);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("renders default fallback on error", () => {
    const Bomb = () => { throw new Error("💥"); };
    render(<ErrorBoundary><Bomb /></ErrorBoundary>);
    expect(screen.getByText("Something went wrong in the preview.")).toBeInTheDocument();
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
});
