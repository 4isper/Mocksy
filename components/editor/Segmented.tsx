"use client";

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false
}: {
  label?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="field">
      {label ? <span>{label}</span> : null}
      <div className="segmented" role="group" aria-label={label}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={value === opt.value}
            className={value === opt.value ? "is-active" : undefined}
            disabled={disabled}
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
