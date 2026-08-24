"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import type { CustomFrame, MockupFrame } from "@/lib/types/editor";
import { FRAME_ORDER, getFrameSpec } from "@/lib/render/frames";
import { parseAspectRatioOr } from "@/lib/render/aspectRatio";

interface FramePickerProps {
  value: MockupFrame;
  onChange: (frame: MockupFrame) => void;
  customFrame?: CustomFrame | null;
  onUploadCustom?: (file: File) => void;
  onRemoveCustom?: () => void;
}

function ratioParts(aspectRatio: string | null): [number, number] {
  const { w, h } = parseAspectRatioOr(aspectRatio ?? "1 / 1");
  return [w, h];
}

export function FramePicker({ value, onChange, customFrame, onUploadCustom, onRemoveCustom }: FramePickerProps) {
  const t = useTranslations();
  const fileRef = useRef<HTMLInputElement>(null);
  const customActive = value === "custom";
  const [cw, ch] = customFrame ? [customFrame.viewBox.w, customFrame.viewBox.h] : [1, 1];

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
      <button
        type="button"
        role="radio"
        aria-checked={customActive}
        aria-label={customFrame ? customFrame.name : t("frame.custom")}
        className={`frame-picker-cell${customActive ? " is-active" : ""}`}
        title={customFrame ? t("editor.customFrameUse") : t("editor.customFrameUpload")}
        onClick={() => {
          if (customFrame) onChange("custom");
          else fileRef.current?.click();
        }}
      >
        {customFrame ? (
          <img
            className="frame-picker-img"
            src={customFrame.asset}
            alt=""
            height={32}
            style={{ aspectRatio: `${cw} / ${ch}` }}
          />
        ) : (
          <span
            className="frame-picker-device is-custom"
            style={{ aspectRatio: `${cw} / ${ch}`, height: 30 }}
            aria-hidden="true"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 3v8M3 7h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </span>
        )}
        <span className="frame-picker-label">
          {customFrame ? customFrame.name.replace(/\.svg$/i, "") : t("frame.custom")}
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".svg,image/svg+xml"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUploadCustom?.(file);
          e.target.value = "";
        }}
      />
      {customFrame && customActive ? (
        <button type="button" className="btn btn-sm" onClick={() => onRemoveCustom?.()}>
          {t("editor.customFrameRemove")}
        </button>
      ) : null}
    </div>
  );
}
