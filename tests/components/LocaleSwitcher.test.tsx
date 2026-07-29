// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocaleSwitcher } from "@/components/editor/LocaleSwitcher";
import { mockPathname, mockPush } from "./setup";

afterEach(cleanup);

describe("LocaleSwitcher", () => {
  it("renders both locale buttons", () => {
    render(<LocaleSwitcher />);
    expect(screen.getByText("EN")).toBeInTheDocument();
    expect(screen.getByText("РУС")).toBeInTheDocument();
  });

  it("marks the current locale as active", () => {
    render(<LocaleSwitcher />);
    const en = screen.getByRole("button", { name: "English" });
    const ru = screen.getByRole("button", { name: "Русский" });
    expect(en).toHaveAttribute("aria-pressed", "true");
    expect(ru).toHaveAttribute("aria-pressed", "false");
  });

  it("adds is-active class to current locale", () => {
    render(<LocaleSwitcher />);
    const en = screen.getByRole("button", { name: "English" });
    const ru = screen.getByRole("button", { name: "Русский" });
    expect(en.className).toContain("is-active");
    expect(ru.className).not.toContain("is-active");
  });

  it("navigates on locale switch click", async () => {
    mockPush.mockClear();
    render(<LocaleSwitcher />);
    await userEvent.click(screen.getByRole("button", { name: "Русский" }));
    expect(mockPush).toHaveBeenCalledWith("/ru");
  });

  it("falls back to en when pathname has no locale", () => {
    mockPathname.mockReturnValue("/");
    render(<LocaleSwitcher />);
    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Русский" })).toHaveAttribute("aria-pressed", "false");
  });
});
