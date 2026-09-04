// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TrashSection } from "@/components/editor/TrashSection";
import { initialScene } from "@/lib/state/editorScene";
import type { Project } from "@/lib/types/editor";

function makeProject(id: string, name: string, updatedAt: number): Project {
  return { id, name, scene: { ...initialScene }, updatedAt };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TrashSection", () => {
  const baseProps = {
    trashed: [makeProject("p1", "Old site", 1000), makeProject("p2", "Logo draft", 2000)],
    relativeTime: vi.fn((ts: number) => `recent(${ts})`),
    onRestore: vi.fn(),
    onEmptyTrash: vi.fn(),
  };

  it("renders nothing when the trash is empty", () => {
    const { container } = render(<TrashSection {...baseProps} trashed={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the trash toggle with a count and lists projects when expanded", () => {
    render(<TrashSection {...baseProps} />);
    const toggle = screen.getByRole("button", { name: /projects.showTrash/ });
    expect(toggle).toHaveTextContent("projects.showTrash");
    fireEvent.click(toggle);
    expect(screen.getByText("Old site")).toBeInTheDocument();
    expect(screen.getByText("Logo draft")).toBeInTheDocument();
    expect(screen.getByText("recent(1000)")).toBeInTheDocument();
    expect(screen.getByText("recent(2000)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /projects.hideTrash/ }));
    expect(screen.queryByText("Old site")).not.toBeInTheDocument();
  });

  it("restores a project by id", () => {
    render(<TrashSection {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /projects.showTrash/ }));
    const restoreButtons = screen.getAllByRole("button", { name: /projects.restoreLabel/ });
    fireEvent.click(restoreButtons[0]!);
    expect(baseProps.onRestore).toHaveBeenCalledWith("p1");
  });

  it("opens the empty-trash modal and confirms", () => {
    render(<TrashSection {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /projects.emptyTrash/ }));
    expect(screen.getByRole("dialog", { name: /projects.emptyTrashConfirm_title/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /projects.emptyTrashConfirm_confirm/ }));
    expect(baseProps.onEmptyTrash).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("cancels the empty-trash modal", () => {
    render(<TrashSection {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /projects.emptyTrash/ }));
    fireEvent.click(screen.getByRole("button", { name: /projects.emptyTrashConfirm_cancel/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(baseProps.onEmptyTrash).not.toHaveBeenCalled();
  });

  it("closes the modal on Escape", () => {
    render(<TrashSection {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /projects.emptyTrash/ }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the modal on backdrop click", () => {
    render(<TrashSection {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /projects.emptyTrash/ }));
    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement!;
    fireEvent.click(backdrop);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the modal open when clicking inside it", () => {
    render(<TrashSection {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /projects.emptyTrash/ }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});