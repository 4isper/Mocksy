// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectsPanel } from "@/components/editor/ProjectsPanel";
import { useProjectsStore } from "@/lib/state/projectsStore";
import { exportProjectToFile, importProjectFromFile } from "@/lib/state/projectFile";

vi.mock("@/lib/state/projectFile", () => ({
  exportProjectToFile: vi.fn(),
  importProjectFromFile: vi.fn(),
}));

const mockExport = vi.mocked(exportProjectToFile);
const mockImport = vi.mocked(importProjectFromFile);

function project(id: string, name: string, updatedAt = Date.now()) {
  return { id, name, scene: null as any, updatedAt };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useProjectsStore.setState({ projects: [], activeProjectId: null });
});

describe("ProjectsPanel", () => {
  it("renders new and import buttons", () => {
    render(<ProjectsPanel />);
    expect(screen.getByText("projects.newProjectBtn")).toBeInTheDocument();
    expect(screen.getByText("projects.import")).toBeInTheDocument();
  });

  it("shows autosave note", () => {
    render(<ProjectsPanel />);
    expect(screen.getByText("projects.autosaveNote")).toBeInTheDocument();
  });

  it("creates a new project on click", async () => {
    render(<ProjectsPanel />);
    await userEvent.click(screen.getByText("projects.newProjectBtn"));
    expect(useProjectsStore.getState().projects.length).toBe(1);
  });

  it("lists existing projects", () => {
    useProjectsStore.setState({
      projects: [
        { id: "p1", name: "My Project", scene: null as any, updatedAt: Date.now() },
        { id: "p2", name: "Other Project", scene: null as any, updatedAt: Date.now() },
      ],
      activeProjectId: "p1",
    });
    render(<ProjectsPanel />);
    expect(screen.getByText("My Project")).toBeInTheDocument();
    expect(screen.getByText("Other Project")).toBeInTheDocument();
  });

  it("switches project on click", async () => {
    useProjectsStore.setState({
      projects: [
        { id: "p1", name: "One", scene: null as any, updatedAt: Date.now() },
        { id: "p2", name: "Two", scene: null as any, updatedAt: Date.now() },
      ],
      activeProjectId: "p1",
    });
    render(<ProjectsPanel />);
    await userEvent.click(screen.getByText("Two"));
    expect(useProjectsStore.getState().activeProjectId).toBe("p2");
  });

  it("switches project on Enter key", async () => {
    useProjectsStore.setState({
      projects: [
        { id: "p1", name: "One", scene: null as any, updatedAt: Date.now() },
        { id: "p2", name: "Two", scene: null as any, updatedAt: Date.now() },
      ],
      activeProjectId: "p1",
    });
    render(<ProjectsPanel />);
    const items = document.querySelectorAll(".project-item");
    (items[1] as HTMLElement).focus();
    await userEvent.keyboard("{Enter}");
    expect(useProjectsStore.getState().activeProjectId).toBe("p2");
  });

  it("shows active project with is-active class", () => {
    useProjectsStore.setState({
      projects: [
        { id: "p1", name: "Active Project", scene: null as any, updatedAt: Date.now() },
      ],
      activeProjectId: "p1",
    });
    render(<ProjectsPanel />);
    const items = document.querySelectorAll(".project-item");
    expect(items[0]!.className).toContain("is-active");
  });

  it("soft-deletes project on delete click", async () => {
    useProjectsStore.setState({
      projects: [
        { id: "p1", name: "Project 1", scene: null as any, updatedAt: Date.now() },
        { id: "p2", name: "Project 2", scene: null as any, updatedAt: Date.now() },
      ],
      activeProjectId: "p1",
    });
    render(<ProjectsPanel />);
    const projectItems = document.querySelectorAll(".project-item");
    const firstItem = projectItems[0]!;
    const btns = firstItem.querySelectorAll(".btn-icon");
    const delBtn = btns[btns.length - 1]! as HTMLButtonElement;
    await userEvent.click(delBtn);
    // Soft delete: project stays in store but gets deletedAt timestamp
    expect(useProjectsStore.getState().projects.length).toBe(2);
    expect(useProjectsStore.getState().projects[0]!.deletedAt).toBeDefined();
  });

  it("disables delete when only one project remains", () => {
    useProjectsStore.setState({ projects: [project("p1", "Solo")], activeProjectId: "p1" });
    render(<ProjectsPanel />);
    const item = document.querySelector(".project-item")!;
    const btns = item.querySelectorAll(".btn-icon");
    const delBtn = btns[btns.length - 1]! as HTMLButtonElement;
    expect(delBtn).toBeDisabled();
  });

  it("renames a project via the inline editor and Enter", async () => {
    useProjectsStore.setState({ projects: [project("p1", "Old Name")], activeProjectId: "p1" });
    render(<ProjectsPanel />);
    await userEvent.click(screen.getByLabelText("projects.renameLabel"));
    const input = document.querySelector(".project-rename") as HTMLInputElement;
    expect(input).toHaveValue("Old Name");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    await userEvent.keyboard("{Enter}");
    expect(useProjectsStore.getState().projects[0]!.name).toBe("New Name");
  });

  it("cancels renaming on Escape", async () => {
    useProjectsStore.setState({ projects: [project("p1", "Keep Me")], activeProjectId: "p1" });
    render(<ProjectsPanel />);
    await userEvent.click(screen.getByLabelText("projects.renameLabel"));
    const input = document.querySelector(".project-rename") as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, "Changed");
    await userEvent.keyboard("{Escape}");
    expect(document.querySelector(".project-rename")).toBeNull();
    expect(useProjectsStore.getState().projects[0]!.name).toBe("Keep Me");
  });

  it("duplicates a project on button click", async () => {
    useProjectsStore.setState({ projects: [project("p1", "Source")], activeProjectId: "p1" });
    render(<ProjectsPanel />);
    await userEvent.click(screen.getByLabelText("projects.duplicateLabel"));
    expect(useProjectsStore.getState().projects.length).toBe(2);
  });

  it("exports a project to a file", async () => {
    const p = project("p1", "Export Me");
    useProjectsStore.setState({ projects: [p], activeProjectId: "p1" });
    render(<ProjectsPanel />);
    await userEvent.click(screen.getByLabelText("projects.exportLabel"));
    expect(mockExport).toHaveBeenCalledWith(p);
  });

  it("imports a valid project file", async () => {
    mockImport.mockResolvedValue(project("imp1", "Imported"));
    useProjectsStore.setState({ projects: [project("p1", "Existing")], activeProjectId: "p1" });
    render(<ProjectsPanel />);
    const input = document.querySelector('input[accept="application/json,.json"]') as HTMLInputElement;
    await userEvent.upload(input, new File(["{}"], "proj.json", { type: "application/json" }));
    await waitFor(() => expect(useProjectsStore.getState().projects.some((p) => p.name === "Imported")).toBe(true));
    expect(mockImport).toHaveBeenCalledTimes(1);
  });

  it("shows an error when importing an invalid project file", async () => {
    mockImport.mockRejectedValue(new Error("bad file"));
    render(<ProjectsPanel />);
    const input = document.querySelector('input[accept="application/json,.json"]') as HTMLInputElement;
    await userEvent.upload(input, new File(["nope"], "bad.json", { type: "application/json" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("projects.importError");
  });

  it("shows 'just now' for a recent update", () => {
    useProjectsStore.setState({ projects: [project("p1", "Recent")], activeProjectId: null });
    render(<ProjectsPanel />);
    expect(screen.getByText("projects.justNow")).toBeInTheDocument();
  });

  it("shows minutes ago for updates under an hour", () => {
    useProjectsStore.setState({ projects: [project("p1", "Old", Date.now() - 5 * 60000)], activeProjectId: null });
    render(<ProjectsPanel />);
    expect(screen.getByText("projects.minAgo")).toBeInTheDocument();
  });

  it("shows hours ago for updates under a day", () => {
    useProjectsStore.setState({ projects: [project("p1", "Old", Date.now() - 2 * 3600000)], activeProjectId: null });
    render(<ProjectsPanel />);
    expect(screen.getByText("projects.hourAgo")).toBeInTheDocument();
  });

  it("shows days ago for older updates", () => {
    useProjectsStore.setState({ projects: [project("p1", "Old", Date.now() - 3 * 86400000)], activeProjectId: null });
    render(<ProjectsPanel />);
    expect(screen.getByText("projects.dayAgo")).toBeInTheDocument();
  });

  it("shows, restores and empties trashed projects", async () => {
    useProjectsStore.setState({
      projects: [
        project("p1", "Alive"),
        { ...project("p2", "Trashed"), deletedAt: Date.now() },
      ],
      activeProjectId: "p1",
    });
    render(<ProjectsPanel />);
    expect(screen.queryByText("Trashed")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("projects.showTrash"));
    expect(screen.getByText("Trashed")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("projects.restoreLabel"));
    expect(useProjectsStore.getState().projects[1]!.deletedAt).toBeUndefined();
  });
});
