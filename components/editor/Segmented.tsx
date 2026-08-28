"use client";

import { useRef } from "react";

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false
}: {
  label?: string;
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  const groupRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const buttons = groupRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])");
    if (!buttons || buttons.length === 0) return;
    const indices = Array.from(buttons).map((b, i) => i);
    const activeIdx = indices.find((i) => buttons[i] === document.activeElement) ?? -1;
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const next = activeIdx < 0 ? 0 : (activeIdx + dir + indices.length) % indices.length;
    buttons[next]?.focus();
  };

  return (
    <div className="field">
      {label ? <span>{label}</span> : null}
      <div ref={groupRef} className="segmented" role="group" aria-label={label} onKeyDown={handleKeyDown}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={value === opt.value}
            tabIndex={value === opt.value ? 0 : -1}
            className={value === opt.value ? "is-active" : undefined}
            disabled={disabled || opt.disabled}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export { Segmented };
