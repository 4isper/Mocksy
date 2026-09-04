// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

  it("disables individual options without affecting the rest", () => {
    const onChange = vi.fn();
    render(
      <Segmented
        label="Quality"
        value="low"
        options={[{ value: "low", label: "Low" }, { value: "medium", label: "Medium", disabled: true }, { value: "high", label: "High" }]}
        onChange={onChange}
      />
    );
    expect(screen.getByText("Medium").closest("button")).toBeDisabled();
    expect(screen.getByText("High").closest("button")).toBeEnabled();
    screen.getByText("High").click();
    expect(onChange).toHaveBeenCalledWith("high");
  });
});

describe("Segmented keyboard navigation", () => {
  const options = [{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }];

  function group() {
    return screen.getByText("Low").closest('[role="group"]') as HTMLDivElement;
  }

  it("ignores non-arrow keys", () => {
    render(<Segmented label="Quality" value="low" options={options} onChange={vi.fn()} />);
    const preventDefault = vi.fn();
    fireEvent.keyDown(group(), { key: "a", preventDefault });
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("moves focus right with ArrowRight", () => {
    render(<Segmented label="Quality" value="low" options={options} onChange={vi.fn()} />);
    (screen.getByText("Low").closest("button") as HTMLButtonElement).focus();
    fireEvent.keyDown(group(), { key: "ArrowRight" });
    expect(document.activeElement).toBe(screen.getByText("Medium").closest("button"));
  });

  it("moves focus left with ArrowLeft", () => {
    render(<Segmented label="Quality" value="low" options={options} onChange={vi.fn()} />);
    (screen.getByText("High").closest("button") as HTMLButtonElement).focus();
    fireEvent.keyDown(group(), { key: "ArrowLeft" });
    expect(document.activeElement).toBe(screen.getByText("Medium").closest("button"));
  });

  it("wraps around at the edges", () => {
    render(<Segmented label="Quality" value="low" options={options} onChange={vi.fn()} />);
    (screen.getByText("High").closest("button") as HTMLButtonElement).focus();
    const g = group();
    fireEvent.keyDown(g, { key: "ArrowRight" });
    expect(document.activeElement).toBe(screen.getByText("Low").closest("button"));
    fireEvent.keyDown(g, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(screen.getByText("High").closest("button"));
  });

  it("skips disabled options while navigating", () => {
    render(
      <Segmented
        label="Quality"
        value="low"
        options={[{ value: "low", label: "Low" }, { value: "medium", label: "Medium", disabled: true }, { value: "high", label: "High" }]}
        onChange={vi.fn()}
      />
    );
    (screen.getByText("Low").closest("button") as HTMLButtonElement).focus();
    fireEvent.keyDown(group(), { key: "ArrowRight" });
    expect(document.activeElement).toBe(screen.getByText("High").closest("button"));
  });

  it("does nothing when every option is disabled", () => {
    render(<Segmented label="Quality" value="low" options={[{ value: "low", label: "Low", disabled: true }]} onChange={vi.fn()} />);
    fireEvent.keyDown(group(), { key: "ArrowRight" });
    expect(document.activeElement).toBe(document.body);
  });
});