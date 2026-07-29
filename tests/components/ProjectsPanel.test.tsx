// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectsPanel } from "@/components/editor/ProjectsPanel";
import { useProjectsStore } from "@/lib/state/projectsStore";

afterEach(() => {
  cleanup();
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

  it("deletes project on delete click", async () => {
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
    expect(useProjectsStore.getState().projects.length).toBe(1);
  });
});
