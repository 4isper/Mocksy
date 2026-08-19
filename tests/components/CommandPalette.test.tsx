// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandPalette } from "@/components/editor/CommandPalette";
import type { Command } from "@/components/editor/CommandPalette";

function makeCommands(overrides?: Partial<Command>): Command[] {
  const base: Command = {
    id: "test-1",
    label: "Test Command",
    description: "A test command description",
    shortcut: "⌘T",
    keywords: ["test", "command", "demo"],
    category: "test",
    action: vi.fn(),
    ...overrides,
  };
  return [base];
}

afterEach(cleanup);

describe("CommandPalette", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <CommandPalette commands={[]} isOpen={false} onClose={vi.fn()} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders command list when open", () => {
    render(
      <CommandPalette commands={makeCommands()} isOpen={true} onClose={vi.fn()} />
    );
    expect(screen.getByText("Test Command")).toBeInTheDocument();
  });

  it("renders label, description and shortcut", () => {
    render(
      <CommandPalette commands={makeCommands()} isOpen={true} onClose={vi.fn()} />
    );
    expect(screen.getByText("Test Command")).toBeInTheDocument();
    expect(screen.getByText("A test command description")).toBeInTheDocument();
    expect(screen.getByText("⌘T")).toBeInTheDocument();
  });

  it("calls action and onClose on click", async () => {
    const action = vi.fn();
    const onClose = vi.fn();
    const cmds = makeCommands({ action });
    render(<CommandPalette commands={cmds} isOpen={true} onClose={onClose} />);
    await userEvent.click(screen.getByText("Test Command"));
    expect(action).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose on Escape", async () => {
    const onClose = vi.fn();
    render(<CommandPalette commands={makeCommands()} isOpen={true} onClose={onClose} />);
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("selects first command by default", () => {
    render(
      <CommandPalette commands={makeCommands()} isOpen={true} onClose={vi.fn()} />
    );
    const items = screen.getAllByRole("option");
    expect(items[0]).toHaveAttribute("aria-selected", "true");
  });

  it("navigates with ArrowDown and ArrowUp", async () => {
    const cmds: Command[] = [
      { id: "a", label: "Alpha", keywords: [], category: "test", action: vi.fn() },
      { id: "b", label: "Beta", keywords: [], category: "test", action: vi.fn() },
    ];
    render(<CommandPalette commands={cmds} isOpen={true} onClose={vi.fn()} />);
    const input = screen.getByRole("textbox");
    const items = screen.getAllByRole("option");
    expect(items[0]).toHaveAttribute("aria-selected", "true");
    await userEvent.type(input, "{ArrowDown}");
    expect(items[1]).toHaveAttribute("aria-selected", "true");
    await userEvent.type(input, "{ArrowUp}");
    expect(items[0]).toHaveAttribute("aria-selected", "true");
  });

  it("points aria-activedescendant at the selected option and tracks navigation", async () => {
    const cmds: Command[] = [
      { id: "a", label: "Alpha", keywords: [], category: "test", action: vi.fn() },
      { id: "b", label: "Beta", keywords: [], category: "test", action: vi.fn() },
    ];
    render(<CommandPalette commands={cmds} isOpen={true} onClose={vi.fn()} />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("aria-controls", "command-palette-list");
    expect(input).toHaveAttribute("aria-activedescendant", "command-option-0");
    await userEvent.type(input, "{ArrowDown}");
    expect(input).toHaveAttribute("aria-activedescendant", "command-option-1");
    await userEvent.type(input, "{ArrowUp}");
    expect(input).toHaveAttribute("aria-activedescendant", "command-option-0");
  });

  it("executes selected command on Enter", async () => {
    const a = vi.fn();
    const b = vi.fn();
    const cmds: Command[] = [
      { id: "a", label: "Alpha", keywords: [], category: "test", action: a },
      { id: "b", label: "Beta", keywords: [], category: "test", action: b },
    ];
    const onClose = vi.fn();
    render(<CommandPalette commands={cmds} isOpen={true} onClose={onClose} />);
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "{ArrowDown}{Enter}");
    expect(b).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("wraps selection with Tab", async () => {
    const cmds: Command[] = [
      { id: "a", label: "Alpha", keywords: [], category: "test", action: vi.fn() },
      { id: "b", label: "Beta", keywords: [], category: "test", action: vi.fn() },
    ];
    render(<CommandPalette commands={cmds} isOpen={true} onClose={vi.fn()} />);
    const input = screen.getByRole("textbox");
    const items = screen.getAllByRole("option");
    await userEvent.type(input, "{Tab}");
    expect(items[1]).toHaveAttribute("aria-selected", "true");
    await userEvent.type(input, "{Tab}");
    expect(items[0]).toHaveAttribute("aria-selected", "true");
  });

  it("filters commands by search query matching label", async () => {
    const cmds: Command[] = [
      { id: "a", label: "Apple", keywords: [], category: "test", action: vi.fn() },
      { id: "b", label: "Banana", keywords: [], category: "test", action: vi.fn() },
      { id: "c", label: "Cherry", keywords: [], category: "test", action: vi.fn() },
    ];
    render(<CommandPalette commands={cmds} isOpen={true} onClose={vi.fn()} />);
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "app");
    expect(screen.getByRole("option", { name: "Apple" })).toBeInTheDocument();
    expect(screen.queryByText("Banana")).not.toBeInTheDocument();
    expect(screen.queryByText("Cherry")).not.toBeInTheDocument();
  });

  it("filters commands by search query matching description", async () => {
    const cmds: Command[] = [
      { id: "a", label: "Foo", description: "export something", keywords: [], category: "test", action: vi.fn() },
      { id: "b", label: "Bar", description: "import something", keywords: [], category: "test", action: vi.fn() },
    ];
    render(<CommandPalette commands={cmds} isOpen={true} onClose={vi.fn()} />);
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "export");
    expect(screen.getByText("Foo")).toBeInTheDocument();
    expect(screen.queryByText("Bar")).not.toBeInTheDocument();
  });

  it("filters by keywords", async () => {
    const cmds: Command[] = [
      { id: "a", label: "One", keywords: ["alpha", "beta"], category: "test", action: vi.fn() },
      { id: "b", label: "Two", keywords: ["gamma", "delta"], category: "test", action: vi.fn() },
    ];
    render(<CommandPalette commands={cmds} isOpen={true} onClose={vi.fn()} />);
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "gamma");
    expect(screen.queryByText("One")).not.toBeInTheDocument();
    expect(screen.getByText("Two")).toBeInTheDocument();
  });

  it("sorts by relevance: label starts with > label includes > desc includes > keyword", async () => {
    const cmds: Command[] = [
      { id: "c", label: "Theme", description: "switch theme", keywords: ["dark", "light"], category: "test", action: vi.fn() },
      { id: "a", label: "Dark Theme", keywords: [], category: "test", action: vi.fn() },
      { id: "b", label: "Apply Theme", description: "theme preset", keywords: [], category: "test", action: vi.fn() },
    ];
    render(<CommandPalette commands={cmds} isOpen={true} onClose={vi.fn()} />);
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "theme");
    const items = screen.getAllByRole("option");
    expect(items[0]).toHaveTextContent("Theme");
    expect(items[1]).toHaveTextContent("Dark Theme");
    expect(items[2]).toHaveTextContent("Apply Theme");
  });

  it("hides disabled commands", () => {
    const cmds: Command[] = [
      { id: "a", label: "Enabled", keywords: [], category: "test", action: vi.fn() },
      { id: "b", label: "Disabled", keywords: [], category: "test", action: vi.fn(), disabled: true },
    ];
    render(<CommandPalette commands={cmds} isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText("Enabled")).toBeInTheDocument();
    expect(screen.queryByText("Disabled")).not.toBeInTheDocument();
  });

  it("shows empty state when no commands match", async () => {
    render(<CommandPalette commands={makeCommands()} isOpen={true} onClose={vi.fn()} />);
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "zzzzz");
    expect(screen.getByText("commandPalette.noResults")).toBeInTheDocument();
  });

  it("shows command count in footer", () => {
    const cmds: Command[] = [
      { id: "a", label: "One", keywords: [], category: "test", action: vi.fn() },
      { id: "b", label: "Two", keywords: [], category: "test", action: vi.fn() },
    ];
    render(<CommandPalette commands={cmds} isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText("commandPalette.commandsAvailable")).toBeInTheDocument();
  });

  it("resets search and selection on re-open", () => {
    const { rerender } = render(
      <CommandPalette commands={makeCommands()} isOpen={true} onClose={vi.fn()} />
    );
    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("");
    rerender(
      <CommandPalette commands={makeCommands()} isOpen={false} onClose={vi.fn()} />
    );
    rerender(
      <CommandPalette commands={makeCommands()} isOpen={true} onClose={vi.fn()} />
    );
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("renders category group headers", () => {
    const cmds: Command[] = [
      { id: "a", label: "Export PNG", category: "export", keywords: [], action: vi.fn() },
      { id: "b", label: "Undo", category: "edit", keywords: [], action: vi.fn() },
    ];
    render(<CommandPalette commands={cmds} isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText("commandPalette.category.export")).toBeInTheDocument();
    expect(screen.getByText("commandPalette.category.edit")).toBeInTheDocument();
  });

  it("groups commands under their category headers", () => {
    const cmds: Command[] = [
      { id: "a", label: "Undo", category: "edit", keywords: [], action: vi.fn() },
      { id: "b", label: "Export PNG", category: "export", keywords: [], action: vi.fn() },
    ];
    render(<CommandPalette commands={cmds} isOpen={true} onClose={vi.fn()} />);
    const exportHeader = screen.getByText("commandPalette.category.export");
    const exportItem = screen.getByText("Export PNG");
    expect(exportHeader.compareDocumentPosition(exportItem) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("highlights the matched substring in the label", async () => {
    const cmds: Command[] = [
      { id: "a", label: "Export PNG", category: "export", keywords: [], action: vi.fn() },
    ];
    render(<CommandPalette commands={cmds} isOpen={true} onClose={vi.fn()} />);
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "png");
    const mark = document.querySelector("mark.command-palette-match");
    expect(mark).toHaveTextContent("PNG");
  });

  it("renders the keyboard hint in the footer", () => {
    render(<CommandPalette commands={makeCommands()} isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText("commandPalette.navHint")).toBeInTheDocument();
  });
});
