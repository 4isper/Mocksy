"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";
import { highlightMatch, matchQuery, scoreMatch } from "@/lib/search/matchCommand";
import type { Command } from "@/lib/types/editor";

export type { Command };

const CATEGORY_ORDER = [
  "file",
  "edit",
  "frame",
  "style",
  "background",
  "aspect",
  "layer",
  "annotation",
  "watermark",
  "export",
  "project",
  "theme",
  "view"
] as const;

function HighlightedLabel({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightMatch(text, query).map((seg, i) =>
        seg.matched ? (
          <mark key={i} className="command-palette-match">
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  );
}

export function CommandPalette({
  commands,
  isOpen,
  onClose,
  onSearchChange
}: {
  commands: Command[];
  isOpen: boolean;
  onClose: () => void;
  onSearchChange?: (query: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const t = useTranslations();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const trapRef = useFocusTrap(isOpen);

  const filteredCommands = useMemo(() => {
    return commands
      .filter(c => !c.disabled && matchQuery(c, searchQuery))
      .sort((a, b) => scoreMatch(b, searchQuery) - scoreMatch(a, searchQuery));
  }, [commands, searchQuery]);

  const groups = useMemo(() => {
    const map = new Map<string, { cmd: Command; index: number }[]>();
    filteredCommands.forEach((cmd, index) => {
      const list = map.get(cmd.category) ?? [];
      list.push({ cmd, index });
      map.set(cmd.category, list);
    });
    const ordered: { category: string; items: { cmd: Command; index: number }[] }[] = CATEGORY_ORDER.filter(cat => map.has(cat)).map(cat => ({
      category: cat,
      items: map.get(cat)!
    }));
    for (const [category, items] of map) {
      if (!(CATEGORY_ORDER as readonly string[]).includes(category)) {
        ordered.push({ category, items });
      }
    }
    return ordered;
  }, [filteredCommands]);

  const prevOpenRef = useRef(isOpen);
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      setSearchQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
    prevOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const item = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement;
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, isOpen]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(Math.min(selectedIndex + 1, filteredCommands.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(Math.max(selectedIndex - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filteredCommands[selectedIndex];
      if (cmd) {
        cmd.action();
        onClose();
      }
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      setSelectedIndex((selectedIndex + 1) % filteredCommands.length);
      return;
    }
  }, [filteredCommands, onClose, selectedIndex]);

  const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  if (!isOpen) return null;

  return (
    <div className="command-palette-backdrop" role="presentation" onClick={onClose}>
      <div
        className="command-palette"
        ref={trapRef}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t("commandPalette.title")}
      >
        <div className="command-palette-header">
          <kbd className="command-palette-kbd">{isMac ? "⌘K" : "Ctrl+K"}</kbd>
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              onSearchChange?.(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder={t("commandPalette.searchPlaceholder")}
            className="command-palette-input"
            autoComplete="off"
            spellCheck={false}
            aria-label={t("commandPalette.searchLabel")}
            aria-controls="command-palette-list"
            aria-activedescendant={filteredCommands.length > 0 ? `command-option-${selectedIndex}` : undefined}
          />
          <kbd className="command-palette-kbd">⎋</kbd>
        </div>
        <div className="command-palette-list" ref={listRef} id="command-palette-list" role="listbox">
          {groups.length === 0 ? (
            <div className="command-palette-empty" role="option" aria-selected={false}>
              {t("commandPalette.noResults")}
            </div>
          ) : (
            groups.map(group => (
              <div
                key={group.category}
                className="command-palette-group"
                role="group"
                aria-label={t(`commandPalette.category.${group.category}`)}
              >
                <div className="command-palette-group-label">
                  {t(`commandPalette.category.${group.category}`)}
                </div>
                {group.items.map(({ cmd, index }) => (
                  <button
                    key={cmd.id}
                    id={`command-option-${index}`}
                    type="button"
                    className={`command-palette-item ${index === selectedIndex ? "selected" : ""}`}
                    data-index={index}
                    onClick={() => {
                      cmd.action();
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    role="option"
                    aria-label={cmd.label}
                    aria-selected={index === selectedIndex}
                  >
                    <span className="command-palette-item-label">
                      <HighlightedLabel text={cmd.label} query={searchQuery} />
                    </span>
                    {cmd.description && (
                      <span className="command-palette-item-desc">{cmd.description}</span>
                    )}
                    {cmd.shortcut && (
                      <kbd className="command-palette-item-shortcut">{cmd.shortcut}</kbd>
                    )}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
        <div className="command-palette-footer">
          <span>{t("commandPalette.commandsAvailable", { count: filteredCommands.length })}</span>
          <span className="command-palette-footer-hint">{t("commandPalette.navHint")}</span>
        </div>
      </div>
    </div>
  );
}
