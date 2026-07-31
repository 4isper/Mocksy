"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";
import { matchQuery, scoreMatch } from "@/lib/search/matchCommand";
import type { Command } from "@/lib/types/editor";

export type { Command };

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
  const trapRef = useFocusTrap(isOpen, false);

  const filteredCommands = useMemo(() => {
    return commands
      .filter(c => !c.disabled && matchQuery(c, searchQuery))
      .sort((a, b) => scoreMatch(b, searchQuery) - scoreMatch(a, searchQuery));
  }, [commands, searchQuery]);

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
          <kbd className="command-palette-kbd">⌘K</kbd>
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
          />
          <kbd className="command-palette-kbd">⎋</kbd>
        </div>
        <div className="command-palette-list" ref={listRef} role="listbox">
          {filteredCommands.length === 0 ? (
            <div className="command-palette-empty" role="option" aria-selected={false}>
              {t("commandPalette.noResults")}
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => (
              <button
                key={cmd.id}
                type="button"
                className={`command-palette-item ${idx === selectedIndex ? "selected" : ""}`}
                data-index={idx}
                onClick={() => {
                  cmd.action();
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
                role="option"
                aria-selected={idx === selectedIndex}
              >
                <span className="command-palette-item-label">{cmd.label}</span>
                {cmd.description && (
                  <span className="command-palette-item-desc">{cmd.description}</span>
                )}
                {cmd.shortcut && (
                  <kbd className="command-palette-item-shortcut">{cmd.shortcut}</kbd>
                )}
              </button>
            ))
          )}
        </div>
        <div className="command-palette-footer">
          {t("commandPalette.commandsAvailable", { count: filteredCommands.length })}
        </div>
      </div>
    </div>
  );
}
