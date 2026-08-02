import type { Command, Project } from "@/lib/types/editor";

export function createProjectCommands(
  t: (key: string, values?: Record<string, string | number | Date>) => string,
  projects: Project[],
  activeProjectId: string | null,
  callbacks: {
    switchProject: (id: string) => void;
  }
): Command[] {
  const { switchProject } = callbacks;
  return projects.map(project => ({
    id: `project-switch-${project.id}`,
    label: t("commandPalette.switchProject", { name: project.name }),
    description: project.id === activeProjectId ? t("commandPalette.current") : t("commandPalette.updated", { date: new Date(project.updatedAt).toLocaleDateString() }),
    keywords: ["project", "switch", "open", project.name.toLowerCase()],
    action: () => switchProject(project.id),
    disabled: project.id === activeProjectId,
  }));
}