// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Segmented } from "@/components/editor/Segmented";

afterEach(() => {
  cleanup();
});

describe("Segmented", () => {
  it("renders label and options", () => {
    render(<Segmented label="Quality" value="medium" options={[{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }]} onChange={vi.fn()} />);
    expect(screen.getByText("Quality")).toBeInTheDocument();
    expect(screen.getByText("Low")).toBeInTheDocument();
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("marks the active option with is-active class", () => {
    render(<Segmented label="Quality" value="medium" options={[{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }]} onChange={vi.fn()} />);
    expect(screen.getByText("Medium").closest("button")).toHaveClass("is-active");
    expect(screen.getByText("Low").closest("button")).not.toHaveClass("is-active");
  });

  it("calls onChange when an option is clicked", () => {
    const onChange = vi.fn();
    render(<Segmented label="Quality" value="low" options={[{ value: "low", label: "Low" }, { value: "high", label: "High" }]} onChange={onChange} />);
    screen.getByText("High").click();
    expect(onChange).toHaveBeenCalledWith("high");
  });

  it("sets aria-pressed correctly", () => {
    render(<Segmented label="Quality" value="low" options={[{ value: "low", label: "Low" }, { value: "high", label: "High" }]} onChange={vi.fn()} />);
    expect(screen.getByText("Low").closest("button")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("High").closest("button")).toHaveAttribute("aria-pressed", "false");
  });
});