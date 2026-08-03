"use client";

import { useTranslations } from "next-intl";
import type { MockupFrame } from "@/lib/types/editor";
import { FRAME_ORDER, getFrameSpec } from "@/lib/render/frames";

interface FramePickerProps {
  value: MockupFrame;
  onChange: (frame: MockupFrame) => void;
}

function ratioParts(aspectRatio: string | null): [number, number] {
  if (!aspectRatio) return [1, 1];
  const [w, h] = aspectRatio.split("/").map((n) => Number(n.trim()));
  return [w || 1, h || 1];
}

export function FramePicker({ value, onChange }: FramePickerProps) {
  const t = useTranslations();

  return (
    <div className="frame-picker" role="radiogroup" aria-label={t("editor.frame")}>
      {FRAME_ORDER.map((frame) => {
        const spec = getFrameSpec(frame);
        const label = t(`frame.${frame}`);
        const active = frame === value;
        const [w, h] = ratioParts(spec.aspectRatio);
        const isTall = h > w;
        const radius = Math.min(spec.screenRadius * (30 / h), 8);

        return (
          <button
            key={frame}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            className={`frame-picker-cell${active ? " is-active" : ""}`}
            onClick={() => onChange(frame)}
          >
            {spec.asset ? (
              <img
                className="frame-picker-img"
                src={spec.asset}
                alt=""
                height={32}
                style={{ aspectRatio: `${w} / ${h}` }}
              />
            ) : (
              <span
                className={`frame-picker-device${frame === "none" ? " is-none" : ""}`}
                style={{ aspectRatio: `${w} / ${h}`, height: 30, borderRadius: radius }}
              >
                {isTall ? <span className="frame-picker-notch" aria-hidden="true" /> : null}
              </span>
            )}
            <span className="frame-picker-label">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
