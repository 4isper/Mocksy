// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SkipLink } from "@/components/editor/SkipLink";

afterEach(() => {
  cleanup();
});

describe("SkipLink", () => {
  it("renders a skip-to-content link", () => {
    render(<SkipLink />);
    const link = screen.getByRole("link", { name: /skip to content/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "#main-content");
  });

  it("focuses the main content when clicked", () => {
    document.body.innerHTML = '<div id="main-content" tabindex="-1">Main</div>';
    render(<SkipLink />);
    const link = screen.getByRole("link", { name: /skip to content/i });
    link.click();
    expect(document.getElementById("main-content")).toHaveFocus();
  });
});